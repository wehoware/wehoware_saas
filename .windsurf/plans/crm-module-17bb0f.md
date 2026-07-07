# CRM Module — End-to-End Plan

Full-featured CRM module for the Wehoware SaaS platform covering contacts, leads, sales pipeline (deals), activities, unified inbox, and dashboard analytics — built as a new top-level admin section following existing multi-tenant patterns. All lead sources flow into one unified CRM: website contact forms, social media DMs (auto-bridged from existing Social Inbox), form builder submissions, booked appointments, phone calls, emails, and manual entry all create CRM contacts that can be tracked through the sales pipeline. Existing Inquiries are fully absorbed and a migration script imports legacy data. Cross-module bridges auto-link Form Builder submissions and Appointments to CRM contacts, with non-blocking error handling so parent operations always succeed.

---

## Phase 1 — Codebase Analysis (Completed)

### Files Analyzed

1. `prisma/schema.prisma` (2433 lines) — Full schema: `WehowareClient`, `WehowareProfile`, `WehowareCustomer`, `WehowareInquiry`, `WehowareSocialAccount`, `WehowareSocialInboxConversation`, `WehowareSocialInboxMessage`, all enums
2. `src/lib/prisma.js` — Prisma client singleton
3. `src/lib/auth.js` — NextAuth v5 config, JWT strategy, credentials provider
4. `src/app/api/utils/auth-middleware.js` — `withAuth` middleware, role/client resolution
5. `src/app/api/v1/inquiries/route.js` — Existing public POST + authed GET/PUT/DELETE
6. `src/app/api/v1/customers/route.js` — Reference API pattern (pagination, serialization, validation)
7. `src/app/api/v1/social/inbox/route.js` — Social inbox list endpoint
8. `src/app/api/v1/social/inbox/sync/route.js` — Sync trigger endpoint
9. `src/lib/social-inbox-sync.js` — Core sync logic (`syncInboxForAccount`, `syncAllInboxes`)
10. `src/app/api/public/utils/public-middleware.js` — `withPublic` middleware (CORS + rate limiting)
11. `src/lib/cron-jobs/social-media.js` — Cron job handlers (no inbox sync job exists)
12. `src/app/api/v1/cron/route.js` — Cron dispatcher (secured by CRON_SECRET)
13. `src/components/AdminLayout.js` — Sidebar with role/clientRole filtering, Inquiries link at line 322
14. `src/app/admin/inquiries/page.js` (513 lines) — Full inquiries admin UI
15. `src/app/admin/accounting/customers/page.jsx` (511 lines) — Reference UI pattern
16. `src/app/admin/social-media/inbox/page.js` (309 lines) — Social inbox UI
17. `src/app/admin/social-media/inbox/[id]/page.js` (333 lines) — Conversation detail UI
18. `src/components/AdminPageHeader.js` — Reusable header component
19. `src/contexts/auth-context.js` — Auth context with client switching
20. `package.json` — Dependencies (no DnD library installed)
21. `next.config.mjs` — Next.js config

### How the Existing System Works

**Inquiries flow**: Public form → `POST /api/v1/inquiries` (no auth, no rate limiting) → creates `WehowareInquiry` row → admin views at `/admin/inquiries` → updates status via PUT (New/In Progress/Resolved). The `InquiryStatus` enum uses `In_Progress @map("In Progress")` — Prisma value is `In_Progress`, DB stores `"In Progress"`, API serializes to `"In Progress"`.

**Social inbox flow**: Cron or manual sync → `POST /api/v1/social/inbox/sync` → `syncAllInboxes(clientId)` in `social-inbox-sync.js` → upserts `WehowareSocialInboxConversation` + `WehowareSocialInboxMessage` rows → admin views at `/admin/social-media/inbox`.

**Customer pattern (reference)**: `withAuth` middleware → `resolveClientId(user)` → Prisma query with `clientId` filter → `serializeCustomer()` converts camelCase → snake_case → returns `{ data, pagination }`. UI uses `Sheet` for create/edit, `ConfirmDialog` for delete, `react-hot-toast` for feedback.

**Multi-tenancy**: Every model has `clientId` FK → `WehowareClient` with `onDelete: Cascade`. `WehowareProfile` has named relations for every FK (e.g., `"CustomerCreator"`, `"CustomerUpdater"`) with corresponding `@@index` entries with `map:` attributes.

