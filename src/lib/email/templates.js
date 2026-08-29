/**
 * Registry of transactional email templates.
 *
 * Each template is a pure function of (context) -> { subject, html, text }.
 * No runtime I/O here — the render is sync so the mailer can pre-render
 * before enqueuing.
 */

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function money(amount, currency = "CAD") {
  const num = Number(amount);
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: (currency || "CAD").toUpperCase(),
  }).format(num);
}

function shell({ title, bodyHtml, footer = "This is an automated email from Wehoware." }) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#111;background:#f6f7f9;margin:0;padding:32px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e7eb;">
    ${bodyHtml}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
    <p style="font-size:12px;color:#6b7280;margin:0;">${escapeHtml(footer)}</p>
  </div>
</body></html>`;
}

const TEMPLATES = {
  "invoice.created": (ctx) => {
    const { invoice_number, client_name, total, currency, due_date, portal_url } = ctx;
    const subject = `New invoice ${invoice_number} — ${money(total, currency)}`;
    const html = shell({
      title: subject,
      bodyHtml: `
        <h2 style="margin-top:0;">Invoice ${escapeHtml(invoice_number)}</h2>
        <p>Hi ${escapeHtml(client_name)},</p>
        <p>A new invoice totalling <strong>${money(total, currency)}</strong> has been issued.
           It's due on <strong>${escapeHtml(due_date)}</strong>.</p>
        ${portal_url ? `<p><a href="${escapeHtml(portal_url)}" style="background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">View invoice</a></p>` : ""}
      `,
    });
    const text = `Invoice ${invoice_number}\n\nHi ${client_name},\n\nA new invoice totalling ${money(total, currency)} has been issued. It is due on ${due_date}.${portal_url ? `\n\nView: ${portal_url}` : ""}`;
    return { subject, html, text };
  },

  "invoice.reminder.due": (ctx) => {
    const { invoice_number, client_name, amount_due, currency, due_date, portal_url } = ctx;
    const subject = `Reminder: Invoice ${invoice_number} is due ${due_date}`;
    const html = shell({
      title: subject,
      bodyHtml: `
        <h2 style="margin-top:0;">Friendly reminder</h2>
        <p>Hi ${escapeHtml(client_name)},</p>
        <p>Invoice <strong>${escapeHtml(invoice_number)}</strong> for
           <strong>${money(amount_due, currency)}</strong> is due on
           <strong>${escapeHtml(due_date)}</strong>.</p>
        ${portal_url ? `<p><a href="${escapeHtml(portal_url)}">Pay now</a></p>` : ""}
      `,
    });
    const text = `Reminder: Invoice ${invoice_number} totalling ${money(amount_due, currency)} is due ${due_date}.`;
    return { subject, html, text };
  },

  "invoice.reminder.overdue": (ctx) => {
    const { invoice_number, client_name, amount_due, currency, days_overdue, portal_url } = ctx;
    const subject = `Overdue: Invoice ${invoice_number} — ${days_overdue} days past due`;
    const html = shell({
      title: subject,
      bodyHtml: `
        <h2 style="margin-top:0;color:#b91c1c;">Overdue invoice</h2>
        <p>Hi ${escapeHtml(client_name)},</p>
        <p>Invoice <strong>${escapeHtml(invoice_number)}</strong> for
           <strong>${money(amount_due, currency)}</strong> is now
           <strong>${escapeHtml(days_overdue)} days overdue</strong>.</p>
        ${portal_url ? `<p><a href="${escapeHtml(portal_url)}">Pay now</a></p>` : ""}
      `,
    });
    const text = `Invoice ${invoice_number} for ${money(amount_due, currency)} is ${days_overdue} days overdue.`;
    return { subject, html, text };
  },

  "bill.reminder.due": (ctx) => {
    const { bill_number, vendor_name, amount_due, currency, due_date } = ctx;
    const subject = `Bill ${bill_number} from ${vendor_name} is due ${due_date}`;
    const html = shell({
      title: subject,
      bodyHtml: `
        <h2 style="margin-top:0;">Upcoming bill</h2>
        <p>Bill <strong>${escapeHtml(bill_number)}</strong> from <strong>${escapeHtml(vendor_name)}</strong>
           for <strong>${money(amount_due, currency)}</strong> is due on
           <strong>${escapeHtml(due_date)}</strong>.</p>
      `,
    });
    const text = `Bill ${bill_number} from ${vendor_name} for ${money(amount_due, currency)} is due ${due_date}.`;
    return { subject, html, text };
  },

  "bill.reminder.overdue": (ctx) => {
    const { bill_number, vendor_name, amount_due, currency, days_overdue } = ctx;
    const subject = `Overdue bill: ${bill_number} from ${vendor_name}`;
    const html = shell({
      title: subject,
      bodyHtml: `
        <h2 style="margin-top:0;color:#b91c1c;">Overdue bill</h2>
        <p>Bill <strong>${escapeHtml(bill_number)}</strong> from <strong>${escapeHtml(vendor_name)}</strong>
           for <strong>${money(amount_due, currency)}</strong> is now
           <strong>${escapeHtml(days_overdue)} days overdue</strong>.</p>
      `,
    });
    const text = `Bill ${bill_number} from ${vendor_name} for ${money(amount_due, currency)} is ${days_overdue} days overdue.`;
    return { subject, html, text };
  },

  "user.invite": (ctx) => {
    const { inviter_name, client_name, invite_url, role } = ctx;
    const subject = `You've been invited to join ${client_name} on Wehoware`;
    const html = shell({
      title: subject,
      bodyHtml: `
        <h2 style="margin-top:0;">You're invited!</h2>
        <p>Hi there,</p>
        <p><strong>${escapeHtml(inviter_name)}</strong> has invited you to join
           <strong>${escapeHtml(client_name)}</strong> on Wehoware as a <strong>${escapeHtml(role)}</strong>.</p>
        <p><a href="${escapeHtml(invite_url)}" style="background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">Accept Invitation</a></p>
        <p style="font-size:12px;color:#6b7280;">This invitation expires in 7 days. If you didn't expect this, you can safely ignore it.</p>
      `,
    });
    const text = `You've been invited to join ${client_name} on Wehoware by ${inviter_name} as a ${role}.\n\nAccept: ${invite_url}\n\nThis invitation expires in 7 days.`;
    return { subject, html, text };
  },

  "user.password_reset": (ctx) => {
    const { reset_url } = ctx;
    const subject = "Reset your Wehoware password";
    const html = shell({
      title: subject,
      bodyHtml: `
        <h2 style="margin-top:0;">Password reset</h2>
        <p>We received a request to reset your password. Click the button below to set a new one:</p>
        <p><a href="${escapeHtml(reset_url)}" style="background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">Reset Password</a></p>
        <p style="font-size:12px;color:#6b7280;">This link expires in 1 hour. If you didn't request this, you can safely ignore it.</p>
      `,
    });
    const text = `Reset your Wehoware password:\n\n${reset_url}\n\nThis link expires in 1 hour.`;
    return { subject, html, text };
  },

  "generic": (ctx) => {
    const subject = ctx.subject || "Notification";
    const bodyText = ctx.text || "";
    const html = shell({
      title: subject,
      bodyHtml: `<p>${escapeHtml(bodyText).replaceAll("\n", "<br>")}</p>`,
    });
    return { subject, html, text: bodyText };
  },

  "invoice.share": (ctx) => {
    const { invoice_number, client_name, total, currency, due_date, billing_start_date, billing_end_date, company_name, share_url } = ctx;
    const billingPeriod = billing_start_date || billing_end_date
      ? `Billing period: ${billing_start_date || '\u2014'} to ${billing_end_date || '\u2014'}<br>`
      : '';
    const subject = `Invoice ${invoice_number} from ${company_name || 'Wehoware'}`;
    const html = shell({
      title: subject,
      bodyHtml: `
        <h2 style="margin-top:0;">Invoice ${escapeHtml(invoice_number)}</h2>
        <p>Hi ${escapeHtml(client_name)},</p>
        <p>You have a new invoice for <strong>${money(total, currency)}</strong>, due on <strong>${escapeHtml(due_date)}</strong>.</p>
        ${billingPeriod ? `<p style="font-size:13px;color:#6b7280;">${billingPeriod}</p>` : ''}
        <p><a href="${escapeHtml(share_url)}" style="background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">View Invoice</a></p>
        <p style="font-size:12px;color:#6b7280;">A PDF copy of this invoice is attached. You can also view it online using the button above.<br>If you cannot click the button, copy this URL: ${escapeHtml(share_url)}</p>
      `,
    });
    const text = `Invoice ${invoice_number} from ${company_name || 'Wehoware'}\n\nHi ${client_name},\n\nYou have a new invoice for ${money(total, currency)}, due on ${due_date}.${billing_start_date || billing_end_date ? `\nBilling period: ${billing_start_date || '\u2014'} to ${billing_end_date || '\u2014'}` : ''}\n\nA PDF copy is attached. View invoice online: ${share_url}`;
    return { subject, html, text };
  },

  "daily_report.reminder": (ctx) => {
    const { name, report_date, link } = ctx;
    const dateStr = report_date || "today";
    const subject = `Reminder: Submit your daily work report for ${dateStr}`;
    const text = `Hi ${name || "there"},\n\nThis is a friendly reminder to submit your daily work report for ${dateStr}.\n\nYou can submit it here: ${link || "https://www.app.wehoware.ca/admin/daily-reports"}\n\nThanks,\nWehoware Team`;
    const html = shell({
      title: subject,
      bodyHtml: `
        <h2 style="margin-top:0;">Daily Work Report Reminder</h2>
        <p>Hi ${escapeHtml(name || "there")},</p>
        <p>This is a friendly reminder to submit your daily work report for <strong>${escapeHtml(dateStr)}</strong>.</p>
        <p style="margin:16px 0;">
          <a href="${escapeHtml(link || "#")}" style="display:inline-block;padding:10px 18px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">Submit Report</a>
        </p>
        <p>Thanks,<br>Wehoware Team</p>
      `,
    });
    return { subject, html, text };
  },
};

export function listTemplates() {
  return Object.keys(TEMPLATES);
}

export function hasTemplate(name) {
  return Object.hasOwn(TEMPLATES, name);
}

export function renderTemplate(name, context = {}) {
  const fn = TEMPLATES[name];
  if (!fn) {
    throw new Error(`Unknown email template: ${name}`);
  }
  const result = fn(context);
  if (!result || !result.subject || !result.html || !result.text) {
    throw new Error(
      `Template ${name} returned an invalid payload (missing subject/html/text)`
    );
  }
  return result;
}

// Exposed for tests
export const __templates = TEMPLATES;
