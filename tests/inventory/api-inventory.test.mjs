// Integration tests for /api/v1/inventory endpoints
import { test } from "node:test";
import assert from "node:assert/strict";
import { GET as listItems, POST as createItem } from "@/app/api/v1/inventory/route";
import {
  GET as getItem,
  PUT as updateItem,
  DELETE as deleteItem,
} from "@/app/api/v1/inventory/[id]/route";
import { POST as duplicateItem } from "@/app/api/v1/inventory/[id]/duplicate/route";
import { GET as listMovements, POST as createMovement } from "@/app/api/v1/inventory/[id]/stock-movements/route";
import { POST as bulkAction } from "@/app/api/v1/inventory/bulk/route";
import { GET as listCategories, POST as createCategory } from "@/app/api/v1/inventory/categories/route";
import { PUT as updateCategory, DELETE as deleteCategory } from "@/app/api/v1/inventory/categories/[id]/route";
import { GET as listAllMovements } from "@/app/api/v1/inventory/stock-movements/route";
import { GET as getSettings, PUT as updateSettings } from "@/app/api/v1/inventory/settings/route";
import { makeRequest, seedAdmin, expectStatus, __seed } from "../harness.mjs";

// -----------------------------------------------------------------------
// Inventory Items — GET (list)
// -----------------------------------------------------------------------

test("inventory GET: requires authentication", async () => {
  const { __resetSession } = await import("../mocks/auth.mjs");
  __resetSession();
  const req = makeRequest({ url: "http://t/api/v1/inventory" });
  const res = await listItems(req, {});
  expectStatus(res, 401);
});

test("inventory GET: lists items scoped to active client", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareInventoryItem", [
    { id: "i1", clientId, title: "Toyota Camry", slug: "toyota-camry", active: true, status: "in_stock", tags: [] },
    { id: "i2", clientId, title: "Honda Civic", slug: "honda-civic", active: false, status: "in_stock", tags: [] },
    { id: "i3", clientId: "other-client", title: "Other Car", slug: "other-car", active: true, status: "in_stock", tags: [] },
  ]);
  const res = await listItems(makeRequest({ url: "http://t/api/v1/inventory" }), {});
  expectStatus(res, 200);
  const body = await res.json();
  assert.equal(body.data.length, 2);
  assert.deepEqual(body.data.map((i) => i.id).sort(), ["i1", "i2"]);
});

test("inventory GET: respects pagination", async () => {
  const { clientId } = seedAdmin();
  const rows = Array.from({ length: 25 }, (_, i) => ({
    id: `item-${i}`,
    clientId,
    title: `Item ${i}`,
    slug: `item-${i}`,
    active: true,
    status: "in_stock",
    tags: [],
  }));
  __seed("wehowareInventoryItem", rows);
  const res = await listItems(
    makeRequest({ url: "http://t/api/v1/inventory?limit=10&page=2" }),
    {}
  );
  const body = await res.json();
  assert.equal(body.data.length, 10);
  assert.equal(body.pagination.totalItems, 25);
  assert.equal(body.pagination.page, 2);
  assert.equal(body.pagination.totalPages, 3);
});

test("inventory GET: filters by type and status", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareInventoryItem", [
    { id: "i1", clientId, title: "Car", slug: "car", type: "vehicle", status: "in_stock", active: true, tags: [] },
    { id: "i2", clientId, title: "Chair", slug: "chair", type: "furniture", status: "out_of_stock", active: true, tags: [] },
    { id: "i3", clientId, title: "Car2", slug: "car2", type: "vehicle", status: "sold", active: true, tags: [] },
  ]);
  const res = await listItems(
    makeRequest({ url: "http://t/api/v1/inventory?type=vehicle&status=in_stock" }),
    {}
  );
  const body = await res.json();
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].id, "i1");
});

test("inventory GET: returns stats", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareInventoryItem", [
    { id: "i1", clientId, title: "A", slug: "a", active: true, status: "in_stock", quantity: 10, reorderThreshold: 5, tags: [] },
    { id: "i2", clientId, title: "B", slug: "b", active: true, status: "in_stock", quantity: 2, reorderThreshold: 5, tags: [] },
    { id: "i3", clientId, title: "C", slug: "c", active: true, status: "out_of_stock", quantity: 0, reorderThreshold: 5, tags: [] },
    { id: "i4", clientId, title: "D", slug: "d", active: false, status: "in_stock", quantity: 10, reorderThreshold: 5, tags: [] },
  ]);
  const res = await listItems(makeRequest({ url: "http://t/api/v1/inventory" }), {});
  const body = await res.json();
  assert.equal(body.stats.total, 4);
  assert.equal(body.stats.active, 3);
  assert.equal(body.stats.lowStock, 2);
  assert.equal(body.stats.outOfStock, 1);
});

