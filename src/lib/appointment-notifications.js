/**
 * Appointment Notification Service
 *
 * Creates in-app notifications (read/unread) for the SaaS owner/admin
 * and sends email notifications when appointments are booked.
 *
 * In-app notifications are stored in the wehoware_notifications table
 * and surfaced via the bell icon in the admin header.
 */
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/ses.js";

/**
 * Find all admin/employee profiles for a client who should receive
 * appointment notifications. Returns array of { id, email, firstName, lastName }.
 */
async function getClientNotifyUsers(clientId) {
  // Primary: managers (highest ClientRole)
  const managers = await prisma.wehowareUserClient.findMany({
    where: {
      clientId,
      active: true,
      role: "manager",
    },
    select: {
      user: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
    },
  });

  const users = managers.map((uc) => uc.user).filter(Boolean);

  // Fallback: if no managers found, get all active users for the client
  if (users.length === 0) {
    const allUserClients = await prisma.wehowareUserClient.findMany({
      where: { clientId, active: true },
      select: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
    return allUserClients.map((uc) => uc.user).filter(Boolean);
  }

  return users;
}

/**
 * Get the client's contact email as a fallback recipient.
 */
async function getClientEmail(clientId) {
  const client = await prisma.wehowareClient.findUnique({
    where: { id: clientId },
    select: { email: true, companyName: true },
  });
  return client;
}

/**
 * Create an in-app notification for each admin/owner user of the client.
 */
async function createInAppNotifications(clientId, { type, title, message, link, metadata }) {
  const users = await getClientNotifyUsers(clientId);
  console.log("[AppointmentNotification] createInAppNotifications — users found:", users.length, "for client:", clientId);
  if (users.length === 0) {
    console.warn("[AppointmentNotification] No users found to notify for client:", clientId);
    return;
  }

  const result = await prisma.wehowareNotification.createMany({
    data: users.map((u) => ({
      clientId,
      userId: u.id,
      type,
      title,
      message: message ?? null,
      link: link ?? null,
      metadata: metadata ?? undefined,
    })),
  });
  console.log("[AppointmentNotification] In-app notifications created:", result.count);
}

/**
 * Send email notification to the client owner/admins about a new appointment.
 */
async function sendOwnerEmail(clientId, appointmentData, clientName) {
  const users = await getClientNotifyUsers(clientId);
  const clientInfo = await getClientEmail(clientId);

  const recipients = users.map((u) => u.email);
  if (recipients.length === 0 && clientInfo?.email) {
    recipients.push(clientInfo.email);
  }
  if (recipients.length === 0) {
    console.log("[AppointmentNotification] No recipients found for client", clientId);
    return;
  }

  const scheduledAt = new Date(appointmentData.scheduled_at || appointmentData.scheduledAt);
  const formattedDate = scheduledAt.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const context = {
    guest_name: appointmentData.guest_name || appointmentData.guestName,
    guest_email: appointmentData.guest_email || appointmentData.guestEmail,
    guest_phone: appointmentData.guest_phone || appointmentData.guestPhone,
    appointment_type: appointmentData.appointment_type?.name || appointmentData.type || null,
    scheduled_at: formattedDate,
    client_name: clientName || clientInfo?.companyName,
    notes: appointmentData.notes || null,
    admin_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://www.app.wehoware.ca"}/admin/appointments`,
  };

  for (const to of recipients) {
    try {
      await sendEmail({
        clientId,
        to,
        template: "appointment.booked.owner",
        context,
      });
    } catch (err) {
      console.error(`[AppointmentNotification] Failed to send email to ${to}:`, err);
    }
  }
}

/**
 * Main entry point — call this when a new appointment is booked.
 * Creates in-app notifications AND sends email to owner/admins.
 *
 * @param {string} clientId
 * @param {object} appointmentData - { guest_name, guest_email, guest_phone, scheduled_at, appointment_type, notes, id }
 * @param {string} clientName - company name for context
 * @param {object} options - { email: boolean, inApp: boolean }
 */
export async function notifyAppointmentBooked(clientId, appointmentData, clientName, options = {}) {
  const { email = true, inApp = true } = options;
  console.log("[AppointmentNotification] notifyAppointmentBooked called for client:", clientId, "guest:", appointmentData.guest_name || appointmentData.guestName);

  const guestName = appointmentData.guest_name || appointmentData.guestName || "Guest";
  const apptType = appointmentData.appointment_type?.name || appointmentData.type || "Appointment";
  const scheduledAt = new Date(appointmentData.scheduled_at || appointmentData.scheduledAt);
  const formattedDate = scheduledAt.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const tasks = [];

  if (inApp) {
    tasks.push(
      createInAppNotifications(clientId, {
        type: "appointment.booked",
        title: `New appointment — ${guestName}`,
        message: `${apptType} with ${guestName} on ${formattedDate}`,
        link: "/admin/appointments",
        metadata: {
          appointmentId: appointmentData.id,
          guestName,
          guestEmail: appointmentData.guest_email || appointmentData.guestEmail,
          appointmentType: apptType,
          scheduledAt: scheduledAt.toISOString(),
        },
      }).catch((err) => {
        console.error("[AppointmentNotification] In-app notification error:", err);
      })
    );
  }

  if (email) {
    tasks.push(
      sendOwnerEmail(clientId, appointmentData, clientName).catch((err) => {
        console.error("[AppointmentNotification] Email notification error:", err);
      })
    );
  }

  await Promise.all(tasks);
  console.log("[AppointmentNotification] notifyAppointmentBooked completed for client:", clientId);
}

/**
 * Event labels for in-app notification titles.
 */
const EVENT_LABELS = {
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
  confirmed: "Confirmed",
  completed: "Completed",
  noshow: "No-Show",
};

/**
 * Send an email notification to the owner/admins about an appointment update.
 * Uses the "appointment.updated.owner" template.
 */
async function sendOwnerUpdateEmail(clientId, eventData, clientName) {
  const users = await getClientNotifyUsers(clientId);
  const clientInfo = await getClientEmail(clientId);

  const recipients = users.map((u) => u.email);
  if (recipients.length === 0 && clientInfo?.email) {
    recipients.push(clientInfo.email);
  }
  if (recipients.length === 0) return;

  const scheduledAt = eventData.scheduled_at ? new Date(eventData.scheduled_at) : null;
  const oldScheduledAt = eventData.old_scheduled_at ? new Date(eventData.old_scheduled_at) : null;

  const fmt = (d) =>
    d
      ? d.toLocaleString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
        })
      : null;

  const context = {
    event: eventData.event,
    guest_name: eventData.guest_name,
    guest_email: eventData.guest_email,
    guest_phone: eventData.guest_phone,
    appointment_type: eventData.appointment_type,
    scheduled_at: fmt(scheduledAt),
    old_scheduled_at: fmt(oldScheduledAt),
    status: eventData.status,
    client_name: clientName || clientInfo?.companyName,
    actor: eventData.actor || "admin",
    notes: eventData.notes,
    admin_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://www.app.wehoware.ca"}/admin/appointments`,
  };

  for (const to of recipients) {
    try {
      await sendEmail({
        clientId,
        to,
        template: "appointment.updated.owner",
        context,
      });
    } catch (err) {
      console.error(`[AppointmentNotification] Failed to send update email to ${to}:`, err);
    }
  }
}

