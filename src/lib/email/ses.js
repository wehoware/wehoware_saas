/**
 * AWS SES transactional email provider, wrapped so callers always go
 * through sendEmail(...) and get:
 *
 *  - Rendered template (subject/html/text) from the template registry.
 *  - Per-send row in wehoware_email_logs with pre-send Queued and
 *    post-send Sent/Failed state for audit + retry.
 *  - Dry-run short-circuit when EMAIL_PROVIDER_MODE=log (default in tests
 *    and when SES is not configured).
 *
 * The provider is injected so unit tests swap in a fake without patching
 * the AWS SDK.
 */
import { renderTemplate } from "./templates.js";
import { prisma } from "@/lib/prisma";

const MAX_RETRY = 3;

function defaultProvider() {
  return {
    mode: process.env.EMAIL_PROVIDER_MODE || "ses",
    fromAddress:
      process.env.EMAIL_FROM_ADDRESS ||
      "no-reply@wehoware.com",
    region: process.env.AWS_REGION || "us-east-1",
  };
}

let injectedClient = null;
let injectedConfig = null;

/** Inject a custom SES client + config (tests and advanced wiring). */
export function __setEmailProviderForTests(client, config) {
  injectedClient = client;
  injectedConfig = config;
}

async function getSesClient() {
  if (injectedClient) return injectedClient;
  const { SESClient } = await import("@aws-sdk/client-ses");
  return new SESClient({ region: defaultProvider().region });
}

/**
 * Send a templated email. Always creates an email log row (visible to
 * the tenant) and returns { id, status, providerMessageId? }.
 *
 * @param {object} input
 * @param {string} input.clientId  tenant id (required for multi-tenant log)
 * @param {string} input.to        recipient address
 * @param {string} input.template  key registered in templates.js
 * @param {object} [input.context] template variables
 * @param {string} [input.from]    override FROM (defaults env)
 * @param {string} [input.replyTo]
 */
export async function sendEmail({
  clientId,
  to,
  template,
  context = {},
  from,
  replyTo,
}) {
  if (!clientId) throw new Error("sendEmail: clientId is required");
  if (!to || typeof to !== "string" || !to.includes("@")) {
    throw new Error("sendEmail: `to` must be a valid email address");
  }
  if (!template) throw new Error("sendEmail: template is required");

  const cfg = injectedConfig || defaultProvider();
  const { subject, html, text } = renderTemplate(template, context);
  const fromAddress = from || cfg.fromAddress;

  // Record an audit row before any network IO so we never silently drop a send
  const log = await prisma.wehowareEmailLog.create({
    data: {
      clientId,
      toAddress: to,
      fromAddress,
      subject,
      template,
      bodyText: text,
      bodyHtml: html,
      context: context ?? {},
      status: "Queued",
      attemptCount: 0,
    },
  });

  if (cfg.mode === "log") {
    // Dev / test short-circuit — mark as Sent but never hit the network.
    const updated = await prisma.wehowareEmailLog.update({
      where: { id: log.id },
      data: {
        status: "Sent",
        sentAt: new Date(),
        attemptCount: 1,
        providerMessageId: `log:${log.id}`,
      },
    });
    return {
      id: updated.id,
      status: updated.status,
      providerMessageId: updated.providerMessageId,
    };
  }

  try {
    const { SendEmailCommand } = await import("@aws-sdk/client-ses");
    const client = await getSesClient();
    const command = new SendEmailCommand({
      Source: fromAddress,
      ReplyToAddresses: replyTo ? [replyTo] : undefined,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: html, Charset: "UTF-8" },
          Text: { Data: text, Charset: "UTF-8" },
        },
      },
    });
    const resp = await client.send(command);
    const providerMessageId = resp?.MessageId || null;
    const updated = await prisma.wehowareEmailLog.update({
      where: { id: log.id },
      data: {
        status: "Sent",
        sentAt: new Date(),
        attemptCount: 1,
        providerMessageId,
      },
    });
    return {
      id: updated.id,
      status: updated.status,
      providerMessageId,
    };
  } catch (err) {
    await prisma.wehowareEmailLog.update({
      where: { id: log.id },
      data: {
        status: "Failed",
        attemptCount: 1,
        errorMessage: String(err?.message || err).slice(0, 2000),
      },
    });
    throw err;
  }
}

/**
 * Retry a previously Failed or Queued email log, up to MAX_RETRY attempts.
 * Returns the updated log row (final state).
 */
