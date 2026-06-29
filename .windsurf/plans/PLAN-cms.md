# Content Management System — Plan

Scope: Content Calendar, Social Media Manager, Employee Work Tracking, Target/KPI Management.

---

## 1. Existing System (Reuse)

| Existing | Reuse For |
|----------|-----------|
| `WehowareTask` + comments/activities | Work item tracking, time-entry linking |
| `WehowareAppointment` + calendar UI | Reuse calendar component for editorial calendar |
| `WehowareBlog` | Link to content pipeline |
| `WehowareReport` | Add social-analytics + KPI report templates |
| `WehowareIntegration` | Add Social Platform providers |

---

## 2. New Database Models (Prisma)

### Content Calendar
- `WehowareContentEvent` — editorial events (blog, social campaign, service launch, task milestone, meeting). Fields: `eventType`, `status` (Planned/In Progress/Ready/Published/Cancelled), `startDate`, `endDate`, `linkedType`, `linkedId`, `assigneeId`.

### Social Media Manager
- `WehowareSocialAccount` — connected platform accounts (Facebook, Instagram, LinkedIn, Twitter, TikTok, YouTube). OAuth tokens, active flag.
- `WehowareSocialPost` — post queue. Fields: `content`, `mediaUrls` (JSON), `hashtags`, `scheduledAt`, `publishedAt`, `status` (Draft/Scheduled/Publishing/Published/Failed), `platformPostId`, cached analytics (`impressions`, `engagements`, `likes`, `comments`, `shares`).

### Work Tracking
- `WehowareTimeEntry` — employee time logs. Fields: `startTime`, `endTime`, `durationMinutes`, `entryType` (General/TaskWork/Meeting/ContentCreation/SocialMedia/ClientCall/Research/BugFix), `taskId`, `projectName`, `billable`, `hourlyRate`, `status` (Logged/Submitted/Approved/Rejected), `approvedBy`.
- `WehowareWorkSession` — live timer sessions. `startedAt`, `endedAt`, `totalSeconds`, `isActive`, `currentTaskId`, `idleSeconds`.

### Target & Goals (KPI/OKR)
- `WehowareGoal` — goal definitions. Fields: `ownerType` (Employee/Team/Department/Client/Company), `ownerId`, `goalType` (KPI/OKR_Objective/OKR_KeyResult/Milestone/Target), `targetValue`, `currentValue`, `unit`, `startDate`, `endDate`, `status`, `priority`, `parentGoalId` (for OKR hierarchy).
- `WehowareGoalProgress` — progress update audit trail. `oldValue`, `newValue`, `note`, `loggedAt`.

---

## 3. API Endpoints

### Calendar (`/api/v1/calendar/*`)
- `GET /events` — date-range + type + assignee filters
- `POST /events` — create
- `GET|PUT|DELETE /events/:id`
- `GET /overview` — dashboard stats

### Social (`/api/v1/social/*`)
- `GET /accounts` — list connected
- `POST /accounts` — connect (OAuth init)
- `DELETE /accounts/:id`
- `GET /posts` — filter by status/account/date
- `POST /posts` — create/schedule
- `PUT|DELETE /posts/:id`
- `POST /posts/:id/publish` — force publish
- `GET /posts/:id/analytics`
- `GET /dashboard` — aggregated stats
- `POST /webhook/:platform` — platform webhooks

### Work (`/api/v1/work/*`)
- `GET /time-entries` — list (self for employees, all for admin)
- `POST /time-entries` — log entry
- `PUT|DELETE /time-entries/:id`
- `POST /time-entries/:id/submit|approve|reject`
- `GET /sessions` — active sessions
- `POST /sessions/start` — start timer
- `POST /sessions/:id/stop` — stop timer
- `GET /dashboard` — weekly summary, charts
- `GET /team` — team overview (admin only)

### Goals (`/api/v1/goals/*`)
- `GET|POST /goals`
- `GET|PUT|DELETE /goals/:id`
- `POST /goals/:id/progress` — log progress update
- `GET /goals/:id/progress` — history
- `GET /dashboard` — my goals + team goals view

---

## 4. Admin UI Pages

### Content Calendar (`/admin/calendar`)
- **Month/Week/Day views** (reuse appointment calendar component)
- Drag-to-reschedule events
- Color-coded by `eventType`
- Filter by assignee, type, status
- Quick-add event modal
- Link to existing blog/service/task/social post

### Social Media Manager (`/admin/social`)
- **Dashboard tab**: Upcoming posts queue, engagement summary, platform breakdown
- **Calendar tab**: Visual content calendar with post cards
- **Posts tab**: List with status badges, edit inline, reschedule
- **Accounts tab**: Connect/disconnect platforms, token health
- **Analytics tab**: Per-post and aggregate engagement charts
- **Composer**: WYSIWYG post editor, media upload, hashtag suggestions, platform preview, schedule picker

### Work Tracking (`/admin/work`)
- **My Time tab**: Daily/weekly time sheet, start/stop timer, manual entry
- **Dashboard tab**: Hours by project/type, weekly trend chart, billable vs non-billable
- **Team tab** (admin/manager): Employee time summaries, approval queue
- **Reports tab**: Exportable time reports by date range, user, project

### Goals & Targets (`/admin/goals`)
- **My Goals tab**: Progress bars, update values, child goal tree (OKRs)
- **Team Goals tab** (admin/manager): All employee goals, filter by status/overdue
- **Create Goal**: Wizard — type, owner, target, dates, linked tasks/projects
- **Dashboard**: Company KPI cards, trend sparklines, heatmap of goal completion

---

## 5. Key Features by Role

