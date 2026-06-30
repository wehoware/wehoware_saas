# SEO Agent for Blog Module — End-to-End Plan

## Executive Summary

Build an AI-powered SEO Agent integrated into the Wehoware SaaS blog module. The agent acts as a **Senior SEO Analyst** and **Senior Scriptwriter** — performing market research, keyword discovery, content planning, blog generation, SEO optimization, plagiarism checking, and content humanization. Configurable from a settings page at `/admin/blogs`.

Leverages existing multi-tenant architecture, Prisma/MySQL, cron job infrastructure, and rich blog SEO fields.

---

## 1. Current Architecture

### Blog Module
- **List/Add/Edit Pages**: `src/app/admin/blogs/` — full CRUD UI with Tiptap editor
- **Blog APIs**: `src/app/api/v1/blogs/` — list, create, update, delete, categories, FAQs, versions, duplicate
- **Public Blog**: `src/app/api/public/blogs/[slug]/` — public read, view increment, JSON-LD
- **SEO Score**: `src/lib/seoScore.js` — 0-100 score from meta tags, keywords, content length, OG tags
- **Sanitizer**: `src/lib/sanitize.js` — server-side HTML sanitization
- **Content Cron**: `src/lib/cron-jobs/content.js` — `publishScheduledBlogs`

### Blog Model SEO Fields
`metaTitle`, `metaDescription`, `metaKeywords`, `openGraphTitle/Description/Image`, `twitterTitle/Description/Image`, `canonicalUrl`, `robotsMeta`, `schemaType`, `seoScore`, `targetKeywords` (JSON), CTA fields, `tags` (JSON), `showToc`, `showAuthorBox`, `allowSocialShare`. Relations: `category`, `versions`, `relatedServices`, `faqs`.

### Client Data
`companyName`, `industry`, `domain`, `website`, `address`, `publicSlug`. Relations: `blogs`, `services`, `keywords` (`WehowareClientKeyword`).

### Settings Infrastructure
`WehowareSetting` model (key-value per client, grouped). APIs at `/api/v1/settings` and `/api/v1/seo/settings`.

### Cron Infrastructure
Registry in `src/lib/cron/jobs.js` (`JOBS` object). HMAC-verified entry at `/api/cron/[job]`. Audit via `WehowareCronJobRun`. Existing jobs: reminders, plaid sync, social media, daily reports.

### Tech Stack
Next.js 15, NextAuth v5, MySQL/Prisma, React 19, shadcn/ui, TailwindCSS, Tiptap. **No existing AI/LLM packages.**

---

## 2. New Database Models

### 2.1 WehowareSeoAgentSetting — Per-Client Config

```prisma
model WehowareSeoAgentSetting {
  id                    String   @id @default(uuid()) @db.VarChar(36)
  clientId              String   @unique @map("client_id") @db.VarChar(36)
  enabled               Boolean  @default(false)
  blogsPerMonth         Int      @default(4) @map("blogs_per_month")
  publishMode           String   @default("draft") @map("publish_mode") @db.VarChar(20) // publish | draft | schedule
  targetWordCount       Int      @default(1500) @map("target_word_count")
  language              String   @default("en") @db.VarChar(10)
  tone                  String   @default("professional") @db.VarChar(50)
  industryFocus         String?  @map("industry_focus") @db.VarChar(255)
  competitorDomains     Json?    @map("competitor_domains")
  targetAudience        String?  @map("target_audience") @db.Text
  contentCategories     Json?    @map("content_categories")
  autoGenerateFaqs      Boolean  @default(true) @map("auto_generate_faqs")
  autoLinkServices      Boolean  @default(true) @map("auto_link_services")
  humanizeContent       Boolean  @default(true) @map("humanize_content")
  plagiarismCheck       Boolean  @default(true) @map("plagiarism_check")
  improveExistingBlogs  Boolean  @default(true) @map("improve_existing_blogs")
  publishingSchedule    String   @default("weekly") @map("publishing_schedule") @db.VarChar(50)
  lastRunAt             DateTime? @map("last_run_at")
  nextRunAt             DateTime? @map("next_run_at")
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")
  client                WehowareClient @relation(fields: [clientId], references: [id], onDelete: Cascade)
  @@map("wehoware_seo_agent_settings")
}
```

### 2.2 WehowareSeoAgentRun — Execution Audit

```prisma
model WehowareSeoAgentRun {
  id            String   @id @default(uuid()) @db.VarChar(36)
  clientId      String   @map("client_id") @db.VarChar(36)
  runType       String   @db.VarChar(50) // research | generate | improve | full
  status        String   @default("pending") @db.VarChar(20) // pending, running, succeeded, failed, timeout, cancelled
  lockToken     String?  @map("lock_token") @db.VarChar(36) // concurrency control — prevents duplicate runs
  startedAt     DateTime @default(now()) @map("started_at")
  finishedAt    DateTime? @map("finished_at")
  durationMs    Int?     @map("duration_ms")
  input         Json?
  output        Json?
  errorMessage  String?  @map("error_message") @db.Text
  blogsCreated  Int      @default(0) @map("blogs_created")
  blogsImproved Int      @default(0) @map("blogs_improved")
  keywordsFound Int      @default(0) @map("keywords_found")
  tokensUsed    Int      @default(0) @map("tokens_used")
  costUsd       Decimal? @db.Decimal(10, 4) @map("cost_usd")
  retryCount    Int      @default(0) @map("retry_count")
  parentRunId   String?  @map("parent_run_id") @db.VarChar(36) // for retry runs
  createdAt     DateTime @default(now()) @map("created_at")
  @@index([clientId])
  @@index([status])
  @@index([clientId, status])
  @@index([lockToken])
  @@map("wehoware_seo_agent_runs")
}
```

