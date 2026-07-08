# Wehoware SaaS Platform - AI Assistant Guide

## ⚠️ Platform Architecture (READ FIRST)

**This is an admin-only SaaS platform.** It is used exclusively by:
- Platform admins
- Business owners / client managers
- SEO teams

**There are NO end-user-facing pages in this application at all.** The `/src/app/services` and `/src/app/blog` directories have been deleted — they were unused marketing stubs and are not part of the content system.

**How client content reaches end users:**
- Admin creates services/blogs via the admin dashboard
- Client websites (separate applications) call the **Public REST APIs** to fetch and display content
- **This app provides only the APIs — it does NOT render any public website**

**Public REST API surface (the only delivery mechanism):**
- `GET /api/public/services` — list active services for a client
- `GET /api/public/services/[slug]` — single service by slug (increments views)
- `GET /api/public/services/categories` — service categories for a client
- `GET /api/public/blogs` — list published blogs for a client
- `GET /api/public/blogs/[slug]` — single blog by slug (increments views)
- `GET /api/public/blogs/categories` — blog categories for a client
- `POST /api/public/blogs/[slug]/like` — increment likes on a blog

**Never build public-facing pages** in this app. No `/services/[slug]`, no `/blog/[slug]`, no public layouts. If client websites need data, they must call the public APIs.

---

## Project Overview
Multi-tenant SaaS platform with Next.js 15, featuring authentication, client management, content management, task tracking, business intelligence, and social media management.
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
- CRM: contacts, pipelines, pipeline_stages, deals, activities, contact_lists, contact_list_memberships
- Analytics: reports, keywords, settings
- Social: platforms, accounts, posts, account_posts, post_analytics

**Multi-Tenant:** Client switching via localStorage, data isolation via client_id, role-based access control
## Project Structure

src/
  app/                          # Next.js App Router
    api/                        # API routes
      auth/                     # NextAuth endpoints
      v1/                       # Version 1 API (43+ endpoints)
        auth/                   # Authentication API
        blogs/                  # Blog management (6 endpoints)
        clients/                # Client management (2 endpoints)
        forms/                  # Form builder (5 endpoints)
        inquiries/              # Lead management (1 endpoint)
        crm/                    # CRM module (20+ endpoints)
          contacts/             # Contacts CRUD + convert
          pipelines/             # Pipelines + stages CRUD
          deals/                 # Deals CRUD + stage moves
          activities/            # Activities CRUD
          lists/                 # Contact lists + memberships
          dashboard/             # Aggregated CRM stats
        integrations/           # Third-party integrations (4 endpoints)
        reports/                # Reporting system (2 endpoints)
        seo/                    # SEO management (5 endpoints)
        services/               # Service catalog (5 endpoints)
        settings/               # Configuration (3 endpoints)
        tasks/                  # Task management (5 endpoints)
        uploads/                # File uploads (1 endpoint)
        users/                  # User management (2 endpoints)
        social/                 # Social Media Manager (13 endpoints)
          posts/                # CRUD + publish/cancel
          accounts/             # OAuth accounts + sync
          platforms/            # Platform list + OAuth URL/callback
          analytics/posts/      # Aggregated analytics
          calendar/             # Calendar grouped by date
    admin/                      # Admin dashboard (35+ pages)
      appointments/            # Appointment scheduling
      blogs/                    # Blog management interface
      categories/              # Category management
      clients/                  # Client administration
      forms/                    # Form builder interface
      crm/                      # CRM module UI (6 pages)
        page.js                # Dashboard (stats, pipeline value, quick links)
        contacts/page.js       # Contacts list + ContactForm dialog
        pipeline/page.js       # Kanban board (drag-and-drop with @dnd-kit)
        deals/page.js          # Deals list + DealForm dialog
        activities/page.js     # Activities timeline + ActivityForm
        lists/page.js          # Contact lists (card grid + inline form)
      inquiries/                # Inquiry management (legacy)
      integrations/             # Integration management
      invoices/                # Invoice system
      keywords/                # SEO keyword management
      reports/                 # Reporting interface
      seo/                      # SEO tools
      services/                # Service management
      settings/                # System settings
      social-media/            # Social Media Manager UI (10 pages)
        page.js                # Dashboard overview (includes Inbox unread badge)
        posts/page.js          # Post list with filters
        posts/create/page.js   # Create post (multi-platform)
        posts/[id]/page.js     # Post detail with per-platform status
        posts/[id]/edit/page.js # Edit draft/scheduled post
        accounts/page.js       # Connected accounts + OAuth connect
        analytics/page.js      # Analytics dashboard
        calendar/page.js       # Content calendar (month view)
        inbox/page.js          # Unified inbox (conversation list)
        inbox/[id]/page.js     # Conversation thread + reply
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
    social-clients/            # Platform SDK wrappers
      index.js                 # getSocialClient(account) factory
      base-client.js           # Abstract base: refreshToken, uploadMedia, createPost, getMetrics
      facebook-client.js       # Meta Graph API v18.0
      instagram-client.js      # Instagram Graph API
      twitter-client.js        # Twitter API v2 + OAuth 2.0 PKCE
      tiktok-client.js         # TikTok for Developers API
    cron-jobs/
      social-media.js          # publishScheduledPosts, refreshExpiringTokens, retryFailedPosts, socialInboxSyncJob
    crm-bridge.js              # Bridge external sources (forms, appointments, social, inquiries) to CRM contacts + activities
    social-inbox-sync.js       # Sync social conversations, bridge new ones to CRM via crm-bridge
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
- **Social Media Manager**: Multi-platform post scheduling, OAuth account management, analytics
- **CRM**: ContactForm, DealForm, ActivityForm dialog components; Kanban pipeline board with @dnd-kit drag-and-drop