// -----------------------------------------------------------------------
// Inventory Items — POST (create)
// -----------------------------------------------------------------------

test("inventory POST: creates item with required fields", async () => {
  const { clientId, userId } = seedAdmin();
  __seed("wehowareInventoryCategory", [
    { id: "cat-1", clientId, name: "Sedans", slug: "sedans", active: true },
  ]);
  const res = await createItem(
    makeRequest({
      method: "POST",
      url: "http://t/api/v1/inventory",
      body: { title: "New Car", category_id: "cat-1", type: "vehicle", price: 45000 },
    }),
    {}
  );
  expectStatus(res, 201);
  const body = await res.json();
  assert.equal(body.item.title, "New Car");
  assert.equal(body.item.slug, "new-car");
  assert.equal(body.item.type, "vehicle");
  assert.equal(body.item.client_id, clientId);
  assert.equal(body.item.created_by, userId);
});

test("inventory POST: rejects missing title", async () => {
  seedAdmin();
  const res = await createItem(
    makeRequest({
      method: "POST",
      url: "http://t/api/v1/inventory",
      body: { type: "vehicle" },
    }),
    {}
  );
  expectStatus(res, 400);
});

// -----------------------------------------------------------------------
// Inventory Items — GET/PUT/DELETE by ID
// -----------------------------------------------------------------------

test("inventory GET [id]: returns item by id", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareInventoryItem", [
    { id: "i1", clientId, title: "Test Car", slug: "test-car", active: true, status: "in_stock", tags: [] },
  ]);
  const res = await getItem(makeRequest({ url: "http://t/api/v1/inventory/i1" }), { params: { id: "i1" } });
  expectStatus(res, 200);
  const body = await res.json();
  assert.equal(body.item.title, "Test Car");
});

test("inventory GET [id]: 404 for non-existent item", async () => {
  seedAdmin();
  const res = await getItem(makeRequest({ url: "http://t/api/v1/inventory/nonexistent" }), { params: { id: "nonexistent" } });
  expectStatus(res, 404);
});

test("inventory PUT [id]: updates item title", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareInventoryItem", [
    { id: "i1", clientId, title: "Old Title", slug: "old-title", active: true, status: "in_stock", tags: [] },
  ]);
  const res = await updateItem(
    makeRequest({
      method: "PUT",
      url: "http://t/api/v1/inventory/i1",
      body: { title: "New Title" },
    }),
    { params: { id: "i1" } }
  );
  expectStatus(res, 200);
  const body = await res.json();
  assert.equal(body.item.title, "New Title");
});

test("inventory DELETE [id]: deletes item", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareInventoryItem", [
    { id: "i1", clientId, title: "To Delete", slug: "to-delete", active: true, status: "in_stock", tags: [] },
  ]);
  const res = await deleteItem(
    makeRequest({ method: "DELETE", url: "http://t/api/v1/inventory/i1" }),
    { params: { id: "i1" } }
  );
  expectStatus(res, 200);
});

// -----------------------------------------------------------------------
// Inventory Items — Duplicate
// -----------------------------------------------------------------------

test("inventory POST [id]/duplicate: creates a copy with unique slug", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareInventoryItem", [
    { id: "i1", clientId, title: "Original", slug: "original", type: "vehicle", active: true, status: "in_stock", price: 1000, tags: [] },
  ]);
  const res = await duplicateItem(
    makeRequest({ method: "POST", url: "http://t/api/v1/inventory/i1/duplicate" }),
    { params: { id: "i1" } }
  );
  expectStatus(res, 201);
  const body = await res.json();
  assert.notEqual(body.item.slug, "original");
  assert.equal(body.item.slug, "original-copy");
});

// -----------------------------------------------------------------------
// Stock Movements
// -----------------------------------------------------------------------

