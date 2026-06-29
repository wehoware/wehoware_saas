// tests/mocks/prisma.mjs
// In-memory Prisma-shaped fake for the accounting models exercised by
// the API route tests. Only supports the handful of queries actually used
// by the handlers — keep it minimal and predictable.
//
// Usage in tests:
//   import { prisma, __reset, __seed } from "../mocks/prisma.mjs";
//   __reset();
//   __seed("wehowareVendor", [{ id: "v1", clientId: "c1", name: "Acme" }]);

import { randomUUID } from "node:crypto";

// -----------------------------------------------------------------
// Central store
// -----------------------------------------------------------------

const store = makeEmptyStore();

function makeEmptyStore() {
  return {
    wehowareProfile: [],
    wehowareUserClient: [],
    wehowareClient: [],
    wehowareVendor: [],
    wehowareBill: [],
    wehowareBillLineItem: [],
    wehowareBillPayment: [],
    wehowareExpense: [],
    wehowareInvoice: [],
    wehowareInvoiceLineItem: [],
    wehowareInvoiceSettings: [],
    wehowareAccountingSettings: [],
    wehowareTransaction: [],
    wehowareBankAccount: [],
    wehowareClientSwitchHistory: [],
    wehowarePlaidItem: [],
    wehowareBankStatementEntry: [],
    wehowareEmailLog: [],
    wehowareReminderRule: [],
    wehowareCronJobRun: [],
    wehowareInventoryCategory: [],
    wehowareInventoryItem: [],
    wehowareInventoryStockMovement: [],
    wehowareInventorySetting: [],
  };
}

export function __reset() {
  for (const key of Object.keys(store)) {
    store[key] = [];
  }
}

export function __seed(model, rows) {
  if (!(model in store)) {
    throw new Error(`Unknown model: ${model}`);
  }
  store[model].push(...rows.map((r) => ({ ...r })));
}

export function __dump(model) {
  return store[model].map((r) => ({ ...r }));
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

function clone(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(clone);
  if (obj instanceof Date) return new Date(obj.getTime());
  if (typeof obj !== "object") return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k] = clone(v);
  return out;
}

function matchesWhere(row, where) {
  if (!where) return true;
  for (const [key, condition] of Object.entries(where)) {
    if (key === "AND") {
      if (!condition.every((c) => matchesWhere(row, c))) return false;
      continue;
    }
    if (key === "OR") {
      if (!condition.some((c) => matchesWhere(row, c))) return false;
      continue;
    }
    if (condition !== null && typeof condition === "object" && !(condition instanceof Date)) {
      const value = row[key];
      // Evaluate every operator present on this condition. Conditions like
      // { gte: t1, lt: t2 } must satisfy BOTH; do NOT short-circuit after
      // the first match.
      let handled = false;
      if ("contains" in condition) {
        handled = true;
        if (
          typeof value !== "string" ||
          !value.toLowerCase().includes(String(condition.contains).toLowerCase())
        ) {
          return false;
        }
      }
      if ("equals" in condition) {
        handled = true;
        if (value !== condition.equals) return false;
      }
      if ("in" in condition) {
        handled = true;
        if (!Array.isArray(condition.in) || !condition.in.includes(value)) {
          return false;
        }
      }
      if ("notIn" in condition) {
        handled = true;
        if (Array.isArray(condition.notIn) && condition.notIn.includes(value)) {
          return false;
        }
      }
      if ("not" in condition) {
        handled = true;
        if (condition.not === null) {
          if (value === null || value === undefined) return false;
        } else if (value === condition.not) {
          return false;
        }
      }
      if ("gte" in condition) {
        handled = true;
        if (!(value >= condition.gte)) return false;
      }
      if ("gt" in condition) {
        handled = true;
        if (!(value > condition.gt)) return false;
      }
      if ("lte" in condition) {
        handled = true;
        if (!(value <= condition.lte)) return false;
      }
      if ("lt" in condition) {
        handled = true;
        if (!(value < condition.lt)) return false;
      }
      if (handled) continue;
    }
    if (row[key] !== condition) return false;
  }
  return true;
}

