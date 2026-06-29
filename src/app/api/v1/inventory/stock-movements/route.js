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

    const [movements, totalItems] = await Promise.all([
      prisma.wehowareInventoryStockMovement.findMany({
        where,
        include: {
          item: { select: { id: true, title: true, sku: true } },
          creator: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.wehowareInventoryStockMovement.count({ where }),
    ]);

    return NextResponse.json({
      data: movements.map(serializeMovement),
      pagination: {
        totalItems,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      },
    });
  } catch (err) {
    console.error("[GET /api/v1/inventory/stock-movements]", err);
    return NextResponse.json({ error: "Failed to fetch stock movements" }, { status: 500 });
  }
}, { allowedRoles: ["client", "employee", "admin"] });
