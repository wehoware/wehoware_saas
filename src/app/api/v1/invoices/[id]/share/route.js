/**
 * /api/v1/invoices/[id]/share
 *
 * POST — generate a share token for the invoice and optionally email it
 *        with a server-generated PDF attachment.
 *
 * Body: { email?: string, send_email?: boolean }
 */
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { withAuth } from "../../../../utils/auth-middleware";
import { sendEmailWithAttachment } from "@/lib/email/ses";
import { generateInvoicePdf } from "@/lib/pdf";
import { formatInvoiceDate } from "@/lib/invoiceFormat";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;

      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "Active client context required" },
          { status: 400 }
        );
      }

      const invoice = await prisma.wehowareInvoice.findFirst({
        where: { id, clientId },
        select: { id: true, invoiceNumber: true, clientName: true, clientEmail: true },
      });

      if (!invoice) {
        return NextResponse.json(
          { error: "Invoice not found" },
          { status: 404 }
        );
      }

      let body = {};
      try {
        body = await request.json();
      } catch {
        // Empty body is fine — just generate token without emailing
      }

      const sendEmail = body.send_email === true;
      const email = body.email || invoice.clientEmail || null;

      if (sendEmail) {
        if (!email || !EMAIL_REGEX.test(email)) {
          return NextResponse.json(
            { error: "A valid email address is required to send the invoice" },
            { status: 400 }
          );
        }
      }

      // Generate share token
      const shareToken = crypto.randomBytes(32).toString("hex");
      await prisma.wehowareInvoice.update({
        where: { id },
        data: {
          shareToken,
          shareTokenGeneratedAt: new Date(),
        },
      });

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const shareUrl = `${baseUrl}/api/v1/invoices/public/${shareToken}/pdf`;

      let emailSent = false;
      let emailError = null;

      if (sendEmail) {
        try {
          // Fetch full invoice with line items + customer for PDF rendering
          const fullInvoice = await prisma.wehowareInvoice.findFirst({
            where: { id, clientId },
            include: {
              lineItems: { orderBy: { sortOrder: "asc" } },
              customer: { select: { name: true, email: true } },
            },
          });

          const settings = await prisma.wehowareInvoiceSettings.findUnique({
            where: { clientId },
          });

          // Serialize for the template renderer
          const serializedInvoice = {
            id: fullInvoice.id,
            invoice_number: fullInvoice.invoiceNumber,
            client_name: fullInvoice.clientName,
            client_email: fullInvoice.clientEmail,
            invoice_date: fullInvoice.invoiceDate,
            due_date: fullInvoice.dueDate,
            status: fullInvoice.status,
            subtotal: fullInvoice.subtotal,
            tax_rate: fullInvoice.taxRate,
            tax_amount: fullInvoice.taxAmount,
            total: fullInvoice.total,
            currency: fullInvoice.currency,
            notes: fullInvoice.notes,
            billing_start_date: fullInvoice.billingStartDate,
            billing_end_date: fullInvoice.billingEndDate,
            line_items: fullInvoice.lineItems.map((item) => ({
              id: item.id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unitPrice,
              total: item.total,
            })),
            customer: fullInvoice.customer
              ? { name: fullInvoice.customer.name, email: fullInvoice.customer.email }
              : null,
          };

          const serializedSettings = settings
            ? {
                company_name: settings.companyName,
                company_email: settings.companyEmail,
                company_phone: settings.companyPhone,
                company_address: settings.companyAddress,
                tax_number: settings.taxNumber,
                logo_url: settings.logoUrl,
                template_id: settings.templateId,
                template_config: settings.templateConfig,
              }
            : null;

          // Generate PDF
          const pdfBuffer = await generateInvoicePdf(serializedInvoice, serializedSettings);

          // Send email with attachment
          await sendEmailWithAttachment({
            clientId,
            to: email,
            template: "invoice.share",
            context: {
              invoice_number: invoice.invoiceNumber,
              client_name: invoice.clientName,
              total: serializedInvoice.total,
              currency: serializedInvoice.currency,
              due_date: formatInvoiceDate(serializedInvoice.due_date),
              billing_start_date: formatInvoiceDate(serializedInvoice.billing_start_date),
              billing_end_date: formatInvoiceDate(serializedInvoice.billing_end_date),
              company_name: serializedSettings?.company_name,
              share_url: shareUrl,
            },
            attachments: [
              {
                filename: `invoice-${invoice.invoiceNumber}.pdf`,
                content: pdfBuffer,
                contentType: "application/pdf",
              },
            ],
          });

          emailSent = true;
        } catch (err) {
          console.error("[POST /api/v1/invoices/[id]/share] email error:", err);
          const awsCode = err?.Code || err?.name;
          if (awsCode === "AccessDenied" || err?.message?.includes("AccessDenied")) {
            emailError = "Email sending is not configured. Please contact your administrator to enable AWS SES email permissions.";
          } else if (awsCode === "MessageRejected" || err?.message?.includes("not verified")) {
            emailError = "The sender email address is not verified in AWS SES. Please verify the domain identity in the AWS SES console.";
          } else {
            emailError = err?.message || String(err);
          }
        }
      }

      return NextResponse.json({
        share_url: shareUrl,
        share_token: shareToken,
        email_sent: emailSent,
        ...(emailError ? { email_error: emailError } : {}),
      });
    } catch (err) {
      console.error("[POST /api/v1/invoices/[id]/share] error:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "admin", "employee"] }
);
