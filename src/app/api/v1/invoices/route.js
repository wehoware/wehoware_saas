/**
 * /api/v1/invoices
 *
 * GET  — list invoices for the resolved client (paginated, filterable, sortable)
 * POST — create a new invoice with optional line items
 *
 * Invoice numbers are auto-generated per client as INV-{YYYY}-{0000}.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../utils/auth-middleware";
import {
  DEFAULT_INVOICE_FORMAT,
  formatInvoiceNumber,
} from "@/lib/invoiceNumber";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const VALID_SORT_FIELDS = {
  invoiceDate: "invoiceDate",
  dueDate: "dueDate",
  total: "total",
  status: "status",
};

const VALID_STATUSES = new Set([
  "Draft",
  "Pending",
  "Paid",
  "Overdue",
  "Cancelled",
]);

function parseDateInput(dateStr) {
  if (!dateStr) return null;
  const normalized = dateStr.includes("T")
    ? dateStr
    : `${dateStr}T00:00:00`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.getUTCFullYear() < 1000) return null;
  return parsed;
}

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

function serializeLineItem(li) {
  return {
    id: li.id,
    description: li.description,
    quantity: li.quantity,
    unit_price: li.unitPrice,
    total: li.total,
    sort_order: li.sortOrder,
  };
}

function serializeInvoice(inv) {
  return {
    id: inv.id,
    client_id: inv.clientId,
    invoice_number: inv.invoiceNumber,
    customer_id: inv.customerId,
    customer: inv.customer ? {
      id: inv.customer.id,
      name: inv.customer.name,
      email: inv.customer.email,
      contact_person: inv.customer.contactPerson,
      phone: inv.customer.phone,
    } : null,
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
    paid_at: inv.paidAt,
    created_at: inv.createdAt,
    updated_at: inv.updatedAt,
    created_by: inv.createdBy,
    updated_by: inv.updatedBy,
    line_items: Array.isArray(inv.lineItems)
      ? inv.lineItems.map(serializeLineItem)
      : [],
  };
}

/**
 * Compute subtotal, taxAmount, and total from a list of raw line-item inputs.
 * Each item must have quantity (number) and unit_price (number).
 */
function computeTotals(lineItems, taxRate) {
  const subtotal = lineItems.reduce((sum, li) => {
    const quantity = Number(li.quantity) || 0;
    const unitPrice = Number(li.unit_price ?? li.unitPrice) || 0;
    return sum + quantity * unitPrice;
  }, 0);
  const taxAmount = subtotal * (Number(taxRate) || 0) / 100;
  const total = subtotal + taxAmount;
  return { subtotal, taxAmount, total };
}

/**
 * Build the line-item create-many payload.
 * sortOrder is positional (0-based index).
 */
function buildLineItemData(lineItems, invoiceId, clientId) {
  return lineItems.map((li, idx) => {
    const qty = Number(li.quantity) || 1;
    const unitPrice = Number(li.unit_price ?? li.unitPrice) || 0;
    return {
      invoiceId,
      clientId,
      description: li.description ?? "",
      quantity: qty,
      unitPrice,
      total: qty * unitPrice,
      sortOrder: idx,
    };
  });
}

// -------------------------------------------------------------------
// GET — list invoices
// -------------------------------------------------------------------
export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;

      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "Active client context required" },
          { status: 400 }
        );
      }

      const url = new URL(request.url);
      const page = Math.max(
        1,
        parseInt(url.searchParams.get("page") || "1", 10)
      );
      const limit = Math.min(
        MAX_PAGE_SIZE,
        Math.max(
          1,
          parseInt(
            url.searchParams.get("limit") || String(DEFAULT_PAGE_SIZE),
            10
          )
        )
      );
      const status = url.searchParams.get("status") || "";
      const rawSortBy = url.searchParams.get("sortBy") || "invoiceDate";
      const sortBy = VALID_SORT_FIELDS[rawSortBy] ?? "invoiceDate";
      const sortOrder =
        url.searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

      const where = { clientId };
      if (status && VALID_STATUSES.has(status)) where.status = status;

      const [items, totalItems] = await Promise.all([
        prisma.wehowareInvoice.findMany({
          where,
          include: {
            lineItems: { orderBy: { sortOrder: "asc" } },
            customer: { select: { id: true, name: true, email: true, contactPerson: true, phone: true } },
          },
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.wehowareInvoice.count({ where }),
      ]);

      return NextResponse.json({
        data: items.map(serializeInvoice),
        pagination: {
          totalItems,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        },
      });
    } catch (err) {
      console.error("[GET /api/v1/invoices] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch invoices" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "admin"], allowedClientRoles: ["client"] }
);

