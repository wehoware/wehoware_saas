# Inventory Feature — End-to-End Implementation Plan

## Overview

A flexible, multi-tenant inventory management system for the Wehoware SaaS platform. Phase 1 targets **vehicle inventory** (car dealership clients like Nawab Motors) with a JSON-based custom attribute system designed for future expansion to furniture, food items, menus, generic products, digital products, and more.

### Selected Capabilities
- **Stock movements & audit trail** — Track stock-in, stock-out, adjustments with full audit logging and low-stock alerts.
- **Public API endpoints** — REST APIs for client websites to fetch inventory listings/details by slug (same pattern as services/blogs).
- **Custom attributes per type** — Flexible JSON-based attribute system so vehicles have VIN/mileage/make while future types have their own attributes.

### Out of Scope (Phase 1)
- Multi-location/warehouse support (can be added later as an extension).
- POS integration.
- Supplier purchase order management.

---

# PHASE 1 — FULL CODEBASE ANALYSIS

## 1. Files Analyzed

### 1.1. Foundational Documentation & Configuration

| # | File | Purpose |
|---|------|---------|
| 1 | `CLAUDE.md` | Platform architecture guide — confirms admin-only SaaS, multi-tenant via `clientId`, Next.js 15 App Router, NextAuth v5 JWT, MySQL 8+, Prisma 6.6. Public content served via `/api/public/` endpoints. Sidebar registration required in `AdminLayout.js`. |
| 2 | `prisma/schema.prisma` | Complete database schema (2060 lines). Defines all models, enums, relations. No existing inventory models. Uses `uuid()` IDs, `db.VarChar` for strings, `Json` for flexible data, `clientId` for multi-tenancy, `createdBy`/`updatedBy` for audit. |
| 3 | `package.json` | Dependencies: Next.js 15, React 19, Prisma 6.6, NextAuth, TailwindCSS, Radix UI, `recharts`, `slugify`, `uuid`, AWS SDK clients. Scripts: `db:push`, `db:seed`, `db:studio`, `dev`, `build`. |

### 1.2. Authentication & Middleware

| # | File | Purpose |
|---|------|---------|
| 4 | `src/app/api/utils/auth-middleware.js` | `withAuth()` HOF — verifies JWT session via `auth()`, looks up `WehowareProfile`, enforces role-based access, resolves active `clientId` from query param or cookie, attaches `request.user` (id, email, role, clientId, activeClientId, activeClientRole) and `request.prisma`. This is the entry point for all authenticated API routes. |

### 1.3. API Route Patterns (Internal — `/api/v1/`)

| # | File | Purpose |
|---|------|---------|
| 5 | `src/app/api/v1/services/route.js` | Reference CRUD pattern for a content model. Demonstrates: `withAuth` wrapping, `resolveClientId()` helper, `serialize()` function (camelCase→snake_case), pagination (`page`, `limit`, `MAX_PAGE_SIZE`), search, sort with `SORTABLE_FIELDS`/`FIELD_MAP`, `generateUniqueSlug()`, Prisma error handling (`P2002`, `P2003`), `allowedRoles` config. |
| 6 | `src/app/api/v1/customers/route.js` | Simpler CRUD reference. Shows JSON body parsing with try/catch, field validation (required fields, max length), `serializeCustomer()` pattern, `active` boolean filtering. |
| 7 | `src/app/api/v1/services/` (directory) | 11 subdirectories — includes `[id]/route.js` (GET/PUT/DELETE by ID), `categories/`, `bulk/`, `duplicate/`, etc. This is the most feature-complete API module and the primary template for the inventory API. |

### 1.4. Admin UI Patterns

| # | File | Purpose |
|---|------|---------|
| 8 | `src/components/AdminLayout.js` | Sidebar navigation config and layout. Defines `sidebarSections` array with `type: "link"` and `type: "group"` entries, role-based filtering via `filterSectionsByRole()`, active route detection, group expand/collapse. **New inventory pages must be registered here.** Uses `roles` and optional `clientRoles` for visibility. |
| 9 | `src/app/admin/services/page.js` | Reference admin list page (1391 lines). Demonstrates: `useAuth()` for `activeClient`/`clientUrl`, `useCallback` fetch pattern with query params, pagination UI, search form, filter switches, category dropdown via `SelectInput`, sort dropdown, bulk select/actions, delete confirmation dialog, clone action, stats cards, table with thumbnails, empty state, loading spinner. |
| 10 | `src/components/AdminPageHeader.js` | Shared header component with title, description, action buttons. Used across all admin pages. |

