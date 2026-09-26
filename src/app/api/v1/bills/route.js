/**
 * /api/v1/bills
 *
 * GET  — list bills (paginated, filterable, sortable)
 * POST — create a new bill with optional line items (atomic)
 *
 * Bill numbers are auto-generated per client as BILL-{YYYY}-{0000}.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../utils/auth-middleware";
import {
  computeLineItemTotals,
  buildLineItemRows,
  formatBillNumber,
  parseDateInput,
  BILL_STATUS_DB_TO_LABEL,
  BILL_STATUS_LABEL_TO_DB,
} from "@/lib/accounting";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const VALID_SORT_FIELDS = {
  billDate: "billDate",
  dueDate: "dueDate",
  total: "total",
  status: "status",
  createdAt: "createdAt",
};

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

function serializeBill(b) {
  return {
    id: b.id,
    client_id: b.clientId,
    vendor_id: b.vendorId,
    vendor: b.vendor
      ? { id: b.vendor.id, name: b.vendor.name, email: b.vendor.email }
      : null,
    bill_number: b.billNumber,
    reference: b.reference,
    bill_date: b.billDate,
    due_date: b.dueDate,
    status: BILL_STATUS_DB_TO_LABEL[b.status] ?? b.status,
    subtotal: b.subtotal,
    tax_rate: b.taxRate,
    tax_amount: b.taxAmount,
    total: b.total,
    amount_paid: b.amountPaid,
    amount_due: Number(b.total) - Number(b.amountPaid),
    currency: b.currency,
    notes: b.notes,
    paid_at: b.paidAt,
    created_at: b.createdAt,
    updated_at: b.updatedAt,
    created_by: b.createdBy,
    updated_by: b.updatedBy,
    line_items: Array.isArray(b.lineItems)
      ? b.lineItems.map(serializeLineItem)
      : [],
    attachment_count: b._count?.attachments ?? 0,
  };
}

// -------------------------------------------------------------------
// GET — list bills
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
      const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
      const limit = Math.min(
        MAX_PAGE_SIZE,
        Math.max(
          1,
          parseInt(url.searchParams.get("limit") || String(DEFAULT_PAGE_SIZE), 10)
        )
      );
      const statusLabel = url.searchParams.get("status") || "";
      const vendorId = url.searchParams.get("vendor_id") || "";
      const search = (url.searchParams.get("search") || "").trim();
      const from = url.searchParams.get("from") || "";
      const to = url.searchParams.get("to") || "";
      const rawSortBy = url.searchParams.get("sortBy") || "billDate";
      const sortBy = VALID_SORT_FIELDS[rawSortBy] ?? "billDate";
      const sortOrder = url.searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

      const where = { clientId };
      if (statusLabel && BILL_STATUS_LABEL_TO_DB[statusLabel]) {
        where.status = BILL_STATUS_LABEL_TO_DB[statusLabel];
      }
      if (vendorId) where.vendorId = vendorId;
      if (search) {
        where.OR = [
          { billNumber: { contains: search } },
          { reference: { contains: search } },
          { vendor: { name: { contains: search } } },
          { vendor: { email: { contains: search } } },
        ];
      }
      if (from || to) {
        where.billDate = {};
        if (from) {
          const fromDate = new Date(`${from}T00:00:00`);
          if (!Number.isNaN(fromDate.getTime())) where.billDate.gte = fromDate;
        }
        if (to) {
          const toDate = new Date(`${to}T23:59:59.999`);
          if (!Number.isNaN(toDate.getTime())) where.billDate.lte = toDate;
        }
      }

      const [items, totalItems, statusGroups] = await Promise.all([
        prisma.wehowareBill.findMany({
          where,
          include: {
            vendor: { select: { id: true, name: true, email: true } },
            lineItems: { orderBy: { sortOrder: "asc" } },
            _count: { select: { attachments: true } },
          },
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.wehowareBill.count({ where }),
        prisma.wehowareBill.groupBy({
          by: ["status"],
          where,
          _count: { _all: true },
          _sum: { total: true, amountPaid: true },
        }),
      ]);

      // Build summary object keyed by status label.
      const summary = {
        total: totalItems,
        totalDue: 0,
        totalPaid: 0,
        overdue: 0,
        paid: 0,
        open: 0,
        draft: 0,
        byStatus: {},
      };
      for (const g of statusGroups) {
        const label = BILL_STATUS_DB_TO_LABEL[g.status] ?? g.status;
        const count = g._count._all;
        const totalSum = Number(g._sum.total || 0);
        const paidSum = Number(g._sum.amountPaid || 0);
        const due = Math.max(0, totalSum - paidSum);
        summary.byStatus[label] = { count, total: totalSum, paid: paidSum, due };
        summary.totalDue += due;
        summary.totalPaid += paidSum;
        if (label === "Overdue") summary.overdue = count;
        if (label === "Paid") summary.paid = count;
        if (label === "Open") summary.open = count;
        if (label === "Draft") summary.draft = count;
      }

      return NextResponse.json({
        data: items.map(serializeBill),
        pagination: {
          totalItems,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        },
        summary,
      });
    } catch (err) {
      console.error("[GET /api/v1/bills] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch bills" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin"] }
);

// -------------------------------------------------------------------
// POST — create bill
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

      // Validate required fields
      const vendorId = body?.vendor_id;
      if (!vendorId) {
        return NextResponse.json(
          { error: "vendor_id is required" },
          { status: 400 }
        );
      }
      const parsedBillDate = parseDateInput(body.bill_date);
      if (!parsedBillDate) {
        return NextResponse.json(
          { error: "bill_date is required and must be a valid date" },
          { status: 400 }
        );
      }
      const parsedDueDate = parseDateInput(body.due_date);
      if (!parsedDueDate) {
        return NextResponse.json(
          { error: "due_date is required and must be a valid date" },
          { status: 400 }
        );
      }

      // Validate vendor belongs to this tenant
      const vendor = await prisma.wehowareVendor.findFirst({
        where: { id: vendorId, clientId },
        select: { id: true },
      });
      if (!vendor) {
        return NextResponse.json(
          { error: "vendor_id not found for this client" },
          { status: 400 }
        );
      }

      const rawLineItems = Array.isArray(body.line_items) ? body.line_items : [];
      const taxRate = Number(body.tax_rate) || 0;
      const { subtotal, taxAmount, total } = computeLineItemTotals(
        rawLineItems,
        taxRate
      );
      const currency = body.currency ?? "CAD";

      // Validate status if provided
      let statusDb = "Draft";
      if (body.status) {
        const mapped = BILL_STATUS_LABEL_TO_DB[body.status];
        if (!mapped) {
          return NextResponse.json(
            { error: "status is invalid" },
            { status: 400 }
          );
        }
        statusDb = mapped;
      }

      const bill = await prisma.$transaction(async (tx) => {
        // Atomically read settings (auto-create on first bill) and bump sequence.
        let settings = await tx.wehowareAccountingSettings.findUnique({
          where: { clientId },
        });
        if (!settings) {
          settings = await tx.wehowareAccountingSettings.create({
            data: { clientId },
          });
        }

        // Allow caller-provided bill_number; otherwise auto-generate.
        const billNumber = body.bill_number
          ? String(body.bill_number).trim()
          : formatBillNumber(
              settings.billNumberFormat,
              settings.nextBillNumber,
              parsedBillDate
            );

        if (!body.bill_number) {
          await tx.wehowareAccountingSettings.update({
            where: { clientId },
            data: { nextBillNumber: settings.nextBillNumber + 1 },
          });
        }

        const created = await tx.wehowareBill.create({
          data: {
            clientId,
            vendorId,
            billNumber,
            reference: body.reference ?? null,
            billDate: parsedBillDate,
            dueDate: parsedDueDate,
            status: statusDb,
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
          await tx.wehowareBillLineItem.createMany({
            data: buildLineItemRows(rawLineItems, created.id, "billId", clientId),
          });
        }

        return tx.wehowareBill.findUnique({
          where: { id: created.id },
          include: {
            vendor: { select: { id: true, name: true, email: true } },
            lineItems: { orderBy: { sortOrder: "asc" } },
          },
        });
      });

      return NextResponse.json(serializeBill(bill), { status: 201 });
    } catch (err) {
      console.error("[POST /api/v1/bills] error:", err);
      if (err?.code === "P2002") {
        return NextResponse.json(
          { error: "Bill number already exists for this client" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create bill" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin"] }
);
