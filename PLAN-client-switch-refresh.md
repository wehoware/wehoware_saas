# Plan: Refresh Components on Client Switch

## 1. Problem

When switching active client via `AdminHeader`, ~26 admin pages do not refresh their data. The `switchClient()` function updates state/cookie/localStorage but does not trigger re-fetching in pages missing `activeClient` in their `useEffect` dependencies.

## 2. Architecture

```
switchClient(clientId)
  ├── setActiveClient(client)           ← React state
  ├── writeActiveClientCookie(client.id) ← API scoping cookie
  └── localStorage.setItem(...)         ← Persistence
```

API middleware reads `wehoware_active_client_id` cookie. Any `fetch('/api/v1/...')` automatically returns the correct client's data **if the page re-fetches.**

## 3. Pages Already Working (12 pages)

Dashboard, Services (list/add/edit), Categories (service/blog), Blogs (list/add), Inquiries, SEO, Keywords, Settings — all have `activeClient` in `useEffect` deps.

## 4. Pages Fixed — `activeClient` Dependency Added

### Core Admin (10 pages)
| # | Page | File | Status |
|---|------|------|--------|
| 1 | Appointments | `admin/appointments/page.js` | ✅ Fixed |
| 2 | Tasks | `admin/tasks/page.js` | ✅ Fixed |
| 3 | Integrations | `admin/integrations/page.js` | ✅ Fixed |
| 4 | Forms | `admin/forms/page.js` | ✅ Fixed |
| 5 | Reports | `admin/reports/page.js` | ✅ Fixed |
| 6 | Users | `admin/users/page.js` | ✅ Fixed |
| 7 | Clients | `admin/clients/page.js` | ✅ Fixed |
| 8 | Blog Edit | `admin/blogs/edit/[id]/page.js` | ✅ Fixed |

### Accounting Module (14 pages)
| # | Page | File | Status |
|---|------|------|--------|
| 9 | Accounting Dashboard | `admin/accounting/page.jsx` | ✅ Fixed |
| 10 | Accounting Invoices | `admin/accounting/invoices/page.jsx` | ✅ Fixed |
| 11 | Invoice Detail | `admin/accounting/invoices/[id]/page.js` | ✅ Fixed |
| 12 | Invoice Add | `admin/accounting/invoices/add/page.js` | ✅ Fixed |
| 13 | Invoice Edit | `admin/accounting/invoices/edit/[id]/page.js` | ✅ Fixed |
| 14 | Bills | `admin/accounting/bills/page.jsx` | ✅ Fixed |
| 15 | Bill Detail | `admin/accounting/bills/[id]/page.jsx` | ✅ Fixed |
| 16 | Bill Add | `admin/accounting/bills/add/page.jsx` | ✅ Fixed |
| 17 | Bill Edit | `admin/accounting/bills/[id]/edit/page.jsx` | ✅ Fixed |
| 18 | Expenses | `admin/accounting/expenses/page.jsx` | ✅ Fixed |
| 19 | Transactions | `admin/accounting/transactions/page.jsx` | ✅ Fixed |
| 20 | Vendors | `admin/accounting/vendors/page.jsx` | ✅ Fixed |
| 21 | Settings | `admin/accounting/settings/page.jsx` | ✅ Fixed |
| 22 | Plaid | `admin/accounting/integrations/plaid/page.jsx` | ✅ Fixed |

### Edit/Detail/Submission Pages (7 pages)
| # | Page | File | Status |
|---|------|------|--------|
| 23 | Tasks Edit | `admin/tasks/edit/[id]/page.js` | ✅ Fixed |
| 24 | Reports Generate | `admin/reports/generate/page.js` | ✅ Fixed |
| 25 | Form Submissions | `admin/forms/submissions/[formId]/page.js` | ✅ Fixed |
| 26 | Users Add | `admin/users/add/page.js` | ✅ Fixed |
| 27 | Users Edit | `admin/users/edit/page.js` | ✅ Fixed |
| 28 | Clients Edit | `admin/clients/edit/page.js` | ✅ Fixed |
| 29 | Services Edit | `admin/services/edit/[id]/page.js` | ✅ Fixed |

**Total fixed: 29 pages.**

## 5. Recommended Approach

**Add `activeClient?.id` to `useEffect` dependencies.**

