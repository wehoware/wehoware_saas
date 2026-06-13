---
name: project-architecture
description: Admin-only SaaS platform — no public pages, only public REST APIs for client websites
metadata:
  type: project
---

This is an admin-only SaaS. The `/app/services` and `/app/blog` directories were deleted — they were unused stubs.

**Why:** Client websites are separate applications. They call the public APIs to display content. This app is only for admins, business owners, and SEO teams.

**How to apply:** Never build public-facing pages. Any end-user content delivery goes through the public APIs only.

Public API surface:
- `GET /api/public/services` — list active services
- `GET /api/public/services/[slug]` — single service (increments views)
- `GET /api/public/services/categories`
- `GET /api/public/blogs` — list published blogs
- `GET /api/public/blogs/[slug]` — single blog (increments views)
- `GET /api/public/blogs/categories`
- `POST /api/public/blogs/[slug]/like` — increment likes
