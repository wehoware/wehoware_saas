/**
 * Calendar Sync Service
 *
 * Syncs appointments to Google Calendar and Microsoft Outlook Calendar
 * using stored OAuth tokens from WehowareIntegration records.
 */

import { prisma } from "@/lib/prisma";

// ------------------------------------------------------------------
// Integration Logging
// ------------------------------------------------------------------

async function logIntegrationOperation(integrationId, clientId, operation, status, details, errorMessage, recordsProcessed) {
  try {
    await prisma.wehowareIntegrationLog.create({
      data: {
        integrationId,
        clientId,
        operation,
        status,
        details: details ?? {},
        errorMessage: errorMessage || null,
        recordsProcessed: recordsProcessed ?? null,
        endTime: new Date(),
      },
    });
  } catch (err) {
    console.error("[IntegrationLog] Failed to log operation:", err);
  }
}

// ------------------------------------------------------------------
// Google Calendar
// ------------------------------------------------------------------

async function getGoogleAccessToken(integration) {
  if (!integration.accessToken) return null;
  // Check if token expired and refresh if needed
  if (integration.tokenExpiresAt && new Date() > integration.tokenExpiresAt) {
    if (!integration.refreshToken) return null;
    const refreshed = await refreshGoogleToken(integration.refreshToken);
    if (!refreshed) return null;
    // Update integration with new tokens
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

async function refreshGoogleToken(refreshToken) {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[Google Refresh] error:", data);
      return null;
    }
    return {
      access_token: data.access_token,
      expires_at: data.expires_in ? Date.now() + data.expires_in * 1000 : null,
      refresh_token: data.refresh_token,
    };
  } catch (err) {
    console.error("[Google Refresh] exception:", err);
    return null;
  }
}