### 2.3 WehowareSeoKeywordResearch — Keyword Store

```prisma
model WehowareSeoKeywordResearch {
  id              String   @id @default(uuid()) @db.VarChar(36)
  clientId        String   @map("client_id") @db.VarChar(36)
  keyword         String   @db.VarChar(255)
  searchVolume    Int?     @map("search_volume")
  difficulty      Decimal? @db.Decimal(5, 2)
  competition     String?  @db.VarChar(20) // low, medium, high
  cpc             Decimal? @db.Decimal(10, 2)
  trend           Json?
  relatedKeywords Json?    @map("related_keywords")
  serpFeatures    Json?    @map("serp_features")
  status          String   @default("new") @db.VarChar(20) // new, selected, used, archived
  priority        Int      @default(0)
  blogId          String?  @map("blog_id") @db.VarChar(36)
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  @@unique([clientId, keyword]) // prevent duplicate keywords per client
  @@index([clientId])
  @@index([clientId, status])
  @@index([keyword])
  @@index([status])
  @@index([priority])
  @@map("wehoware_seo_keyword_research")
}
```

### 2.4 WehowareSeoContentPlan — Content Calendar

```prisma
model WehowareSeoContentPlan {
  id                 String   @id @default(uuid()) @db.VarChar(36)
  clientId           String   @map("client_id") @db.VarChar(36)
  title              String   @db.VarChar(500)
  slug               String?  @db.VarChar(500)
  topic              String   @db.Text
  primaryKeyword     String   @map("primary_keyword") @db.VarChar(255)
  secondaryKeywords  Json?    @map("secondary_keywords")
  searchIntent       String?  @map("search_intent") @db.VarChar(50)
  contentType        String   @default("blog_post") @map("content_type") @db.VarChar(50)
  targetWordCount    Int      @default(1500) @map("target_word_count")
  categoryId         String?  @map("category_id") @db.VarChar(36)
  scheduledDate      DateTime? @map("scheduled_date")
  status             String   @default("planned") @db.VarChar(20) // planned, drafted, published, skipped
  blogId             String?  @map("blog_id") @db.VarChar(36)
  outline            Json?
  competitorAnalysis Json?    @map("competitor_analysis")
  similarityHash     String?  @map("similarity_hash") @db.VarChar(64) // SHA256 of normalized title for dedup
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")
  @@unique([clientId, slug])
  @@unique([clientId, similarityHash])
  @@index([clientId])
  @@index([clientId, status])
  @@index([scheduledDate])
  @@map("wehoware_seo_content_plans")
}
```

### 2.5 WehowareSeoAgentLog — Step Logs

```prisma
model WehowareSeoAgentLog {
  id           String   @id @default(uuid()) @db.VarChar(36)
  runId        String   @map("run_id") @db.VarChar(36)
  clientId     String   @map("client_id") @db.VarChar(36)
  step         String   @db.VarChar(100) // research, keyword_analysis, outline, draft, seo_optimize, humanize, plagiarism_check, finalize
  stepOrder    Int      @map("step_order")
  status       String   @default("pending") @db.VarChar(20)
  input        Json?
  output       Json?
  durationMs   Int?     @map("duration_ms")
  errorMessage String?  @map("error_message") @db.Text
  tokensUsed   Int      @default(0) @map("tokens_used")
  retryCount   Int      @default(0) @map("retry_count")
  createdAt    DateTime @default(now()) @map("created_at")
  @@index([runId])
  @@index([clientId])
  @@index([runId, step])
  @@map("wehoware_seo_agent_logs")
}
```

---

## 3. LLM Integration

### 3.1 Provider Strategy

No AI packages exist yet. Recommended: **OpenAI API** with pluggable interface.

- Add `openai` npm package
- Env vars: `OPENAI_API_KEY`, `OPENAI_MODEL` (default: `gpt-4o`)
- Architect as pluggable interface so Anthropic/Vercel AI SDK can be added later
- Use `gpt-4o-mini` for research/analysis steps, `gpt-4o` for content generation
- **Pin model version** — never use unversioned aliases (e.g., `gpt-4o-latest`); pin to specific snapshots to prevent prompt breakage on model updates
- **Token budget enforcement** — hard ceiling per run via `SEO_AGENT_MAX_TOKENS_PER_RUN`; abort run if exceeded
- **Rate limiting** — max 3 concurrent LLM calls per process; queue excess calls with 1s delay between batches
- **Circuit breaker** — if 5 consecutive LLM calls fail, trip circuit (30s cooldown); reject new calls during cooldown; auto-reset after cooldown
- **PII scrubbing** — strip email addresses, phone numbers, and addresses from client data before sending to LLM

### 3.2 AI Module Structure

```
src/lib/ai/
├── client.js              # LLM client factory (pluggable)
├── prompts/
│   ├── keyword-research.js
│   ├── topic-ideation.js
│   ├── outline-generation.js
│   ├── content-generation.js
│   ├── seo-optimization.js
│   ├── humanization.js
│   ├── plagiarism-check.js
│   ├── content-improvement.js
│   └── competitor-analysis.js
├── agents/
│   ├── seo-agent.js       # Main orchestrator
│   ├── researcher.js      # Market research + keyword discovery
│   ├── planner.js         # Content planning + calendar
│   ├── writer.js          # Blog content generation
│   ├── optimizer.js       # SEO meta optimization
│   ├── humanizer.js       # Content humanization
│   ├── plagiarism.js      # Originality checking
│   ├── dedup.js           # Topic deduplication gate
│   └── improver.js        # Existing blog improvement
└── utils/
    ├── token-counter.js
    ├── response-parser.js
    ├── retry.js
    ├── circuit-breaker.js  # Circuit breaker for LLM calls
    ├── rate-limiter.js     # Concurrency limiter for LLM calls
    ├── pii-scrubber.js     # Strip PII before sending to LLM
    ├── similarity.js       # Title/keyword similarity scoring
    └── validator.js        # LLM response validation + schema enforcement
```

