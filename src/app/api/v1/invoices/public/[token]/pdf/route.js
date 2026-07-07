/**
 * /api/v1/invoices/public/[token]/pdf
 *
 * GET — generate and return a server-side PDF for the public invoice (no auth).
 * Uses Playwright headless Chromium to render the invoice template to PDF.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateInvoicePdf } from "@/lib/pdf";

function serializePublicInvoice(inv) {
  return {
    id: inv.id,
    invoice_number: inv.invoiceNumber,
    client_name: inv.clientName,
    client_email: inv.clientEmail,
    invoice_date: inv.invoiceDate,
    due_date: inv.dueDate,
    status: inv.status,
    subtotal: inv.subtotal,
    tax_rate: inv.taxRate,
    tax_amount: inv.taxAmount,
    total: inv.total,
    currency: inv.currency,
    notes: inv.notes,
    billing_start_date: inv.billingStartDate,
    billing_end_date: inv.billingEndDate,
    line_items: Array.isArray(inv.lineItems)
      ? inv.lineItems.map((item) => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total: item.total,
        }))
      : [],
    customer: inv.customer
      ? { name: inv.customer.name, email: inv.customer.email }
      : null,
  };
}

function serializeSettings(settings) {
  if (!settings) return null;
  return {
    company_name: settings.companyName,
    company_email: settings.companyEmail,
    company_phone: settings.companyPhone,
    company_address: settings.companyAddress,
    tax_number: settings.taxNumber,
    logo_url: settings.logoUrl,
    template_id: settings.templateId,
    template_config: settings.templateConfig,
  };
}

export async function GET(request, { params }) {
  try {
    const { token } = await params;
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    const invoice = await prisma.wehowareInvoice.findFirst({
      where: { shareToken: token },
      include: {
        lineItems: { orderBy: { sortOrder: "asc" } },
        customer: { select: { name: true, email: true } },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const settings = await prisma.wehowareInvoiceSettings.findUnique({
      where: { clientId: invoice.clientId },
    });

    const serializedInvoice = serializePublicInvoice(invoice);
    const serializedSettings = serializeSettings(settings);

    const pdfBuffer = await generateInvoicePdf(serializedInvoice, serializedSettings);

    const filename = `invoice-${invoice.invoiceNumber}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (err) {
    console.error("[GET /api/v1/invoices/public/[token]/pdf] error:", err);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