### 1.5. Public API Pattern

| # | File | Purpose |
|---|------|---------|
| 11 | `src/app/api/public/` (directory) | Public REST APIs for client websites. Resolve client via `domain` or `clientId` query parameter (no auth required). This is where public inventory listing/detail endpoints will live. |

### 1.6. Database & Prisma

| # | File | Purpose |
|---|------|---------|
| 12 | `src/lib/prisma.js` | Prisma client singleton instance. Imported by `auth-middleware.js` and attached to `request.prisma`. |
| 13 | `prisma/migrations/` | Migration files (SQL-based). New inventory tables will require a new migration. |
| 14 | `prisma/seed.mjs` | Database seeding script. |

### 1.7. Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | MySQL connection string for Prisma |
| `NEXTAUTH_SECRET` | JWT signing secret for NextAuth |
| `NEXTAUTH_URL` | Base URL for auth callbacks |

No new environment variables are required for the inventory feature.

## 2. How the Existing System Works (Plain-English Summary)

### Multi-Tenancy & Data Isolation
Every business entity in the platform is scoped to a `WehowareClient` via a `clientId` foreign key. When a user makes an API request, the `withAuth` middleware resolves their active client context: for `client` role users, it uses their `profile.clientId`; for `admin`/`employee` users, it resolves from a `clientId` query param or a cookie (`wehoware_active_client_id`), falling back to their primary client assignment. This `activeClientId` is attached to `request.user` and every API handler uses it to filter queries — ensuring a user from Client A can never see or modify Client B's data.

### API Layer Architecture
Internal admin APIs live under `/api/v1/<resource>/` and are wrapped with `withAuth()`. Each handler follows a consistent pattern:
1. Extract `prisma` and `user` from the request object (injected by `withAuth`)
2. Call `resolveClientId(user)` to get the active client
3. Parse query params for pagination (`page`, `limit`), search, sort, filters
4. Build a Prisma `where` clause always including `clientId`
5. Execute `findMany` + `count` in parallel via `Promise.all`
6. Return `{ data: [...], pagination: { totalItems, page, limit, totalPages } }`
7. Serialize results with a `serialize()` function that converts Prisma camelCase to API snake_case

POST/PUT handlers validate required fields, generate slugs (per-client uniqueness), handle Prisma error codes (`P2002` for unique constraint, `P2003` for FK), and set `createdBy`/`updatedBy` from `user.id`.

Public APIs under `/api/public/` skip auth and resolve the client from the request's `domain` or `clientId` parameter.

### Admin UI Architecture
Admin pages are React client components under `/src/app/admin/`. They use `useAuth()` context for the current user and active client. List pages fetch from `/api/v1/` endpoints with query parameters, render data in tables with shadcn/ui components (Card, Button, Input, Switch, Dialog, DropdownMenu), and support search, filter, sort, pagination, bulk actions, and CRUD dialogs. The sidebar in `AdminLayout.js` controls navigation — new pages must be registered in the `sidebarSections` array with appropriate role permissions.

### Prisma Schema Conventions
- IDs: `id String @id @default(uuid())`
- Strings: `db.VarChar(255)` or specific lengths
- Text fields: `db.Text`
- JSON: `Json?` for flexible data
- Timestamps: `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`
- Audit: `createdBy String?`, `updatedBy String?` (references `WehowareProfile.id`)
- Multi-tenancy: `clientId String?` with FK to `WehowareClient`
- Slugs: `slug String? @unique` (usually scoped as `@@unique([clientId, slug])`)
- Enums: Defined at file top level for statuses, types, roles

## 3. Existing Components/Utilities the Inventory Feature Will Use