---

## 4. Agent Pipeline

### 4.1 Pipeline Overview

```
1. Market Research → 2. Keyword Analysis → 3. Topic Planning
3a. Topic Deduplication Gate (NEW)
4. Content Generation → 5. SEO Optimization → 6. Humanization
7. Plagiarism Check → 8. Final Review → 9. Persist & Publish (atomic transaction)
```

### 4.2 Step Details

**Step 1 — Market Research** (`researcher.js`):
- Input: client data (PII-scrubbed), existing blogs (ALL titles + slugs, not just last 50), services, competitor domains
- Analyze industry trends, content gaps, competitor strategies
- Output: industry overview, content gaps, competitor insights, recommendations
- **Validation**: LLM response must parse as JSON with required fields; retry up to 2x on parse failure

**Step 2 — Keyword Analysis** (`researcher.js`):
- Generate seed keywords from industry + services
- Expand to long-tail, classify intent (informational/commercial/transactional)
- Estimate volume/difficulty, identify SERP features
- Store in `WehowareSeoKeywordResearch` with `@@unique([clientId, keyword])` — upsert on conflict
- **Validation**: each keyword must be non-empty string ≤255 chars; reject empty/malformed entries

**Step 3 — Topic Planning** (`planner.js`):
- Select top N keywords (N = `blogsPerMonth`) by priority + diversity — **only keywords with status = "new"**
- Generate blog titles, classify content type (how-to, listicle, guide, etc.)
- Assign categories, generate detailed outlines (H2/H3 structure)
- Schedule across month based on `publishingSchedule`
- Store in `WehowareSeoContentPlan`
- **Compute `similarityHash`** = SHA256 of normalized title (lowercase, stripped punctuation, stopwords removed)

**Step 3a — Topic Deduplication Gate** (`dedup.js`) — **NEW**:
- Fetch ALL existing blog titles + slugs from `WehowareBlog` for this client (no limit)
- Fetch ALL existing `WehowareSeoContentPlan` titles for this client
- For each planned topic:
  1. **Exact match check**: reject if `similarityHash` already exists in DB (enforced by `@@unique` constraint)
  2. **Fuzzy title match**: compute Levenshtein distance against all existing titles; reject if similarity > 80%
  3. **Keyword overlap check**: reject if `primaryKeyword` matches any existing blog's `targetKeywords` array
  4. **Content plan cross-check**: reject if a plan with same `primaryKeyword` already exists in status `planned` or `drafted`
- Rejected topics are marked `skipped` with reason; planner generates replacement topics
- **Retry**: up to 3 rounds of replacement topic generation before giving up on that slot
- **Hard gate**: if `publishMode = "publish"`, dedup is mandatory — no bypass

**Step 4 — Content Generation** (`writer.js`):
- Generate full blog from outline (intro, sections, conclusion, CTA)
- Integrate primary keyword (1-2% density) + secondary keywords
- Auto-generate FAQs (3-5 Q&As) if enabled
- Generate excerpt (155-160 chars), tags, read time
- Output as clean HTML (Tiptap/sanitize-html compatible)
- **Validation**: word count must be ≥ 50% of `targetWordCount`; if short, retry with explicit length instruction (max 2 retries)
- **Validation**: HTML must contain at least 3 `<h2>` tags matching outline structure; reject if structure mismatch
- **Slug collision**: if auto-generated slug exists in `WehowareBlog`, append `-2`, `-3`, etc.

**Step 5 — SEO Optimization** (`optimizer.js`):
- Meta title (50-60 chars), meta description (150-160 chars), meta keywords
- OpenGraph + Twitter card tags
- Canonical URL from client domain + slug
- Schema type (BlogPosting/Article/HowTo)
- Internal linking to existing blogs/services
- Compute SEO score via existing `computeSeoScore()`

**Step 6 — Humanization** (`humanizer.js`):
- Detect AI patterns (repetitive structure, overuse of "moreover/furthermore")
- Vary sentence length, add contractions, conversational elements
- Inject client-specific context (local references, company examples)
- Target Flesch reading ease 60-70
- Preserve all SEO elements (keywords, headings, structure)

**Step 7 — Plagiarism Check** (`plagiarism.js`):
- Extract key phrases, assess originality via LLM
- Check self-plagiarism against client's existing blogs (DB query — fetch all blog titles + excerpts)
- Generate originality score (0-100), flag problematic passages
- If score < 85, regenerate flagged sections (max 2 retries; then save as draft with warning)

**Step 8 — Final Review**:
- Re-compute SEO score (target >= 80) — if < 80, retry SEO optimization (max 2 retries)
- Verify word count meets target (±10%) — if short, flag for draft mode even if publishMode = "publish"
- Verify all SEO fields populated — missing fields = auto-fail
- Verify humanization + originality checks passed
- **Post-sanitization check**: run `sanitizeHtml()` then verify result is non-empty and retains ≥ 80% of original content length; if sanitization strips too much, reject and regenerate
- Generate quality report with pass/fail per check
- **Hard rule**: if ANY quality check fails and `publishMode = "publish"`, downgrade to `draft` with quality report attached