// -------------------------------------------------------------------
// POST — create invoice
// -------------------------------------------------------------------
export const POST = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;

      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "Active client context required" },
          { status: 400 }
        );
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 }
        );
      }

      // Required fields
      const clientName = body?.client_name;
      const invoiceDate = body?.invoice_date;
      const dueDate = body?.due_date;

      // Validate customer_id if provided
      let customerId = body?.customer_id ?? null;
      if (customerId) {
        const customer = await prisma.wehowareCustomer.findFirst({
          where: { id: customerId, clientId },
          select: { id: true },
        });
        if (!customer) {
          return NextResponse.json(
            { error: "customer_id is invalid or does not belong to this client" },
            { status: 400 }
          );
        }
      }

      if (!clientName) {
        return NextResponse.json(
          { error: "client_name is required" },
          { status: 400 }
        );
      }
      if (!invoiceDate) {
        return NextResponse.json(
          { error: "invoice_date is required" },
          { status: 400 }
        );
      }
      if (!dueDate) {
        return NextResponse.json(
          { error: "due_date is required" },
          { status: 400 }
        );
      }

      const parsedInvoiceDate = parseDateInput(invoiceDate);
      if (!parsedInvoiceDate) {
        return NextResponse.json(
          { error: "invoice_date is invalid" },
          { status: 400 }
        );
      }
      const parsedDueDate = parseDateInput(dueDate);
      if (!parsedDueDate) {
        return NextResponse.json(
          { error: "due_date is invalid" },
          { status: 400 }
        );
      }

      const rawLineItems = Array.isArray(body.line_items) ? body.line_items : [];
      const taxRate = Number(body.tax_rate) || 0;
      const { subtotal, taxAmount, total } = computeTotals(rawLineItems, taxRate);
      const currency = body.currency ?? "CAD";
      let status = "Draft";
      if (body.status) {
        if (!VALID_STATUSES.has(body.status)) {
          return NextResponse.json(
            { error: "status is invalid" },
            { status: 400 }
          );
        }
        status = body.status;
      }

      const invoice = await prisma.$transaction(async (tx) => {
        // Atomically read settings (auto-create on first invoice) and
        // bump the sequence so concurrent requests can't collide.
        let settings = await tx.wehowareInvoiceSettings.findUnique({
          where: { clientId },
        });
        if (!settings) {
          settings = await tx.wehowareInvoiceSettings.create({
            data: { clientId },
          });
        }

        const sequence = settings.nextInvoiceNumber;
        const invoiceNumber = formatInvoiceNumber(
          settings.invoiceFormat || DEFAULT_INVOICE_FORMAT,
          sequence,
          parsedInvoiceDate
        );

        await tx.wehowareInvoiceSettings.update({
          where: { clientId },
          data: { nextInvoiceNumber: sequence + 1 },
        });

        const created = await tx.wehowareInvoice.create({
          data: {
            clientId,
            invoiceNumber,
            customerId,
            clientName,
            clientEmail: body.client_email ?? null,
            invoiceDate: parsedInvoiceDate,
            dueDate: parsedDueDate,
            status,
            subtotal,
            taxRate,
            taxAmount,
            total,
            currency,
            notes: body.notes ?? null,
            createdBy: user.id,
            updatedBy: user.id,
          },
        });

        if (rawLineItems.length > 0) {
          await tx.wehowareInvoiceLineItem.createMany({
            data: buildLineItemData(rawLineItems, created.id, clientId),
          });
        }

        return tx.wehowareInvoice.findUnique({
          where: { id: created.id },
          include: {
            lineItems: { orderBy: { sortOrder: "asc" } },
            customer: { select: { id: true, name: true, email: true, contactPerson: true, phone: true } },
          },
        });
      });

      return NextResponse.json(serializeInvoice(invoice), { status: 201 });
    } catch (err) {
      console.error("[POST /api/v1/invoices] error:", err);
      return NextResponse.json(
        { error: "Failed to create invoice" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "admin"], allowedClientRoles: ["client"] }
);