Why:
- Minimal change (follows existing pattern in 12 pages)
- Preserves form state and scroll position
- No UX disruption from full reloads
- API already respects activeClient via cookie

Rejected alternatives:
- `router.refresh()` — only works for server components, admin pages are `"use client"`
- `window.location.reload()` — destroys state, jarring UX
- Custom events / SWR — over-engineered for current codebase

## 6. Implementation Pattern

For each page, apply this standard change:

```javascript
// 1. Add import
import { useAuth } from "@/contexts/auth-context";

// 2. Destructure in component
const { activeClient } = useAuth();

// 3. Add activeClient?.id to useEffect deps
useEffect(() => {
  fetchData();
}, [activeClient?.id, /* existing deps */]);
```

For employee-role pages that require a selected client:
```javascript
useEffect(() => {
  if (activeClient?.id) {
    fetchData();
  } else {
    setData([]);
    setIsLoading(false);
  }
}, [activeClient?.id, /* existing deps */]);
```

## 7. Implementation Phases

### Phase 1: Critical (Core client-scoped pages)
1. `admin/invoices/page.jsx` — add `activeClient?.id` to deps
2. `admin/transactions/page.jsx` — add `activeClient?.id` to deps
3. `admin/appointments/page.js` — add `activeClient?.id` to deps (import useAuth)
4. `admin/tasks/page.js` — add `activeClient?.id` to deps (import useAuth)
5. `admin/integrations/page.js` — add `activeClient?.id` to deps (import useAuth)
6. `admin/forms/page.js` — add `activeClient?.id` to deps (import useAuth)
7. `admin/reports/page.js` — add `activeClient?.id` to deps (import useAuth)

### Phase 2: Admin pages (evaluate scoping)
8. `admin/users/page.js` — add `activeClient?.id` to deps (already imports useAuth)
9. `admin/clients/page.js` — add `activeClient?.id` to deps (import useAuth)
10. `admin/blogs/edit/[id]/page.js` — add client-mismatch detection or redirect

### Phase 3: Accounting module
11-24. All 14 accounting pages — import `useAuth`, add `activeClient?.id` to `useEffect` deps

### Phase 4: Edit/Detail pages
25-29. Review and update remaining detail/edit pages as needed

## 8. Edge Cases

1. **Employee with no client selected** — Show empty state, don't fetch
2. **Edit page with wrong client** — Show warning banner or redirect to list
3. **Form with unsaved changes** — Consider `beforeunload` or confirm dialog
4. **API error after switch** — Handle gracefully with existing error states
5. **Active tab/filter state** — Should be preserved during client switch

## 9. Testing Checklist

- [x] Switch client on each updated page → data refreshes
- [x] Filter/sort state preserved during switch
- [x] Loading states display correctly
- [x] Empty state shown when employee has no client selected
- [x] No console warnings about missing deps
- [x] No duplicate API calls (fetch should not fire twice)

## 10. Files to Modify

```
src/app/admin/invoices/page.jsx
src/app/admin/transactions/page.jsx
src/app/admin/appointments/page.js
src/app/admin/tasks/page.js
src/app/admin/integrations/page.js
src/app/admin/forms/page.js
src/app/admin/reports/page.js
src/app/admin/users/page.js
src/app/admin/clients/page.js
src/app/admin/blogs/edit/[id]/page.js
src/app/admin/accounting/page.jsx
src/app/admin/accounting/invoices/page.jsx
src/app/admin/accounting/invoices/[id]/page.js
src/app/admin/accounting/invoices/add/page.js
src/app/admin/accounting/invoices/edit/[id]/page.js
src/app/admin/accounting/bills/page.jsx
src/app/admin/accounting/bills/[id]/page.jsx
src/app/admin/accounting/bills/add/page.jsx
src/app/admin/accounting/bills/[id]/edit/page.jsx
src/app/admin/accounting/expenses/page.jsx
src/app/admin/accounting/transactions/page.jsx
src/app/admin/accounting/vendors/page.jsx
src/app/admin/accounting/settings/page.jsx
src/app/admin/accounting/integrations/plaid/page.jsx
src/app/admin/tasks/edit/[id]/page.js
src/app/admin/reports/generate/page.js
src/app/admin/forms/submissions/[formId]/page.js
```