function sortRows(rows, orderBy) {
  if (!orderBy) return rows;
  const entries = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const entry of entries) {
      for (const [key, dir] of Object.entries(entry)) {
        const av = a[key];
        const bv = b[key];
        if (av === bv) continue;
        const cmp = av > bv ? 1 : -1;
        return dir === "desc" ? -cmp : cmp;
      }
    }
    return 0;
  });
}

function applyInclude(row, include, modelKey) {
  if (!include) return row;
  const out = { ...row };
  for (const [relation, config] of Object.entries(include)) {
    const resolver = RELATIONS[modelKey]?.[relation];
    if (!resolver) continue;
    const related = resolver(row);
    if (Array.isArray(related)) {
      let list = clone(related);
      if (config?.orderBy) list = sortRows(list, config.orderBy);
      if (config?.where) list = list.filter((r) => matchesWhere(r, config.where));
      out[relation] = list;
    } else {
      out[relation] = related ? clone(related) : null;
    }
  }
  return out;
}

// -----------------------------------------------------------------
// Relation resolvers — tell the mock how to eager-load relations.
// -----------------------------------------------------------------
const RELATIONS = {
  wehowareBill: {
    vendor(row) {
      return store.wehowareVendor.find((v) => v.id === row.vendorId) || null;
    },
    lineItems(row) {
      return store.wehowareBillLineItem.filter((li) => li.billId === row.id);
    },
    payments(row) {
      return store.wehowareBillPayment.filter((p) => p.billId === row.id);
    },
  },
  wehowareInvoice: {
    lineItems(row) {
      return store.wehowareInvoiceLineItem.filter((li) => li.invoiceId === row.id);
    },
  },
  wehowareExpense: {
    submitter(row) {
      return store.wehowareProfile.find((p) => p.id === row.submittedBy) || null;
    },
    approver(row) {
      return row.approvedBy
        ? store.wehowareProfile.find((p) => p.id === row.approvedBy)
        : null;
    },
  },
  wehowareVendor: {},
  wehowareTransaction: {},
  wehowarePlaidItem: {
    bankAccounts(row) {
      return store.wehowareBankAccount.filter(
        (a) => a.plaidItemId === row.itemId
      );
    },
    statementEntries(row) {
      return store.wehowareBankStatementEntry.filter(
        (e) => e.plaidItemId === row.itemId
      );
    },
  },
  wehowareBankStatementEntry: {
    plaidItem(row) {
      return (
        store.wehowarePlaidItem.find((i) => i.itemId === row.plaidItemId) ||
        null
      );
    },
    bankAccount(row) {
      return (
        store.wehowareBankAccount.find((a) => a.id === row.bankAccountId) ||
        null
      );
    },
  },
  wehowareBankAccount: {
    plaidItem(row) {
      return (
        store.wehowarePlaidItem.find((i) => i.itemId === row.plaidItemId) ||
        null
      );
    },
  },
  wehowareInventoryItem: {
    category(row) {
      return store.wehowareInventoryCategory.find((c) => c.id === row.categoryId) || null;
    },
    stockMovements(row) {
      return store.wehowareInventoryStockMovement.filter((m) => m.itemId === row.id);
    },
  },
  wehowareInventoryCategory: {
    items(row) {
      return store.wehowareInventoryItem.filter((i) => i.categoryId === row.id);
    },
  },
  wehowareInventoryStockMovement: {
    item(row) {
      return store.wehowareInventoryItem.find((i) => i.id === row.itemId) || null;
    },
  },
};

// -----------------------------------------------------------------
// Model factory
// -----------------------------------------------------------------