## Key Files

**Auth:** src/lib/auth.js (NextAuth config), src/contexts/auth-context.js (state management), src/app/api/v1/auth/route.js (API), src/app/login/page.js (UI)

**Database:** prisma/schema.prisma (1745+ lines), src/lib/prisma.js (client), src/db/schema.sql (reference)

**Config:** package.json (87 packages), tailwind.config.js, next.config.mjs

**Environment:** DATABASE_URL (MySQL), NEXTAUTH_SECRET, CRON_SECRET (for cron job auth)

**CRM Module:**
- API: `/api/v1/crm/*` — Contacts, Pipelines, Deals, Activities, Lists, Dashboard
- Bridge: `src/lib/crm-bridge.js` — Deduplicates and creates CRM contacts from external sources (form submissions, appointments, social inbox conversations, legacy inquiries)
- Integration points: Appointments POST calls `bridgeAppointmentToCrm`, social inbox sync calls `bridgeSocialConversationToCrm` after new conversation upsert
- Cron: `social_inbox_sync` job registered in `/api/v1/cron/route.js`, syncs all active clients' social inboxes
- Migration: `scripts/migrate-inquiries-to-crm.mjs` — one-time script to migrate legacy WehowareInquiry records to CRM contacts + activities
- UI: `/admin/crm` — Dashboard, Contacts, Pipeline (Kanban), Deals, Activities, Lists pages

**Social Media Env Vars:**
- FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, FACEBOOK_CALLBACK_URL
- INSTAGRAM_CALLBACK_URL (shares Meta app credentials with Facebook)
- TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_CALLBACK_URL
- TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_CALLBACK_URL

**Scripts:** dev (Turbopack), build, start, lint, db:push, db:seed, db:studio

**CRITICAL — Sidebar registration:** Every new admin page MUST have a matching entry in `src/components/AdminLayout.js` inside `sidebarSections`. Without it, `isRouteAllowed` evaluates to `false` and the user sees "Access Denied: You don't have permission to view this page." Add the entry to the correct group's `children` array (or as a top-level `link`) with the exact `href`, matching `roles`, and a lucide-react `icon`.

## Authentication Flow