**Step 9 — Persist & Publish** (atomic transaction):
- Sanitize HTML via existing `sanitizeHtml()`
- **Wrap all DB writes in a single Prisma transaction** (`prisma.$transaction()`):
  1. Create blog record
  2. Create FAQ records (if generated)
  3. Create related service links (if auto-link enabled)
  4. Save initial version to `WehowareBlogVersion`
  5. Update content plan status → `drafted` or `published`
  6. Update keyword status → `used` + link `blogId`
  7. Update `WehowareSeoAgentRun` counters
- If transaction fails, no partial writes — entire batch rolls back
- If `publishMode` = "publish" → status "Published" + `publishedAt` set immediately
- If `publishMode` = "draft" → status "Draft" (human reviews before publishing)
- If `publishMode` = "schedule" → status "Draft" + `scheduledPublishAt` set per content plan
- **Idempotency**: check if `WehowareSeoContentPlan.blogId` is already set before creating a new blog — skip if already linked

---

## 5. Existing Blog Improvement Pipeline

Separate from new content generation, the agent can improve existing blogs:

1. **Scan**: Fetch all published/draft blogs for the client
2. **Analyze**: For each blog, compute current SEO score and identify gaps:
   - Missing meta title/description, short content, missing target keywords
   - Missing OG/Twitter tags, missing thumbnail alt text, low keyword density
   - Missing FAQ section, missing internal links
3. **Prioritize**: Sort by improvement potential (lowest SEO score first)
4. **Improve**: For each blog — regenerate/expand meta tags, expand thin content, add missing SEO fields, add FAQs, add internal links, re-humanize, re-check plagiarism
5. **Save**: Update blog via Prisma, save version to `WehowareBlogVersion`
6. **Report**: Log improvements made per blog

**Trigger**: Runs as part of scheduled cron (if `improveExistingBlogs` = true) or manually from settings page.

---

## 6. Agent Orchestration

### 6.1 Main Orchestrator (`src/lib/ai/agents/seo-agent.js`)

```javascript
export async function runSeoAgent({ clientId, runType = "full", options = {} }) {
  // 1. Load settings from WehowareSeoAgentSetting
  // 2. CONCURRENCY CONTROL: check for active run for this client
  //    - Query: WHERE clientId AND status = 'running'
  //    - If active run exists AND startedAt < 30 min ago → throw (run already in progress)
  //    - If active run exists AND startedAt > 30 min ago → mark as 'timeout', proceed
  // 3. Create WehowareSeoAgentRun record with lockToken = uuid()
  // 4. Set run timeout: AbortController with 10 min deadline (configurable via SEO_AGENT_RUN_TIMEOUT_MS)
  // 5. Execute pipeline based on runType:
  //    "research": Steps 1-2
  //    "plan": Steps 1-3a
  //    "generate": Steps 4-9
  //    "improve": Existing blog improvement
  //    "full": Steps 1-9
  // 6. Each step creates WehowareSeoAgentLog entry with tokensUsed
  // 7. On step failure: log error, mark step as 'failed', decide:
  //    - Retryable (LLM timeout, rate limit) → retry step (max 3x with backoff)
  //    - Non-retryable (validation, dedup) → skip blog, continue to next plan
  //    - Fatal (DB down, auth) → abort entire run, mark as 'failed'
  // 8. On timeout: mark run as 'timeout', save partial results
  // 9. Update run with results (blogsCreated, blogsImproved, keywordsFound, tokensUsed, costUsd)
  // 10. Update WehowareSeoAgentSetting.lastRunAt + nextRunAt
}
```

**Step-level retry with idempotency**:
- Each step checks if it already completed successfully (via `WehowareSeoAgentLog` status)
- On retry, skip already-succeeded steps; resume from failed step
- This enables safe retry of failed runs without duplicating work

### 6.2 Cron Job Integration

New cron job file: `src/lib/cron-jobs/seo-agent.js`

```javascript
export async function runSeoAgentCronDispatcher() {
  // 1. Fetch all WehowareSeoAgentSetting where enabled = true
  //    AND (nextRunAt is null OR nextRunAt <= now())
  // 2. BATCH PROCESSING: process clients in batches of 5 (configurable via SEO_AGENT_CRON_BATCH_SIZE)
  //    - Process batch sequentially, wait for each client to complete before next
  //    - This prevents overwhelming LLM API rate limits and DB connections
  // 3. For each client:
  //    - Call runSeoAgent({ clientId, runType: "full" })
  //    - Wrap in try/catch — one client failure does NOT stop others
  //    - Log errors to WehowareSeoAgentRun with status 'failed'
  // 4. Update nextRunAt based on publishingSchedule
  // 5. Return { clientsProcessed, blogsCreated, blogsImproved, errors, totalTokensUsed, totalCostUsd }
  // 6. CRON TIMEOUT: if overall cron invocation exceeds 25 min (Vercel limit),
  //    stop processing new clients; remaining clients will be picked up next invocation
}
```

Register in `src/lib/cron/jobs.js`:
```javascript
"seo-agent-dispatcher": runSeoAgentCronDispatcher,
```

**Schedule**: Daily at 6 AM UTC via EventBridge/Vercel Cron: `POST /api/cron/seo-agent-dispatcher`

**Stale run cleanup**: cron dispatcher also cleans up runs stuck in `running` status for > 30 min — marks them as `timeout` so next run can proceed.

---

## 7. Settings Page — `/admin/blogs` Enhancement

### 7.1 Approach

Add a **"SEO Agent" tab** to the existing `/admin/blogs/page.js`. The blog list remains the default tab; "SEO Agent" is the second tab. This keeps everything at `/admin/blogs` as requested.

