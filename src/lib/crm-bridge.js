/**
 * crm-bridge.js
 * Bridges external lead sources (Form Builder, Appointments, Social Inbox)
 * into CRM contacts with deduplication and activity logging.
 */
import { prisma } from "./prisma";

/**
 * Find or create a CRM contact from an external source.
 * Deduplicates by [clientId, email].
 */
async function findOrCreateContact({ clientId, email, firstName, lastName, phone, company, source, extra = {} }) {
  if (!clientId) return null;

  if (email) {
    const existing = await prisma.wehowareCrmContact.findFirst({
      where: { clientId, email },
    });
    if (existing) {
      const updated = await prisma.wehowareCrmContact.update({
        where: { id: existing.id },
        data: {
          firstName: firstName ?? existing.firstName,
          lastName: lastName ?? existing.lastName,
          phone: phone ?? existing.phone,
          company: company ?? existing.company,
          ...extra,
        },
      });
      return { contact: updated, created: false };
    }
  }

  const contact = await prisma.wehowareCrmContact.create({
    data: {
      clientId,
      type: "Lead",
      status: "New",
      source,
      firstName: firstName ?? null,
      lastName: lastName ?? null,
      email: email ?? null,
      phone: phone ?? null,
      company: company ?? null,
      ...extra,
    },
  });
  return { contact, created: true };
}

/**
 * Log an activity for a contact.
 */
async function logActivity({ clientId, contactId, type, direction, title, description, dealId = null }) {
  return prisma.wehowareCrmActivity.create({
    data: {
      clientId,
      contactId,
      dealId,
      type,
      direction,
      title,
      description,
      completedAt: new Date(),
    },
  });
}

/**
 * Bridge a Form Builder submission to a CRM contact.
 */
export async function bridgeFormSubmissionToCrm({ clientId, submissionId, formData, formTemplateId }) {
  try {
    const email = formData?.email || formData?.Email || null;
    const name = formData?.name || formData?.Name || formData?.full_name || null;
    const phone = formData?.phone || formData?.Phone || null;
    const company = formData?.company || formData?.Company || null;

    const nameParts = name ? name.trim().split(/\s+/) : [];
    const firstName = nameParts[0] || null;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;

    const { contact, created } = await findOrCreateContact({
      clientId,
      email,
      firstName,
      lastName,
      phone,
      company,
      source: "FormBuilder",
      extra: {
        formSubmissionId: submissionId,
      },
    });

    if (contact) {
      await logActivity({
        clientId,
        contactId: contact.id,
        type: "FormBuilderSubmission",
        direction: "Inbound",
        title: `Form submission: ${formTemplateId || "Unknown form"}`,
        description: JSON.stringify(formData).slice(0, 2000),
      });
    }

    return { contact, created };
  } catch (err) {
    console.error("[crm-bridge] bridgeFormSubmissionToCrm error:", err);
    return { contact: null, created: false, error: err.message };
  }
}

/**
 * Bridge an appointment booking to a CRM contact.
 */
export async function bridgeAppointmentToCrm({ clientId, appointmentId, guestName, guestEmail, guestPhone, scheduledAt, appointmentType }) {
  try {
    const nameParts = guestName ? guestName.trim().split(/\s+/) : [];
    const firstName = nameParts[0] || guestName;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;

    const { contact, created } = await findOrCreateContact({
      clientId,
      email: guestEmail,
      firstName,
      lastName,
      phone: guestPhone,
      source: "Appointment",
      extra: {
        appointmentId,
      },
    });

    if (contact) {
      await logActivity({
        clientId,
        contactId: contact.id,
        type: "AppointmentBooked",
        direction: "Inbound",
        title: `Appointment booked: ${appointmentType || "General"}`,
        description: `Scheduled for ${scheduledAt ? new Date(scheduledAt).toISOString() : "unknown time"}`,
      });
    }

    return { contact, created };
  } catch (err) {
    console.error("[crm-bridge] bridgeAppointmentToCrm error:", err);
    return { contact: null, created: false, error: err.message };
  }
}

/**
 * Bridge a social inbox conversation to a CRM contact.
 * Called after social inbox sync discovers new conversations.
 */
export async function bridgeSocialConversationToCrm({ clientId, conversationId, platform, senderName, senderUsername, senderProfileUrl, messageContent }) {
  try {
    const nameParts = senderName ? senderName.trim().split(/\s+/) : [];
    const firstName = nameParts[0] || senderUsername || null;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;

    // Social contacts may not have email — dedup by conversationId
    const existing = await prisma.wehowareCrmContact.findFirst({
      where: { clientId, socialInboxConversationId: conversationId },
    });

    if (existing) {
      return { contact: existing, created: false };
    }

    const contact = await prisma.wehowareCrmContact.create({
      data: {
        clientId,
        type: "Lead",
        status: "New",
        source: "SocialMedia",
        firstName,
        lastName,
        socialPlatform: platform,
        socialProfiles: senderProfileUrl ? { url: senderProfileUrl, username: senderUsername } : { username: senderUsername },
        socialInboxConversationId: conversationId,
      },
    });

    await logActivity({
      clientId,
      contactId: contact.id,
      type: "SocialMessage",
      direction: "Inbound",
      title: `New ${platform} message from ${senderUsername || senderName || "unknown"}`,
      description: messageContent ? messageContent.slice(0, 2000) : null,
    });

    return { contact, created: true };
  } catch (err) {
    console.error("[crm-bridge] bridgeSocialConversationToCrm error:", err);
    return { contact: null, created: false, error: err.message };
  }
}

/**
 * Bridge a legacy inquiry to a CRM contact (for migration script).
 */
export async function bridgeInquiryToCrm({ clientId, name, email, phone, subject, message, serviceId, createdAt }) {
  try {
    const nameParts = name ? name.trim().split(/\s+/) : [];
    const firstName = nameParts[0] || name;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;

    const { contact, created } = await findOrCreateContact({
      clientId,
      email,
      firstName,
      lastName,
      phone,
      source: "Website",
      extra: {
        inquirySubject: subject,
        inquiryMessage: message,
        inquiryServiceId: serviceId ?? null,
      },
    });

    return { contact, created };
  } catch (err) {
    console.error("[crm-bridge] bridgeInquiryToCrm error:", err);
    return { contact: null, created: false, error: err.message };
  }
}
