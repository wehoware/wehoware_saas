# Accounting module test suite

End-to-end test suite for the accounting module (bills, invoices, expenses,
vendors, payments, transactions, settings). Uses Node's built-in `node:test`
runner with a custom ESM loader that resolves the Next.js `@/` path alias and
stubs `next/server`, `@/lib/prisma`, and `@/lib/auth` so API handlers can be
exercised without running a live Next.js dev server.

## Layout

```
tests/
├── README.md                  - this file
├── loader.mjs                 - ESM hook that rewrites @/ and injects mocks
├── mocks/
│   ├── auth.mjs               - stubbed NextAuth `auth()` and helpers
│   ├── next-server.mjs        - stubbed `NextResponse.json`, etc.
│   ├── prisma.mjs             - in-memory Prisma-shaped fake
│   └── invoice-helpers.mjs    - stubs for invoiceTemplates/storage imports
├── harness.mjs                - shared test helpers (makeRequest, resetPrisma)
├── setup.mjs                  - registers the loader
├── accounting/
│   ├── lib-accounting.test.mjs           - src/lib/accounting.js units
│   ├── lib-invoice-number.test.mjs       - src/lib/invoiceNumber.js units
│   ├── lib-invoice-format.test.mjs       - src/lib/invoiceFormat.js units
│   ├── api-vendors.test.mjs              - /api/v1/vendors CRUD
│   ├── api-bills.test.mjs                - /api/v1/bills CRUD + totals
│   ├── api-bill-payments.test.mjs        - /api/v1/bills/[id]/payments
│   ├── api-invoices.test.mjs             - /api/v1/invoices CRUD + totals
│   ├── api-expenses.test.mjs             - /api/v1/expenses CRUD
│   ├── api-expense-approve.test.mjs      - approve/reject/reimburse transitions
│   ├── api-transactions.test.mjs         - /api/v1/transactions CRUD
│   └── api-accounting-settings.test.mjs  - accounting + invoice settings
└── integrations/
    ├── lib-crypto.test.mjs               - AES-GCM secrets + HMAC + safeEqual
    ├── lib-email-templates.test.mjs      - registry rendering + HTML escaping
    ├── lib-email-ses.test.mjs            - sendEmail (log + injected SES) + retry
    ├── lib-cron-auth.test.mjs            - HMAC + bearer cron auth
    ├── lib-cron-jobs.test.mjs            - reminder + Plaid dispatchers + audit
    ├── lib-plaid-sync.test.mjs           - transactionsSync pagination/upserts
    ├── api-cron-route.test.mjs           - POST /api/cron/[job]
    ├── api-plaid-link-token.test.mjs     - POST /api/v1/plaid/link-token
    ├── api-plaid-exchange.test.mjs       - POST /api/v1/plaid/exchange
    ├── api-plaid-webhook.test.mjs        - POST /api/v1/plaid/webhook
    ├── api-plaid-items.test.mjs          - GET/DELETE /api/v1/plaid/items
    ├── api-plaid-sync.test.mjs           - POST /api/v1/plaid/sync
    └── api-plaid-statement-entries.test.mjs - GET /api/v1/plaid/statement-entries
```

## Running

```bash
npm test             # run the whole suite
npm run test:unit    # only pure-utility tests
npm run test:api     # only API-handler tests
```

## Why not jest / vitest?

This suite intentionally avoids a new dev dependency. `node --test` ships
with Node 20+ which this project already requires, and the custom loader
keeps it compatible with the existing Next.js source layout.
