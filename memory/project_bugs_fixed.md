---
name: bugs-and-features-2026-06-03
description: All 10 bugs fixed + Phase 3 features added to blogs/services module on 2026-06-03
metadata:
  type: project
---

Session on 2026-06-03 completed the following:

**Bugs fixed:**
- BUG-01: Blog POST now sets `publishedAt` when creating with status=Published
- BUG-02: Service slug uniqueness is now per-client (fixed in both POST and PUT routes)
- BUG-03: Blog status filter validated against allowlist in GET /api/v1/blogs
- BUG-04: Fixed stale formData closure in services edit `handleInputChange` (uses functional update)
- BUG-05: Fee NaN validation added in services PUT route
- BUG-06: Removed client-side double-filter in admin blogs list (server-side only)
- BUG-07: Thumbnail cleanup added to services DELETE route
- BUG-08: fee_currency changed to SelectInput (CAD/USD) in services add page
- BUG-09/10: `/app/services` and `/app/blog` directories deleted

**Schema changes (db:push applied):**
- Blog/Service slug changed from global `@unique` to `@@unique([clientId, slug])`
- Added `thumbnailAlt`, `scheduledPublishAt` to Blog and Service
- Added `WehowareBlogVersion`, `WehowareServiceVersion` (version history)
- Added `WehowareBlogServiceRelation` (blog↔service linking)

**New APIs created:**
- `/api/public/services/[slug]` — single service with view increment
- `/api/public/blogs/[slug]` — single blog with view increment
- `/api/public/blogs/[slug]/like` — increment likes
- `/api/public/services/categories` — active categories
- `/api/public/blogs/categories` — categories with published posts
- `/api/v1/blogs/[id]/duplicate` — clone blog as Draft
- `/api/v1/services/[id]/duplicate` — clone service as inactive
- `/api/v1/blogs/[id]/versions` — version history
- `/api/v1/services/[id]/versions` — version history
- `/api/v1/blogs/[id]/related-services` — GET/POST/DELETE
- `/api/v1/services/[id]/related-blogs` — GET/POST/DELETE
- `/api/v1/blogs/bulk` — bulk publish/unpublish/archive/delete
- `/api/v1/services/bulk` — bulk activate/deactivate/delete
- `/api/v1/cron/content` — triggers scheduled-publish cron (secured with CRON_SECRET)
- `/src/lib/cron-jobs/content.js` — publishScheduledBlogs + publishScheduledServices

**New library:**
- `src/lib/sanitize.js` — server-side HTML sanitizer (sanitize-html) used in all blog/service create+update APIs

**Admin UI updates:**
- Blogs list: pagination (20/page), bulk actions, clone button
- Services list: pagination (20/page), bulk actions, clone button, fee_label "Free" display
- Blog create/edit: thumbnailAlt input, scheduled publish datetime picker, preview modal, version history panel (edit only), related services panel (edit only)
- Service create/edit: thumbnailAlt input, scheduled publish datetime picker, preview modal, version history panel (edit only), related blogs panel (edit only)

**How to apply:** All these features exist. CRON_SECRET env var needed for the cron endpoint.
