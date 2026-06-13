---
name: user-profile
description: User is the developer/owner of the Wehoware SaaS platform
metadata:
  type: user
---

The user is the developer and owner of the Wehoware SaaS platform — a multi-tenant admin dashboard for business owners, SEO teams, and platform admins.

**Technical level:** Senior — provides detailed bug reports with code-level root cause analysis and suggested fixes. Expects thorough implementation without hand-holding.

**Communication style:** Direct, comprehensive task lists. Expects all items to be completed without stopping to ask for approval on each step. Asks clarifying questions upfront, then wants everything done in one session.

**Architecture decisions confirmed:**
- No public-facing pages — ever. Only admin UI + public REST APIs.
- Storage: local filesystem (public/uploads) or AWS S3 — not Supabase.
- MySQL + Prisma (not PostgreSQL/Supabase).