// Default column values that match the Prisma schema's `@default(...)`.
// The handlers assume these are populated by the DB so the mock must too.
const DEFAULTS = {
  wehowareBill: {
    amountPaid: 0,
    subtotal: 0,
    taxRate: 0,
    taxAmount: 0,
    total: 0,
    status: "Draft",
    currency: "CAD",
  },
  wehowareInvoice: {
    subtotal: 0,
    taxRate: 0,
    taxAmount: 0,
    total: 0,
    amountPaid: 0,
    status: "Draft",
    currency: "CAD",
  },
  wehowareExpense: {
    taxAmount: 0,
    currency: "CAD",
    status: "Pending",
  },
  wehowareVendor: {
    active: true,
  },
  wehowareAccountingSettings: {
    defaultCurrency: "CAD",
    defaultTaxRate: 0,
    fiscalYearStart: 1,
    billNumberFormat: "BILL-{YYYY}-{XXXX}",
    nextBillNumber: 1,
    reminderEnabled: false,
    reminderDaysBefore: 7,
  },
  wehowareInvoiceSettings: {
    invoiceFormat: "INV-{YYYY}-{XXXX}",
    nextInvoiceNumber: 1,
    defaultCurrency: "CAD",
    defaultTaxRate: 0,
  },
  wehowareTransaction: {
    type: "Other",
    status: "Pending",
    source: "Manual",
    direction: "Incoming",
    reconciliation: "Unreconciled",
    matchedAmount: 0,
    currency: "CAD",
  },
  wehowarePlaidItem: {
    status: "Active",
  },
  wehowareBankStatementEntry: {
    source: "Plaid",
    currency: "CAD",
    pending: false,
    reconciliation: "Unreconciled",
    importedAt: new Date(0),
  },
  wehowareEmailLog: {
    status: "Queued",
    attemptCount: 0,
  },
  wehowareReminderRule: {
    active: true,
  },
  wehowareCronJobRun: {
    status: "Running",
  },
  wehowareBankAccount: {
    isActive: true,
    currency: "CAD",
    type: "Checking",
    balance: 0,
  },
  wehowareInventoryCategory: {
    active: true,
  },
  wehowareInventoryItem: {
    type: "product",
    currency: "CAD",
    priceVisible: true,
    quantity: 0,
    reorderThreshold: 0,
    status: "in_stock",
    tags: [],
    featured: false,
    active: true,
    images: null,
    videos: null,
    views: 0,
  },
  wehowareInventoryStockMovement: {},
  wehowareInventorySetting: {
    defaultCurrency: "CAD",
    lowStockThreshold: 5,
    autoArchiveDays: 90,
    enableStockTracking: true,
    enableLowStockAlerts: true,
    enablePublicListing: true,
    enableInquiries: true,
    enableTestDrive: false,
    defaultItemType: "product",
  },
};

function applyDefaults(key, data) {
  return { ...(DEFAULTS[key] ?? {}), ...data };
}

function makeModel(key) {
  return {
    async findMany({ where, orderBy, include, skip = 0, take, select } = {}) {
      let rows = store[key].filter((r) => matchesWhere(r, where));
      rows = sortRows(rows, orderBy);
      if (skip) rows = rows.slice(skip);
      if (take !== undefined) rows = rows.slice(0, take);
      if (select) {
        rows = rows.map((r) => projectSelect(r, select));
      }
      return rows.map((r) => applyInclude(clone(r), include, key));
    },
    async findFirst({ where, include, orderBy, select } = {}) {
      let rows = store[key].filter((r) => matchesWhere(r, where));
      rows = sortRows(rows, orderBy);
      const row = rows[0];
      if (!row) return null;
      if (select) return projectSelect(clone(row), select);
      return applyInclude(clone(row), include, key);
    },
    async findUnique({ where, include, select } = {}) {
      const row = store[key].find((r) => matchesWhere(r, where));
      if (!row) return null;
      if (select) return projectSelect(clone(row), select);
      return applyInclude(clone(row), include, key);
    },
    async count({ where } = {}) {
      return store[key].filter((r) => matchesWhere(r, where)).length;
    },
    async create({ data, include }) {
      const row = applyDefaults(key, {
        id: data.id || randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      });
      store[key].push(row);
      return applyInclude(clone(row), include, key);
    },
    async createMany({ data }) {
      const rows = Array.isArray(data) ? data : [data];
      for (const d of rows) {
        const row = applyDefaults(key, {
          id: d.id || randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
          ...d,
        });
        store[key].push(row);
      }
      return { count: rows.length };
    },
    async update({ where, data, include }) {
      const row = store[key].find((r) => matchesWhere(r, where));
      if (!row) {
        const err = new Error("Record to update not found");
        err.code = "P2025";
        throw err;
      }
      Object.assign(row, data, { updatedAt: new Date() });
      return applyInclude(clone(row), include, key);
    },
    async upsert({ where, update, create, include }) {
      const row = store[key].find((r) => matchesWhere(r, where));
      if (row) {
        Object.assign(row, update, { updatedAt: new Date() });
        return applyInclude(clone(row), include, key);
      }
      const created = applyDefaults(key, {
        id: create.id || randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...create,
      });
      store[key].push(created);
      return applyInclude(clone(created), include, key);
    },
    async delete({ where }) {
      const idx = store[key].findIndex((r) => matchesWhere(r, where));
      if (idx === -1) {
        const err = new Error("Record to delete not found");
        err.code = "P2025";
        throw err;
      }
      const [removed] = store[key].splice(idx, 1);
      return clone(removed);
    },
    async deleteMany({ where } = {}) {
      const before = store[key].length;
      store[key] = store[key].filter((r) => !matchesWhere(r, where));
      return { count: before - store[key].length };
    },
    async updateMany({ where, data } = {}) {
      let count = 0;
      for (const row of store[key]) {
        if (matchesWhere(row, where)) {
          Object.assign(row, data, { updatedAt: new Date() });
          count += 1;
        }
      }
      return { count };
    },
    async aggregate({ where, _sum } = {}) {
      const rows = store[key].filter((r) => matchesWhere(r, where));
      const out = {};
      if (_sum) {
        out._sum = {};
        for (const field of Object.keys(_sum)) {
          out._sum[field] = rows.reduce(
            (acc, r) => acc + Number(r[field] ?? 0),
            0
          );
        }
      }
      return out;
    },
  };
}

