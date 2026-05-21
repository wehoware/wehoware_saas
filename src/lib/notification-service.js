/**
 * Notification Service
 * 
 * Handles sending email and SMS notifications for appointments.
 * This is a placeholder implementation that logs to console.
 * In production, integrate with email providers (SendGrid, Mailgun, etc.)
 * and SMS providers (Twilio, etc.)
 */

/**
 * Send appointment confirmation email to guest
 */
export async function sendAppointmentConfirmationEmail(appointment, clientName) {
  console.log("[Notification] Would send appointment confirmation email:", {
    to: appointment.guest_email,
    subject: `Appointment Confirmed with ${clientName}`,
    guestName: appointment.guest_name,
    scheduledAt: appointment.scheduled_at,
    location: appointment.location,
  });
  // TODO: Integrate with email provider
}

/**
 * Send appointment cancellation email to guest
 */
export async function sendAppointmentCancellationEmail(appointment, clientName) {
  console.log("[Notification] Would send appointment cancellation email:", {
    to: appointment.guest_email,
    subject: `Appointment Cancelled with ${clientName}`,
    guestName: appointment.guest_name,
    scheduledAt: appointment.scheduled_at,
  });
  // TODO: Integrate with email provider
}

/**
 * Send appointment reschedule email to guest
 */
export async function sendAppointmentRescheduleEmail(appointment, clientName, oldDate) {
  console.log("[Notification] Would send appointment reschedule email:", {
    to: appointment.guest_email,
    subject: `Appointment Rescheduled with ${clientName}`,
    guestName: appointment.guest_name,
    oldDate,
    newDate: appointment.scheduled_at,
  });
  // TODO: Integrate with email provider
}

/**
 * Send appointment reminder SMS to guest
 */
export async function sendAppointmentReminderSMS(appointment, clientName) {
  console.log("[Notification] Would send appointment reminder SMS:", {
    to: appointment.guest_phone,
    guestName: appointment.guest_name,
    scheduledAt: appointment.scheduled_at,
    clientName,
  });
  // TODO: Integrate with SMS provider
}

/**
 * Get notification settings for a client
 */
export async function getNotificationSettings(clientId) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/v1/settings/group/appointments?format=keyValue`);
    if (!res.ok) return null;
    const json = await res.json();
    const raw = json.data?.appointment_settings;
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed?.notifications || null;
    }
    return null;
  } catch (err) {
    console.error("[Notification] Failed to fetch settings:", err);
    return null;
  }
}

/**
 * Trigger notifications based on appointment event
 */
export async function triggerAppointmentNotification(event, appointment, clientId, clientName, extraData = {}) {
  const settings = await getNotificationSettings(clientId);
  
  if (!settings) {
    console.log("[Notification] No notification settings found, skipping");
    return;
  }

  const { email, sms } = settings;

  switch (event) {
    case 'created':
      if (email?.onBooking) {
        await sendAppointmentConfirmationEmail(appointment, clientName);
      }
      break;
    case 'confirmed':
      if (email?.onConfirmation) {
        await sendAppointmentConfirmationEmail(appointment, clientName);
      }
      break;
    case 'cancelled':
      if (email?.onCancellation) {
        await sendAppointmentCancellationEmail(appointment, clientName);
      }
      break;
    case 'rescheduled':
      if (email?.onReschedule) {
        await sendAppointmentRescheduleEmail(appointment, clientName, extraData.oldDate);
      }
      break;
    case 'reminder':
      if (sms?.onReminder) {
        await sendAppointmentReminderSMS(appointment, clientName);
      }
      break;
    default:
      console.log("[Notification] Unknown event:", event);
  }
}
