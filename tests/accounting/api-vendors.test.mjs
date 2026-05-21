// Integration tests for /api/v1/vendors and /api/v1/vendors/[id]
import { test } from "node:test";
import assert from "node:assert/strict";
import { GET as listVendors, POST as createVendor } from "@/app/api/v1/vendors/route";
import {
  GET as getVendor,
  PUT as updateVendor,
  DELETE as deleteVendor,
} from "@/app/api/v1/vendors/[id]/route";
import { makeRequest, seedAdmin, expectStatus, prisma, __seed } from "../harness.mjs";

test("vendors GET: requires authentication", async () => {
  // No seeding -> no session
  const { __resetSession } = await import("../mocks/auth.mjs");
  __resetSession();
  const req = makeRequest({ url: "http://t/api/v1/vendors" });
  const res = await listVendors(req, {});
  expectStatus(res, 401);
});

test("vendors GET: lists scoped to active client only", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareVendor", [
    { id: "v1", clientId, name: "Acme", active: true },
    { id: "v2", clientId, name: "Globex", active: false },
    { id: "v3", clientId: "other-client", name: "Other", active: true },
  ]);
  const res = await listVendors(
    makeRequest({ url: "http://t/api/v1/vendors" }),
    {}
  );
  expectStatus(res, 200);
  const body = await res.json();
  assert.equal(body.data.length, 2);
  assert.deepEqual(
    body.data.map((v) => v.id).sort(),
    ["v1", "v2"]
  );
});

test("vendors GET: respects active=true filter", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareVendor", [
    { id: "v1", clientId, name: "Acme", active: true },
    { id: "v2", clientId, name: "Globex", active: false },
  ]);
  const res = await listVendors(
    makeRequest({ url: "http://t/api/v1/vendors?active=true" }),
    {}
  );
  const body = await res.json();
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].id, "v1");
});

test("vendors GET: respects pagination", async () => {
  const { clientId } = seedAdmin();
  const rows = Array.from({ length: 25 }, (_, i) => ({
    id: `v${i}`,
    clientId,
    name: `Vendor ${i}`,
    active: true,
  }));
  __seed("wehowareVendor", rows);
  const res = await listVendors(
    makeRequest({ url: "http://t/api/v1/vendors?limit=10&page=2" }),
    {}
  );
  const body = await res.json();
  assert.equal(body.data.length, 10);
  assert.equal(body.pagination.totalItems, 25);
  assert.equal(body.pagination.page, 2);
  assert.equal(body.pagination.totalPages, 3);
});

test("vendors POST: rejects empty name", async () => {
  seedAdmin();
  const res = await createVendor(
    makeRequest({
      method: "POST",
      body: { name: "" },
    }),
    {}
  );
  expectStatus(res, 400);
  const body = await res.json();
  assert.match(body.error, /name is required/i);
});

test("vendors POST: creates and returns vendor", async () => {
  const { clientId } = seedAdmin();
  const res = await createVendor(
    makeRequest({
      method: "POST",
      body: { name: "New Vendor", email: "v@example.com" },
    }),
    {}
  );
  expectStatus(res, 201);
  const body = await res.json();
  assert.equal(body.name, "New Vendor");
  assert.equal(body.email, "v@example.com");
  assert.equal(body.active, true);
  assert.equal(body.client_id, clientId);
});

test("vendors PUT: 404s when vendor belongs to another client", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareVendor", [
    { id: "v1", clientId: "other-client", name: "Not Mine", active: true },
  ]);
  const res = await updateVendor(
    makeRequest({ method: "PUT", body: { name: "Hacked" } }),
    { params: Promise.resolve({ id: "v1" }) }
  );
  expectStatus(res, 404);
});

test("vendors PUT: updates fields", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareVendor", [
    { id: "v1", clientId, name: "Acme", active: true, email: "a@x.com" },
  ]);
  const res = await updateVendor(
    makeRequest({
      method: "PUT",
      body: { name: "Acme Corp", active: false },
    }),
    { params: Promise.resolve({ id: "v1" }) }
  );
  expectStatus(res, 200);
  const body = await res.json();
  assert.equal(body.name, "Acme Corp");
  assert.equal(body.active, false);
});

test("vendors DELETE: hard-deletes when no bills exist", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareVendor", [{ id: "v1", clientId, name: "Acme", active: true }]);
  const res = await deleteVendor(
    makeRequest({ method: "DELETE" }),
    { params: Promise.resolve({ id: "v1" }) }
  );
  expectStatus(res, 200);
  const body = await res.json();
  assert.equal(body.archived, false);
  assert.equal((await prisma.wehowareVendor.findFirst({ where: { id: "v1" } })), null);
});

test("vendors DELETE: archives when vendor has bills", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareVendor", [{ id: "v1", clientId, name: "Acme", active: true }]);
  __seed("wehowareBill", [
    {
      id: "b1",
      clientId,
      vendorId: "v1",
      billNumber: "BILL-1",
      total: 100,
      amountPaid: 0,
      status: "Open",
      billDate: new Date(),
      dueDate: new Date(),
    },
  ]);
  const res = await deleteVendor(
    makeRequest({ method: "DELETE" }),
    { params: Promise.resolve({ id: "v1" }) }
  );
  expectStatus(res, 200);
  const body = await res.json();
  assert.equal(body.archived, true);
  // Vendor remains but is archived
  const row = await prisma.wehowareVendor.findFirst({ where: { id: "v1" } });
  assert.ok(row);
  assert.equal(row.active, false);
});

test("vendors GET single: tenant isolation", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareVendor", [
    { id: "v1", clientId: "other", name: "Other", active: true },
  ]);
  const res = await getVendor(
    makeRequest({}),
    { params: Promise.resolve({ id: "v1" }) }
  );
  expectStatus(res, 404);
});
