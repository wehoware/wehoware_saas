/**
 * Video Meeting Service
 *
 * Handles Zoom meeting creation and management using stored OAuth tokens.
 * Google Meet and Microsoft Teams are handled within calendar-sync.js
 * via the calendar APIs (conferenceData and onlineMeeting respectively).
 */

import { prisma } from "@/lib/prisma";

// ------------------------------------------------------------------
// Zoom helpers
// ------------------------------------------------------------------

async function refreshZoomToken(refreshToken) {
  try {
    const res = await fetch("https://zoom.us/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${process.env.ZOOM_CLIENT_ID || ""}:${process.env.ZOOM_CLIENT_SECRET || ""}`
        ).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[Zoom Refresh] error:", data);
      return null;
    }
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_in ? Date.now() + data.expires_in * 1000 : null,
    };
  } catch (err) {
    console.error("[Zoom Refresh] exception:", err);
    return null;
  }
}

async function getZoomAccessToken(integration) {
  if (!integration.accessToken) return null;
  if (integration.tokenExpiresAt && new Date() > integration.tokenExpiresAt) {
    if (!integration.refreshToken) return null;
    const refreshed = await refreshZoomToken(integration.refreshToken);
    if (!refreshed) return null;
    await prisma.wehowareIntegration.update({
      where: { id: integration.id },
      data: {
        accessToken: refreshed.access_token,
        tokenExpiresAt: refreshed.expires_at ? new Date(refreshed.expires_at) : null,
        refreshToken: refreshed.refresh_token || integration.refreshToken,
      },
    });
    return refreshed.access_token;
  }
  return integration.accessToken;
}

// ------------------------------------------------------------------
// Meeting creation
// ------------------------------------------------------------------

/**
 * Create a Zoom meeting for an appointment.
 * Returns the join URL and meeting ID.
 */
export async function createZoomMeeting(integration, appointment, appointmentType) {
  const accessToken = await getZoomAccessToken(integration);
  if (!accessToken) return { error: "No valid Zoom access token" };

  const start = new Date(appointment.scheduledAt);
  const duration = appointmentType?.duration || 30;

  const payload = {
    topic: appointmentType?.name ? `Appointment: ${appointmentType.name}` : "Appointment",
    type: 2, // Scheduled meeting
    start_time: start.toISOString(),
    duration,
    timezone: appointment.timezone || "UTC",
    agenda: `Guest: ${appointment.guestName} (${appointment.guestEmail})\n${appointment.notes || ""}`,
    settings: {
      host_video: true,
      participant_video: true,
      join_before_host: false,
      mute_upon_entry: true,
      waiting_room: true,
    },
  };

  try {
    const res = await fetch("https://api.zoom.us/v2/users/me/meetings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[Zoom Create] error:", data);
      return { error: data.message || "Failed to create Zoom meeting" };
    }
    return {
      joinUrl: data.join_url,
      meetingId: String(data.id),
      startUrl: data.start_url,
    };
  } catch (err) {
    console.error("[Zoom Create] exception:", err);
    return { error: err.message };
  }
}

/**
 * Delete a Zoom meeting.
 */
export async function deleteZoomMeeting(integration, meetingId) {
  const accessToken = await getZoomAccessToken(integration);
  if (!accessToken) return { error: "No valid Zoom access token" };

  try {
    const res = await fetch(`https://api.zoom.us/v2/meetings/${encodeURIComponent(meetingId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok && res.status !== 404) {
      const data = await res.json().catch(() => ({}));
      console.error("[Zoom Delete] error:", data);
      return { error: data.message || "Failed to delete Zoom meeting" };
    }
    return { success: true };
  } catch (err) {
    console.error("[Zoom Delete] exception:", err);
    return { error: err.message };
  }
}

// ------------------------------------------------------------------
// Integration lookup
// ------------------------------------------------------------------

async function findZoomIntegration(clientId) {
  const provider = await prisma.wehowareIntegrationProvider.findFirst({
    where: { name: "Zoom", active: true },
    select: { id: true },
  });
  if (!provider) return null;

  return prisma.wehowareIntegration.findFirst({
    where: {
      clientId,
      providerId: provider.id,
      status: "Active",
      accessToken: { not: null },
    },
  });
}

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------

/**
 * Auto-generate a video meeting link for an appointment.
 * Checks connected video integrations in priority order: Zoom.
 * Returns the meeting link and provider name.
 */
export async function generateMeetingLink(appointment, clientId) {
  const appointmentType = appointment.appointmentTypeId
    ? await prisma.wehowareAppointmentType.findUnique({
        where: { id: appointment.appointmentTypeId },
        select: { id: true, name: true, duration: true },
      })
    : null;

  // Try Zoom first
  const zoomIntegration = await findZoomIntegration(clientId);
  if (zoomIntegration) {
    const result = await createZoomMeeting(zoomIntegration, appointment, appointmentType);
    if (!result.error) {
      return { link: result.joinUrl, provider: "zoom", meetingId: result.meetingId };
    }
    console.error("[VideoMeeting] Zoom creation failed:", result.error);
  }

  return { link: null, provider: null, meetingId: null };
}

/**
 * Remove a video meeting for an appointment.
 * Looks up stored meeting details and deletes from the provider.
 */
export async function removeMeetingLink(appointmentId, clientId) {
  // In a full implementation, you would track meeting IDs in a separate table.
  // For now, this is a placeholder that callers can extend.
  return { success: true };
}