export async function retryEmailLog(logId) {
  const log = await prisma.wehowareEmailLog.findUnique({ where: { id: logId } });
  if (!log) throw new Error(`email log ${logId} not found`);
  if (log.status === "Sent") return log;
  if (log.attemptCount >= MAX_RETRY) {
    return prisma.wehowareEmailLog.update({
      where: { id: log.id },
      data: { status: "Suppressed" },
    });
  }

  const cfg = injectedConfig || defaultProvider();
  try {
    if (cfg.mode === "log") {
      return prisma.wehowareEmailLog.update({
        where: { id: log.id },
        data: {
          status: "Sent",
          sentAt: new Date(),
          attemptCount: log.attemptCount + 1,
          providerMessageId: `log:${log.id}:retry`,
        },
      });
    }
    const { SendEmailCommand } = await import("@aws-sdk/client-ses");
    const client = await getSesClient();
    const resp = await client.send(
      new SendEmailCommand({
        Source: log.fromAddress,
        Destination: { ToAddresses: [log.toAddress] },
        Message: {
          Subject: { Data: log.subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: log.bodyHtml || "", Charset: "UTF-8" },
            Text: { Data: log.bodyText || "", Charset: "UTF-8" },
          },
        },
      })
    );
    return prisma.wehowareEmailLog.update({
      where: { id: log.id },
      data: {
        status: "Sent",
        sentAt: new Date(),
        attemptCount: log.attemptCount + 1,
        providerMessageId: resp?.MessageId || null,
      },
    });
  } catch (err) {
    return prisma.wehowareEmailLog.update({
      where: { id: log.id },
      data: {
        status: "Failed",
        attemptCount: log.attemptCount + 1,
        errorMessage: String(err?.message || err).slice(0, 2000),
      },
    });
  }
}

export const __internal = { MAX_RETRY };

/**
 * Send a templated email with file attachments via SES SendRawEmail.
 * Uses nodemailer to construct the raw MIME multipart message.
 *
 * @param {object} input
 * @param {string} input.clientId    tenant id
 * @param {string} input.to          recipient address
 * @param {string} input.template    key registered in templates.js
 * @param {object} [input.context]   template variables
 * @param {string} [input.from]      override FROM
 * @param {string} [input.replyTo]
 * @param {Array<{filename: string, content: Buffer, contentType?: string}>} [input.attachments]
 */
export async function sendEmailWithAttachment({
  clientId,
  to,
  template,
  context = {},
  from,
  replyTo,
  attachments = [],
}) {
  if (!clientId) throw new Error("sendEmailWithAttachment: clientId is required");
  if (!to || typeof to !== "string" || !to.includes("@")) {
    throw new Error("sendEmailWithAttachment: `to` must be a valid email address");
  }
  if (!template) throw new Error("sendEmailWithAttachment: template is required");

  const cfg = injectedConfig || defaultProvider();
  const { subject, html, text } = renderTemplate(template, context);
  const fromAddress = from || cfg.fromAddress;

  // Audit log row before any network IO
  const log = await prisma.wehowareEmailLog.create({
    data: {
      clientId,
      toAddress: to,
      fromAddress,
      subject,
      template,
      bodyText: text,
      bodyHtml: html,
      context: context ?? {},
      status: "Queued",
      attemptCount: 0,
    },
  });

  if (cfg.mode === "log") {
    const updated = await prisma.wehowareEmailLog.update({
      where: { id: log.id },
      data: {
        status: "Sent",
        sentAt: new Date(),
        attemptCount: 1,
        providerMessageId: `log:${log.id}`,
      },
    });
    return {
      id: updated.id,
      status: updated.status,
      providerMessageId: updated.providerMessageId,
    };
  }

  try {
    const nodemailer = await import("nodemailer");
    const { default: nodemailerDefault } = nodemailer;

    // Build the raw MIME message using nodemailer
    const mailOptions = {
      from: fromAddress,
      to,
      subject,
      text,
      html,
      attachments: attachments.map((att) => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType || "application/pdf",
        encoding: "binary",
      })),
    };
    if (replyTo) mailOptions.replyTo = replyTo;

    const rawMessage = await nodemailerDefault.createTransport({
      streamTransport: true,
    }).sendMail(mailOptions);

    // Convert the raw stream to a Buffer
    const rawChunks = [];
    for await (const chunk of rawMessage.message) {
      rawChunks.push(Buffer.from(chunk));
    }
    const rawEmail = Buffer.concat(rawChunks);

    const { SendRawEmailCommand } = await import("@aws-sdk/client-ses");
    const client = await getSesClient();
    const command = new SendRawEmailCommand({
      RawMessage: { Data: rawEmail },
    });
    const resp = await client.send(command);
    const providerMessageId = resp?.MessageId || null;
    const updated = await prisma.wehowareEmailLog.update({
      where: { id: log.id },
      data: {
        status: "Sent",
        sentAt: new Date(),
        attemptCount: 1,
        providerMessageId,
      },
    });
    return {
      id: updated.id,
      status: updated.status,
      providerMessageId,
    };
  } catch (err) {
    await prisma.wehowareEmailLog.update({
      where: { id: log.id },
      data: {
        status: "Failed",
        attemptCount: 1,
        errorMessage: String(err?.message || err).slice(0, 2000),
      },
    });
    throw err;
  }
}
