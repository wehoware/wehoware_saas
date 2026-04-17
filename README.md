# Wehoware SaaS

Multi-tenant SaaS platform built with **Next.js 15** (App Router, React 19, Turbopack),
**NextAuth v5** for authentication, **Prisma** ORM, and **MySQL 8.0+**.

---

## Quick start

### 1. Install

```bash
npm install
```

### 2. Configure environment

Copy `.env.local.example` (or edit `.env.local`) and fill in:

```env
# MySQL (AWS RDS, PlanetScale, local — anything MySQL 8.0+)
DATABASE_URL="mysql://user:pass@host:3306/wehoware"

# NextAuth
NEXTAUTH_SECRET="run: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"

# Default tenant ID (optional, used by public-facing routes)
NEXT_PUBLIC_CLIENT_ID="your-default-client-uuid"

# --- Transitional only, remove once Supabase is fully ripped out ---
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."
```

### 3. Push schema & seed admin user

```bash
npm run db:push     # create all 26 tables in MySQL
npm run db:seed     # create default tenant + admin user
```

Default admin credentials (override via `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
env vars): see the console output at the end of `db:seed`.

### 4. Run

```bash
npm run dev
```

Open <http://localhost:3000> and log in at `/login`.

---

## Useful scripts

| Command            | What it does                                 |
| ------------------ | -------------------------------------------- |
| `npm run dev`      | Start Next.js dev server (Turbopack)         |
| `npm run build`    | Production build                             |
| `npm run start`    | Run production build                         |
| `npm run lint`     | ESLint                                       |
| `npm run db:push`  | Apply `prisma/schema.prisma` to the database |
| `npm run db:seed`  | Create default tenant + admin user           |
| `npm run db:studio`| Open Prisma Studio (browse DB in browser)    |

---

## Architecture

```
src/
├── lib/
│   ├── auth.js          # NextAuth v5 config (JWT + credentials)
│   ├── prisma.js        # Prisma client singleton
│   └── supabaseAdmin.js # (transitional) still used by ~40 unmigrated routes
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/  # NextAuth endpoints
│   │   ├── v1/auth/             # Our enriched session endpoint
│   │   └── utils/auth-middleware.js  # withAuth() HOC
│   └── (pages...)
├── contexts/
│   └── auth-context.js  # React context wrapping signIn/signOut
└── hooks/
    └── useAuth.js       # re-exports from auth-context
```

### Migration status (Supabase → MySQL)

| Area                            | Status                       |
| ------------------------------- | ---------------------------- |
| Database schema (26 tables)     | ✅ Migrated to MySQL/Prisma  |
| Authentication                  | ✅ Migrated to NextAuth v5   |
| Session management              | ✅ JWT via `next-auth`       |
| Auth middleware                 | ✅ Uses Prisma               |
| ~40 data routes (blogs, services, inquiries, tasks, reports, etc.) | ⚠️  Still call Supabase client (RLS disabled, works with service-role key) |
| File uploads (thumbnails)       | ⚠️  Still use Supabase Storage — needs S3 replacement |
| Data migration from old Supabase DB | ❌ Not yet done           |

The transitional Supabase client is attached to `request.supabase` in
`auth-middleware.js` so unmigrated routes keep working. As each route is
ported to Prisma, drop its `request.supabase` usage.

---

## Deploying

The app is a standard Next.js 15 app — deploy to Vercel, Railway, Fly, or
any Node host. Required runtime env vars:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL` (must match the public URL)
- Supabase keys (until fully removed)

Run `npm run db:push` + `npm run db:seed` once against the production DB
before first deploy.
