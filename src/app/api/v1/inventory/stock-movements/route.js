/**
 * /api/v1/inventory/stock-movements
 *
 * GET — list all stock movements for the active client (across all items)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) return user.activeClientId ?? null;
  return null;
}

function serializeMovement(m) {
  return {
    id: m.id,
    item_id: m.itemId,
    movement_type: m.movementType,
    quantity_change: m.quantityChange,
    quantity_after: m.quantityAfter,
    reason: m.reason,
    created_by: m.createdBy,
    created_at: m.createdAt,
    item: m.item ? { id: m.item.id, title: m.item.title, sku: m.item.sku } : null,
    user: m.creator ? { id: m.creator.id, name: `${m.creator.firstName || ""} ${m.creator.lastName || ""}`.trim() || m.creator.email } : null,
  };
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const SORTABLE_FIELDS = {
  created_at: "createdAt",
  quantity_change: "quantityChange",
  quantity_after: "quantityAfter",
};

// Movement types that increase stock (positive contribution)
const INBOUND_TYPES = new Set(["restock", "return"]);
// Movement types that decrease stock (negative contribution)
const OUTBOUND_TYPES = new Set(["sale", "damage"]);

export const GET = withAuth(async (request) => {
  try {
    const { prisma, user } = request;
    const clientId = resolveClientId(user);
    if (!clientId) return NextResponse.json({ error: "Active client context required" }, { status: 400 });

    const url = new URL(request.url);
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(url.searchParams.get("limit") || String(DEFAULT_PAGE_SIZE), 10)));
    const search = (url.searchParams.get("search") || "").trim();
    const movementType = url.searchParams.get("movement_type") || "";
    const itemId = url.searchParams.get("itemId") || "";
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    const sortByRaw = (url.searchParams.get("sortBy") || "created_at").trim();
    const sortBy = SORTABLE_FIELDS[sortByRaw] || "createdAt";
    const sortOrder = (url.searchParams.get("sortOrder") || "desc").toLowerCase() === "asc" ? "asc" : "desc";

    const where = { clientId };
    if (movementType) where.movementType = movementType;
    if (itemId) where.itemId = itemId;
    if (search) {
      where.OR = [
        { reason: { contains: search } },
        { item: { title: { contains: search } } },
        { item: { sku: { contains: search } } },
      ];
    }
    if (from || to) {
      where.createdAt = {};
      if (from) {
        const fromDate = new Date(`${from}T00:00:00`);
        if (!Number.isNaN(fromDate.getTime())) where.createdAt.gte = fromDate;
      }
      if (to) {
        // Inclusive of the entire "to" day
        const toDate = new Date(`${to}T23:59:59.999`);
        if (!Number.isNaN(toDate.getTime())) where.createdAt.lte = toDate;
      }
    }

    const [movements, totalItems, summaryRows] = await Promise.all([
      prisma.wehowareInventoryStockMovement.findMany({
        where,
        include: {
          item: { select: { id: true, title: true, sku: true } },
          creator: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.wehowareInventoryStockMovement.count({ where }),
      // Aggregate totals across the filtered set (ignores pagination)
      prisma.wehowareInventoryStockMovement.groupBy({
        by: ["movementType"],
        where,
        _sum: { quantityChange: true },
        _count: { _all: true },
      }),
    ]);

    // Build a flat summary object keyed by movement type
    const byType = {};
    let stockIn = 0;
    let stockOut = 0;
    let totalChange = 0;
    for (const row of summaryRows) {
      const change = row._sum.quantityChange || 0;
      byType[row.movementType] = { count: row._count._all, netChange: change };
      totalChange += change;
      if (INBOUND_TYPES.has(row.movementType)) stockIn += change;
      if (OUTBOUND_TYPES.has(row.movementType)) stockOut += Math.abs(change);
    }

    return NextResponse.json({
      data: movements.map(serializeMovement),
      pagination: {
        totalItems,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      },
      summary: {
        totalMovements: totalItems,
        stockIn,
        stockOut,
        netChange: totalChange,
        byType,
      },
    });
  } catch (err) {
    console.error("[GET /api/v1/inventory/stock-movements]", err);
    return NextResponse.json({ error: "Failed to fetch stock movements" }, { status: 500 });
  }
}, { allowedRoles: ["client", "employee", "admin"] });