| Component/Utility | Usage |
|---|---|
| `withAuth()` (`src/app/api/utils/auth-middleware.js`) | Wrap all internal API routes |
| `prisma` (`src/lib/prisma.js`) | Database access |
| `resolveClientId()` pattern | Extract active client for data isolation |
| `serialize()` pattern | Convert Prisma models to API response format |
| `generateUniqueSlug()` pattern | Per-client slug uniqueness for inventory items |
| `AdminLayout.js` sidebar config | Register inventory pages in navigation |
| `AdminPageHeader` | Page header for all inventory admin pages |
| shadcn/ui components (Card, Button, Input, Switch, Dialog, etc.) | UI building blocks |
| `SelectInput` | Dropdown selects in forms/filters |
| `ConfirmDialog` / `AlertComponent` | Delete confirmations and error display |
| `useAuth()` context | Get active client, user role, clientUrl |
| Public API client resolution pattern | For `/api/public/inventory/` endpoints |

## 4. Proposed Data Models (Prisma)

### New Enums
```prisma
enum InventoryItemType {
  vehicle
  furniture
  food
  menu
  product
  digital
  custom
}

enum InventoryItemStatus {
  draft
  active
  sold
  reserved
  archived
  out_of_stock
}

enum StockMovementType {
  stock_in
  stock_out
  adjustment
  transfer
  initial
}

enum InventoryCategoryType {
  vehicle_brand
  vehicle_body_type
  product_category
  food_category
  generic
}
```

### New Models

**WehowareInventoryItem** — The core inventory record (one per vehicle/product/etc.)
- `id`, `clientId`, `type` (InventoryItemType), `status` (InventoryItemStatus)
- `title`, `slug` (unique per client), `description` (Text), `content` (Text)
- `sku` (optional, unique per client), `categoryId`
- `price` (Decimal), `currency` (VarChar, default "CAD")
- `costPrice` (Decimal, optional — for margin calculations)
- `quantity` (Int, default 0) — current stock level
- `reorderThreshold` (Int, default 0) — low-stock alert threshold
- `attributes` (Json) — flexible type-specific data (VIN, mileage, make, model, year for vehicles; dimensions, material for furniture; etc.)
- `images` (Json) — array of image URLs + alt text
- `featured` (Boolean), `active` (Boolean)
- `thumbnail`, `thumbnailAlt`
- SEO fields: `metaTitle`, `metaDescription`, `metaKeywords`, `schemaType`, `seoScore`, `targetKeywords`
- `publishedAt`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`
- Relations: `category`, `stockMovements`, `client`

**WehowareInventoryCategory** — Categories for inventory items
- `id`, `clientId`, `name`, `slug`, `description`, `type` (InventoryCategoryType)
- `parentId` (optional — for nested categories)
- `createdAt`, `updatedAt`
- Relation: `items`

**WehowareStockMovement** — Audit trail for every stock change
- `id`, `clientId`, `itemId`
- `type` (StockMovementType) — stock_in, stock_out, adjustment, transfer, initial
- `quantity` (Int) — positive for in, negative for out
- `previousQuantity` (Int) — stock before this movement
- `newQuantity` (Int) — stock after this movement
- `reason` (VarChar, optional) — e.g. "Purchase order", "Sale", "Damage", "Correction"
- `reference` (VarChar, optional) — PO number, invoice number, etc.
- `notes` (Text, optional)
- `createdBy`, `createdAt`
- Relations: `item`, `client`, `createdByProfile`

**WehowareInventorySettings** — Per-client inventory configuration
- `id`, `clientId`
- `defaultCurrency` (default "CAD")
- `lowStockThreshold` (default 5)
- `enableLowStockAlerts` (Boolean, default true)
- `enablePublicApi` (Boolean, default true)
- `publicListingPageSize` (default 20)
- `attributesSchema` (Json) — defines which custom attributes are expected per `InventoryItemType` for this client
- `createdAt`, `updatedAt`

### Key Indexes
- `@@unique([clientId, slug])` on `WehowareInventoryItem`
- `@@unique([clientId, sku])` on `WehowareInventoryItem`
- `@@index([clientId, status])` on `WehowareInventoryItem`
- `@@index([clientId, type])` on `WehowareInventoryItem`
- `@@index([itemId, createdAt])` on `WehowareStockMovement`
- `@@unique([clientId, slug])` on `WehowareInventoryCategory`

## 5. Proposed File Structure

### API Routes (Internal)
```
src/app/api/v1/inventory/
  route.js                    — GET (list), POST (create)
  [id]/route.js               — GET, PUT, DELETE single item
  categories/route.js         — GET (list), POST (create category)
  categories/[id]/route.js    — PUT, DELETE category
  bulk/route.js               — POST (bulk activate/deactivate/delete)
  stock-movements/route.js    — GET (list movements for an item), POST (create movement)
  settings/route.js           — GET, PUT (inventory settings)