**Login:** Credentials → NextAuth signIn → JWT token → User data enrichment → Admin redirect
**Session:** HTTP-only JWT cookies, 8-hour expiration, auto-refresh
**Logout:** NextAuth signOut → Clear cookies → Reset state → Login redirect

**Multi-Tenant:**
- Client switching via localStorage for employees/admins
- Data isolation via client_id filtering
- Roles: Admin (all clients), Employee (assigned clients), Client (own data)

## Social Media Manager

### Feature Overview
Full multi-platform social media management: OAuth account connection, post creation/scheduling, content calendar, analytics, and automated background publishing.

### Data Flow: Post Publishing
1. User creates post (UI → `POST /api/v1/social/posts`) → stored as `Draft` or `Scheduled`
2. **Immediate publish**: UI → `POST /api/v1/social/posts/[id]/publish` → sets `Publishing` → calls `getSocialClient(account).createPost()` per platform → sets `Published` / `PartiallyPublished` / `Failed`
3. **Scheduled publish**: Cron `publishScheduledPosts()` queries `status=Scheduled, scheduledFor<=now()` → same publish pipeline

### Data Flow: OAuth Account Connection
1. UI (`accounts/page.js`) → `GET /api/v1/social/platforms/[platformCode]/oauth-url` → returns `authUrl` with encoded `state` (clientId, userId, platformId, platformCode)
2. Browser redirects to platform OAuth → platform redirects to `GET /api/v1/social/platforms/[platformCode]/callback`
3. Callback exchanges code for tokens, fetches profile, upserts `WehowareSocialAccount` → redirects to `accounts/page.js?success=true`

### Database Models (prisma/schema.prisma lines 1629–1744)

| Model | Table | Purpose |
|---|---|---|
| `WehowareSocialPlatform` | `wehoware_social_platforms` | Platform registry (Facebook, Instagram, Twitter, TikTok) with oauthConfig JSON and rateLimits JSON |
| `WehowareSocialAccount` | `wehoware_social_accounts` | Connected OAuth accounts per client; stores accessToken, refreshToken, tokenExpiresAt, profileData JSON (pageId, pageAccessToken, igUserId, etc.) |
| `WehowareSocialPost` | `wehoware_social_posts` | Posts with content, mediaUrls JSON, hashtags JSON, targetAccounts JSON, publishResults JSON, errorDetails JSON |
| `WehowareSocialAccountPost` | `wehoware_social_account_posts` | Per-account publish record (platformPostId, platformUrl, status, metrics JSON) |
| `WehowareSocialPostAnalytics` | `wehoware_social_post_analytics` | Time-series metrics per accountPost (metricType, metricValue, recordedAt) |

**Enums:**
- `SocialAccountStatus`: Active | Disconnected | Error | Paused
- `SocialPostStatus`: Draft | Scheduled | Publishing | Published | PartiallyPublished | Failed | Cancelled
- `SocialAccountPostStatus`: Pending | Publishing | Published | Failed | Retrying
- `SocialPostType`: Text | Image | Video | Carousel | Story | Reel

**Key relations:** `WehowareClient` has `socialAccounts[]` and `socialPosts[]`. `WehowareProfile` tracks `createdBy`/`updatedBy` on accounts and posts. Account unique constraint: `[clientId, platformId, accountId]`. AccountPost unique constraint: `[postId, accountId]`.

### API Endpoints (`/api/v1/social/`)