| Feature | Admin | Manager | Employee | Client |
|---------|-------|---------|----------|--------|
| Content Calendar — full CRUD | ✅ | ✅ (own client) | ✅ (own) | ✅ view only |
| Social — connect accounts | ✅ | ❌ | ❌ | ❌ |
| Social — create posts | ✅ | ✅ | ✅ | ❌ |
| Social — view analytics | ✅ | ✅ | ✅ | ❌ |
| Work Timer — self log | ✅ | ✅ | ✅ | ❌ |
| Work — view team | ✅ | ✅ | ❌ | ❌ |
| Work — approve entries | ✅ | ✅ | ❌ | ❌ |
| Goals — create & assign | ✅ | ✅ | ❌ | ❌ |
| Goals — update progress | ✅ | ✅ | ✅ own | ❌ |
| Goals — view team KPIs | ✅ | ✅ | limited | ❌ |

---

## 6. Integration & Automation

- **Cron jobs** (via existing cron infra):
  - Publish scheduled social posts at `scheduledAt`
  - Sync social analytics daily (`impressions`, `engagements`, etc.)
  - Goal deadline reminders (24h, 72h before)
  - Weekly work-summary email to managers
- **Webhooks**: Platform publish confirmations, engagement events
- **Reports**: Pre-built templates for "Social Media Performance", "Employee Time Summary", "Goal Achievement"

---

## 7. Implementation Order

1. **Phase 1 — Schema & Calendar**: Add Prisma models, migrations, `/admin/calendar` with event CRUD
2. **Phase 2 — Work Tracking**: Time entries, timer, `/admin/work` pages, dashboard charts
3. **Phase 3 — Goals**: Goal CRUD, progress logging, `/admin/goals`, OKR tree view
4. **Phase 4 — Social**: Social accounts model, UI shell, post composer, queue
5. **Phase 5 — Platform Connectors**: OAuth for Facebook/Instagram (Meta), LinkedIn, Twitter/X. Add cron publish + analytics sync
6. **Phase 6 — Polish**: Reports, notifications, mobile-responsive timer, keyboard shortcuts

---

## 8. New Enums to Add

```prisma
enum ContentEventType { BlogPost, ServiceLaunch, SocialMediaCampaign, EmailCampaign, TaskMilestone, Meeting, Holiday, Other }
enum ContentEventStatus { Planned, In_Progress, Ready, Published, Cancelled }
enum SocialPlatform { Facebook, Instagram, Twitter, LinkedIn, TikTok, YouTube, Pinterest, Threads }
enum SocialPostStatus { Draft, Scheduled, Publishing, Published, Failed }
enum TimeEntryType { General, TaskWork, Meeting, ContentCreation, SocialMedia, ClientCall, Research, BugFix, Other }
enum TimeEntryStatus { Logged, Submitted, Approved, Rejected }
enum GoalOwnerType { Employee, Team, Department, Client, Company }
enum GoalType { KPI, OKR_Objective, OKR_KeyResult, Milestone, Target }
enum GoalStatus { Draft, Active, Paused, Achieved, Missed, Cancelled }
enum GoalPriority { Low, Medium, High, Critical }
```

---

## 9. Files to Create / Modify

### Schema
- `prisma/schema.prisma` — add 5 models + 8 enums + relation fields to `WehowareClient`
- `prisma/migrations/` — new migration

### API Routes
- `src/app/api/v1/calendar/events/route.js` (GET/POST)
- `src/app/api/v1/calendar/events/[id]/route.js` (GET/PUT/DELETE)
- `src/app/api/v1/calendar/overview/route.js`
- `src/app/api/v1/social/accounts/route.js`
- `src/app/api/v1/social/accounts/[id]/route.js`
- `src/app/api/v1/social/posts/route.js`
- `src/app/api/v1/social/posts/[id]/route.js`
- `src/app/api/v1/social/posts/[id]/publish/route.js`
- `src/app/api/v1/social/dashboard/route.js`
- `src/app/api/v1/social/webhook/[platform]/route.js`
- `src/app/api/v1/work/time-entries/route.js`
- `src/app/api/v1/work/time-entries/[id]/route.js`
- `src/app/api/v1/work/time-entries/[id]/submit/route.js`
- `src/app/api/v1/work/time-entries/[id]/approve/route.js`
- `src/app/api/v1/work/sessions/route.js`
- `src/app/api/v1/work/sessions/[id]/stop/route.js`
- `src/app/api/v1/work/dashboard/route.js`
- `src/app/api/v1/work/team/route.js`
- `src/app/api/v1/goals/route.js`
- `src/app/api/v1/goals/[id]/route.js`
- `src/app/api/v1/goals/[id]/progress/route.js`
- `src/app/api/v1/goals/dashboard/route.js`

### Admin Pages
- `src/app/admin/calendar/page.js`
- `src/app/admin/social/page.js`
- `src/app/admin/work/page.js`
- `src/app/admin/goals/page.js`

### Components (new directories)
- `src/components/calendar/` — CalendarView, EventCard, EventModal, FilterBar
- `src/components/social/` — PostComposer, PostQueue, AccountCard, AnalyticsChart, PlatformPreview
- `src/components/work/` — TimerWidget, TimeSheet, ApprovalQueue, WeeklyChart
- `src/components/goals/` — GoalCard, OKRTree, ProgressBar, GoalWizard, DashboardCards

### Shared Modifications
- `src/components/AdminLayout.js` — add 4 new sidebar entries (Calendar, Social, Work, Goals) with role filtering
- `src/app/admin/page.js` — add CMS widget cards to dashboard

---

Plan complete. Ready to implement by phase.