/**
 * Notify the SaaS owner/admins about an appointment update event.
 *
 * Events: rescheduled, cancelled, confirmed, completed, noshow
 *
 * @param {string} clientId
 * @param {object} eventData
 *   - event: "rescheduled" | "cancelled" | "confirmed" | "completed" | "noshow"
 *   - guest_name, guest_email, guest_phone
 *   - appointment_type: string (type name)
 *   - scheduled_at: ISO string (current/new time)
 *   - old_scheduled_at: ISO string (for rescheduled)
 *   - status: current status string
 *   - actor: "guest" | "admin" (who made the change)
 *   - id: appointment id
 * @param {string} clientName
 * @param {object} options - { email: boolean, inApp: boolean }
 */
export async function notifyAppointmentEvent(clientId, eventData, clientName, options = {}) {
  const { email = true, inApp = true } = options;

  const event = eventData.event || "updated";
  const label = EVENT_LABELS[event] || "Updated";
  const guestName = eventData.guest_name || "Guest";
  const apptType = eventData.appointment_type || "Appointment";
  const actor = eventData.actor || "admin";
  const actorPrefix = actor === "guest" ? "Guest " : "";

  const scheduledAt = eventData.scheduled_at ? new Date(eventData.scheduled_at) : null;
  const formattedDate = scheduledAt
    ? scheduledAt.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  // Build notification message based on event type
  let message;
  switch (event) {
    case "rescheduled": {
      const oldDate = eventData.old_scheduled_at
        ? new Date(eventData.old_scheduled_at).toLocaleString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })
        : "previous time";
      message = `${actorPrefix}${apptType} with ${guestName} moved from ${oldDate} to ${formattedDate}`;
      break;
    }
    case "cancelled":
      message = `${actorPrefix}${apptType} with ${guestName} on ${formattedDate} has been cancelled`;
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

  const tasks = [];

  if (inApp) {
    tasks.push(
      createInAppNotifications(clientId, {
        type: `appointment.${event}`,
        title: `Appointment ${label.toLowerCase()} — ${guestName}`,
        message,
        link: "/admin/appointments",
        metadata: {
          appointmentId: eventData.id,
          event,
          guestName,
          guestEmail: eventData.guest_email,
          appointmentType: apptType,
          scheduledAt: eventData.scheduled_at,
          oldScheduledAt: eventData.old_scheduled_at,
          actor,
        },
      }).catch((err) => {
        console.error("[AppointmentNotification] In-app update notification error:", err);
      })
    );
  }

  if (email) {
    tasks.push(
      sendOwnerUpdateEmail(clientId, eventData, clientName).catch((err) => {
        console.error("[AppointmentNotification] Email update notification error:", err);
      })
    );
  }

  await Promise.all(tasks);
}
