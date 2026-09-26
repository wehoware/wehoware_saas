/**
 * POST /api/v1/notifications/sync
 *
 * Checks for recent appointments that don't have corresponding
 * notifications and creates them retroactively.
 *
 * Syncs both:
 *  - appointment.booked (for new bookings)
 *  - appointment.cancelled / confirmed / completed / noshow (for status changes)
 *
 * This handles the case where a booking/status change was made through a
 * different server (e.g. production API) that doesn't have the notification
 * code, but the admin SaaS server shares the same database.
 *
 * Uses a per-client lock to prevent concurrent sync runs from creating
 * duplicate notifications.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId;
  return user.activeClientId ?? null;
}

// Per-client sync lock — prevents concurrent sync runs
const syncLocks = new Map();

const STATUS_EVENT_MAP = {
  Cancelled: "cancelled",
  Confirmed: "confirmed",
  Completed: "completed",
  NoShow: "noshow",
};

const EVENT_LABELS = {
  cancelled: "Cancelled",
  confirmed: "Confirmed",
  completed: "Completed",
  noshow: "No-Show",
};

export const POST = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "No client context resolved." },
          { status: 400 }
        );
      }

      // Prevent concurrent sync for the same client
      if (syncLocks.get(clientId)) {
        return NextResponse.json({ synced: 0, reason: "already_syncing" });
      }
      syncLocks.set(clientId, true);

      try {
        // 1. Find all users for this client
        const userClients = await prisma.wehowareUserClient.findMany({
          where: { clientId, active: true },
          select: { userId: true },
        });
        const userIds = userClients.map((uc) => uc.userId);
        if (userIds.length === 0) {
          return NextResponse.json({ synced: 0, reason: "no_users" });
        }

        // 2. Use a transaction to atomically read existing + create missing
        const result = await prisma.$transaction(async (tx) => {
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

          // --- Sync 1: Booked notifications ---
          // Find existing "appointment.booked" notification appointmentIds
          const existingBookedNotifs = await tx.wehowareNotification.findMany({
            where: { clientId, type: "appointment.booked" },
            select: { metadata: true },
          });
          const bookedApptIds = new Set(
            existingBookedNotifs
              .map((n) => n.metadata?.appointmentId)
              .filter(Boolean)
          );

          // Find appointments that don't have booking notifications (last 7 days, non-cancelled)
          const unnotifiedAppts = await tx.wehowareAppointment.findMany({
            where: {
              clientId,
              createdAt: { gte: sevenDaysAgo },
              status: { notIn: ["Cancelled"] },
            },
            include: { appointmentType: { select: { name: true } } },
            orderBy: { createdAt: "desc" },
            take: 50,
          });

          const missingBooked = unnotifiedAppts.filter(
            (a) => !bookedApptIds.has(a.id)
          );

          // --- Sync 2: Status-change notifications ---
          // Find existing status-change notification keys (type + appointmentId)
          const existingStatusNotifs = await tx.wehowareNotification.findMany({
            where: {
              clientId,
              type: {
                in: [
                  "appointment.cancelled",
                  "appointment.confirmed",
                  "appointment.completed",
                  "appointment.noshow",
                ],
              },
            },
            select: { type: true, metadata: true },
          });
          const statusNotifKeys = new Set(
            existingStatusNotifs.map(
              (n) => `${n.type}|${n.metadata?.appointmentId}`
            )
          );

          // Find appointments with status changes (last 7 days, non-pending/non-cancelled bookings)
          // We look at updatedAt to detect recent status changes
          const statusChangedAppts = await tx.wehowareAppointment.findMany({
            where: {
              clientId,
              updatedAt: { gte: sevenDaysAgo },
              status: { in: ["Cancelled", "Confirmed", "Completed", "NoShow"] },
            },
            include: { appointmentType: { select: { name: true } } },
            orderBy: { updatedAt: "desc" },
            take: 50,
          });

          // Filter to appointments that don't have the corresponding status notification
          const missingStatus = statusChangedAppts.filter((a) => {
            const eventType = `appointment.${STATUS_EVENT_MAP[a.status]}`;
            const key = `${eventType}|${a.id}`;
            return !statusNotifKeys.has(key);
          });

          if (missingBooked.length === 0 && missingStatus.length === 0) {
            return { synced: 0, notifications_created: 0 };
          }

          let created = 0;

          // Create booked notifications
          for (const appt of missingBooked) {
            const scheduledAt = appt.scheduledAt;
            const formattedDate = scheduledAt.toLocaleString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            });
            const apptType = appt.appointmentType?.name || "Appointment";
            const guestName = appt.guestName || "Guest";

            await tx.wehowareNotification.createMany({
              data: userIds.map((userId) => ({
                clientId,
                userId,
                type: "appointment.booked",
                title: `New appointment — ${guestName}`,
                message: `${apptType} with ${guestName} on ${formattedDate}`,
                link: "/admin/appointments",
                metadata: {
                  appointmentId: appt.id,
                  guestName,
                  guestEmail: appt.guestEmail,
                  appointmentType: apptType,
                  scheduledAt: scheduledAt.toISOString(),
                  synced: true,
                },
              })),
            });
            created += userIds.length;
          }

          // Create status-change notifications
          for (const appt of missingStatus) {
            const event = STATUS_EVENT_MAP[appt.status];
            const eventType = `appointment.${event}`;
            const scheduledAt = appt.scheduledAt;
            const formattedDate = scheduledAt.toLocaleString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            });
            const apptType = appt.appointmentType?.name || "Appointment";
            const guestName = appt.guestName || "Guest";
            const label = EVENT_LABELS[event] || "Updated";

            let message;
            switch (event) {
              case "cancelled":
                message = `${apptType} with ${guestName} on ${formattedDate} has been cancelled`;
                break;
              case "confirmed":
                message = `${apptType} with ${guestName} on ${formattedDate} has been confirmed`;
                break;
              case "completed":
                message = `${apptType} with ${guestName} on ${formattedDate} marked as completed`;
                break;
              case "noshow":
                message = `${apptType} with ${guestName} on ${formattedDate} marked as no-show`;
                break;
              default:
                message = `${apptType} with ${guestName} on ${formattedDate} has been updated`;
            }

            await tx.wehowareNotification.createMany({
              data: userIds.map((userId) => ({
                clientId,
                userId,
                type: eventType,
                title: `Appointment ${label.toLowerCase()} — ${guestName}`,
                message,
                link: "/admin/appointments",
                metadata: {
                  appointmentId: appt.id,
                  event,
                  guestName,
                  guestEmail: appt.guestEmail,
                  appointmentType: apptType,
                  scheduledAt: scheduledAt.toISOString(),
                  synced: true,
                },
              })),
            });
            created += userIds.length;
          }

          return {
            synced: missingBooked.length + missingStatus.length,
            notifications_created: created,
          };
        });

        return NextResponse.json({
          synced: result.synced,
          notifications_created: result.notifications_created,
        });
      } finally {
        syncLocks.delete(clientId);
      }
    } catch (err) {
      console.error("[POST /api/v1/notifications/sync] error:", err);
      return NextResponse.json(
        { error: "Failed to sync notifications" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