### 7.2 UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Blog Management                                            │
│  [ All Blogs ]  [ Categories ]  [ SEO Agent Settings ]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ Agent Status ──────────────────────────────────────┐   │
│  │  ● Active / ○ Inactive        [ Toggle Switch ]     │   │
│  │  Last Run: 2025-01-10 14:30   Next Run: 2025-01-15  │   │
│  │  Blogs This Month: 3/4                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ Content Settings ──────────────────────────────────┐   │
│  │  Blogs per month:    [ 4 ▾ ]                        │   │
│  │  Publishing schedule: [ Weekly ▾ ]                  │   │
│  │  Target word count:   [ 1500 ]                      │   │
│  │  Language:            [ English ▾ ]                 │   │
│  │  Tone:                [ Professional ▾ ]            │   │
│  │  After generation:    [ Save as Draft ▾ ]            │   │
│  │    Options: Publish Immediately / Save as Draft /    │   │
│  │            Schedule for Review                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ Agent Capabilities ────────────────────────────────┐   │
│  │  ☑ Market research                                  │   │
│  │  ☑ Keyword analysis                                 │   │
│  │  ☑ Topic research & planning                        │   │
│  │  ☑ Auto-generate FAQs                               │   │
│  │  ☑ Auto-link services                               │   │
│  │  ☑ Humanize content                                 │   │
│  │  ☑ Plagiarism check                                 │   │
│  │  ☑ Improve existing blogs                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ Targeting ─────────────────────────────────────────┐   │
│  │  Industry focus:    [ Healthcare ]                  │   │
│  │  Target audience:   [ Patients seeking care... ]    │   │
│  │  Competitor domains: [ competitor1.com ] [ × ]      │   │
│  │  Content categories: ☑ Implants  ☑ Cosmetic         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ Actions ───────────────────────────────────────────┐   │
│  │  [ Run Agent Now ]  [ View Run History ]  [ Save ]  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ Recent Agent Activity ─────────────────────────────┐   │
│  │  Date       │ Type      │ Status    │ Blogs │ KW    │   │
│  │  2025-01-10 │ Full run  │ Succeeded │ 2     │ 15    │   │
│  │  2025-01-05 │ Improve   │ Succeeded │ 5     │ -     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ Content Plan (This Month) ─────────────────────────┐   │
│  │  Date       │ Title                      │ Status    │   │
│  │  2025-01-15 │ Implants Cost Guide         │ Drafted   │   │
│  │  2025-01-22 │ Whitening Options           │ Planned   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 New Components

```
src/components/seo-agent/
├── SeoAgentSettings.jsx       # Main settings panel
├── SeoAgentStatus.jsx         # Status card (active/inactive, last/next run)
├── SeoAgentCapabilities.jsx   # Capability checkboxes
├── SeoAgentTargeting.jsx      # Industry, audience, competitors, categories
├── SeoAgentRunHistory.jsx     # Table of past agent runs
├── SeoAgentContentPlan.jsx    # Content calendar for current month
├── SeoAgentKeywordResults.jsx # Keyword research results viewer
└── SeoAgentLogViewer.jsx      # Detailed step-by-step log for a run
```

### 7.4 New API Routes

```
src/app/api/v1/seo-agent/
├── settings/route.js          # GET/PUT agent settings
├── run/route.js               # POST — trigger agent run
├── runs/route.js              # GET — list agent runs
├── runs/[id]/route.js         # GET — single run details
├── runs/[id]/logs/route.js    # GET — step logs for a run
├── keywords/route.js          # GET — keyword research results
├── content-plans/route.js     # GET — content plans
├── content-plans/[id]/route.js # GET/PUT — approve/skip plan
└── status/route.js            # GET — current agent status + stats
```

---

## 8. Complete Feature List

### 8.1 Core Agent Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | Market Research | Analyzes client's industry, competitors, and market trends |
| 2 | Keyword Discovery | Generates seed keywords, expands to long-tail, classifies intent |
| 3 | Keyword Prioritization | Scores keywords by opportunity (volume vs difficulty vs relevance) |
| 4 | Topic Ideation | Generates blog topic ideas from top keywords with diversity |
| 5 | Content Calendar | Plans publication schedule across the month |
| 6 | Outline Generation | Creates detailed blog outlines with H2/H3 structure |
| 7 | Blog Content Generation | Writes full blog posts (1500-3000 words) with proper HTML |
| 8 | FAQ Auto-Generation | Generates 3-5 relevant FAQs per blog post |
| 9 | CTA Generation | Creates call-to-action sections tied to client services |
| 10 | Meta Tag Optimization | Generates optimal meta title, description, keywords |
| 11 | OpenGraph Optimization | Generates OG title, description, image suggestions |
| 12 | Twitter Card Optimization | Generates Twitter-specific card metadata |
| 13 | Schema Markup | Sets appropriate schema type (BlogPosting, Article, HowTo, FAQ) |
| 14 | Canonical URL | Auto-generates canonical URLs from client domain + slug |
| 15 | Internal Linking | Suggests and inserts links to existing blogs and services |
| 16 | Target Keywords Assignment | Assigns primary + secondary keywords to targetKeywords field |
| 17 | SEO Score Computation | Uses existing computeSeoScore() (target: >=80) |
| 18 | Content Humanization | Rewrites AI content to sound natural, varying structure |
| 19 | Plagiarism Check | Checks content originality against web patterns + existing blogs |
| 20 | Self-Plagiarism Prevention | Compares new content against client's existing blogs |
| 21 | Readability Optimization | Ensures Flesch reading ease score of 60-70 |
| 22 | Tag Generation | Auto-generates relevant tags for each blog post |
| 23 | Category Assignment | Assigns blogs to existing categories or suggests new ones |
| 24 | Excerpt Generation | Creates compelling 155-160 char excerpts |
| 25 | Read Time Calculation | Computes estimated read time from word count |
| 26 | Thumbnail Alt Text | Generates descriptive alt text for thumbnails |
| 27 | Content Versioning | Saves generated content as a version in WehowareBlogVersion |
| 28 | Publish Mode | Choose: publish immediately, save as draft for review, or schedule for later |
| 29 | Scheduled Publishing | Integrates with existing publishScheduledBlogs cron |

