/**
 * /api/v1/invoices/[id]/pdf
 *
 * GET — generate and return a server-side PDF for an authenticated user.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";
import { generateInvoicePdf } from "@/lib/pdf";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

export const GET = withAuth(
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
        include: {
          lineItems: { orderBy: { sortOrder: "asc" } },
          customer: { select: { name: true, email: true } },
        },
      });

      if (!invoice) {
        return NextResponse.json(
          { error: "Invoice not found" },
          { status: 404 }
        );
      }

      const settings = await prisma.wehowareInvoiceSettings.findUnique({
        where: { clientId },
      });

      const serializedInvoice = {
        id: invoice.id,
        invoice_number: invoice.invoiceNumber,
        client_name: invoice.clientName,
        client_email: invoice.clientEmail,
        invoice_date: invoice.invoiceDate,
        due_date: invoice.dueDate,
        status: invoice.status,
        subtotal: invoice.subtotal,
        tax_rate: invoice.taxRate,
        tax_amount: invoice.taxAmount,
        total: invoice.total,
        currency: invoice.currency,
        notes: invoice.notes,
        billing_start_date: invoice.billingStartDate,
        billing_end_date: invoice.billingEndDate,
        line_items: invoice.lineItems.map((item) => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total: item.total,
        })),
        customer: invoice.customer
          ? { name: invoice.customer.name, email: invoice.customer.email }
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

      const pdfBuffer = await generateInvoicePdf(serializedInvoice, serializedSettings);
      const filename = `invoice-${invoice.invoiceNumber}.pdf`;

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "private, max-age=60",
        },
      });
    } catch (err) {
      console.error("[GET /api/v1/invoices/[id]/pdf] error:", err);
      return NextResponse.json(
        { error: "Failed to generate PDF" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "admin", "employee"] }
);
