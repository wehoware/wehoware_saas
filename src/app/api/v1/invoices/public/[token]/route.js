/**
 * /api/v1/invoices/public/[token]
 *
 * GET — fetch a public invoice by share token (no auth required).
 * Returns a sanitized invoice + settings suitable for public rendering.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    return NextResponse.json({
      invoice: serializePublicInvoice(invoice),
      settings: serializeSettings(settings),
    });
  } catch (err) {
    console.error("[GET /api/v1/invoices/public/[token]] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