### 8.2 Existing Blog Improvement

| # | Feature | Description |
|---|---------|-------------|
| 30 | Blog SEO Audit | Scans all existing blogs and identifies SEO weaknesses |
| 31 | Meta Tag Improvement | Regenerates missing/short meta titles and descriptions |
| 32 | Content Expansion | Expands thin content (<1000 words) with relevant info |
| 33 | Keyword Gap Filling | Adds missing target keywords to existing blogs |
| 34 | FAQ Addition | Adds FAQ sections to blogs that don't have them |
| 35 | Internal Link Repair | Adds missing internal links to services and related blogs |
| 36 | OG/Twitter Tag Completion | Fills in missing social media meta tags |
| 37 | Alt Text Generation | Generates missing thumbnail alt text |
| 38 | Content Refresh | Updates outdated content with current information |
| 39 | SEO Score Improvement | Targets improving all blogs to SEO score >=80 |

### 8.3 Analytics & Reporting

| # | Feature | Description |
|---|---------|-------------|
| 40 | Agent Run History | Complete audit log of every agent execution |
| 41 | Step-by-Step Logs | Detailed logs for each pipeline step |
| 42 | Content Plan Dashboard | Visual calendar of planned/drafted/published blogs |
| 43 | Keyword Research Viewer | Browse discovered keywords with metrics |
| 44 | Performance Metrics | Track blogs created, improved, keywords found per run |
| 45 | Cost Tracking | Track LLM token usage per run |
| 46 | Error Recovery | Failed steps can be retried without re-running pipeline |

### 8.4 Configuration & Control

| # | Feature | Description |
|---|---------|-------------|
| 47 | On/Off Toggle | Enable/disable the agent per client |
| 48 | Blogs Per Month | Control content volume (1-30) |
| 49 | Publish Mode | Three options: Publish Immediately, Save as Draft, or Schedule for Review |
| 50 | Publishing Schedule | Daily, weekly, biweekly, monthly |
| 51 | Language Selection | Generate content in different languages |
| 52 | Tone Selection | Professional, casual, conversational, technical |
| 53 | Target Word Count | Configure desired content length |
| 54 | Industry Focus | Specify industry for targeted research |
| 55 | Target Audience | Define audience for content tailoring |
| 56 | Competitor Domains | Add competitor URLs for analysis |
| 57 | Content Categories | Select which categories agent focuses on |
| 58 | Capability Toggles | Enable/disable individual features |
| 59 | Manual Trigger | "Run Agent Now" button for immediate execution |
| 60 | Content Plan Approval | Review and approve/reject planned topics |
| 61 | Topic Deduplication | Prevents duplicate topics via hash + fuzzy match + keyword overlap |
| 62 | Cost Tracking per Run | Token usage and USD cost tracked per run and per step |
| 63 | Circuit Breaker | Auto-trips on repeated LLM failures; cooldown period |
| 64 | Concurrency Control | Prevents duplicate runs for same client via lock tokens |
| 65 | Stale Run Cleanup | Auto-marks runs stuck > 30 min as timeout |
| 66 | Data Retention | Auto-purge logs after 90 days, keywords after 365 days |
| 67 | PII Scrubbing | Strips PII from client data before sending to LLM |

---

## 9. Implementation Phases

### Phase 1 — Foundation (Week 1-2)
1. Database: Add 5 new Prisma models, create migration
2. LLM Client: `src/lib/ai/client.js` with OpenAI integration
3. Agent Settings API: `src/app/api/v1/seo-agent/settings/route.js`
4. Settings UI: Add "SEO Agent" tab to `/admin/blogs` page
5. Agent Status API + basic orchestrator skeleton

### Phase 2 — Research & Planning (Week 2-3)
6. Market Research Agent: `src/lib/ai/agents/researcher.js`
7. Keyword Research Agent: keyword discovery, intent, prioritization
8. Content Planner Agent: `src/lib/ai/agents/planner.js`
9. Keyword + Content Plan APIs
10. UI: Keyword results viewer + content plan dashboard

### Phase 3 — Content Generation (Week 3-4)
11. Content Writer Agent: `src/lib/ai/agents/writer.js`
12. SEO Optimizer Agent: `src/lib/ai/agents/optimizer.js`
13. Content Humanizer Agent: `src/lib/ai/agents/humanizer.js`
14. Plagiarism Checker Agent: `src/lib/ai/agents/plagiarism.js`
15. Run Agent API + integration with blog creation flow

### Phase 4 — Improvement & Cron (Week 4-5)
16. Blog Improver Agent: `src/lib/ai/agents/improver.js`
17. Cron Job: `src/lib/cron-jobs/seo-agent.js` + register in JOBS
18. Run History API + UI components
19. Log viewer + content plan approval UI

### Phase 5 — Polish (Week 5-6)
20. Prompt engineering refinement
21. Error handling, retry logic, partial failure recovery
22. Cost monitoring, token budget limits
23. Quality gates enforcement
24. Unit + integration tests
25. Documentation

---

## 10. New Files Summary