test("stock-movements POST [id]: records movement and updates quantity", async () => {
  const { clientId, userId } = seedAdmin();
  __seed("wehowareInventoryItem", [
    { id: "i1", clientId, title: "Car", slug: "car", active: true, status: "in_stock", quantity: 5, reorderThreshold: 2, tags: [] },
  ]);
  const res = await createMovement(
    makeRequest({
      method: "POST",
      url: "http://t/api/v1/inventory/i1/stock-movements",
      body: { movement_type: "restock", quantity: 10, reason: "New shipment" },
    }),
    { params: { id: "i1" } }
  );
  expectStatus(res, 201);
  const body = await res.json();
  assert.equal(body.movement.movement_type, "restock");
  assert.equal(body.movement.quantity_change, 10);
  assert.equal(body.movement.quantity_after, 15);
  assert.equal(body.movement.created_by, userId);
});

test("stock-movements POST [id]: rejects zero quantity", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareInventoryItem", [
    { id: "i1", clientId, title: "Car", slug: "car", active: true, status: "in_stock", quantity: 5, tags: [] },
  ]);
  const res = await createMovement(
    makeRequest({
      method: "POST",
      url: "http://t/api/v1/inventory/i1/stock-movements",
      body: { movement_type: "restock", quantity: 0 },
    }),
    { params: { id: "i1" } }
  );
  expectStatus(res, 400);
});

test("stock-movements GET [id]: lists movements for an item", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareInventoryItem", [
    { id: "i1", clientId, title: "Car", slug: "car", active: true, status: "in_stock", quantity: 5, tags: [] },
  ]);
  __seed("wehowareInventoryStockMovement", [
    { id: "m1", itemId: "i1", clientId, movementType: "stock_in", quantityChange: 10, quantityAfter: 10, createdAt: new Date("2024-01-01") },
    { id: "m2", itemId: "i1", clientId, movementType: "stock_out", quantityChange: -5, quantityAfter: 5, createdAt: new Date("2024-01-02") },
  ]);
  const res = await listMovements(
    makeRequest({ url: "http://t/api/v1/inventory/i1/stock-movements" }),
    { params: { id: "i1" } }
  );
  expectStatus(res, 200);
  const body = await res.json();
  assert.equal(body.movements.length, 2);
});

test("stock-movements GET (global): lists all movements for client", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareInventoryStockMovement", [
    { id: "m1", itemId: "i1", clientId, movementType: "stock_in", quantityChange: 5, quantityAfter: 5 },
    { id: "m2", itemId: "i2", clientId, movementType: "adjustment", quantityChange: -1, quantityAfter: 4 },
    { id: "m3", itemId: "i3", clientId: "other", movementType: "stock_in", quantityChange: 3, quantityAfter: 3 },
  ]);
  const res = await listAllMovements(
    makeRequest({ url: "http://t/api/v1/inventory/stock-movements" }),
    {}
  );
  expectStatus(res, 200);
  const body = await res.json();
  assert.equal(body.data.length, 2);
});

// -----------------------------------------------------------------------
// Bulk Operations
// -----------------------------------------------------------------------

test("inventory POST /bulk: activates items", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareInventoryItem", [
    { id: "i1", clientId, title: "A", slug: "a", active: false, status: "in_stock", tags: [] },
    { id: "i2", clientId, title: "B", slug: "b", active: false, status: "in_stock", tags: [] },
  ]);
  const res = await bulkAction(
    makeRequest({
      method: "POST",
      url: "http://t/api/v1/inventory/bulk",
      body: { action: "activate", ids: ["i1", "i2"] },
    }),
    {}
  );
  expectStatus(res, 200);
  const body = await res.json();
  assert.equal(body.updated, 2);
});

test("inventory POST /bulk: deletes items", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareInventoryItem", [
    { id: "i1", clientId, title: "A", slug: "a", active: true, status: "in_stock", tags: [] },
    { id: "i2", clientId, title: "B", slug: "b", active: true, status: "in_stock", tags: [] },
  ]);
  const res = await bulkAction(
    makeRequest({
      method: "POST",
      url: "http://t/api/v1/inventory/bulk",
      body: { action: "delete", ids: ["i1", "i2"] },
    }),
    {}
  );
  expectStatus(res, 200);
  const body = await res.json();
  assert.equal(body.deleted, 2);
});

// -----------------------------------------------------------------------
// Categories
// -----------------------------------------------------------------------