```

### API Routes (Public)
```
src/app/api/public/inventory/
  route.js                    — GET (list active items by client domain/slug)
  [slug]/route.js             — GET (single item details by slug)
  categories/route.js         — GET (list categories)
```

### Admin Pages
```
src/app/admin/inventory/
  page.js                     — List page (table, search, filter, pagination, bulk actions)
  add/page.js                 — Create new item form
  edit/[id]/page.js           — Edit existing item form
  categories/page.js          — Category management
  stock-movements/page.js     — Stock movement history (filterable by item, date, type)
  settings/page.js            — Inventory settings
```

### Sidebar Registration
Add a new group entry in `AdminLayout.js`:
```javascript
{
  type: "group",
  id: "inventory",
  title: "Inventory",
  icon: <Package className="h-5 w-5" />,  // from lucide-react
  roles: ["admin", "employee", "client"],
  children: [
    { title: "All Items", href: "/admin/inventory", icon: ..., roles: ["admin", "employee", "client"], matchExact: true },
    { title: "Categories", href: "/admin/inventory/categories", icon: ..., roles: ["admin", "employee"] },
    { title: "Stock Movements", href: "/admin/inventory/stock-movements", icon: ..., roles: ["admin", "employee"] },
    { title: "Settings", href: "/admin/inventory/settings", icon: ..., roles: ["admin"] },
  ],
}
```

---

# PHASE 2 — REAL-WORLD & WORST-CASE SCENARIO MAPPING

## A. REAL-TIME SCENARIOS

### Normal Happy Path
1. **Create vehicle listing** — Admin fills form with title, price, attributes (make, model, year, VIN, mileage), images. System generates slug, saves item with `status=draft`, `quantity=0`, creates initial `StockMovement` with `type=initial` when quantity is set.
2. **List inventory** — Admin navigates to inventory page, sees paginated table filtered by their `clientId`, can search by title/VIN/SKU, filter by status/type/category, sort by price/date.
3. **Update stock** — Admin records stock-in (e.g., 5 units received). System creates `StockMovement` record, updates `quantity` atomically, checks if quantity crosses `reorderThreshold` and triggers alert.
4. **Publish item** — Admin changes status from `draft` to `active`. Item becomes available via public API.
5. **Public API fetch** — Client website calls `/api/public/inventory?domain=example.com`, receives paginated active items with serialized attributes.
6. **Edit item** — Admin updates price or attributes. `updatedBy` and `updatedAt` are set automatically.
7. **Delete item** — Admin deletes item. System checks for related stock movements (soft delete vs hard delete decision needed — recommend soft delete via `status=archived` with optional hard delete after confirmation).

### Concurrent User Actions (Race Conditions)
8. **Two users edit the same item simultaneously** — User A and User B both open edit page for item X. User A saves first. User B saves second, overwriting A's changes. **Mitigation**: Use `updatedAt` as optimistic concurrency token — compare request's `updatedAt` with DB's `updatedAt` before saving; reject if mismatch.
9. **Double stock movement submission** — User clicks "Add Stock" twice rapidly. Two POST requests arrive. **Mitigation**: Use Prisma transaction (`$transaction`) to read current quantity, compute new quantity, update item, and create movement atomically. Frontend should also disable button after first click.
10. **Two users create items with same title** — Both generate slug "2024-toyota-camry". **Mitigation**: `generateUniqueSlug()` checks DB and appends counter suffix. `@@unique([clientId, slug])` constraint catches race; handler retries with new slug on `P2002`.
11. **Bulk delete while another user is editing one of the selected items** — **Mitigation**: Bulk delete should use individual item status check within transaction; skip items that were modified since the user last fetched them.

### Real-Time Data Updates (Stale Data, Cache Invalidation)
12. **Public API shows stale data after admin updates item** — Admin updates price; client website still shows old price. **Mitigation**: No server-side caching layer currently exists in the app. Public API queries DB directly. If caching is added later, use cache tags or short TTL. For now, data is real-time.
13. **Admin list page shows stale counts after bulk action** — After bulk delete, the total count in stats cards doesn't update. **Mitigation**: Refetch list data after any mutation; the existing pattern already calls `fetchServices(page)` after mutations.
14. **Stock quantity display is stale after another user posts a movement** — **Mitigation**: Stock movements page should refetch on focus/visibility change or poll periodically. The quantity shown on the item list is fetched fresh each page load.

### Network Latency or Partial Failures Mid-Transaction
15. **Stock movement creation succeeds but item quantity update fails** — **Mitigation**: Wrap both operations in a Prisma `$transaction`. If either fails, both roll back. No partial state.
16. **Image upload succeeds but item creation fails** — **Mitigation**: Create item first, then upload images, then update item with image URLs. Or use the existing upload endpoint pattern and only store URLs on successful item save. Orphan uploads are acceptable (can be cleaned up by a cron job).
17. **Request timeout during bulk operation** — User selects 100 items for deletion, request times out at 30s. **Mitigation**: Process bulk operations in batches (e.g., 50 at a time). Return partial results with count of successes/failures. Frontend shows progress.
18. **Public API request is slow due to large dataset** — Client has 10,000 inventory items. **Mitigation**: Enforce pagination with `MAX_PAGE_SIZE=100`. Add DB indexes on `clientId+status`, `clientId+type`. Consider `select` instead of `include` to reduce payload size.

## B. WORST-CASE SCENARIOS

### Database Connection Failure or Timeout
19. **Prisma connection pool exhausted** — Many concurrent requests during a bulk import. **Mitigation**: Prisma handles connection pooling. Bulk import should process in small batches with delays. API routes already have try/catch that returns 500. Frontend shows error dialog with retry option.
20. **Database goes down mid-session** — Admin is editing a form, DB becomes unavailable on save. **Mitigation**: API returns 500 with generic error. Frontend catches error, shows error dialog, preserves form data in state so user doesn't lose input. Retry button re-submits.
21. **Migration fails partway** — Adding inventory tables fails on one table. **Mitigation**: Prisma migrations are transactional in MySQL (DDL). Use `prisma migrate dev` which handles rollback. Test migration on a copy first.

### Third-Party API/Service Unavailable
22. **Image upload service (AWS S3) unavailable** — **Mitigation**: Image upload is optional. Item can be saved without images. Upload endpoint should return a clear error. Frontend allows retry. Images can be added later via edit.
23. **Public API consumer's website is down** — Not our problem. Our API just needs to respond correctly when called.

### Invalid, Malformed, or Missing Input
24. **Missing required fields on create** — No title provided. **Mitigation**: Validate in API route before Prisma call. Return 400 with specific field error message. Frontend shows inline validation errors.
25. **Invalid JSON body** — Malformed JSON in POST/PUT. **Mitigation**: Wrap `request.json()` in try/catch, return 400 "Invalid JSON body" (existing pattern in customers route).
26. **Negative price or quantity** — **Mitigation**: Validate `price >= 0` and `quantity >= 0` in API route. Return 400 with clear message.
27. **Invalid `InventoryItemType` enum value** — Client sends `type: "airplane"`. **Mitigation**: Validate against enum values. Return 400 with list of valid types.
28. **Attributes JSON is not an object** — Client sends `attributes: "hello"` or `attributes: [1,2,3]`. **Mitigation**: Validate that `attributes` is a plain object (or null). Return 400.
29. **SKU contains special characters** — **Mitigation**: Sanitize SKU (alphanumeric + hyphens only). Validate length <= 100.
30. **Extremely long title/description** — **Mitigation**: Enforce `title` max 255 chars, `description` max 5000 chars at API level. Use `db.VarChar(255)` and `db.Text` in schema.
31. **HTML/XSS in description or content fields** — **Mitigation**: Use existing `sanitizeHtml()` from `@/lib/sanitize` (as done in services route) before saving.

### Extremely Large Payloads or High Record Counts
32. **Client imports 50,000 inventory items via CSV** — **Mitigation**: Phase 1 does not include CSV import. If added later, process in batches of 100-500, use background job queue, show progress bar. API's `MAX_PAGE_SIZE=100` prevents listing overload.
33. **Attributes JSON is extremely large** — Client puts 100KB of data in attributes. **Mitigation**: Validate JSON size limit at API level (e.g., max 10KB for attributes). MySQL `Json` column type handles this but query performance degrades.
34. **Images array has 100+ entries** — **Mitigation**: Limit to 20 images per item. Validate in API route.
35. **Stock movement history grows to millions of rows** — **Mitigation**: Paginate stock movements with `MAX_PAGE_SIZE=100`. Add index on `itemId+createdAt`. Consider archiving movements older than 1 year via cron job (future enhancement).

### Unauthorized Access Attempts
36. **Unauthenticated request to `/api/v1/inventory`** — **Mitigation**: `withAuth()` returns 401 if no valid JWT session.
37. **Client user tries to access another client's inventory** — **Mitigation**: `resolveClientId()` always returns the user's own active client. All queries filter by `clientId`. Even if user manipulates the `clientId` query param, `tryClientAccess()` checks `WehowareUserClient` for authorized access.
38. **Employee role tries to delete inventory items** — **Mitigation**: `allowedRoles` config on DELETE handler restricts to `["admin", "client"]` (or appropriate roles). Returns 403.
39. **Public API accessed without domain/clientId** — **Mitigation**: Return 400 "domain or clientId parameter required". Don't leak any data.
40. **Public API returns draft/archived items** — **Mitigation**: Public API queries filter `status: "active"` and `active: true` only. Never expose draft/sold/archived items.
41. **Privilege escalation via client role manipulation** — User with `client` role tries to pass `role=admin` in request body. **Mitigation**: Role comes from `WehowareProfile` via `withAuth()`, not from request body. Request body role fields are ignored.
42. **SQL injection via search parameter** — **Mitigation**: Prisma parameterizes all queries. `contains` filter is safe. No raw SQL used.

### Cascading Failures
43. **Stock movement creation fails, but the API already returned success to frontend** — **Mitigation**: Use Prisma `$transaction` for item update + movement creation. If transaction fails, API returns error. No partial success.
44. **Category deletion when items reference it** — **Mitigation**: Either (a) prevent deletion if items reference category (check count, return 409), or (b) set `categoryId` to null on items. Recommend option (a) with a clear error message.
45. **Inventory settings don't exist for a client** — First time accessing inventory feature. **Mitigation**: `GET /api/v1/inventory/settings` should return defaults if no settings record exists. `PUT` should upsert (create if not exists, update if exists).
46. **Item deletion when stock movements exist** — **Mitigation**: Either (a) soft delete (set `status=archived`), or (b) cascade delete stock movements. Recommend soft delete for audit trail integrity. Hard delete should require explicit confirmation and also delete movements.

## C. EDGE CASES

### Empty Arrays / Null / Undefined at Data Boundaries
47. **Empty inventory list** — Client has no items yet. **Mitigation**: Return `{ data: [], pagination: { totalItems: 0, page: 1, limit: 20, totalPages: 1 } }`. Frontend shows empty state with icon and "No items found" message.
48. **`attributes` is null/undefined** — Item created without custom attributes. **Mitigation**: Default to `{}` in API route. Frontend handles empty object gracefully.
49. **`images` is null/undefined** — No images uploaded. **Mitigation**: Default to `[]`. Frontend shows placeholder image (`/images/blank.jpg` — existing pattern).
50. **`category` is null** — Item has no category. **Mitigation**: Display "Uncategorized" (existing pattern from services page).
51. **`price` is null or 0** — **Mitigation**: Display "Contact for pricing" or "Free" (existing pattern from services: `fee_label` logic).
52. **Stock movement with `quantity: 0`** — **Mitigation**: Reject with 400 "Quantity must be non-zero" unless type is `adjustment` with explicit reason.
53. **`reorderThreshold` not set** — **Mitigation**: Fall back to client's `InventorySettings.lowStockThreshold` (default 5). If neither is set, no alert.
54. **`currency` not provided** — **Mitigation**: Default to `InventorySettings.defaultCurrency` (default "CAD").

### Duplicate Records or Idempotency Requirements
55. **Duplicate SKU** — Two items with same SKU for same client. **Mitigation**: `@@unique([clientId, sku])` constraint. API catches `P2002`, returns 409 "An item with this SKU already exists".
56. **Duplicate slug** — Same title generates same slug. **Mitigation**: `generateUniqueSlug()` appends counter. `@@unique([clientId, slug])` catches races.
57. **Duplicate VIN in attributes** — Two vehicles with same VIN. **Mitigation**: Phase 1 does not enforce VIN uniqueness (it's in JSON). Future enhancement: add a unique index on a generated column from `attributes->"$.vin"` if MySQL supports it, or validate in application code.
58. **Idempotent stock movement** — User refreshes page after submitting stock movement, re-submits. **Mitigation**: Stock movements are append-only (no update/delete). A duplicate movement would double-count. Frontend should redirect after successful POST (PRG pattern). Consider adding a client-side idempotency key in the future.
59. **Duplicate category name** — **Mitigation**: `@@unique([clientId, slug])` on categories. `generateUniqueSlug()` for categories too.

### Timezone, Locale, and Currency Edge Cases
60. **Currency mismatch** — Item price in USD but client default is CAD. **Mitigation**: Each item stores its own `currency` field. Display with the item's currency. Settings has `defaultCurrency` for new items.
61. **Price precision** — Vehicle costs $45,999.99. **Mitigation**: Use Prisma `Decimal` type (maps to MySQL `DECIMAL(10,2)`). Frontend uses `Number(price).toFixed(2)`.
62. **Timezone on `publishedAt`** — Admin in EST schedules publish for 9 AM. **Mitigation**: Store all timestamps in UTC (Prisma default). Frontend converts to user's local timezone for display. Use `new Date()` for comparisons.
63. **Multi-language attributes** — Vehicle title in English and French. **Mitigation**: `attributes` JSON can store `{ title_fr: "...", description_fr: "..." }`. Phase 1 doesn't build i18n UI for attributes, but the JSON structure supports it.

### First-Run vs. Returning-User Behavior Differences
64. **First inventory item for a new client** — No categories exist, no settings exist. **Mitigation**: Auto-create default `InventorySettings` on first API access (upsert). Show onboarding prompt: "Create your first category" and "Add your first item".
65. **First stock movement for an item** — `previousQuantity` should be 0 (or the item's initial quantity if set on creation). **Mitigation**: When creating an item with `quantity > 0`, automatically create an `initial` stock movement with `previousQuantity: 0`, `newQuantity: quantity`.
66. **Client switches from one client to another** — Admin manages Client A's inventory, switches to Client B. **Mitigation**: `activeClientId` changes via cookie/query param. All API calls use new `clientId`. UI refetches data. Existing pattern works (same as services/blogs).
67. **New user with no client assignment** — **Mitigation**: `resolveClientId()` returns null. API returns 400 "Active client context required". UI shows "Select a client to view inventory".

### Mobile vs. Desktop vs. POS Environment Differences
68. **Mobile admin view** — Table doesn't fit on small screen. **Mitigation**: Existing `AdminLayout.js` handles responsive sidebar. Table uses `overflow-auto` wrapper. Consider card-based layout for mobile in future. Stats grid uses `grid-cols-1 sm:grid-cols-2 md:grid-cols-4` (existing pattern).
69. **Public API consumed by mobile website** — **Mitigation**: Public API returns JSON. Pagination limits payload size. Images should be optimized (use `next/image` on client site). API response includes `thumbnail` field for list views and full `images` array for detail view.
70. **POS integration (future)** — Not in Phase 1 scope. But the stock movement API (`POST /api/v1/inventory/stock-movements`) is designed to accept external `reference` and `reason` fields, making POS integration straightforward later.
71. **Slow 3G network on public API** — **Mitigation**: Public API supports `fields` query param (future) to request only needed fields. For Phase 1, ensure `select` is used in Prisma to avoid returning unnecessary columns. List endpoint returns summary fields; detail endpoint returns full data.

---

# Implementation Order (Reference for Build Phase)

1. **Prisma schema** — Add enums + 4 models, run `prisma migrate dev`
2. **Internal API routes** — `route.js` (list/create), `[id]/route.js` (get/update/delete), `categories/`, `stock-movements/`, `settings/`, `bulk/`
3. **Public API routes** — `route.js` (list), `[slug]/route.js` (detail), `categories/`
4. **Admin UI** — List page, add/edit form, categories page, stock movements page, settings page
5. **Sidebar registration** — Add inventory group to `AdminLayout.js`
6. **Testing** — API tests following existing test patterns in `tests/` directory
7. **Seed data** — Add sample inventory items to `prisma/seed.mjs`