```
src/lib/ai/
├── client.js
├── prompts/ (9 prompt files)
├── agents/ (9 agent files — includes dedup.js)
└── utils/ (8 util files — includes circuit-breaker, rate-limiter, pii-scrubber, similarity, validator)

src/lib/cron-jobs/seo-agent.js

src/app/api/v1/seo-agent/
├── settings/route.js
├── run/route.js
├── runs/route.js
├── runs/[id]/route.js
├── runs/[id]/logs/route.js
├── keywords/route.js
├── content-plans/route.js
├── content-plans/[id]/route.js
└── status/route.js

src/components/seo-agent/ (8 component files)

src/app/admin/blogs/page.js (modified — add SEO Agent tab)

prisma/migrations/010_seo_agent_models.sql

tests/seo-agent/ (11 test files)
```

---

## 11. Environment Variables

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
OPENAI_MAX_TOKENS=4096
OPENAI_TEMPERATURE=0.7
SEO_AGENT_DEFAULT_BLOGS_PER_MONTH=4
SEO_AGENT_MIN_SEO_SCORE=80
SEO_AGENT_MIN_ORIGINALITY_SCORE=85
SEO_AGENT_MAX_TOKENS_PER_RUN=100000
SEO_AGENT_RUN_TIMEOUT_MS=600000
SEO_AGENT_CRON_BATCH_SIZE=5
SEO_AGENT_MAX_CONCURRENT_LLM_CALLS=3
SEO_AGENT_CIRCUIT_BREAKER_THRESHOLD=5
SEO_AGENT_CIRCUIT_BREAKER_COOLDOWN_MS=30000
SEO_AGENT_DEDUP_SIMILARITY_THRESHOLD=0.8
SEO_AGENT_MAX_STEP_RETRIES=3
SEO_AGENT_MAX_CONTENT_RETRIES=2
SEO_AGENT_STALE_RUN_TIMEOUT_MS=1800000
SEO_AGENT_LOG_RETENTION_DAYS=90
SEO_AGENT_KEYWORD_RETENTION_DAYS=365
```

---

## 12. Security & Access Control

- **API routes**: Protected via existing `withAuth` middleware
- **Settings**: `allowedRoles: ["client", "employee", "admin"]`
- **Run trigger**: `allowedRoles: ["employee", "admin"]` — rate limited to 1 trigger per client per 5 min
- **Cron endpoint**: HMAC-verified via `verifyCronRequest()`
- **Client scoping**: Every query filters by `clientId` from auth context — no cross-client data leakage
- **Content safety**: All HTML passes through `sanitizeHtml()` before DB storage
- **Quality gates**: Minimum SEO score + originality score before auto-publish; failed checks downgrade to draft
- **PII scrubbing**: Client data sent to LLM is scrubbed of email addresses, phone numbers, physical addresses
- **Prompt injection protection**: Client-supplied data (competitor domains, target audience, industry focus) is sanitized and wrapped in XML delimiters in prompts; LLM system instructions explicitly state to ignore embedded instructions
- **Data retention**: Agent logs auto-purged after 90 days; keyword research after 365 days (configurable via env)

---

## 13. Cost Estimates (per blog, GPT-4o)

| Step | Est. Tokens | Cost |
|------|------------|------|
| Market Research | ~5K | $0.06 |
| Keyword Research | ~3.5K | $0.04 |
| Outline Generation | ~2.5K | $0.03 |
| Content Generation | ~5K | $0.07 |
| SEO Optimization | ~3K | $0.03 |
| Humanization | ~6K | $0.07 |
| Plagiarism Check | ~2.5K | $0.02 |
| **Total per blog** | **~25K** | **~$0.32** |

4 blogs/month = ~$1.28/client. Using gpt-4o-mini reduces ~10x.

---

## 14. Testing Strategy

```
tests/seo-agent/
├── lib-ai-client.test.mjs
├── lib-ai-researcher.test.mjs
├── lib-ai-planner.test.mjs
├── lib-ai-writer.test.mjs
├── lib-ai-optimizer.test.mjs
├── lib-ai-humanizer.test.mjs
├── lib-ai-plagiarism.test.mjs
├── lib-ai-improver.test.mjs
├── lib-ai-dedup.test.mjs
├── lib-ai-validator.test.mjs
├── lib-ai-circuit-breaker.test.mjs
├── lib-ai-similarity.test.mjs
├── lib-ai-pii-scrubber.test.mjs
├── api-seo-agent-settings.test.mjs
├── api-seo-agent-run.test.mjs
└── cron-seo-agent.test.mjs
```

Mock LLM responses with predefined JSON fixtures. Mock Prisma with existing `tests/mocks/prisma.mjs`.

**Critical test scenarios**:
- Concurrent run for same client → second run rejected
- Retry after mid-pipeline failure → no duplicate blogs created
- Dedup gate rejects similar title → replacement topic generated
- LLM returns malformed JSON → validator catches, retries
- LLM returns 200-word content → word count validation triggers retry
- Sanitization strips content to empty → post-sanitization check catches
- Circuit breaker trips after 5 failures → subsequent calls rejected during cooldown
- Cron processes 50 clients → batch processing, no timeout
- Slug collision → auto-suffix applied
- Transaction rollback on FAQ creation failure → no orphan blog record

---

## 15. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| LLM API downtime | Circuit breaker (5 failures → 30s cooldown); retry with exponential backoff; queue runs |
| Hallucinated content | Plagiarism check + humanization + quality gate; failed checks downgrade to draft |
| Low SEO score | Auto-retry SEO optimization (max 2 retries); downgrade to draft if still < 80 |
| High token costs | Hard token budget per run; per-run cost tracking; use gpt-4o-mini for research steps |
| Duplicate topics | Step 3a dedup gate: exact hash match + fuzzy Levenshtein + keyword overlap check |
| Duplicate blogs on retry | Idempotency: check content plan blogId before creating; step-level resume skips completed steps |
| Concurrent runs same client | lockToken + active run check; stale run cleanup after 30 min |
| Partial DB writes | All blog creation wrapped in `prisma.$transaction()` — atomic rollback on failure |
| LLM returns malformed JSON | Response validator with schema enforcement; retry up to 2x on parse failure |
| LLM returns short content | Word count validation (≥ 50% of target); retry with explicit length instruction |
| Sanitization strips content | Post-sanitization check: verify ≥ 80% content retained; regenerate if stripped |
| Slug collision | Auto-append `-2`, `-3` suffix on collision with existing blog slugs |
| Cron timeout (Vercel 30s/Next.js) | Batch processing (5 clients); stop at 25 min; remaining clients picked up next run |
| Stuck runs | Stale run cleanup: runs > 30 min auto-marked as `timeout` |
| Rate limit from OpenAI | Max 3 concurrent LLM calls; 1s delay between batches |
| AI-detected content | Humanization step with pattern detection + readability scoring |
| Prompt injection | Client data wrapped in XML delimiters; system instructions to ignore embedded commands |
| PII exposure to LLM | PII scrubber strips emails, phones, addresses before sending to OpenAI |
| Model version drift | Pin to specific model snapshots; never use unversioned aliases |
| Data growth | Auto-purge logs after 90 days; keyword research after 365 days |
| One client failure stops all | Per-client try/catch in cron dispatcher; errors logged, others continue |

---

## 16. Production Readiness Review

Review performed as: Senior Software Engineer (20+ yrs), Solution Architect (20+ yrs), Production Readiness Reviewer (zero tolerance).

### 16.1 Issues Found & Resolved in This Revision

| # | Category | Issue | Resolution Applied |
|---|----------|-------|-------------------|
| 1 | Concurrency | No prevention of duplicate runs for same client | `lockToken` + active run check in orchestrator |
| 2 | Idempotency | Retry after failure creates duplicate blogs | Step-level resume via `WehowareSeoAgentLog` status; `blogId` check before creation |
| 3 | Topic dedup | No dedup gate — same topic could recur after months | Step 3a: `dedup.js` with hash + fuzzy match + keyword overlap |
| 4 | LLM validation | No validation of LLM response structure | `validator.js` with schema enforcement; retry on parse failure |
| 5 | DB transactions | Blog + FAQ + links written separately — partial writes possible | All writes in `prisma.$transaction()` |
| 6 | Run timeout | Stuck runs hold resources forever | `AbortController` with 10 min deadline; stale run cleanup at 30 min |
| 7 | Circuit breaker | LLM failures cascade without protection | `circuit-breaker.js`: 5 failures → 30s cooldown |
| 8 | Slug collision | Auto-generated slugs could collide | Auto-append `-2`, `-3` suffix |
| 9 | Post-sanitization | `sanitizeHtml` could strip content to empty | Post-sanitization check: ≥ 80% content retained |
| 10 | Prompt injection | Client data in prompts could contain malicious instructions | XML delimiters + system instructions to ignore embedded commands |
| 11 | PII exposure | Client data sent to LLM may contain PII | `pii-scrubber.js` strips emails, phones, addresses |
| 12 | Model drift | OpenAI model updates could break prompts | Pin to specific model snapshots |
| 13 | Cron timeout | Processing all clients in one invocation exceeds Vercel limit | Batch processing (5 clients); stop at 25 min |
| 14 | Rate limiting | No LLM call concurrency control | `rate-limiter.js`: max 3 concurrent calls |
| 15 | Cost control | No per-run cost enforcement | Hard token budget + per-run cost tracking in `WehowareSeoAgentRun` |
| 16 | Data retention | Logs and keywords grow indefinitely | Auto-purge: logs 90 days, keywords 365 days |
| 17 | Quality gate bypass | Failed content could auto-publish | Hard rule: any failed check → downgrade to draft |
| 18 | Error isolation | One client failure stops entire cron | Per-client try/catch in dispatcher |
| 19 | Keyword dedup | Same keyword stored multiple times | `@@unique([clientId, keyword])` constraint |
| 20 | Content plan dedup | Same plan created twice | `@@unique([clientId, slug])` + `@@unique([clientId, similarityHash])` |
| 21 | Word count validation | LLM could generate 200 words instead of 1500 | Validation: ≥ 50% of target; retry with explicit length instruction |
| 22 | HTML structure | LLM output may not match outline | Validation: ≥ 3 `<h2>` tags matching outline |
| 23 | API rate limiting | Run trigger could be spammed | Rate limited to 1 trigger per client per 5 min |
| 24 | DB indexes | Missing composite indexes for common queries | Added `[clientId, status]`, `[runId, step]`, `[clientId, status]` on keyword research |
| 25 | Partial failure info | No visibility into which step failed | `WehowareSeoAgentLog` with per-step status, tokens, retries, errors |
| 26 | Cost visibility | No per-step cost tracking | `tokensUsed` + `costUsd` on both run and log records |
| 27 | Keyword rotation | Used keywords could be reselected | Only select keywords with `status = "new"`; mark as `used` after blog creation |

### 16.2 Remaining Considerations (Post-Launch)

- **Webhook notifications**: notify client admins when agent completes a run (email or in-app)
- **A/B testing**: test different prompt variations for content quality
- **Human approval workflow**: require manual approval before any blog is published (even if `publishMode = "publish"`)
- **External plagiarism API**: integrate Copyscape/Originality.ai for web-scale plagiarism detection
- **Google Search Console integration**: use real query data for keyword research instead of LLM estimates
- **Multi-language support**: extend beyond English with localized prompts
- **Cost ceiling per client**: hard monthly cost limit per client (not just per run)
- **Observability dashboard**: Grafana/Datadog panel for agent health, cost, and output quality