| Method | Path | Action |
|---|---|---|
| GET | `/posts` | List posts (paginated, filter by status/dates) |
| POST | `/posts` | Create post (Draft or Scheduled) |
| GET | `/posts/[id]` | Get post details with accountPosts |
| PUT | `/posts/[id]` | Update Draft/Scheduled post |
| DELETE | `/posts/[id]` | Delete (Draft/Scheduled/Failed/Cancelled only) |
| POST | `/posts/[id]/publish` | Publish immediately to all target platforms |
| POST | `/posts/[id]/cancel` | Cancel a Scheduled post |
| GET | `/accounts` | List connected accounts (filter by status/platform) |
| GET | `/accounts/[id]` | Get account details |
| PUT | `/accounts/[id]` | Update account status |
| DELETE | `/accounts/[id]` | Disconnect account (nulls tokens, sets Disconnected) |
| POST | `/accounts/[id]/sync` | Trigger manual sync from platform API |
| GET | `/platforms` | List active platforms with oauthConfig and rateLimits |
| GET | `/platforms/[platformCode]/oauth-url` | Generate OAuth authorization URL |
| GET | `/platforms/[platformCode]/callback` | OAuth callback handler |
| GET | `/analytics/posts` | Aggregated analytics (summary + per-platform breakdown) |
| GET | `/calendar` | Posts grouped by date YYYY-MM-DD (excludes Drafts) |

### Social Client Library (`src/lib/social-clients/`)

`getSocialClient(account)` factory — requires `account.platform.platformCode` to be included.

All clients extend `BaseSocialClient` and implement:
- `refreshAccessToken()` → `{ accessToken, refreshToken, expiresAt }`
- `uploadMedia(url, mimeType)` → `mediaId`
- `createPost(content, mediaIds, opts)` → `platformPostId`
- `getPostMetrics(platformPostId)` → metrics object

**Character limits enforced client-side and in docs:** Twitter 280, Facebook 63,206, Instagram 2,200, TikTok 2,200.

**Media upload strategies:** Facebook/Instagram — upload to page/container, get ID; Twitter — chunked 5 MB binary upload; TikTok — pass URL directly.

**profileData fields used during publish:**
- Facebook: `profileData.pageId`, `profileData.pageAccessToken`
- Instagram: `profileData.igUserId`
- Twitter: uses account-level access token only
- TikTok: uses account-level access token only

### Cron Jobs (`src/lib/cron-jobs/social-media.js`)

| Export | Trigger | Behavior |
|---|---|---|
| `publishScheduledPosts()` | Scheduled (external trigger) | Finds `status=Scheduled, scheduledFor<=now()`; publishes each via social clients; sets `Published`/`PartiallyPublished`/`Failed` |
| `refreshExpiringTokens()` | Scheduled (external trigger) | Finds Active accounts with `tokenExpiresAt` within 2 hours; calls `refreshAccessToken()`; sets `Error` on failure |
| `retryFailedPosts()` | Scheduled (external trigger) | Retries `Failed` accountPosts up to `MAX_RETRY_ATTEMPTS=3`; skips if parent post is Cancelled/Published |

**Note:** Cron scheduling mechanism (external caller / Next.js route handler / OS cron) is not yet wired — the three exports exist but no invocation entrypoint is currently defined in the codebase.

### Inbox API Endpoints (`/api/v1/social/inbox/`)

| Method | Path | Action |
|---|---|---|
| GET | `/inbox` | List conversations (paginated; filter by status/platform/unread) |
| POST | `/inbox/sync` | Trigger full inbox sync across all active accounts |
| GET | `/inbox/[id]` | Get conversation with full message thread (last 100 msgs) |
| PUT | `/inbox/[id]` | Update conversation status: Open, Archived, Closed |
| POST | `/inbox/[id]/reply` | Send reply via platform API; stores outbound message locally |
| POST | `/inbox/[id]/read` | Mark all messages in conversation as read; reset unreadCount |

### Inbox Sync Service (`src/lib/social-inbox-sync.js`)

