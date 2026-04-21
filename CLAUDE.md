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

src/
  app/                          # Next.js App Router
    api/                        # API routes
      auth/                     # NextAuth endpoints
      v1/                       # Version 1 API (43 endpoints)
        auth/                   # Authentication API
        blogs/                  # Blog management (6 endpoints)
        clients/                # Client management (2 endpoints)
        forms/                  # Form builder (5 endpoints)
        inquiries/              # Lead management (1 endpoint)
        integrations/           # Third-party integrations (4 endpoints)
        reports/                # Reporting system (2 endpoints)
        seo/                    # SEO management (5 endpoints)
        services/               # Service catalog (5 endpoints)
        settings/               # Configuration (3 endpoints)
        tasks/                  # Task management (5 endpoints)
        uploads/                # File uploads (1 endpoint)
        users/                  # User management (2 endpoints)
    admin/                      # Admin dashboard (35+ pages)
      appointments/            # Appointment scheduling
      blogs/                    # Blog management interface
      categories/              # Category management
      clients/                  # Client administration
      forms/                    # Form builder interface
      inquiries/                # Inquiry management
      integrations/             # Integration management
      invoices/                # Invoice system
      keywords/                # SEO keyword management
      reports/                 # Reporting interface
      seo/                      # SEO tools
      services/                # Service management
      settings/                # System settings
      tasks/                   # Task management interface
      transactions/            # Transaction tracking
      users/                   # User administration
    login/                      # Authentication page
    about/                      # About page
    blog/                       # Public blog pages
    contact/                    # Contact page
    services/                   # Public services pages
  components/                  # Reusable React components (25+ files)
    ui/                        # Shadcn/ui components (25+ components)
    dashboard/                 # Dashboard components
    tasks/                      # Task management components (11 files)
    appointments/               # Appointment components
    invoice/                    # Invoice components
    seo/                        # SEO management components
    settings/                   # Settings components
    AdminHeader.js              # Admin navigation header
    AdminLayout.js              # Admin layout wrapper
    Footer.js                   # Site footer
    Header.js                   # Site header
  contexts/                    # React contexts
    auth-context.js            # Authentication state management
  hooks/                       # Custom React hooks
    useAuth.js                 # Authentication hook
  lib/                         # Utility libraries
    auth.js                    # NextAuth configuration
    prisma.js                  # Prisma client singleton
  db/                          # Database schemas
    schema.sql                 # SQL schema reference
    wehoware_profiles_rows.sql  # Profile data reference
  styles/                      # Global styles
    globals.css                # Global CSS variables

### Component Architecture

**UI Components (shadcn/ui):**
- Complete component library with 25+ accessible components
- Custom theme with design tokens and dark mode support
- Radix UI primitives for accessibility
- TailwindCSS integration with custom animations

**Business Components:**
- **Task Management**: 11 specialized components for complete task workflow
- **Dashboard**: Overview cards, charts, and activity feeds
- **Form Builder**: Dynamic form creation with validation
- **SEO Tools**: Keyword management and static page editing
- **Admin Interface**: Comprehensive admin layout and navigation
## Key Files

**Auth:** src/lib/auth.js (NextAuth config), src/contexts/auth-context.js (state management), src/app/api/v1/auth/route.js (API), src/app/login/page.js (UI)

**Database:** prisma/schema.prisma (773 lines), src/lib/prisma.js (client), src/db/schema.sql (reference)

**Config:** package.json (87 packages), tailwind.config.js, next.config.mjs

**Environment:** DATABASE_URL (MySQL), NEXTAUTH_SECRET

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