function buildGoogleEvent(appointment, appointmentType, integrationConfig = {}) {
  const start = new Date(appointment.scheduledAt);
  const end = new Date(start.getTime() + (appointmentType?.duration || 30) * 60000);
  const event = {
    summary: appointmentType?.name
      ? `Appointment: ${appointmentType.name}`
      : "Appointment",
    description: `Guest: ${appointment.guestName} (${appointment.guestEmail})\n${appointment.notes || ""}`,
    start: {
      dateTime: start.toISOString(),
      timeZone: appointment.timezone || "UTC",
    },
    end: {
      dateTime: end.toISOString(),
      timeZone: appointment.timezone || "UTC",
    },
    attendees: [{ email: appointment.guestEmail }],
    reminders: { useDefault: true },
  };

  // Add Google Meet conference if enabled
  if (integrationConfig?.enableMeet) {
    event.conferenceData = {
      createRequest: {
        requestId: `${appointment.id}-${Date.now()}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  return event;
}

async function createGoogleCalendarEvent(integration, appointment, appointmentType) {
  const accessToken = await getGoogleAccessToken(integration);
  if (!accessToken) return { error: "No valid Google access token" };

  const calendarId = integration.config?.calendarId || "primary";
  const event = buildGoogleEvent(appointment, appointmentType, integration.config);
  const hasConference = !!event.conferenceData;

  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
  );
  if (hasConference) url.searchParams.set("conferenceDataVersion", "1");

  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[Google Create] error:", data);
      await logIntegrationOperation(
        integration.id, integration.clientId, "calendar_create", "FAILED",
        { provider: "google", appointmentId: appointment.id }, data.error?.message
      );
      return { error: data.error?.message || "Failed to create Google Calendar event" };
    }
    await logIntegrationOperation(
      integration.id, integration.clientId, "calendar_create", "SUCCESS",
      { provider: "google", appointmentId: appointment.id, externalEventId: data.id }
    );
    return { externalEventId: data.id, meetLink: data.conferenceData?.entryPoints?.[0]?.uri || null };
  } catch (err) {
    console.error("[Google Create] exception:", err);
    await logIntegrationOperation(
      integration.id, integration.clientId, "calendar_create", "FAILED",
      { provider: "google", appointmentId: appointment.id }, err.message
    );
    return { error: err.message };
  }
}

async function updateGoogleCalendarEvent(integration, externalEventId, appointment, appointmentType) {
  const accessToken = await getGoogleAccessToken(integration);
  if (!accessToken) return { error: "No valid Google access token" };

  const calendarId = integration.config?.calendarId || "primary";
  const event = buildGoogleEvent(appointment, appointmentType, integration.config);

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(externalEventId)}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      console.error("[Google Update] error:", data);
      await logIntegrationOperation(
        integration.id, integration.clientId, "calendar_update", "FAILED",
        { provider: "google", appointmentId: appointment.id, externalEventId }, data.error?.message
      );
      return { error: data.error?.message || "Failed to update Google Calendar event" };
    }
    await logIntegrationOperation(
      integration.id, integration.clientId, "calendar_update", "SUCCESS",
      { provider: "google", appointmentId: appointment.id, externalEventId: data.id }
    );
    return { externalEventId: data.id };
  } catch (err) {
    console.error("[Google Update] exception:", err);
    await logIntegrationOperation(
      integration.id, integration.clientId, "calendar_update", "FAILED",
      { provider: "google", appointmentId: appointment.id, externalEventId }, err.message
    );
    return { error: err.message };
  }
}

async function deleteGoogleCalendarEvent(integration, externalEventId) {
  const accessToken = await getGoogleAccessToken(integration);
  if (!accessToken) return { error: "No valid Google access token" };

  const calendarId = integration.config?.calendarId || "primary";

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(externalEventId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!res.ok && res.status !== 410) {
      const data = await res.json().catch(() => ({}));
      console.error("[Google Delete] error:", data);
      await logIntegrationOperation(
        integration.id, integration.clientId, "calendar_delete", "FAILED",
        { provider: "google", externalEventId }, data.error?.message
      );
      return { error: data.error?.message || "Failed to delete Google Calendar event" };
    }
    await logIntegrationOperation(
      integration.id, integration.clientId, "calendar_delete", "SUCCESS",
      { provider: "google", externalEventId }
    );
    return { success: true };
  } catch (err) {
    console.error("[Google Delete] exception:", err);
    await logIntegrationOperation(
      integration.id, integration.clientId, "calendar_delete", "FAILED",
      { provider: "google", externalEventId }, err.message
    );
    return { error: err.message };
  }
}

// ------------------------------------------------------------------
// Microsoft Graph (Outlook)
// ------------------------------------------------------------------

async function getMicrosoftAccessToken(integration) {
  if (!integration.accessToken) return null;
  if (integration.tokenExpiresAt && new Date() > integration.tokenExpiresAt) {
    if (!integration.refreshToken) return null;
    const refreshed = await refreshMicrosoftToken(integration.refreshToken);
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

async function refreshMicrosoftToken(refreshToken) {
  try {
    const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID || "",
        client_secret: process.env.MICROSOFT_CLIENT_SECRET || "",
        refresh_token: refreshToken,
        grant_type: "refresh_token",
        scope: "Calendars.ReadWrite offline_access",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[Microsoft Refresh] error:", data);
      return null;
    }
    return {
      access_token: data.access_token,
      expires_at: data.expires_in ? Date.now() + data.expires_in * 1000 : null,
      refresh_token: data.refresh_token,
    };
  } catch (err) {
    console.error("[Microsoft Refresh] exception:", err);
    return null;
  }
}

function buildMicrosoftEvent(appointment, appointmentType, integrationConfig = {}) {
  const start = new Date(appointment.scheduledAt);
  const end = new Date(start.getTime() + (appointmentType?.duration || 30) * 60000);
  const event = {
    subject: appointmentType?.name
      ? `Appointment: ${appointmentType.name}`
      : "Appointment",
    body: {
      contentType: "text",
      content: `Guest: ${appointment.guestName} (${appointment.guestEmail})\n${appointment.notes || ""}`,
    },
    start: {
      dateTime: start.toISOString(),
      timeZone: appointment.timezone || "UTC",
    },
    end: {
      dateTime: end.toISOString(),
      timeZone: appointment.timezone || "UTC",
    },
    attendees: [
      {
        emailAddress: { address: appointment.guestEmail, name: appointment.guestName },
        type: "required",
      },
    ],
  };

  // Add Microsoft Teams meeting if enabled
  if (integrationConfig?.enableTeams) {
    event.isOnlineMeeting = true;
    event.onlineMeetingProvider = "teamsForBusiness";
  }

  return event;
}

async function createMicrosoftCalendarEvent(integration, appointment, appointmentType) {
  const accessToken = await getMicrosoftAccessToken(integration);
  if (!accessToken) return { error: "No valid Microsoft access token" };

  const event = buildMicrosoftEvent(appointment, appointmentType, integration.config);

  try {
    const res = await fetch("https://graph.microsoft.com/v1.0/me/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[Microsoft Create] error:", data);
      await logIntegrationOperation(
        integration.id, integration.clientId, "calendar_create", "FAILED",
        { provider: "microsoft", appointmentId: appointment.id }, data.error?.message
      );
      return { error: data.error?.message || "Failed to create Outlook event" };
    }
    await logIntegrationOperation(
      integration.id, integration.clientId, "calendar_create", "SUCCESS",
      { provider: "microsoft", appointmentId: appointment.id, externalEventId: data.id }
    );
    return { externalEventId: data.id, teamsLink: data.onlineMeeting?.joinUrl || null };
  } catch (err) {
    console.error("[Microsoft Create] exception:", err);
    await logIntegrationOperation(
      integration.id, integration.clientId, "calendar_create", "FAILED",
      { provider: "microsoft", appointmentId: appointment.id }, err.message
    );
    return { error: err.message };
  }
}

async function updateMicrosoftCalendarEvent(integration, externalEventId, appointment, appointmentType) {
  const accessToken = await getMicrosoftAccessToken(integration);
  if (!accessToken) return { error: "No valid Microsoft access token" };

  const event = buildMicrosoftEvent(appointment, appointmentType, integration.config);

  try {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(externalEventId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      console.error("[Microsoft Update] error:", data);
      await logIntegrationOperation(
        integration.id, integration.clientId, "calendar_update", "FAILED",
        { provider: "microsoft", appointmentId: appointment.id, externalEventId }, data.error?.message
      );
      return { error: data.error?.message || "Failed to update Outlook event" };
    }
    await logIntegrationOperation(
      integration.id, integration.clientId, "calendar_update", "SUCCESS",
      { provider: "microsoft", appointmentId: appointment.id, externalEventId: data.id }
    );
    return { externalEventId: data.id };
  } catch (err) {
    console.error("[Microsoft Update] exception:", err);
    await logIntegrationOperation(
      integration.id, integration.clientId, "calendar_update", "FAILED",
      { provider: "microsoft", appointmentId: appointment.id, externalEventId }, err.message
    );
    return { error: err.message };
  }
}

async function deleteMicrosoftCalendarEvent(integration, externalEventId) {
  const accessToken = await getMicrosoftAccessToken(integration);
  if (!accessToken) return { error: "No valid Microsoft access token" };

  try {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(externalEventId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!res.ok && res.status !== 404) {
      const data = await res.json().catch(() => ({}));
      console.error("[Microsoft Delete] error:", data);
      await logIntegrationOperation(
        integration.id, integration.clientId, "calendar_delete", "FAILED",
        { provider: "microsoft", externalEventId }, data.error?.message
      );
      return { error: data.error?.message || "Failed to delete Outlook event" };
    }
    await logIntegrationOperation(
      integration.id, integration.clientId, "calendar_delete", "SUCCESS",
      { provider: "microsoft", externalEventId }
    );
    return { success: true };
  } catch (err) {
    console.error("[Microsoft Delete] exception:", err);
    await logIntegrationOperation(
      integration.id, integration.clientId, "calendar_delete", "FAILED",
      { provider: "microsoft", externalEventId }, err.message
    );
    return { error: err.message };
  }
}

// ------------------------------------------------------------------
// Integration helpers
// ------------------------------------------------------------------

async function findCalendarIntegration(clientId, providerName) {
  // Look up the integration provider by name
  const provider = await prisma.wehowareIntegrationProvider.findFirst({
    where: { name: providerName, active: true },
    select: { id: true },
  });
  if (!provider) return null;

  // Find an active integration for this client + provider
  return prisma.wehowareIntegration.findFirst({
    where: {
      clientId,
      providerId: provider.id,
      status: "Active",
      accessToken: { not: null },
    },
  });
}

async function findExistingCalendarEvent(appointmentId, provider) {
  return prisma.wehowareCalendarEvent.findUnique({
    where: { appointmentId_provider: { appointmentId, provider } },
  });
}

// ------------------------------------------------------------------
// Public sync API
// ------------------------------------------------------------------

async function syncToProvider(integration, appointment, appointmentType, providerKey, clientId) {
  const existing = await findExistingCalendarEvent(appointment.id, providerKey);

  let syncResult;
  if (providerKey === "google") {
    if (existing) {
      syncResult = await updateGoogleCalendarEvent(
        integration, existing.externalEventId, appointment, appointmentType
      );
    } else {
      syncResult = await createGoogleCalendarEvent(integration, appointment, appointmentType);
    }
  } else if (providerKey === "microsoft") {
    if (existing) {
      syncResult = await updateMicrosoftCalendarEvent(
        integration, existing.externalEventId, appointment, appointmentType
      );
    } else {
      syncResult = await createMicrosoftCalendarEvent(integration, appointment, appointmentType);
    }
  }

  if (syncResult?.error) {
    if (existing) {
      await prisma.wehowareCalendarEvent.update({
        where: { id: existing.id },
        data: { syncStatus: "error", syncError: syncResult.error, lastSyncAt: new Date() },
      });
    }
    return { provider: providerKey, status: "error", error: syncResult.error };
  }

  if (syncResult?.externalEventId) {
    if (existing) {
      await prisma.wehowareCalendarEvent.update({
        where: { id: existing.id },
        data: { syncStatus: "synced", syncError: null, lastSyncAt: new Date() },
      });
    } else {
      await prisma.wehowareCalendarEvent.create({
        data: {
          clientId,
          appointmentId: appointment.id,
          integrationId: integration.id,
          provider: providerKey,
          externalEventId: syncResult.externalEventId,
          calendarId: integration.config?.calendarId || "primary",
          syncStatus: "synced",
          lastSyncAt: new Date(),
        },
      });
    }
    return { provider: providerKey, status: "synced", externalEventId: syncResult.externalEventId };
  }

  return { provider: providerKey, status: "skipped" };
}

/**
 * Sync an appointment to all connected calendar integrations.
 * Creates or updates calendar events as needed.
 */
export async function syncAppointmentToCalendars(appointment, clientId) {
  const results = [];

  const appointmentType = appointment.appointmentTypeId
    ? await prisma.wehowareAppointmentType.findUnique({
        where: { id: appointment.appointmentTypeId },
        select: { id: true, name: true, duration: true },
      })
    : null;

  const providers = [
    { name: "Google Calendar", key: "google" },
    { name: "Outlook Calendar", key: "microsoft" },
  ];

  for (const p of providers) {
    const integration = await findCalendarIntegration(clientId, p.name);
    if (!integration) continue;

    const result = await syncToProvider(integration, appointment, appointmentType, p.key, clientId);
    results.push(result);
  }

  return results;
}

/**
 * Backfill: sync all future appointments for a client to a specific integration.
 * Call this after a new calendar integration is connected.
 */
export async function backfillAppointmentsToCalendar(integration, clientId) {
  const now = new Date();
  const appointments = await prisma.wehowareAppointment.findMany({
    where: { clientId, scheduledAt: { gte: now } },
    include: { appointmentType: { select: { id: true, name: true, duration: true } } },
    orderBy: { scheduledAt: "asc" },
  });

  const providerName = await prisma.wehowareIntegrationProvider.findUnique({
    where: { id: integration.providerId },
    select: { name: true },
  });

  let providerKey = null;
  if (providerName?.name === "Google Calendar") {
    providerKey = "google";
  } else if (providerName?.name === "Outlook Calendar") {
    providerKey = "microsoft";
  }

  if (!providerKey) {
    return { error: "Unsupported provider for backfill" };
  }

  const results = [];
  for (const appt of appointments) {
    const result = await syncToProvider(integration, appt, appt.appointmentType, providerKey, clientId);
    results.push(result);
  }

  await logIntegrationOperation(
    integration.id, clientId, "calendar_backfill", "SUCCESS",
    { provider: providerKey, count: appointments.length }, null, appointments.length
  );

  return { provider: providerKey, synced: results.filter(r => r.status === "synced").length, errors: results.filter(r => r.status === "error").length };
}

/**
 * Remove an appointment from all connected calendar integrations.
 */
export async function removeAppointmentFromCalendars(appointmentId, clientId) {
  const results = [];

  const calendarEvents = await prisma.wehowareCalendarEvent.findMany({
    where: { appointmentId },
  });

  for (const ce of calendarEvents) {
    const integration = await prisma.wehowareIntegration.findUnique({
      where: { id: ce.integrationId },
    });
    if (!integration) continue;

    let result;
    if (ce.provider === "google") {
      result = await deleteGoogleCalendarEvent(integration, ce.externalEventId);
    } else if (ce.provider === "microsoft") {
      result = await deleteMicrosoftCalendarEvent(integration, ce.externalEventId);
    }

    if (result?.success || result?.error?.includes("410") || result?.error?.includes("404")) {
      await prisma.wehowareCalendarEvent.delete({ where: { id: ce.id } });
      results.push({ provider: ce.provider, status: "deleted" });
    } else {
      await prisma.wehowareCalendarEvent.update({
        where: { id: ce.id },
        data: { syncStatus: "error", syncError: result?.error || "Unknown error", lastSyncAt: new Date() },
      });
      results.push({ provider: ce.provider, status: "error", error: result?.error });
    }
  }

  return results;
}
