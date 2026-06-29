/**
 * /api/v1/inventory/[id]/stock-movements
 *
 * GET  — list stock movements for a specific item
 * POST — record a new stock movement (adjusts item quantity)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) return user.activeClientId ?? null;
  return null;
}

const MOVEMENT_TYPE_DIRECTIONS = {
  restock: 1,
  sale: -1,
  adjustment: 0,
  return: 1,
  damage: -1,
  transfer: 0,
};

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

export const GET = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id } = await params;
    const clientId = resolveClientId(user);
    if (!clientId) return NextResponse.json({ error: "Active client context required" }, { status: 400 });

    const item = await prisma.wehowareInventoryItem.findFirst({
      where: { id, clientId },
      select: { id: true },
    });
    if (!item) return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });

    const movements = await prisma.wehowareInventoryStockMovement.findMany({
      where: { itemId: id },
      include: {
        item: { select: { id: true, title: true, sku: true } },
        creator: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ movements: movements.map(serializeMovement) });
  } catch (err) {
    console.error("[GET /api/v1/inventory/[id]/stock-movements]", err);
    return NextResponse.json({ error: "Failed to fetch stock movements" }, { status: 500 });
  }
}, { allowedRoles: ["client", "employee", "admin"] });

export const POST = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id } = await params;
    const clientId = resolveClientId(user);
    if (!clientId) return NextResponse.json({ error: "Active client context required" }, { status: 400 });

    const item = await prisma.wehowareInventoryItem.findFirst({
      where: { id, clientId },
    });
    if (!item) return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });

    const body = await request.json();
    const { movement_type: movementType, quantity, reason } = body ?? {};

    if (!movementType || !MOVEMENT_TYPE_DIRECTIONS.hasOwnProperty(movementType)) {
      return NextResponse.json({ error: "Invalid movement_type" }, { status: 400 });
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty === 0) {
      return NextResponse.json({ error: "quantity must be a non-zero number" }, { status: 400 });
    }

    const direction = MOVEMENT_TYPE_DIRECTIONS[movementType];
    const absQty = Math.abs(qty);
    const change = direction !== 0 ? direction * absQty : qty;
    const newQuantity = Math.max(0, item.quantity + change);

    const [movement] = await prisma.$transaction([
      prisma.wehowareInventoryStockMovement.create({
        data: {
          itemId: id,
          clientId,
          movementType,
          quantityChange: change,
          quantityAfter: newQuantity,
          reason: reason || null,
          createdBy: user.id,
        },
        include: {
          item: { select: { id: true, title: true, sku: true } },
          creator: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      prisma.wehowareInventoryItem.update({
        where: { id },
        data: {
          quantity: newQuantity,
          status: newQuantity === 0 ? "out_of_stock" : newQuantity <= item.reorderThreshold ? "low_stock" : "in_stock",
          updatedBy: user.id,
        },
      }),
    ]);

    return NextResponse.json({ movement: serializeMovement(movement), item: { id, quantity: newQuantity } }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/v1/inventory/[id]/stock-movements]", err);
    if (err instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    return NextResponse.json({ error: "Failed to record stock movement" }, { status: 500 });
  }
}, { allowedRoles: ["employee", "admin"] });