function projectSelect(row, select) {
  const out = {};
  for (const [k, v] of Object.entries(select)) {
    if (v) out[k] = row[k];
  }
  return out;
}

// -----------------------------------------------------------------
// Assemble the prisma client
// -----------------------------------------------------------------
export const prisma = {
  wehowareProfile: makeModel("wehowareProfile"),
  wehowareUserClient: makeModel("wehowareUserClient"),
  wehowareClient: makeModel("wehowareClient"),
  wehowareVendor: makeModel("wehowareVendor"),
  wehowareBill: makeModel("wehowareBill"),
  wehowareBillLineItem: makeModel("wehowareBillLineItem"),
  wehowareBillPayment: makeModel("wehowareBillPayment"),
  wehowareExpense: makeModel("wehowareExpense"),
  wehowareInvoice: makeModel("wehowareInvoice"),
  wehowareInvoiceLineItem: makeModel("wehowareInvoiceLineItem"),
  wehowareInvoiceSettings: makeModel("wehowareInvoiceSettings"),
  wehowareAccountingSettings: makeModel("wehowareAccountingSettings"),
  wehowareTransaction: makeModel("wehowareTransaction"),
  wehowareBankAccount: makeModel("wehowareBankAccount"),
  wehowareClientSwitchHistory: makeModel("wehowareClientSwitchHistory"),
  wehowarePlaidItem: makeModel("wehowarePlaidItem"),
  wehowareBankStatementEntry: makeModel("wehowareBankStatementEntry"),
  wehowareEmailLog: makeModel("wehowareEmailLog"),
  wehowareReminderRule: makeModel("wehowareReminderRule"),
  wehowareCronJobRun: makeModel("wehowareCronJobRun"),
  wehowareInventoryCategory: makeModel("wehowareInventoryCategory"),
  wehowareInventoryItem: makeModel("wehowareInventoryItem"),
  wehowareInventoryStockMovement: makeModel("wehowareInventoryStockMovement"),
  wehowareInventorySetting: makeModel("wehowareInventorySetting"),

  async $queryRaw(strings, ...values) {
    // Simplified mock for the lowStock query
    // SELECT COUNT(*) AS cnt FROM wehoware_inventory_items WHERE client_id = ? AND active = 1 AND quantity <= reorder_threshold
    const clientId = values[0];
    const count = store.wehowareInventoryItem.filter(
      (r) => r.clientId === clientId && r.active === true && r.quantity <= (r.reorderThreshold || 0)
    ).length;
    return [{ cnt: count }];
  },

  async $transaction(handlerOrOps) {
    // Same-process mock — just run sequentially. If passed an array of
    // promise-like ops, await them in order.
    if (typeof handlerOrOps === "function") {
      return handlerOrOps(this);
    }
    const results = [];
    for (const op of handlerOrOps) {
      results.push(await op);
    }
    return results;
  },
};

export default prisma;