test("categories GET: lists categories scoped to client", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareInventoryCategory", [
    { id: "c1", clientId, name: "Sedans", slug: "sedans", active: true },
    { id: "c2", clientId, name: "SUVs", slug: "suvs", active: true },
    { id: "c3", clientId: "other", name: "Other", slug: "other", active: true },
  ]);
  const res = await listCategories(makeRequest({ url: "http://t/api/v1/inventory/categories" }), {});
  expectStatus(res, 200);
  const body = await res.json();
  assert.equal(body.data.length, 2);
});

test("categories POST: creates category with slug", async () => {
  const { clientId, userId } = seedAdmin();
  const res = await createCategory(
    makeRequest({
      method: "POST",
      url: "http://t/api/v1/inventory/categories",
      body: { name: "Trucks", description: "Pickup trucks" },
    }),
    {}
  );
  expectStatus(res, 201);
  const body = await res.json();
  assert.equal(body.data.name, "Trucks");
  assert.equal(body.data.slug, "trucks");
  assert.equal(body.data.client_id, clientId);
  assert.equal(body.data.created_by, userId);
});

test("categories POST: rejects missing name", async () => {
  seedAdmin();
  const res = await createCategory(
    makeRequest({
      method: "POST",
      url: "http://t/api/v1/inventory/categories",
      body: { description: "No name" },
    }),
    {}
  );
  expectStatus(res, 400);
});

test("categories PUT [id]: updates category name", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareInventoryCategory", [
    { id: "c1", clientId, name: "Old Name", slug: "old-name", active: true },
  ]);
  const res = await updateCategory(
    makeRequest({
      method: "PUT",
      url: "http://t/api/v1/inventory/categories/c1",
      body: { name: "New Name" },
    }),
    { params: { id: "c1" } }
  );
  expectStatus(res, 200);
  const body = await res.json();
  assert.equal(body.data.name, "New Name");
});

test("categories DELETE [id]: deletes category", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareInventoryCategory", [
    { id: "c1", clientId, name: "To Delete", slug: "to-delete", active: true },
  ]);
  const res = await deleteCategory(
    makeRequest({ method: "DELETE", url: "http://t/api/v1/inventory/categories/c1" }),
    { params: { id: "c1" } }
  );
  expectStatus(res, 200);
});

// -----------------------------------------------------------------------
// Settings
// -----------------------------------------------------------------------

test("settings GET: returns defaults when no settings exist", async () => {
  const { clientId } = seedAdmin();
  const res = await getSettings(makeRequest({ url: "http://t/api/v1/inventory/settings" }), {});
  expectStatus(res, 200);
  const body = await res.json();
  assert.equal(body.settings.default_currency, "CAD");
  assert.equal(body.settings.low_stock_threshold, 5);
  assert.equal(body.settings.enable_stock_tracking, true);
});

test("settings GET: returns existing settings", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareInventorySetting", [
    { id: "s1", clientId, defaultCurrency: "USD", lowStockThreshold: 10, enableStockTracking: false },
  ]);
  const res = await getSettings(makeRequest({ url: "http://t/api/v1/inventory/settings" }), {});
  expectStatus(res, 200);
  const body = await res.json();
  assert.equal(body.settings.default_currency, "USD");
  assert.equal(body.settings.low_stock_threshold, 10);
  assert.equal(body.settings.enable_stock_tracking, false);
});

test("settings PUT: updates settings", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareInventorySetting", [
    { id: "s1", clientId, defaultCurrency: "CAD", lowStockThreshold: 5 },
  ]);
  const res = await updateSettings(
    makeRequest({
      method: "PUT",
      url: "http://t/api/v1/inventory/settings",
      body: { default_currency: "EUR", low_stock_threshold: 3 },
    }),
    {}
  );
  expectStatus(res, 200);
  const body = await res.json();
  assert.equal(body.settings.default_currency, "EUR");
  assert.equal(body.settings.low_stock_threshold, 3);
});

test("settings PUT: creates settings if none exist (upsert)", async () => {
  const { clientId } = seedAdmin();
  const res = await updateSettings(
    makeRequest({
      method: "PUT",
      url: "http://t/api/v1/inventory/settings",
      body: { default_currency: "GBP" },
    }),
    {}
  );
  expectStatus(res, 200);
  const body = await res.json();
  assert.equal(body.settings.default_currency, "GBP");
});
