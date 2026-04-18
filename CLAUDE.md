# Wehoware SaaS Platform - AI Assistant Guide
## Project Overview
Multi-tenant SaaS platform with Next.js 15, featuring authentication, client management, content management, task tracking, and business intelligence.
## Technology Stack
**Frontend:** Next.js 15.2.4, React 19, TailwindCSS 3.3.5, Radix UI (25+ packages), Framer Motion 12.6.3
**Backend:** NextAuth v5 (JWT), MySQL 8.0+, Prisma 6.6.0, bcryptjs 2.4.3
**Rich Content:** TipTap 2.11.7, React Day Picker 9.6.4, custom form builder
**Data/Analytics:** Recharts 2.15.1, date-fns 4.1.0, UUID 11.1.0
**Dev Tools:** Turbopack, ESLint 9, Prisma Studio
## Architecture
**Authentication:** NextAuth v5 with JWT, 8-hour sessions, three roles (client/employee/admin), multi-tenant client switching
**Database (MySQL + Prisma):**
- Core: clients, profiles, user-clients
- Content: blogs, services, static pages
- Business: inquiries, tasks, forms, integrations
- Analytics: reports, keywords, settings

**Multi-Tenant:** Client switching via localStorage, data isolation via client_id, role-based access control
## Project Structure
**API (43 endpoints):** auth, blogs, clients, forms, inquiries, integrations, reports, seo, services, settings, tasks, uploads, users
**Admin Pages (35+):** appointments, blogs, categories, clients, forms, inquiries, integrations, invoices, keywords, reports, seo, services, settings, tasks, transactions, users
**Components:** UI library (shadcn/ui), dashboard, tasks (11 files), appointments, invoice, seo, settings, admin layout
**Core:** auth-context.js, auth.js, prisma.js, database schemas
**Components:** shadcn/ui library (25+ components), task management (11 components), dashboard, form builder, SEO tools, admin interface
## Key Files

**Auth:** src/lib/auth.js (NextAuth config), src/contexts/auth-context.js (state management), src/app/api/v1/auth/route.js (API), src/app/login/page.js (UI)

**Database:** prisma/schema.prisma (773 lines), src/lib/prisma.js (client), src/db/schema.sql (reference)

**Config:** package.json (87 packages), tailwind.config.js, next.config.mjs

**Environment:** DATABASE_URL (MySQL), NEXTAUTH_SECRET, NEXTAUTH_URL

**Scripts:** dev (Turbopack), build, start, lint, db:push, db:seed, db:studio

## Authentication Flow

**Login:** Credentials → NextAuth signIn → JWT token → User data enrichment → Admin redirect
**Session:** HTTP-only JWT cookies, 8-hour expiration, auto-refresh
**Logout:** NextAuth signOut → Clear cookies → Reset state → Login redirect

**Multi-Tenant:**
- Client switching via localStorage for employees/admins
- Data isolation via client_id filtering
- Roles: Admin (all clients), Employee (assigned clients), Client (own data)

## Development

**Setup:** npm install, npm run dev (localhost:3001), npm run db:push, npm run db:seed

**Database:** npx prisma generate, npx prisma studio

**Build:** npm run build, npm start, npm run lint

## Development Guidelines

**API:** Create routes in api/v1/, use Prisma client, implement auth/session validation, add client filtering

**Database:** Update prisma/schema.prisma, run db:push, use include/select for efficient queries

**Frontend:** Add pages in app/ or admin/, use useAuth() hook, use shadcn/ui components, responsive design

**Features:** Task management (CRUD, activity logging), content management (blogs, services), form builder (dynamic forms), integrations (webhooks)

## Security & Performance

**Security:** bcryptjs passwords, JWT sessions (8-hour), role-based access, input validation, Prisma ORM protection, client isolation

**Performance:** Prisma singleton, stateless JWT, local client switching, optimized queries, Turbopack builds

**Migration:** Supabase → NextAuth, PostgreSQL → MySQL, Supabase client → Prisma ORM

**Testing:** Role testing, client switching, CRUD operations, form builder, task management

**Deployment:** MySQL 8.0+, secure env vars, NextAuth production config, monitoring, CDN optimization