| Export | Behavior |
|---|---|
| `syncInboxForAccount(account)` | Fetches conversations + messages from one account; upserts to DB; returns `{ conversationsSynced, messagesSynced, errors }` |
| `syncAllInboxes(clientId)` | Runs `syncInboxForAccount` for every active account (Promise.allSettled — one failure won't block others) |

**Sync strategy:** Incremental — each conversation stores `lastSyncedAt`. Subsequent syncs pass `since` to platform APIs to fetch only deltas.

### Platform Inbox Capabilities

| Platform | Inbox Type | Conversations | Reply |
|---|---|---|---|
| Facebook | Messenger page DMs | `GET /{pageId}/conversations?platform=messenger` | `POST /{pageId}/messages` |
| Instagram | Business DMs | `GET /{igUserId}/conversations?platform=instagram` | `POST /{igUserId}/messages` |
| Twitter/X | Direct Messages v2 | `GET /users/{userId}/dm_conversations` | `POST /dm_conversations/{id}/messages` |
| TikTok | Video comments (no DM API) | `GET /video/list/` → per-video threads | `POST /video/comment/create/` |

### Database Models — Inbox (prisma/schema.prisma)

| Model | Table | Purpose |
|---|---|---|
| `WehowareSocialInboxConversation` | `wehoware_social_inbox_conversations` | One row per conversation thread; tracks `unreadCount`, `status` (Open/Archived/Closed), `lastSyncedAt`, `participantId` |
| `WehowareSocialInboxMessage` | `wehoware_social_inbox_messages` | Individual messages; `direction` (Inbound/Outbound), `isRead`, `sentAt`, `mediaUrls` JSON |

**Enums:** `SocialInboxConversationStatus` (Open, Archived, Closed) · `SocialMessageDirection` (Inbound, Outbound)

**Unique constraints:** conversation `[accountId, platformConversationId]` · message `[conversationId, platformMessageId]`

### Admin UI Pages (`src/app/admin/social-media/`)

| Page | Route | Key Behavior |
|---|---|---|
| Dashboard | `/admin/social-media` | Stats cards, connected accounts list, recent posts, platform analytics |
| Post List | `/admin/social-media/posts` | Paginated/filtered list; actions: View, Edit, Publish, Cancel, Delete |
| Create Post | `/admin/social-media/posts/create` | Multi-platform form; character limit validation; Schedule or Publish Now |
| Post Detail | `/admin/social-media/posts/[id]` | Per-platform publish status icons, platform URLs, error messages |
| Edit Post | `/admin/social-media/posts/[id]/edit` | Edit Draft/Scheduled; same form as create, pre-filled |
| Accounts | `/admin/social-media/accounts` | Platform grid with Connect buttons; connected accounts with Sync/Disconnect; reads OAuth result from URL params |
| Analytics | `/admin/social-media/analytics` | Date-range selector; summary stats; per-platform breakdown with progress bars |
| Calendar | `/admin/social-media/calendar` | Month grid; color-coded status dots; click day for scheduled post detail |
| Inbox | `/admin/social-media/inbox` | Unified inbox: conversation list with unread badge, platform filter, Sync All button |
| Conversation | `/admin/social-media/inbox/[id]` | Full message thread; reply box (Enter to send); archive/close/reopen actions |

## Development

**Setup:** npm install, npm run dev (localhost:3001), npm run db:push, npm run db:seed

**Database:** npx prisma generate, npx prisma studio

**Build:** npm run build, npm start, npm run lint

## Development Guidelines

**API:** Create routes in api/v1/, use Prisma client, implement auth/session validation, add client filtering

**Database:** Update prisma/schema.prisma, run db:push, use include/select for efficient queries

**Frontend:** Add pages in app/ or admin/, use useAuth() hook, use shadcn/ui components, responsive design

**Features:** Task management (CRUD, activity logging), content management (blogs, services), form builder (dynamic forms), integrations (webhooks), social media (multi-platform scheduling)

## Security & Performance

**Security:** bcryptjs passwords, JWT sessions (8-hour), role-based access, input validation, Prisma ORM protection, client isolation

**Performance:** Prisma singleton, stateless JWT, local client switching, optimized queries, Turbopack builds

**Migration:** Supabase → NextAuth, PostgreSQL → MySQL, Supabase client → Prisma ORM

**Testing:** Role testing, client switching, CRUD operations, form builder, task management, social OAuth flow

**Deployment:** MySQL 8.0+, secure env vars, NextAuth production config, monitoring, CDN optimization