**Audit fields pattern**: All content models have `active Boolean @default(true)`, `createdBy String? @db.VarChar(36)`, `updatedBy String? @db.VarChar(36)`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`, with `creator`/`updater` relations to `WehowareProfile` and `@@index` entries for both.

---

## Phase 2 — Scenario Mapping

### Real-Time Scenarios

1. **Happy path — website inquiry**: Public form submits → CRM contact created (type=Lead, source=Website) → appears in CRM contacts + unified inbox → admin converts to customer
2. **Happy path — social DM**: Social sync runs → new conversation detected → auto-bridge creates CRM contact + activity → appears in unified inbox with SocialMedia badge
3. **Concurrent inquiry submissions**: Two forms submit simultaneously with same email → dedup by `[clientId, email]` unique constraint → second one updates existing contact's inquiry fields
4. **Social sync mid-flight**: Sync pulls 50 conversations → post-sync hook iterates → one bridge fails → remaining 49 still succeed (per-conversation try/catch)
5. **Stale data on dashboard**: Admin has dashboard open, new lead arrives via social sync → dashboard shows stale counts until refresh → acceptable (no real-time push needed)
6. **Network latency on pipeline drag**: User drags deal to new stage → API call slow → UI shows optimistic update → if API fails, revert position + toast error

### Worst-Case Scenarios

7. **DB connection failure**: Prisma throws `PrismaClientInitializationError` → API returns 500 with generic error → UI shows toast "Failed to fetch/create" → no data corruption
8. **Social platform API down**: `syncInboxForAccount` catches error per-account → logs `syncError` on `WehowareSocialAccount` → continues to next account → post-sync hook only processes successfully synced conversations
9. **Malformed public POST**: Missing `name`/`email` → 400 with field-specific error message. Empty body → 400 "Invalid JSON body". Extra fields → ignored (only mapped fields used)
10. **Large payload (1000+ contacts)**: API pagination caps at `MAX_PAGE_SIZE` (100). UI fetches with `limit=100`. Dashboard stats use `count()` not `findMany()` for performance
11. **Auth bypass attempt**: Unauthenticated request to `/api/v1/crm/contacts` → `withAuth` returns 401. Client role trying to access another client's data → `clientId` filter prevents cross-tenant access
12. **Cascading failure in social bridge**: Post-sync hook throws → caught by outer try/catch in `syncAllInboxes` → sync still returns success for conversations synced → bridge failure logged but doesn't break sync

### Edge Cases

13. **Null email on social lead**: Social conversation has no email → `email` field is null → `[clientId, email]` unique constraint allows multiple NULLs in MySQL → no dedup conflict. Dedup for social uses `socialInboxConversationId` instead
14. **Duplicate social conversation**: Same `platformConversationId` synced twice → `@@unique([accountId, platformConversationId])` on `WehowareSocialInboxConversation` prevents duplicate → post-sync hook checks `socialInboxConversationId` on CRM contact → skips if exists
15. **Name with no space**: `participantName = "Prince"` → `firstName = "Prince"`, `lastName = null` (split on first space, if no space, all goes to firstName)
16. **Inquiry status reverse mapping**: Admin page sends `PUT /api/v1/inquiries` with `status: "In Progress"` → API maps to CRM `Contacted` → GET returns CRM contact → reverse-maps `Contacted` back to `"In Progress"` for backward compat
17. **Phone log with existing contact**: User logs call with phone `555-1234` → contact with that phone exists → logs `Call` activity on existing contact → does NOT create duplicate contact
18. **Email log with no matching contact**: User logs email with `new@email.com` → no match → creates new contact (type=Lead, source=Email) + logs `Email` activity
19. **Timezone on `scheduledAt`**: Activity scheduled for "3pm EST" → stored as UTC in MySQL DateTime → UI converts using browser locale → `date-fns` handles display formatting
20. **First-run (no pipelines)**: CRM dashboard loads with no pipelines → shows empty state with "Create Pipeline" button → pipeline board shows "No pipelines configured" message
21. **Deal with no contact**: API validates `contactId` is required on POST `/api/v1/crm/deals` → 400 if missing. UI form requires contact selection

---

## Architecture Decisions

- **Separate from Accounting Customers/Vendors**: CRM Contacts are a new entity. Existing `WehowareCustomer` (accounting) stays untouched. A soft-link field `accountingCustomerId` on CRM Contacts optionally connects them.
- **Full absorption of Inquiries**: The public `POST /api/v1/inquiries` endpoint is rewritten to create a `WehowareCrmContact` with `type=Lead`, `source=Website` instead of a `WehowareInquiry` row. The `/admin/inquiries` page is removed and replaced by `/admin/crm/contacts?type=Lead`. A migration script imports existing `WehowareInquiry` rows into CRM contacts. The `WehowareInquiry` model is deprecated (kept in schema for backward compat but no new writes).
- **Multi-tenant isolation**: All tables include `clientId` FK to `WehowareClient`, same as every other module.
- **Auth**: Reuses `withAuth` middleware from `@/app/api/utils/auth-middleware.js` with `allowedRoles: ["admin", "employee", "client"]`.
- **API conventions**: REST routes under `/api/v1/crm/*`, snake_case JSON payloads, paginated list responses with `{ data, pagination }` shape — matching existing patterns (customers, inquiries, etc.).
- **UI conventions**: shadcn/ui components, `AdminPageHeader`, `Sheet` for create/edit drawers, `ConfirmDialog` for deletes, `react-hot-toast` for notifications — matching the accounting/customers page pattern.
- **Sidebar**: New `CRM_GROUP_ID` group in `AdminLayout.js` `sidebarSections` with children for each CRM page.
- **Database**: MySQL via Prisma, UUID PKs (`@db.VarChar(36)`), `@map` for snake_case columns, `createdBy`/`updatedBy` audit fields linked to `WehowareProfile`.

---

## Cross-Module Analysis (Platform Fit Review)

This SaaS platform is for a **US-based software development & marketing agency**. The "active client" concept = agency clients. Each module serves the agency's workflow:

### Existing Modules & CRM Impact

| Module | Existing Behavior | CRM Integration | Status |
|---|---|---|---|
| **Accounting/Customers** (`WehowareCustomer`) | Separate entity — billing customers with invoices | CRM contact converts to `WehowareCustomer` via `accountingCustomerId` soft-link. Already in plan. | ✅ Covered |
| **Accounting/Invoices** (`WehowareInvoice`) | Invoices linked to `WehowareCustomer.customerId` | When CRM lead converts → creates `WehowareCustomer` → invoices flow naturally. Already in plan. | ✅ Covered |
| **Inquiries** (`WehowareInquiry`) | Public form submissions → admin manages | Full absorption into CRM contacts. Already in plan. | ✅ Covered |
| **Social Media Inbox** (`WehowareSocialInboxConversation`) | Social DMs synced from platforms | Auto-bridge to CRM contacts. Already in plan. | ✅ Covered |
| **Services** (`WehowareService`) | Agency service catalog with fees | `inquiryServiceId` on CRM contact preserves which service the lead inquired about. Already in plan. | ✅ Covered |
| **Form Builder** (`WehowareFormTemplate` + `WehowareFormSubmission`) | Custom forms with submissions stored as JSON | **NEW: Auto-create CRM contacts from form submissions.** See below. | 🔧 Adding |
| **Appointments** (`WehowareAppointment`) | Guest bookings with name/email/phone | **NEW: Auto-link appointments to CRM contacts.** See below. | 🔧 Adding |
| **Tasks** (`WehowareTask`) | Task management with goals, reports, daily reports | CRM activities of type Task/FollowUp could create real `WehowareTask` records. **Deferred to future phase** per user decision. | ⏭️ Deferred |
| **Blogs** (`WehowareBlog`) | Content management | No direct CRM interaction. | ✅ N/A |
| **SEO** (`WehowareSeoSetting`) | SEO tools, keywords, analyser | No direct CRM interaction. | ✅ N/A |
| **Inventory** (`WehowareInventoryItem`) | Product/inventory management | No direct CRM interaction. | ✅ N/A |
| **Reports** (`WehowareReport`) | Reporting system | No direct CRM interaction. Dashboard is self-contained. | ✅ N/A |
| **Integrations** (`WehowareIntegration`) | Third-party webhooks, calendar events | No direct CRM interaction. | ✅ N/A |

### Agency Business Model Fit

As a software dev & marketing agency, the CRM serves as the **central lead pipeline**:
- **Lead sources**: Website contact forms, social media DMs, form builder submissions, phone calls, emails, appointments booked, manual entry
- **Sales pipeline**: Lead → Qualified → Proposal → Negotiation → Won (becomes accounting customer)
- **Conversion**: CRM contact `type=Lead` → `type=Customer` → creates `WehowareCustomer` → invoices can be generated
- **Service tracking**: `inquiryServiceId` links leads to specific agency services (web dev, SEO, social media management, etc.)
- **Multi-client**: Each agency client has their own CRM data isolated by `clientId` — the agency manages CRM for each client

### Currency Decision

Platform uses `CAD` everywhere (invoices, services, customers). CRM deal `currency` field defaults to `CAD` for consistency. Changing platform-wide is a separate task.

---

## Database Schema (Prisma)

### New Enums

```prisma
enum ContactType {
  Lead
  Customer
  Member
  Subscriber
  Partner
  Vendor
}

enum ContactStatus {
  New
  Contacted
  Qualified
  Unqualified
  Converted
  Lost
}

enum LeadSource {
  Website
  SocialMedia
  PhoneCall
  Email
  Referral
  EmailCampaign
  ColdCall
  Event
  WalkIn
  FormBuilder
  Appointment
  Other
}

enum DealStatus {
  Open
  Won
  Lost
  Abandoned
}

enum ActivityType {
  Call
  Email
  Meeting
  Task
  Note
  Visit
  Demo
  FollowUp
  SocialMessage
  WebInquiry
  FormBuilderSubmission
  AppointmentBooked
}

enum ActivityDirection {
  Outbound
  Inbound
}

enum PipelineStageType {
  Lead
  Qualified
  Proposal
  Negotiation
  ClosedWon
  ClosedLost
}
```

### New Models

#### 1. WehowareCrmContact
Core contact/lead record — replaces the concept of scattered inquiries + customers into a unified CRM contact.

| Field | Type | Notes |
|---|---|---|
| id | String @id UUID | |
| clientId | String FK → WehowareClient | |
| firstName | String? VarChar(100) | |
| lastName | String? VarChar(100) | |
| email | String? VarChar(255) | |
| phone | String? VarChar(50) | |
| mobile | String? VarChar(50) | |
| company | String? VarChar(255) | |
| jobTitle | String? VarChar(255) | |
| website | String? VarChar(500) | |
| type | ContactType | default Lead |
| status | ContactStatus | default New |
| source | LeadSource? | |
| inquirySubject | String? VarChar(500) | Original subject from contact form submission |
| inquiryMessage | String? Text | Original message from contact form submission |
| inquiryServiceId | String? VarChar(36) | Original serviceId from inquiry (if submitted via service page) |
| socialInboxConversationId | String? VarChar(36) | **Proper FK** with `@relation` to `WehowareSocialInboxConversation` (one-to-one). The conversation model gets back-relation `crmContact WehowareCrmContact?` |
| socialPlatform | String? VarChar(50) | e.g. facebook, instagram, twitter, tiktok (for social-sourced leads) |
| formSubmissionId | String? VarChar(36) | **Soft-link** to `WehowareFormSubmission` (no FK — just ID reference, same pattern as `accountingCustomerId`) |
| appointmentId | String? VarChar(36) | **Soft-link** to `WehowareAppointment` (no FK — just ID reference) |
| ownerId | String? FK → WehowareProfile | Assigned sales rep (named relation `"CrmContactOwner"`) |
| address | String? Text | |
| city | String? VarChar(100) | |
| state | String? VarChar(100) | |
| country | String? VarChar(100) | |
| postalCode | String? VarChar(20) | |
| avatarUrl | String? VarChar(500) | |
| socialProfiles | Json? | { linkedin, twitter, facebook, instagram } |
| tags | Json | [] |
| customFields | Json? | User-defined fields |
| notes | String? Text | |
| leadScore | Int | default 0 |
| lastContactedAt | DateTime? | |
| convertedAt | DateTime? | |
| accountingCustomerId | String? VarChar(36) | Soft-link to WehowareCustomer (no FK relation — just ID reference) |
| **active** | **Boolean** | **default true — soft delete flag (matches `WehowareCustomer`, `WehowareBlogCategory` pattern)** |
| createdBy | String? FK → WehowareProfile | Named relation `"CrmContactCreator"` |
| updatedBy | String? FK → WehowareProfile | Named relation `"CrmContactUpdater"` |
| createdAt | DateTime | `@default(now())` |
| updatedAt | DateTime | `@updatedAt` |
| **Relations** | | `client`, `owner`, `creator`, `updater`, `socialInboxConversation`, `deals[]`, `activities[]`, `listMemberships[]` |

**Indexes**: `[clientId]`, `[email]`, `[status]`, `[type]`, `[ownerId]`, `[source]`, `[socialInboxConversationId]`, `[formSubmissionId]`, `[appointmentId]`, `[active]`, `[createdBy]` with `map: "wehoware_crm_contacts_created_by_fkey"`, `[updatedBy]` with `map: "wehoware_crm_contacts_updated_by_fkey"`, `@@unique([clientId, email])` — note: MySQL allows multiple NULL emails in unique constraint

#### 2. WehowareCrmPipeline
Sales pipeline (kanban board) — e.g. "Default Sales Pipeline", "Recruitment Pipeline".

| Field | Type | Notes |
|---|---|---|
| id | String @id UUID | |
| clientId | String FK | |
| name | String VarChar(255) | |
| description | String? Text | |
| isActive | Boolean | default true |
| **active** | **Boolean** | **default true — soft delete flag** |
| createdBy | String? FK | Named relation `"CrmPipelineCreator"` |
| updatedBy | String? FK | Named relation `"CrmPipelineUpdater"` |
| createdAt / updatedAt | DateTime | |
| **Relations** | | `client`, `creator`, `updater`, `stages[]`, `deals[]` |

**Indexes**: `[clientId]`, `[active]`, `[createdBy]` with `map:`, `[updatedBy]` with `map:`

#### 3. WehowareCrmPipelineStage
Stages within a pipeline — e.g. "New Lead", "Qualified", "Proposal Sent", "Won".

| Field | Type | Notes |
|---|---|---|
| id | String @id UUID | |
| pipelineId | String FK → WehowareCrmPipeline | onDelete Cascade |
| clientId | String FK → WehowareClient | With explicit `client` relation |
| name | String VarChar(255) | |
| stageType | PipelineStageType | |
| displayOrder | Int | |
| isClosedStage | Boolean | default false — won/lost stages |
| probability | Int | default 0 — win probability % |
| color | String? VarChar(20) | Hex color for UI |
| **active** | **Boolean** | **default true** |
| **createdBy** | **String? FK** | **Named relation `"CrmStageCreator"`** |
| **updatedBy** | **String? FK** | **Named relation `"CrmStageUpdater"`** |
| createdAt / updatedAt | DateTime | |
| **Relations** | | `client`, `pipeline`, `creator`, `updater`, `deals[]` |

**Indexes**: `[pipelineId]`, `[clientId]`, `[displayOrder]`, `[active]`, `[createdBy]` with `map:`, `[updatedBy]` with `map:`

#### 4. WehowareCrmDeal
A deal/opportunity linked to a contact and pipeline stage.

| Field | Type | Notes |
|---|---|---|
| id | String @id UUID | |
| clientId | String FK | |
| contactId | String FK → WehowareCrmContact | |
| pipelineId | String FK → WehowareCrmPipeline | |
| stageId | String FK → WehowareCrmPipelineStage | |
| title | String VarChar(500) | |
| description | String? Text | |
| value | Decimal Decimal(12,2) | Deal amount |
| currency | String VarChar(10) | default CAD |
| status | DealStatus | default Open |
| expectedCloseDate | DateTime? | |
| actualCloseDate | DateTime? | |
| ownerId | String? FK → WehowareProfile | Sales rep |
| tags | Json | [] |
| customFields | Json? | |
| lostReason | String? Text | |
| **active** | **Boolean** | **default true** |
| createdBy | String? FK | Named relation `"CrmDealCreator"` |
| updatedBy | String? FK | Named relation `"CrmDealUpdater"` |
| createdAt / updatedAt | DateTime | |
| **Relations** | | `client`, `contact`, `pipeline`, `stage`, `owner`, `creator`, `updater`, `activities[]` |

**Indexes**: `[clientId]`, `[contactId]`, `[pipelineId]`, `[stageId]`, `[status]`, `[ownerId]`, `[expectedCloseDate]`, `[active]`, `[createdBy]` with `map:`, `[updatedBy]` with `map:`

#### 5. WehowareCrmActivity
Activity/timeline log for contacts and deals — calls, emails, meetings, notes.

| Field | Type | Notes |
|---|---|---|
| id | String @id UUID | |
| clientId | String FK | |
| contactId | String? FK → WehowareCrmContact | |
| dealId | String? FK → WehowareCrmDeal | |
| type | ActivityType | |
| direction | ActivityDirection? | For calls/emails |
| title | String VarChar(500) | |
| description | String? Text | |
| scheduledAt | DateTime? | For meetings/follow-ups |
| completedAt | DateTime? | |
| durationMinutes | Int? | |
| outcome | String? VarChar(255) | e.g. "Interested", "No answer" |
| ownerId | String? FK → WehowareProfile | Named relation `"CrmActivityOwner"` |
| **active** | **Boolean** | **default true** |
| createdBy | String? FK | Named relation `"CrmActivityCreator"` |
| updatedBy | String? FK | Named relation `"CrmActivityUpdater"` |
| createdAt / updatedAt | DateTime | |
| **Relations** | | `client`, `contact`, `deal`, `owner`, `creator`, `updater` |

**Indexes**: `[clientId]`, `[contactId]`, `[dealId]`, `[type]`, `[scheduledAt]`, `[completedAt]`, `[ownerId]`, `[active]`, `[createdBy]` with `map:`, `[updatedBy]` with `map:`

#### 6. WehowareCrmContactList
Contact lists/segments for grouping — e.g. "Newsletter Subscribers", "Hot Leads".

| Field | Type | Notes |
|---|---|---|
| id | String @id UUID | |
| clientId | String FK | |
| name | String VarChar(255) | |
| description | String? Text | |
| color | String? VarChar(20) | |
| **active** | **Boolean** | **default true** |
| **createdBy** | **String? FK** | **Named relation `"CrmListCreator"`** |
| **updatedBy** | **String? FK** | **Named relation `"CrmListUpdater"`** |
| createdAt / updatedAt | DateTime | |
| **Relations** | | `client`, `creator`, `updater`, `memberships[]` |

**Indexes**: `[clientId]`, `[active]`, `[createdBy]` with `map:`, `[updatedBy]` with `map:`

#### 7. WehowareCrmContactListMembership
Join table: contact ↔ list.

| Field | Type | Notes |
|---|---|---|
| id | String @id UUID | |
| contactListId | String FK → WehowareCrmContactList | onDelete Cascade |
| contactId | String FK → WehowareCrmContact | onDelete Cascade |
| clientId | String FK → WehowareClient | With explicit `client` relation |
| addedAt | DateTime | `@default(now())` |
| **Relations** | | `client`, `contactList`, `contact` |

**Unique**: `[contactListId, contactId]`
**Indexes**: `[contactListId]`, `[contactId]`, `[clientId]`

### Relations Added to Existing Models

- `WehowareClient`: add `crmContacts WehowareCrmContact[]`, `crmPipelines WehowareCrmPipeline[]`, `crmPipelineStages WehowareCrmPipelineStage[]`, `crmDeals WehowareCrmDeal[]`, `crmActivities WehowareCrmActivity[]`, `crmContactLists WehowareCrmContactList[]`, `crmContactListMemberships WehowareCrmContactListMembership[]`
- `WehowareProfile`: add named relations — `ownedCrmContacts WehowareCrmContact[] @relation("CrmContactOwner")`, `createdCrmContacts WehowareCrmContact[] @relation("CrmContactCreator")`, `updatedCrmContacts WehowareCrmContact[] @relation("CrmContactUpdater")`, `createdCrmPipelines @relation("CrmPipelineCreator")`, `updatedCrmPipelines @relation("CrmPipelineUpdater")`, `createdCrmStages @relation("CrmStageCreator")`, `updatedCrmStages @relation("CrmStageUpdater")`, `ownedCrmDeals @relation("CrmDealOwner")`, `createdCrmDeals @relation("CrmDealCreator")`, `updatedCrmDeals @relation("CrmDealUpdater")`, `ownedCrmActivities @relation("CrmActivityOwner")`, `createdCrmActivities @relation("CrmActivityCreator")`, `updatedCrmActivities @relation("CrmActivityUpdater")`, `createdCrmLists @relation("CrmListCreator")`, `updatedCrmLists @relation("CrmListUpdater")`
- `WehowareSocialInboxConversation`: add `crmContact WehowareCrmContact?` (one-to-one back-relation via `socialInboxConversationId` on `WehowareCrmContact`)

---

## API Endpoints

All under `/api/v1/crm/` — using `withAuth` middleware.

### Contacts (`/api/v1/crm/contacts`)

| Method | Path | Description |
|---|---|---|
| GET | `/contacts` | List contacts (paginated, search, filter by type/status/source/owner/tags) |
| POST | `/contacts` | Create contact |
| GET | `/contacts/[id]` | Get contact detail (with deals, recent activities) |
| PUT | `/contacts/[id]` | Update contact |
| DELETE | `/contacts/[id]` | Delete contact (or archive if has deals) |
| POST | `/contacts/[id]/convert` | Convert lead → customer (sets status, optionally creates accounting customer) |
| GET | `/contacts/stats` | Dashboard stats: total by type, by status, by source, new this month |

### Public Lead Capture (`/api/v1/inquiries` — rewritten)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/inquiries` | **None (public) — wrapped with `withPublic` middleware from `@/app/api/public/utils/public-middleware.js` for CORS headers + in-memory rate limiting** | Creates `WehowareCrmContact` with `type=Lead`, `source=Website`, `status=New`. Maps `name`→`firstName`/`lastName`, `email`, `phone`, `subject`→`inquirySubject`, `message`→`inquiryMessage`, `service_id`→`inquiryServiceId`. **Dedup**: if `[clientId, email]` already exists, updates inquiry fields on existing contact instead of creating duplicate. **Response**: 201 with `{ id, name, email, subject, message, status, created_at }` — reverse-serialized from CRM contact fields (`firstName`+`lastName`→`name`, `inquirySubject`→`subject`, `inquiryMessage`→`message`, `status`→`"New"`). Existing client website forms need zero changes. |
| GET | `/inquiries` | withAuth | Returns CRM contacts filtered to `type=Lead, source=Website` — same `{ data, pagination }` shape. **Reverse serialization**: `firstName`+`lastName`→`name`, `inquirySubject`→`subject`, `inquiryMessage`→`message`, CRM `Contacted`→`"In Progress"`, CRM `Qualified`→`"Resolved"`. |
| PUT | `/inquiries` | withAuth | Updates CRM contact status. **Forward mapping**: `"New"`→`New`, `"In Progress"`→`Contacted`, `"Resolved"`→`Qualified`. Also updates `inquirySubject`/`inquiryMessage` if provided. |
| DELETE | `/inquiries` | withAuth | Soft-deletes (sets `active=false`) corresponding CRM contact. |

### Pipelines (`/api/v1/crm/pipelines`)

| Method | Path | Description |
|---|---|---|
| GET | `/pipelines` | List pipelines (with stages) |
| POST | `/pipelines` | Create pipeline |
| GET | `/pipelines/[id]` | Get pipeline with stages and deal counts |
| PUT | `/pipelines/[id]` | Update pipeline |
| DELETE | `/pipelines/[id]` | Delete pipeline (if no deals) |
| POST | `/pipelines/[id]/stages` | Add stage to pipeline |
| PUT | `/pipelines/[id]/stages/[stageId]` | Update stage |
| DELETE | `/pipelines/[id]/stages/[stageId]` | Delete stage |

### Deals (`/api/v1/crm/deals`)

| Method | Path | Description |
|---|---|---|
| GET | `/deals` | List deals (paginated, filter by pipeline/stage/status/owner/contact) |
| POST | `/deals` | Create deal |
| GET | `/deals/[id]` | Get deal detail (with contact, activities) |
| PUT | `/deals/[id]` | Update deal (including stage movement) |
| DELETE | `/deals/[id]` | Delete deal |
| POST | `/deals/[id]/move` | Move deal to different stage (drag-and-drop) |
| GET | `/deals/stats` | Dashboard stats: total value, won/lost, by pipeline, by stage |

### Activities (`/api/v1/crm/activities`)

| Method | Path | Description |
|---|---|---|
| GET | `/activities` | List activities (filter by contact/deal/type/owner/date range) |
| POST | `/activities` | Create activity (log a call, schedule a meeting, etc.) |
| GET | `/activities/[id]` | Get activity detail |
| PUT | `/activities/[id]` | Update activity (mark complete, reschedule) |
| DELETE | `/activities/[id]` | Delete activity |
| POST | `/activities/[id]/complete` | Mark activity as completed |

### Contact Lists (`/api/v1/crm/lists`)

| Method | Path | Description |
|---|---|---|
| GET | `/lists` | List contact lists |
| POST | `/lists` | Create list |
| GET | `/lists/[id]` | Get list with member count |
| PUT | `/lists/[id]` | Update list |
| DELETE | `/lists/[id]` | Delete list |
| POST | `/lists/[id]/members` | Add contact(s) to list |
| DELETE | `/lists/[id]/members/[contactId]` | Remove contact from list |

### Unified Inbox (`/api/v1/crm/inbox`)

| Method | Path | Description |
|---|---|---|
| GET | `/inbox` | Unified feed: merges CRM contacts from all sources (website, social, phone, email, manual) into one chronological feed. Filter by source, status, unread. Each item shows source badge, contact name, message preview, timestamp. |
| GET | `/inbox/stats` | Counts by source: unconverted social conversations, new website inquiries, missed calls, unread emails |
| POST | `/inbox/social/[conversationId]/convert` | Convert a social inbox conversation into a tracked CRM lead — creates CRM contact from participant info, links conversation, creates initial activity (type=SocialMessage) |
| POST | `/inbox/phone/log` | Log an inbound/outbound phone call as a CRM contact + activity (type=Call). If phone number matches existing contact, links to it instead of creating duplicate. |
| POST | `/inbox/email/log` | Log an inbound/outbound email as a CRM contact + activity (type=Email). If email matches existing contact, links to it instead of creating duplicate. |

### Cross-Module Integration Endpoints

#### Form Builder → CRM

**Trigger**: When a `WehowareFormSubmission` is created (in `POST /api/v1/forms/[id]/submissions`), a post-save hook auto-creates a CRM contact.

| Method | Path | Auth | Description |
|---|---|---|---|
| — | (internal hook) | — | After `WehowareFormSubmission` is created, extract `firstName`, `lastName`, `email`, `phone` from `submissionData` JSON. Create `WehowareCrmContact` with `type=Lead`, `source=FormBuilder`, `status=New`, `formSubmissionId=submission.id`. Create `WehowareCrmActivity` with `type=FormBuilderSubmission`, `description="Form: {formTemplate.title}"`, `metadata=submissionData`. **Dedup**: if `[clientId, email]` already exists, update `formSubmissionId` and add activity to existing contact. |

**Implementation**: Add a helper function `bridgeFormSubmissionToCrm(submission, formTemplate, prisma)` in a new file `src/lib/crm-bridge.js`. Call it from the form submission POST handler after successful insert. Wrap in try-catch — form submission should succeed even if CRM bridge fails (log error, don't block).

#### Appointments → CRM

**Trigger**: When a `WehowareAppointment` is created (in `POST /api/v1/appointments`), a post-save hook auto-creates/links a CRM contact.

| Method | Path | Auth | Description |
|---|---|---|---|
| — | (internal hook) | — | After `WehowareAppointment` is created, use `guestName` (split into `firstName`/`lastName`), `guestEmail`, `guestPhone`. Create `WehowareCrmContact` with `type=Lead`, `source=Appointment`, `status=New`, `appointmentId=appointment.id`. Create `WehowareCrmActivity` with `type=AppointmentBooked`, `description="Appointment: {appointmentType?.name || 'General'}"`, `scheduledAt=appointment.scheduledAt`, `metadata={ appointmentId, location, meetingLink }`. **Dedup**: if `[clientId, guestEmail]` already exists, update `appointmentId` and add activity to existing contact. |

**Implementation**: Add a helper function `bridgeAppointmentToCrm(appointment, prisma)` in `src/lib/crm-bridge.js`. Call it from the appointment POST handler after successful insert. Wrap in try-catch — appointment creation should succeed even if CRM bridge fails.

**Contact Detail UI**: The contact detail page (`/admin/crm/contacts/[id]`) shows a "Linked Appointments" card when `appointmentId` is set, with a link to `/admin/appointments`. Similarly, the appointments page could show a CRM contact badge when `appointmentId` matches a CRM contact — but this is a read-only convenience, not a separate endpoint.

### Social Inbox Auto-Bridge

The post-sync hook is added to **`src/lib/social-inbox-sync.js`** (not the route file) — inside `syncAllInboxes()` after conversations are upserted. This ensures it fires whether sync is triggered via the API route or via cron job.

**Hook logic** — iterates newly synced conversations and for each:
- `type=Lead`, `source=SocialMedia`, `status=New`
- `firstName` = split `participantName` on first space (if no space, all in `firstName`, `lastName=null`)
- `avatarUrl` = `participantAvatar`
- `socialInboxConversationId` = conversation ID (proper FK relation)
- `socialPlatform` = `platformCode`
- `socialProfiles` = `{ [platformCode]: { handle: participantHandle, id: participantId } }`
- `customFields` = `{ lastMessagePreview, participantId }`
- Creates an initial `WehowareCrmActivity` (type=SocialMessage, direction=Inbound) with the first message content as description
- **Dedup**: if a `WehowareCrmContact` with `socialInboxConversationId = conversation.id` already exists → skip
- **Error handling**: per-conversation `try/catch` — one bridge failure doesn't block others. Errors logged with `console.error`.

### Cron Job — Social Inbox Sync

Add a new cron job type `social_inbox_sync` to `src/lib/cron-jobs/social-media.js` and register it in `src/app/api/v1/cron/route.js`:
- Calls `syncAllInboxes()` for all clients with active social accounts
- Runs every 15 minutes (configured in external cron scheduler)
- Post-sync hook fires automatically inside `syncAllInboxes()`
- Secured by `CRON_SECRET` header (same as existing cron jobs)

### Dashboard (`/api/v1/crm/dashboard`)

| Method | Path | Description |
|---|---|---|
| GET | `/dashboard` | Aggregated stats: contacts by status, deals by stage, revenue, activities this week, upcoming follow-ups, recent conversions, **leads by source** (website vs social vs phone vs email vs manual), **unconverted social conversations count** |

---

## Admin UI Pages

All under `/src/app/admin/crm/` — using existing shadcn/ui + AdminPageHeader patterns.

### Sidebar Registration (`AdminLayout.js`)

New group in `sidebarSections`:
```
CRM (icon: Contact icon)
  ├── Overview      → /admin/crm            (dashboard)
  ├── Unified Inbox → /admin/crm/inbox       (all sources in one feed)
  ├── Contacts      → /admin/crm/contacts    (list + detail)
  ├── Pipeline      → /admin/crm/pipeline    (kanban board)
  ├── Deals         → /admin/crm/deals       (list view)
  ├── Activities    → /admin/crm/activities  (timeline)
  └── Lists         → /admin/crm/lists       (segments)
```

Roles: `["admin", "employee", "client"]` with `clientRoles: ["client", "manager", "editor"]`

### Page Structure

| Page | Route | Description |
|---|---|---|
| Dashboard | `/admin/crm` | Stat cards (total contacts, open deals, pipeline value, win rate, **leads by source**), charts (contacts by source, deals by stage), upcoming activities, recent conversions, **unconverted social count** |
| Unified Inbox | `/admin/crm/inbox` | Single feed showing leads from all sources (website, social, phone, email, manual) with source badges, filter by source/status, click to view contact detail, convert to deal button |
| Contacts List | `/admin/crm/contacts` | Table with search, filters (type, status, source, owner), tags display, create/edit via Sheet drawer |
| Contact Detail | `/admin/crm/contacts/[id]` | Full profile: info, deals, activity timeline, notes, edit, convert-to-customer button |
| Pipeline Board | `/admin/crm/pipeline` | Kanban board: columns = stages, cards = deals, drag-and-drop to move stages, deal value badges, color-coded stages |
| Deals List | `/admin/crm/deals` | Table view of all deals with filter by pipeline/stage/status/owner, create/edit via Sheet |
| Deal Detail | `/admin/crm/deals/[id]` | Deal info, linked contact, stage progression, activities, value, close date |
| Activities | `/admin/crm/activities` | Timeline view of all activities, filter by type/date/owner, schedule new activity, mark complete |
| Lists | `/admin/crm/lists` | Contact list/segment management, add/remove members, member counts |

### Components (`/src/components/crm/`)

| Component | Purpose |
|---|---|
| `ContactForm.js` | Create/edit contact form (used in Sheet) |
| `ContactDetail.js` | Contact profile view with tabs (info, deals, activities, notes). Shows linked records: social inbox conversation (if `socialInboxConversationId`), form submission (if `formSubmissionId`), appointment (if `appointmentId`), accounting customer (if `accountingCustomerId`) |
| `DealForm.js` | Create/edit deal form |
| `DealCard.js` | Kanban card for pipeline board |
| `PipelineBoard.js` | Drag-and-drop kanban board with stage columns |
| `ActivityForm.js` | Log/schedule activity form |
| `ActivityTimeline.js` | Chronological activity feed |
| `ContactListForm.js` | Create/edit contact list |
| `CrmDashboard.js` | Dashboard with stat cards and charts |
| `CrmStatsCards.js` | Reusable stat card row |
| `UnifiedInbox.js` | Unified inbox feed component with source badges and filters |
| `SourceBadge.js` | Reusable badge showing lead source (Website/Social/FormBuilder/Appointment/Phone/Email/Manual) with icon |
| `PhoneLogForm.js` | Quick form to log a phone call as a lead + activity |
| `EmailLogForm.js` | Quick form to log an email as a lead + activity |

---

## Implementation Phases

### Phase 1: Database & Schema (1 session)
1. Add 7 new enums to `prisma/schema.prisma`
2. Add 7 new models to `prisma/schema.prisma` — all with `active Boolean @default(true)`, `createdBy`/`updatedBy` with named relations and `@@index` with `map:` attributes (matching `WehowareCustomer` pattern)
3. Add relations to `WehowareClient` (7 new arrays) and `WehowareProfile` (16 named relations)
4. Add `crmContact WehowareCrmContact?` back-relation on `WehowareSocialInboxConversation`
5. Run `npx prisma db push` to create tables
6. Run `npx prisma generate` to update client

### Phase 2: API Layer — Contacts & Inquiry Rewrite (1 session)
1. Create `/api/v1/crm/contacts/route.js` (GET list, POST create)
2. Create `/api/v1/crm/contacts/[id]/route.js` (GET, PUT, DELETE — soft-delete via `active=false`)
3. Create `/api/v1/crm/contacts/[id]/convert/route.js` (POST)
4. Create `/api/v1/crm/contacts/stats/route.js` (GET)
5. **Rewrite** `/api/v1/inquiries/route.js`:
   - POST: wrap with `withPublic` middleware (rate limiting + CORS), create CRM contact with dedup by `[clientId, email]`, reverse-serialize response
   - GET/PUT/DELETE: use `withAuth`, proxy to CRM contacts with forward/reverse status mapping

### Phase 3: API Layer — Pipelines & Deals (1 session)
1. Create `/api/v1/crm/pipelines/` routes (CRUD + stages)
2. Create `/api/v1/crm/deals/` routes (CRUD + move stage + stats)

### Phase 4: API Layer — Activities, Lists & Dashboard (1 session)
1. Create `/api/v1/crm/activities/` routes (CRUD + complete)
2. Create `/api/v1/crm/lists/` routes (CRUD + members)
3. Create `/api/v1/crm/dashboard/route.js` (GET aggregated stats including leads-by-source)

### Phase 5: Unified Inbox, Social Bridge & Cross-Module Hooks (1.5 sessions)
1. Create `/api/v1/crm/inbox/route.js` (GET — unified feed)
2. Create `/api/v1/crm/inbox/stats/route.js` (GET — counts by source)
3. Create `/api/v1/crm/inbox/social/[conversationId]/convert/route.js` (POST)
4. Create `/api/v1/crm/inbox/phone/log/route.js` (POST — dedup by phone)
5. Create `/api/v1/crm/inbox/email/log/route.js` (POST — dedup by email)
6. **Modify** `src/lib/social-inbox-sync.js` — add post-sync hook inside `syncAllInboxes()` (NOT in the route file) with per-conversation try/catch
7. **Add** `social_inbox_sync` cron job to `src/lib/cron-jobs/social-media.js` and register in `src/app/api/v1/cron/route.js`
8. **Create** `src/lib/crm-bridge.js` — shared bridge functions: `bridgeFormSubmissionToCrm()`, `bridgeAppointmentToCrm()`, `bridgeSocialConversationToCrm()` (used by social inbox sync hook)
9. **Modify** form submission POST handler — call `bridgeFormSubmissionToCrm()` after successful insert (try-catch, non-blocking)
10. **Modify** `src/app/api/v1/appointments/route.js` — call `bridgeAppointmentToCrm()` after successful insert (try-catch, non-blocking)

### Phase 6: UI — Contacts (1 session)
1. Create `/admin/crm/contacts/page.jsx` (list + Sheet create/edit)
2. Create `/admin/crm/contacts/[id]/page.jsx` (detail with tabs)
3. Create `src/components/crm/ContactForm.js`

### Phase 7: UI — Pipeline & Deals (1 session)
1. **Install DnD library**: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities` (not currently in `package.json`)
2. Create `/admin/crm/pipeline/page.jsx` (kanban board with drag-and-drop using @dnd-kit)
3. Create `/admin/crm/deals/page.jsx` (list view)
4. Create `/admin/crm/deals/[id]/page.jsx` (detail)
5. Create `src/components/crm/PipelineBoard.js`, `DealCard.js`, `DealForm.js`

### Phase 8: UI — Unified Inbox, Activities, Lists, Dashboard (1.5 sessions)
1. Create `/admin/crm/inbox/page.jsx` (unified inbox feed with source filters, convert buttons)
2. Create `/admin/crm/activities/page.jsx` (timeline)
3. Create `/admin/crm/lists/page.jsx` (segment management)
4. Create `/admin/crm/page.jsx` (dashboard with stats + charts + leads-by-source breakdown)
5. Create supporting components (`UnifiedInbox.js`, `SourceBadge.js`, `PhoneLogForm.js`, `EmailLogForm.js`)

### Phase 9: Sidebar, Inquiry Migration & Integration (1 session)
1. Add CRM group to `sidebarSections` in `AdminLayout.js` (after the existing Content section, before Settings)
2. Import `Contact` icon from lucide-react (already available in package)
3. **Remove** `/admin/inquiries` page and its sidebar entry (line 322-327 in `AdminLayout.js`) — replaced by `/admin/crm/contacts?type=Lead`
4. Create migration script `scripts/migrate-inquiries-to-crm.mjs` — reads all `WehowareInquiry` rows, creates corresponding `WehowareCrmContact` records (type=Lead, source=Website, inquirySubject/Message/ServiceId preserved, status mapped, ipAddress/userAgent stored in customFields)
5. Test role-based visibility
6. Update `CLAUDE.md` with CRM module documentation

---

## Key Design Patterns (Following Existing Conventions)

- **resolveClientId()**: Same pattern as customers/inquiries — client role uses `user.clientId`, employee/admin uses `user.activeClientId`
- **Serialization**: camelCase → snake_case in API responses (matching inquiries/customers pattern)
- **Pagination**: `{ data, pagination: { totalItems, page, limit, totalPages } }`
- **Search**: `OR` conditions on name/email/phone/company fields
- **Sort**: Whitelisted sort fields with `VALID_SORT_FIELDS` map
- **Delete safety**: Archive (soft-delete via `active = false`) if related records exist, hard delete otherwise
- **Audit fields**: `createdBy` / `updatedBy` on all models, linked to `WehowareProfile`
- **Sheet drawers**: Create/edit forms in `SheetContent` (matching customers page)
- **ConfirmDialog**: For all delete operations
- **toast notifications**: `react-hot-toast` for success/error feedback
- **Loading states**: `Loader2` spinner with animate-spin

## File Summary

**New files: ~43**
- 1 schema update (`prisma/schema.prisma`)
- 1 sidebar update (`src/components/AdminLayout.js`)
- ~20 API route files (including unified inbox + social bridge + phone/email logging)
- ~11 admin page files (including unified inbox page)
- ~13 component files (including inbox + source badges + phone/email log forms)
- 1 bridge library (`src/lib/crm-bridge.js`)

**Files modified**: `prisma/schema.prisma` (add models + enums + relations on `WehowareClient`, `WehowareProfile`, `WehowareSocialInboxConversation`), `src/components/AdminLayout.js` (add CRM sidebar group, remove Inquiries entry), `src/app/api/v1/inquiries/route.js` (rewrite to create CRM contacts with `withPublic` + `withAuth`), `src/lib/social-inbox-sync.js` (add post-sync CRM bridge hook inside `syncAllInboxes`), `src/lib/cron-jobs/social-media.js` (add `social_inbox_sync` cron job), `src/app/api/v1/cron/route.js` (register new cron job type), `src/app/api/v1/forms/[id]/submissions/route.js` (add `bridgeFormSubmissionToCrm` call), `src/app/api/v1/appointments/route.js` (add `bridgeAppointmentToCrm` call), `package.json` (add `@dnd-kit` dependencies), `CLAUDE.md` (documentation).

**Files removed**: `src/app/admin/inquiries/page.js` (replaced by CRM contacts page).

**New files**: `scripts/migrate-inquiries-to-crm.mjs` (one-time migration script).

## Inquiry Migration Details

### Field Mapping (WehowareInquiry → WehowareCrmContact)

| Inquiry Field | CRM Contact Field | Notes |
|---|---|---|
| name | firstName | Split on first space if possible, else all in firstName |
| email | email | |
| phone | phone | |
| subject | inquirySubject | Preserved for backward compat |
| message | inquiryMessage | Preserved for backward compat |
| serviceId | inquiryServiceId | Preserved for backward compat |
| status (New/In Progress/Resolved) | status (New/Contacted/Qualified) | Status mapping |
| clientId | clientId | |
| ipAddress | customFields.ipAddress | Stored in customFields JSON |
| userAgent | customFields.userAgent | Stored in customFields JSON |
| createdAt | createdAt | Preserved original timestamp |

### Status Mapping

| Inquiry Status | CRM Contact Status |
|---|---|
| New | New |
| In Progress | Contacted |
| Resolved | Qualified |

### Backward Compatibility

- Public `POST /api/v1/inquiries` keeps the same request body (`name`, `email`, `phone`, `subject`, `message`, `client_id`) and returns a 201 with the same shape — existing client website forms need **zero changes**
- The old `GET /api/v1/inquiries` response shape (`{ data, pagination }`) is preserved — returns CRM contacts filtered to `type=Lead, source=Website` with inquiry fields mapped back to the old shape
- `WehowareInquiry` model stays in `schema.prisma` (no Prisma error) but no new rows are written to it

---

## Unified Inbox — Lead Source Integration

### How Each Source Creates a CRM Contact

| Source | Trigger | Auto or Manual | Contact Created From |
|---|---|---|---|
| Website contact form | Public `POST /api/v1/inquiries` | **Auto** | Form fields (name, email, phone, subject, message) |
| Social media DM | Social inbox sync pulls new conversation | **Auto** (post-sync hook) | Conversation participant info (name, handle, avatar, platform) |
| Form Builder submission | `POST /api/v1/forms/[id]/submissions` | **Auto** (post-save hook) | Extracted from `submissionData` JSON (name, email, phone) |
| Appointment booked | `POST /api/v1/appointments` | **Auto** (post-save hook) | Guest info (guestName, guestEmail, guestPhone) |
| Phone call | User clicks "Log Call" in CRM inbox | **Manual** | User enters caller name, phone, notes → creates contact + Call activity |
| Email | User clicks "Log Email" in CRM inbox | **Manual** | User enters sender name, email, subject, body → creates contact + Email activity |
| Manual entry | User creates contact in CRM contacts page | **Manual** | User fills out contact form, selects source |
| Referral / Event / Other | User creates contact, selects source | **Manual** | User fills out contact form |

### Deduplication Rules

- **Website inquiries**: Dedup by `[clientId, email]` — if email already exists, update inquiry fields on existing contact instead of creating duplicate
- **Social media**: Dedup by `socialInboxConversationId` — one conversation = one CRM contact
- **Form Builder**: Dedup by `[clientId, email]` — if email already exists, update `formSubmissionId` and add activity to existing contact
- **Appointments**: Dedup by `[clientId, guestEmail]` — if email already exists, update `appointmentId` and add activity to existing contact
- **Phone calls**: Dedup by `[clientId, phone]` — if phone matches existing contact, log call as activity on existing contact
- **Email**: Dedup by `[clientId, email]` — if email matches existing contact, log email as activity on existing contact

### Social Inbox Bridge Details

The existing `/api/v1/social/inbox/sync` endpoint syncs conversations from connected social accounts. After sync completes, a **post-sync hook** iterates new conversations and:
1. Checks if a `WehowareCrmContact` with `socialInboxConversationId = conversation.id` already exists → skip if yes
2. Creates a new `WehowareCrmContact`:
   - `type = Lead`, `source = SocialMedia`, `status = New`
   - `firstName` = split `participantName` on first space
   - `avatarUrl` = `participantAvatar`
   - `socialInboxConversationId` = conversation ID
   - `socialPlatform` = `platformCode`
   - `socialProfiles` = `{ [platformCode]: { handle: participantHandle, id: participantId } }`
   - `customFields` = `{ lastMessagePreview, participantId }`
3. Creates a `WehowareCrmActivity` (type=SocialMessage, direction=Inbound) with the first message content as description
4. The existing social inbox page (`/admin/social-media/inbox`) gets a "View in CRM" link on conversations that have been bridged

### Phone Call Logging

From the Unified Inbox page, users can click "Log Call" to open a quick form:
- **Fields**: caller name, phone number, call direction (inbound/outbound), duration, notes/outcome
- **Behavior**: If phone matches existing contact → log as `Call` activity on that contact. If no match → create new contact (type=Lead, source=PhoneCall) + log Call activity.
- **Activity fields**: type=Call, direction=selected, title=`Call from/to {name}`, description=notes, durationMinutes=entered, completedAt=now

### Email Logging

From the Unified Inbox page, users can click "Log Email" to open a quick form:
- **Fields**: sender name, email address, subject, body, direction (inbound/outbound)
- **Behavior**: If email matches existing contact → log as `Email` activity on that contact. If no match → create new contact (type=Lead, source=Email) + log Email activity.
- **Activity fields**: type=Email, direction=selected, title=`Email: {subject}`, description=body, completedAt=now

---

## Bugs & Risks Identified (20 Issues — All Fixed in This Plan)

### Critical (Would Break Production)

1. **Missing `active` soft-delete field on all 7 CRM models** — Existing models like `WehowareCustomer` and `WehowareBlogCategory` all have `active Boolean @default(true)`. The original plan omitted this on every CRM model. **Fixed**: All 7 models now include `active Boolean @default(true)` + `[active]` index.

2. **Missing named relation strings on `WehowareProfile`** — Prisma requires explicit `@relation("Name")` when a model has multiple FKs to the same target. The original plan listed generic relation arrays. **Fixed**: All 16 relations on `WehowareProfile` now have named strings (e.g., `"CrmContactCreator"`, `"CrmContactOwner"`) with corresponding `@@index` + `map:` attributes.

3. **`socialInboxConversationId` was a plain VarChar with no FK relation** — The original plan stored it as a loose string field. **Fixed**: Now a proper FK with `@relation` to `WehowareSocialInboxConversation` and back-relation `crmContact WehowareCrmContact?` on the conversation model.

4. **No rate limiting on public POST `/api/v1/inquiries`** — The existing endpoint has no rate limiting. The rewritten endpoint would inherit this vulnerability. **Fixed**: POST now wrapped with `withPublic` middleware from `@/app/api/public/utils/public-middleware.js` (provides CORS + in-memory rate limiting).

5. **No DnD library installed** — `package.json` has no drag-and-drop dependency. The pipeline board requires one. **Fixed**: Phase 6 now starts with `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`.

### Significant (Would Cause Runtime Errors or Data Issues)

6. **Post-sync hook location wrong** — Original plan said modify `/api/v1/social/inbox/sync/route.js`. But cron-triggered sync bypasses the route. **Fixed**: Hook goes in `src/lib/social-inbox-sync.js` inside `syncAllInboxes()` so it fires regardless of trigger source.

7. **No cron job for social inbox sync** — No periodic sync means social DMs don't auto-bridge without manual trigger. **Fixed**: New `social_inbox_sync` cron job added to `social-media.js` + registered in cron dispatcher.

8. **Missing reverse serialization for inquiry backward compat** — GET `/api/v1/inquiries` needs to map CRM fields back to old shape (`firstName`+`lastName`→`name`, `Contacted`→`"In Progress"`, etc.). **Fixed**: Explicit reverse serialization documented in API endpoint table.

9. **Missing audit fields on `WehowareCrmPipelineStage` and `WehowareCrmContactList`** — These models lacked `createdBy`/`updatedBy`. **Fixed**: Both now have audit fields with named relations.

10. **`WehowareCrmContactListMembership` missing `client` relation** — Had `clientId` but no relation to `WehowareClient`. **Fixed**: Explicit `client` relation added.

11. **`InquiryStatus` enum mapping nuance** — The existing enum uses `In_Progress @map("In Progress")`. The Prisma enum value is `In_Progress` but the API serializes to `"In Progress"`. The CRM status mapping must handle this correctly. **Fixed**: Forward/reverse mapping explicitly documented in API section.

### Minor (Would Cause Inconsistencies)

12. **`WehowareCrmContactList` missing `createdBy`/`updatedBy`** — Inconsistent with platform convention. **Fixed**: Added with named relations `"CrmListCreator"`/`"CrmListUpdater"`.

13. **Missing `active` index on CRM models** — Queries filtering `active: true` would table-scan without an index. **Fixed**: All models now have `[active]` in their index list.

14. **`accountingCustomerId` should not be a FK** — If it were a Prisma relation, deleting a `WehowareCustomer` would cascade or block. **Fixed**: Documented as soft-link (plain VarChar ID reference, no FK relation).

15. **Social bridge error handling not specified** — If one conversation bridge fails, it could abort the entire sync. **Fixed**: Per-conversation `try/catch` with `console.error` logging — one failure doesn't block others.

### Cross-Module Integration Risks (New — From Platform Analysis)

16. **Form Builder submissions not linked to CRM** — `WehowareFormSubmission` stores guest data as JSON but has no CRM connection. For an agency, form submissions are a primary lead source. **Fixed**: New `bridgeFormSubmissionToCrm()` in `src/lib/crm-bridge.js`, called from form submission POST handler (non-blocking try-catch). New `LeadSource.FormBuilder` enum value + `formSubmissionId` soft-link field on CRM contact.

17. **Appointments not linked to CRM** — `WehowareAppointment` has `guestName`/`guestEmail`/`guestPhone` but no CRM connection. Booked appointments are warm leads. **Fixed**: New `bridgeAppointmentToCrm()` in `src/lib/crm-bridge.js`, called from appointment POST handler (non-blocking try-catch). New `LeadSource.Appointment` enum value + `appointmentId` soft-link field on CRM contact.

18. **Bridge failures must not block parent operations** — If CRM bridge fails, form submissions and appointments must still succeed. **Fixed**: All bridge calls wrapped in try-catch with `console.error` logging. Parent operation continues regardless of bridge outcome.

19. **Form submission data extraction fragility** — `submissionData` is a JSON blob with arbitrary field names. Different form templates may use different field names for name/email/phone. **Mitigated**: Bridge function checks common field name variants (`firstName`/`first_name`/`name`, `email`/`e-mail`, `phone`/`mobile`/`telephone`). Falls back to storing raw `submissionData` in activity `metadata` even if contact fields can't be extracted. Contact is still created with whatever data is available.

20. **Appointment guestName splitting** — `guestName` is a single field, CRM contact has `firstName`/`lastName`. **Fixed**: Split on first space (same pattern as inquiry migration). If no space, all goes to `firstName`, `lastName=null`.

---

## Environment Variables & Configuration

| Variable | Used By | Notes |
|---|---|---|
| `DATABASE_URL` | Prisma client | MySQL connection string — already configured in `.env` |
| `CRON_SECRET` | `/api/v1/cron/route.js` | Secures cron job dispatch — already configured |
| `NEXTAUTH_SECRET` | NextAuth v5 | JWT signing — already configured |
| No new env vars required | — | CRM module uses existing infrastructure only |
