# SEO Analyser Agent — End-to-End Plan

AI-powered SEO analysis agent that scans all client content (blogs, services, inventory items) on a configurable schedule, performing on-page SEO, keyword, schema, internal linking, content structure, AEO, GEO, and SXO analysis — generating audit reports and suggested fixes that flow into an approval queue, with results displayed via accordions in each content list page.

---

## 1. Current Architecture (Verified)

### Content Types with SEO Fields

| Model | File | SEO Fields | Has `seoScore` | Has `content` |
|-------|------|------------|-----------------|---------------|
| `WehowareBlog` | `prisma/schema.prisma:188-248` | metaTitle, metaDescription, metaKeywords, OG, Twitter, canonicalUrl, robotsMeta, schemaType, targetKeywords, tags, CTA | ✅ | ✅ (LongText) |
| `WehowareService` | `prisma/schema.prisma:273-334` | Same as Blog + `showToc`, `showAuthorBox` | ✅ | ✅ (LongText) |
| `WehowareInventoryItem` | `prisma/schema.prisma:2073-2137` | Same as Blog | ✅ | ✅ (LongText) |
| `WehowareStaticPage` | `prisma/schema.prisma:363-384` | metaTitle, metaDescription, metaKeywords, OG | ❌ | ✅ (LongText) |

### Existing SEO Infrastructure
- **SEO Score Utility**: `src/lib/seoScore.js` — `computeSeoScore()` returns 0-100 based on meta tags, keywords, thumbnail, OG, slug, content length
- **SEO Admin Page**: `src/app/admin/seo/page.js` — tabs: Global Settings, Static Pages, Sitemap Config, Keywords
- **SEO APIs**: `/api/v1/seo/settings`, `/api/v1/seo/keywords`, `/api/v1/seo/static-pages`
- **Keyword Manager**: `src/components/seo/KeywordManager.jsx` — sections-based keyword management
- **Settings Model**: `WehowareSetting` (key-value per client, grouped) — `prisma/schema.prisma:386-400`
- **Client Keyword Model**: `WehowareClientKeyword` — stores keyword sections per client+employee

### Cron Infrastructure
- **Registry**: `src/lib/cron/jobs.js` — `JOBS` object, `runJob()` function, HMAC auth at `/api/cron/[job]`
- **Content Cron**: `src/lib/cron-jobs/content.js` — `publishScheduledBlogs` (separate route at `/api/v1/cron/content`)
- **Audit**: `WehowareCronJobRun` model logs every run

### Content List Pages (Accordion Integration Points)
- **Blogs**: `src/app/admin/blogs/page.js` — table with SEO score badge, 1402 lines
- **Services**: `src/app/admin/services/page.js`
- **Inventory**: `src/app/admin/inventory/page.js`
- **No Accordion component exists** — need to add `src/components/ui/accordion.js`

### Auth & Access Control
- `withAuth` middleware: `src/app/api/utils/auth-middleware.js` — provides `request.user`, `request.prisma`, role-based access
- `resolveClientId(user)` pattern used across SEO APIs — derives client from auth context

### Tech Stack
Next.js 15, NextAuth v5, MySQL/Prisma, React 19, shadcn/ui, TailwindCSS. No existing AI/LLM packages.

---

## 2. Relationship with Blog Agent

```
SEO Analyser Agent (this plan)
    ↓ Scans all content, identifies issues, generates keyword research
    ↓ Feeds analysis results to:
SEO Blog Agent (seo-agent-blog.md)
    ↓ Uses analyser's keyword research + content gap analysis
    ↓ Generates new blog content based on findings
    ↓ Published blogs get scanned by analyser on next run
```

**Data flow**: The analyser's `WehowareSeoAnalyserIssue` records with `issueType = "content_gap"` and `WehowareSeoKeywordResearch` records (shared with blog agent) feed directly into the blog agent's Step 1 (Market Research) and Step 3 (Keyword Analysis).

---

## 3. New Database Models

### 3.1 WehowareSeoAnalyserSetting — Per-Client Config

```prisma
model WehowareSeoAnalyserSetting {
  id                    String   @id @default(uuid()) @db.VarChar(36)
  clientId              String   @unique @map("client_id") @db.VarChar(36)
  enabled               Boolean  @default(false)
  scheduleFrequency     String   @default("weekly") @map("schedule_frequency") @db.VarChar(20) // now | daily | weekly | monthly
  scheduleDayOfWeek     Int      @default(1) @map("schedule_day_of_week") // 0=Sun..6=Sat (for weekly)
  scheduleDayOfMonth    Int      @default(1) @map("schedule_day_of_month") // 1-28 (for monthly)
  scheduleHour          Int      @default(2) @map("schedule_hour") // 0-23 UTC
  scanBlogs             Boolean  @default(true) @map("scan_blogs")
  scanServices          Boolean  @default(true) @map("scan_services")
  scanInventory         Boolean  @default(true) @map("scan_inventory")
  scanStaticPages       Boolean  @default(true) @map("scan_static_pages")
  minSeoScore           Int      @default(80) @map("min_seo_score") // flag items below this
  checkMetaTags         Boolean  @default(true) @map("check_meta_tags")
  checkSchema           Boolean  @default(true) @map("check_schema")
  checkInternalLinks    Boolean  @default(true) @map("check_internal_links")
  checkContentStructure Boolean  @default(true) @map("check_content_structure")
  checkAeo              Boolean  @default(true) @map("check_aeo") // Answer Engine Optimization
  checkGeo              Boolean  @default(true) @map("check_geo") // Generative Engine Optimization
  checkSxo              Boolean  @default(true) @map("check_sxo") // Search Experience Optimization
  checkKeywordUsage     Boolean  @default(true) @map("check_keyword_usage")
  checkCanonical        Boolean  @default(true) @map("check_canonical")
  checkOpenGraph        Boolean  @default(true) @map("check_open_graph")
  checkTwitterCards     Boolean  @default(true) @map("check_twitter_cards")
  checkRobotsMeta       Boolean  @default(true) @map("check_robots_meta")
  checkImageAlt         Boolean  @default(true) @map("check_image_alt")
  checkHeadingStructure Boolean  @default(true) @map("check_heading_structure")
  // E-E-A-T Signals
  checkEeat             Boolean  @default(true) @map("check_eeat") // Experience, Expertise, Authoritativeness, Trustworthiness
  // Content Readability & Quality
  checkReadability      Boolean  @default(true) @map("check_readability") // Flesch score, sentence length, passive voice, transition words
  checkContentFreshness Boolean  @default(true) @map("check_content_freshness") // staleness, last updated, date relevance
  // Technical SEO (On-Page)
  checkUrlOptimization  Boolean  @default(true) @map("check_url_optimization") // URL length, keywords in slug, hyphens, lowercase
  checkIndexability     Boolean  @default(true) @map("check_indexability") // noindex, canonical conflicts
  checkDuplicateContent Boolean  @default(true) @map("check_duplicate_content") // internal/near-duplicate detection
  checkPageDepth        Boolean  @default(true) @map("check_page_depth") // clicks from homepage
  checkHttps            Boolean  @default(true) @map("check_https") // mixed content, SSL
  // Core Web Vitals Signals
  checkWebVitals        Boolean  @default(true) @map("check_web_vitals") // image optimization, lazy load, CLS indicators
  // Rich Snippets / Rich Results
  checkRichSnippets     Boolean  @default(true) @map("check_rich_snippets") // review, organization, local business, event schema
  // Content Optimization Scoring
  checkTfidf            Boolean  @default(true) @map("check_tfidf") // TF-IDF analysis, semantic relevance
  checkContentCoverage  Boolean  @default(true) @map("check_content_coverage") // word count benchmarking, content coverage vs competitors
  // SERP Feature Optimization
  checkSerpFeatures     Boolean  @default(true) @map("check_serp_features") // People Also Ask, image pack, video carousel, featured snippet format
  // Multi-media SEO
  checkMultimediaSeo    Boolean  @default(true) @map("check_multimedia_seo") // image file names, title attributes, video transcripts, captions
  autoSuggestFixes      Boolean  @default(true) @map("auto_suggest_fixes") // generate suggested fixes for approval queue
  language              String   @default("en") @db.VarChar(10)
  lastRunAt             DateTime? @map("last_run_at")
  nextRunAt             DateTime? @map("next_run_at")
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")
  client                WehowareClient @relation(fields: [clientId], references: [id], onDelete: Cascade)

  @@map("wehoware_seo_analyser_settings")
}
```

### 3.2 WehowareSeoAnalyserRun — Execution Audit

```prisma
model WehowareSeoAnalyserRun {
  id              String   @id @default(uuid()) @db.VarChar(36)
  clientId        String   @map("client_id") @db.VarChar(36)
  runType         String   @default("full") @map("run_type") @db.VarChar(20) // full | single_item
  itemType        String?  @map("item_type") @db.VarChar(20) // blog | service | inventory | static_page (for single_item runs)
  itemId          String?  @map("item_id") @db.VarChar(36) // for single_item runs
  status          String   @default("pending") @db.VarChar(20) // pending, running, succeeded, failed, timeout, cancelled
  lockToken       String?  @map("lock_token") @db.VarChar(36)
  triggerSource   String   @default("cron") @map("trigger_source") @db.VarChar(20) // cron | manual | per_item
  startedAt       DateTime @default(now()) @map("started_at")
  finishedAt      DateTime? @map("finished_at")
  durationMs      Int?     @map("duration_ms")
  itemsScanned    Int      @default(0) @map("items_scanned")
  issuesFound     Int      @default(0) @map("issues_found")
  suggestionsMade Int      @default(0) @map("suggestions_made")
  tokensUsed      Int      @default(0) @map("tokens_used")
  costUsd         Decimal? @db.Decimal(10, 4) @map("cost_usd")
  errorMessage    String?  @map("error_message") @db.Text
  input           Json?
  output          Json?
  createdAt       DateTime @default(now()) @map("created_at")
  client          WehowareClient @relation(fields: [clientId], references: [id], onDelete: Cascade)

  @@index([clientId])
  @@index([status])
  @@index([clientId, status])
  @@index([lockToken])
  @@index([clientId, itemType, itemId])
  @@map("wehoware_seo_analyser_runs")
}
```

### 3.3 WehowareSeoAnalyserIssue — Issues Found

```prisma
model WehowareSeoAnalyserIssue {
  id              String   @id @default(uuid()) @db.VarChar(36)
  clientId        String   @map("client_id") @db.VarChar(36)
  runId           String   @map("run_id") @db.VarChar(36)
  itemType        String   @map("item_type") @db.VarChar(20) // blog | service | inventory | static_page
  itemId          String   @map("item_id") @db.VarChar(36)
  itemTitle       String   @map("item_title") @db.VarChar(500)
  itemSlug        String?  @map("item_slug") @db.VarChar(500)
  issueCategory   String   @map("issue_category") @db.VarChar(50) // meta_tags, schema, internal_links, content_structure, aeo, geo, sxo, keyword_usage, canonical, og, twitter, robots, image_alt, headings, seo_score, eeat, readability, freshness, url_optimization, indexability, duplicate_content, page_depth, https, web_vitals, rich_snippets, tfidf, content_coverage, serp_features, multimedia
  issueType       String   @map("issue_type") @db.VarChar(100) // missing_meta_title, meta_title_too_long, missing_schema, no_internal_links, thin_content, no_faq_schema, etc.
  severity        String   @default("medium") @db.VarChar(20) // low, medium, high, critical
  description     String   @db.Text
  current_value   String?  @map("current_value") @db.Text
  suggested_value String?  @map("suggested_value") @db.Text
  status          String   @default("open") @db.VarChar(20) // open, approved, rejected, applied, dismissed, superseded
  appliedAt       DateTime? @map("applied_at")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  client          WehowareClient @relation(fields: [clientId], references: [id], onDelete: Cascade)
  run             WehowareSeoAnalyserRun @relation(fields: [runId], references: [id], onDelete: Cascade)

  @@index([clientId])
  @@index([clientId, itemType, itemId])
  @@index([clientId, status])
  @@index([clientId, issueCategory])
  @@index([runId])
  @@index([severity])
  @@map("wehoware_seo_analyser_issues")
}
```

### 3.4 WehowareSeoAnalyserSuggestion — Approval Queue

```prisma
model WehowareSeoAnalyserSuggestion {
  id              String   @id @default(uuid()) @db.VarChar(36)
  clientId        String   @map("client_id") @db.VarChar(36)
  issueId         String   @map("issue_id") @db.VarChar(36)
  itemType        String   @map("item_type") @db.VarChar(20) // blog | service | inventory | static_page
  itemId          String   @map("item_id") @db.VarChar(36)
  field           String   @db.VarChar(100) // metaTitle, metaDescription, schemaType, content, etc.
  action          String   @db.VarChar(50) // set, update, append, prepend
  currentValue    String?  @map("current_value") @db.Text
  suggestedValue  String   @map("suggested_value") @db.LongText
  explanation     String?  @db.Text
  status          String   @default("pending") @db.VarChar(20) // pending, approved, rejected, applied, expired
  approvedBy      String?  @map("approved_by") @db.VarChar(36)
  approvedAt      DateTime? @map("approved_at")
  appliedAt       DateTime? @map("applied_at")
  appliedResult   String?  @map("applied_result") @db.Text
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  client          WehowareClient @relation(fields: [clientId], references: [id], onDelete: Cascade)
  issue           WehowareSeoAnalyserIssue @relation(fields: [issueId], references: [id], onDelete: Cascade)

  @@index([clientId])
  @@index([clientId, status])
  @@index([clientId, itemType, itemId])
  @@index([issueId])
  @@map("wehoware_seo_analyser_suggestions")
}
```

### 3.5 WehowareSeoAnalyserLog — Step Logs

```prisma
model WehowareSeoAnalyserLog {
  id           String   @id @default(uuid()) @db.VarChar(36)
  runId        String   @map("run_id") @db.VarChar(36)
  clientId     String   @map("client_id") @db.VarChar(36)
  step         String   @db.VarChar(100) // scan_blogs, scan_services, scan_inventory, analyze, generate_suggestions
  stepOrder    Int      @map("step_order")
  status       String   @default("pending") @db.VarChar(20)
  input        Json?
  output       Json?
  durationMs   Int?     @map("duration_ms")
  errorMessage String?  @map("error_message") @db.Text
  tokensUsed   Int      @default(0) @map("tokens_used")
  createdAt    DateTime @default(now()) @map("created_at")

  @@index([runId])
  @@index([clientId])
  @@index([runId, step])
  @@map("wehoware_seo_analyser_logs")
}
```

### 3.6 Back-relations on WehowareClient

Add to `WehowareClient` model:
```prisma
seoAnalyserSetting    WehowareSeoAnalyserSetting?
seoAnalyserRuns       WehowareSeoAnalyserRun[]
seoAnalyserIssues     WehowareSeoAnalyserIssue[]
seoAnalyserSuggestions WehowareSeoAnalyserSuggestion[]
```

---

## 4. Analysis Framework

### 4.1 On-Page SEO Analysis (Traditional)

| Check | Issue Type | Severity | Description |
|-------|-----------|----------|-------------|
| Missing meta title | `missing_meta_title` | critical | No metaTitle set |
| Meta title too long (>60 chars) | `meta_title_too_long` | medium | Truncated in SERPs |
| Meta title too short (<30 chars) | `meta_title_too_short` | low | Under-optimized |
| Missing meta description | `missing_meta_description` | high | No metaDescription set |
| Meta description too long (>160) | `meta_desc_too_long` | medium | Truncated in SERPs |
| Missing meta keywords | `missing_meta_keywords` | low | No metaKeywords or targetKeywords |
| Missing canonical URL | `missing_canonical` | high | No canonicalUrl set |
| Missing robots meta | `missing_robots` | medium | No robotsMeta set |
| SEO score below threshold | `low_seo_score` | high | seoScore < minSeoScore setting |
| Missing slug | `missing_slug` | critical | No slug set |
| Thin content (<300 chars) | `thin_content` | high | Content too short for SEO |
| Missing thumbnail | `missing_thumbnail` | medium | No thumbnail, loses 8 SEO points |
| Missing thumbnail alt | `missing_thumbnail_alt` | low | No thumbnailAlt, loses 7 SEO points |

### 4.2 Schema Analysis

| Check | Issue Type | Severity | Description |
|-------|-----------|----------|-------------|
| Missing schema type | `missing_schema` | high | No schemaType set |
| Invalid schema type | `invalid_schema` | medium | schemaType doesn't match content type (e.g., blog should use BlogPosting/Article) |
| Missing FAQ schema | `missing_faq_schema` | medium | Blog has FAQs but no FAQPage schema |
| Missing Product schema | `missing_product_schema` | medium | Inventory item missing Product schema fields (price, availability) |
| Missing Service schema | `missing_service_schema` | medium | Service missing Service schema fields (offers, provider) |
| Missing BreadcrumbList | `missing_breadcrumb_schema` | low | No breadcrumb schema |

### 4.3 Internal Linking Analysis

| Check | Issue Type | Severity | Description |
|-------|-----------|----------|-------------|
| No internal links | `no_internal_links` | high | Content has zero links to other pages |
| Few internal links (<3) | `few_internal_links` | medium | Content has <3 internal links |
| Broken internal links | `broken_internal_links` | high | Links to slugs that don't exist |
| Missing service links | `missing_service_links` | medium | Blog not linked to relevant services |
| Missing blog-to-blog links | `missing_blog_links` | low | No links to related blog posts |
| Orphaned content | `orphaned_content` | medium | No other content links to this item |

### 4.4 Content Structure Analysis

| Check | Issue Type | Severity | Description |
|-------|-----------|----------|-------------|
| No H1 heading | `missing_h1` | high | Content has no H1 tag |
| Multiple H1 headings | `multiple_h1` | medium | Content has >1 H1 tag |
| No H2/H3 structure | `poor_heading_structure` | medium | No heading hierarchy |
| No paragraphs | `no_paragraphs` | medium | Content is one block |
| No lists | `no_lists` | low | Content has no UL/OL lists |
| No images | `no_images` | low | Content has no images |
| Missing image alt texts | `missing_image_alt` | medium | Images without alt attributes |
| No CTA | `missing_cta` | low | No call-to-action fields set |
| Content too short (<500 words) | `short_content` | medium | Word count below recommended |

### 4.5 AEO (Answer Engine Optimization)

| Check | Issue Type | Severity | Description |
|-------|-----------|----------|-------------|
| No FAQ section | `no_faq_section` | medium | No FAQ content for answer engines |
| No Q&A format | `no_qa_format` | low | No question-answer patterns in content |
| No featured snippet bait | `no_snippet_bait` | low | No 40-60 word paragraphs that could be featured snippets |
| No definition blocks | `no_definitions` | low | No "What is X" definition blocks |
| No step-by-step lists | `no_step_by_step` | low | No numbered step lists for "how to" queries |

### 4.6 GEO (Generative Engine Optimization)

| Check | Issue Type | Severity | Description |
|-------|-----------|----------|-------------|
| No entity mentions | `no_entity_mentions` | low | Content doesn't mention relevant entities/brands |
| No citation-worthy claims | `no_citations` | low | No statistics, data, or claims that AI engines would cite |
| No structured data for AI | `no_ai_structured_data` | medium | No schema that AI crawlers can parse |
| Low content uniqueness | `low_uniqueness` | medium | Content too generic for AI engines to reference |

### 4.7 SXO (Search Experience Optimization)

| Check | Issue Type | Severity | Description |
|-------|-----------|----------|-------------|
| Slow content rendering | `poor_rendering` | low | Content structure causes poor LCP |
| No table of contents | `missing_toc` | low | Long content without ToC (blogs) |
| No author box | `missing_author_box` | low | No author trust signal (blogs) |
| Poor mobile readability | `poor_mobile_readability` | low | Long paragraphs, small font indicators |
| No social share | `no_social_share` | low | allowSocialShare disabled |

### 4.8 Keyword Analysis

| Check | Issue Type | Severity | Description |
|-------|-----------|----------|-------------|
| No target keywords | `no_target_keywords` | high | targetKeywords is null/empty |
| Keywords not in content | `keywords_not_in_content` | medium | Target keywords not found in content body |
| Keywords not in title | `keywords_not_in_title` | high | Primary keyword not in title/metaTitle |
| Keywords not in meta description | `keywords_not_in_meta_desc` | medium | Keywords not in metaDescription |
| Keyword stuffing | `keyword_stuffing` | medium | Keyword density >3% |
| Missing LSI keywords | `missing_lsi_keywords` | low | No related/LSI keywords in content |

### 4.9 E-E-A-T Signals (Experience, Expertise, Authoritativeness, Trustworthiness)

| Check | Issue Type | Severity | Description |
|-------|-----------|----------|-------------|
| No author bio | `missing_author_bio` | medium | Blog has no author information or bio |
| No author credentials | `missing_author_credentials` | low | Author lacks expertise indicators |
| No trust signals | `missing_trust_signals` | medium | No contact info, privacy policy, or about page links |
| No source citations | `no_source_citations` | medium | Content makes claims without citing sources |
| No outbound authority links | `no_authority_links` | low | No links to authoritative external sources |
| No first-hand experience | `no_experience_signals` | low | Content lacks first-person experience indicators |
| No author box enabled | `author_box_disabled` | low | showAuthorBox is false (blogs) |

### 4.10 Content Readability & Quality

| Check | Issue Type | Severity | Description |
|-------|-----------|----------|-------------|
| Low Flesch Reading Ease (<30) | `low_readability_score` | medium | Content is difficult to read |
| Long sentences (>25 words avg) | `long_sentences` | low | Average sentence length too high |
| Passive voice overuse (>10%) | `passive_voice_overuse` | low | Too much passive voice |
| No transition words | `no_transition_words` | low | Poor flow, missing transition words |
| Complex word density (>15%) | `complex_words` | low | Too many complex words for target audience |

### 4.11 Content Freshness & Decay

| Check | Issue Type | Severity | Description |
|-------|-----------|----------|-------------|
| Content not updated in 12+ months | `stale_content` | medium | updatedAt > 12 months ago |
| Outdated date references | `outdated_dates` | medium | Content references specific years/dates that are past |
| Outdated statistics | `outdated_statistics` | low | Content cites statistics >2 years old |
| No "last updated" indicator | `no_updated_indicator` | low | No visible last-updated date for users |

### 4.12 Technical SEO — URL Optimization

| Check | Issue Type | Severity | Description |
|-------|-----------|----------|-------------|
| URL too long (>75 chars) | `url_too_long` | low | Slug/URL exceeds recommended length |
| No keywords in URL | `no_keywords_in_url` | medium | Slug doesn't contain target keywords |
| URL has underscores | `url_underscores` | low | Uses underscores instead of hyphens |
| URL has uppercase | `url_uppercase` | low | URL should be lowercase only |
| URL has special characters | `url_special_chars` | medium | Non-alphanumeric characters in slug |

### 4.13 Technical SEO — Indexability

| Check | Issue Type | Severity | Description |
|-------|-----------|----------|-------------|
| noindex detected | `noindex_set` | high | robotsMeta contains noindex |
| Canonical conflicts | `canonical_conflict` | high | canonicalUrl points to different URL than self |
| Missing canonical on paginated content | `missing_canonical_paginated` | medium | No canonical on paginated/list pages |
| Conflicting robots directives | `robots_conflict` | medium | Contradictory robots meta directives |

### 4.14 Technical SEO — Duplicate Content

| Check | Issue Type | Severity | Description |
|-------|-----------|----------|-------------|
| Internal duplicate content | `internal_duplicate` | high | Another item has >80% similar content |
| Near-duplicate content | `near_duplicate` | medium | Another item has >60% similar content |
| Duplicate meta titles | `duplicate_meta_title` | high | Multiple items share the same metaTitle |
| Duplicate meta descriptions | `duplicate_meta_desc` | medium | Multiple items share the same metaDescription |
| Duplicate target keywords | `duplicate_target_keywords` | medium | Multiple items target same primary keyword (cannibalization) |

### 4.15 Technical SEO — Page Depth & HTTPS

| Check | Issue Type | Severity | Description |
|-------|-----------|----------|-------------|
| Deep page (>3 clicks from home) | `deep_page` | low | Item is buried too deep in site structure |
| Mixed content (HTTP on HTTPS) | `mixed_content` | high | Content references HTTP resources |
| No HTTPS in internal links | `non_https_links` | medium | Internal links use HTTP instead of HTTPS |
| Broken external links | `broken_external_links` | medium | External links return 404 or are dead |

### 4.16 Core Web Vitals Signals

| Check | Issue Type | Severity | Description |
|-------|-----------|----------|-------------|
| Images without dimensions | `images_no_dimensions` | medium | IMG tags without width/height (CLS risk) |
| No lazy loading on images | `no_lazy_loading` | low | Images below the fold not lazy-loaded |
| Large image references | `large_images` | medium | Images referenced are >500KB (LCP risk) |
| No image format optimization | `no_image_optimization` | low | Using PNG/JPG instead of WebP/AVIF |
| Render-blocking indicators | `render_blocking` | low | Inline CSS/JS blocks in content |
| No async/defer on scripts | `no_async_scripts` | low | Script tags without async/defer attributes |

### 4.17 Rich Snippets / Rich Results

| Check | Issue Type | Severity | Description |
|-------|-----------|----------|-------------|
| Missing review/rating schema | `missing_review_schema` | medium | Service/inventory has rating but no Review schema |
| Missing Organization schema | `missing_organization_schema` | medium | No Organization schema for the business |
| Missing LocalBusiness schema | `missing_localbusiness_schema` | medium | Client has physical address but no LocalBusiness schema |
| Missing Event schema | `missing_event_schema` | low | Content mentions events but no Event schema |
| Missing Sitelinks search box | `missing_sitelinks_schema` | low | No WebSite schema with SearchAction |
| Missing FAQPage schema | `missing_faqpage_schema` | medium | Blog has FAQs but no FAQPage JSON-LD |
| Missing HowTo schema | `missing_howto_schema` | low | Content is step-by-step guide but no HowTo schema |
| Missing Article schema fields | `incomplete_article_schema` | medium | BlogPosting missing author, datePublished, image |

### 4.18 Content Optimization Scoring (Surfer SEO / Clearscope level)

| Check | Issue Type | Severity | Description |
|-------|-----------|----------|-------------|
| Low TF-IDF score | `low_tfidf_score` | medium | Key terms have low TF-IDF vs corpus |
| Low semantic relevance | `low_semantic_relevance` | medium | NLP entities don't match target topic |
| Word count below benchmark | `below_word_count_benchmark` | medium | Content significantly shorter than industry avg for topic |
| Low content coverage | `low_content_coverage` | medium | Missing key subtopics that competitors cover |
| No NLP entity coverage | `low_entity_coverage` | low | Missing named entities expected for the topic |
| Low topical authority | `low_topical_authority` | low | Content doesn't demonstrate deep topic coverage |

### 4.19 SERP Feature Optimization

| Check | Issue Type | Severity | Description |
|-------|-----------|----------|-------------|
| No People Also Ask targeting | `no_paa_targeting` | low | Content doesn't answer common PAA questions |
| No image pack optimization | `no_image_optimization_serp` | low | Images not optimized for image search (file names, alt, captions) |
| No video carousel optimization | `no_video_optimization` | low | No video schema or transcripts for video results |
| No featured snippet format | `no_snippet_format` | medium | Content not structured for featured snippets (table, list, or 40-60 word paragraph) |
| No table-eligible content | `no_table_content` | low | Comparison/data content not in HTML table for snippet |
| No list-eligible content | `no_list_content` | low | Step-by-step content not in OL/UL for snippet |

### 4.20 Multi-media SEO

| Check | Issue Type | Severity | Description |
|-------|-----------|----------|-------------|
| Non-descriptive image file names | `poor_image_filenames` | low | Image file names are generic (e.g., "img001.jpg") |
| Missing image title attributes | `missing_image_titles` | low | IMG tags without title attribute |
| Missing image captions | `missing_image_captions` | low | Images without figcaption or caption text |
| No video transcripts | `missing_video_transcripts` | medium | Video content without text transcripts |
| No video schema | `missing_video_schema` | low | Videos without VideoObject schema |
| Unoptimized image alt text | `poor_alt_text` | low | Alt text is too short, too long, or keyword-stuffed |

---

## 5. Agent Pipeline (10 Steps)

### Step 1 — Initialize Run
- Create `WehowareSeoAnalyserRun` with `status = "running"`, `lockToken = uuid()`
- Check for existing active run for same client (concurrency control)
- Load `WehowareSeoAnalyserSetting` for client
- If setting not found or `enabled = false`, skip client
- **Single-item mode**: If run triggered with `{ itemType, itemId }`, set `runType = "single_item"`, store `{ itemType, itemId }` in `WehowareSeoAnalyserRun.input`. Steps 2-6 will process only that one item. Skip Steps 6-7 (cross-content analysis + keyword sync) for single-item runs.

### Step 2 — Fetch All Content
- **Single-item mode**: Fetch only the specified item via the appropriate Prisma model (blog/service/inventory/static_page) by `itemId` + `clientId`. Also fetch all slugs for internal link validation (needed even for single-item to check broken links).
- **Full mode**: Fetch all content types as below.
- Fetch blogs (if `scanBlogs`): `WehowareBlog.findMany({ where: { clientId, status: { in: ["Published", "Draft"] } } })`
- Fetch services (if `scanServices`): `WehowareService.findMany({ where: { clientId, active: true } })`
- Fetch inventory items (if `scanInventory`): `WehowareInventoryItem.findMany({ where: { clientId, active: true } })`
- Fetch static pages (if `scanStaticPages`): `WehowareStaticPage.findMany({ where: { clientId, isActive: true } })`
- Fetch all slugs (for internal link validation): aggregate all `slug` fields from all content types
- Fetch existing keywords: `WehowareClientKeyword` + `WehowareSeoKeywordResearch` (if blog agent models exist)
- **Pagination**: for clients with 1000+ items, fetch in batches of 100

### Step 3 — Run Rule-Based Checks (No LLM)
For each item, run all enabled checks from Section 4 that are deterministic (no LLM needed):
- Meta tag presence/length checks (4.1)
- Schema type validation (4.2)
- Internal link counting + broken link detection (4.3)
- Heading structure analysis via HTML parsing (4.4)
- Image alt text presence (4.4)
- Keyword presence in content/title/meta (4.8)
- SEO score check via existing `computeSeoScore()`
- E-E-A-T signals: author bio, trust signals, outbound authority links, author box enabled (4.9)
- Readability: Flesch Reading Ease, sentence length, passive voice %, transition words, complex word density (4.10)
- Content freshness: staleness check (updatedAt > 12 months), outdated date references, outdated statistics (4.11)
- URL optimization: URL length, keywords in slug, underscores, uppercase, special chars (4.12)
- Indexability: noindex detection, canonical conflicts, robots directive conflicts (4.13)
- Duplicate content: duplicate meta titles/descriptions, duplicate target keywords (4.14)
- Page depth & HTTPS: mixed content, non-HTTPS links (4.15)
- Core Web Vitals: images without dimensions, no lazy loading, large images, no WebP/AVIF, render-blocking (4.16)
- Rich snippets: missing review/organization/localbusiness/event/FAQ/HowTo/Article schema (4.17)
- SERP features: no PAA targeting, no featured snippet format, no table/list-eligible content (4.19)
- Multi-media: poor image filenames, missing image titles/captions, missing video transcripts/schema (4.20)
- Create `WehowareSeoAnalyserIssue` records for each found issue

### Step 4 — Run LLM-Powered Analysis
For each item with issues (or all items if batch size allows), send to LLM for deeper analysis:
- **AEO analysis** (4.5): Does content have answerable patterns? FAQ opportunities?
- **GEO analysis** (4.6): Is content structured for AI citation? Entity coverage?
- **SXO analysis** (4.7): User experience signals, readability, content gaps
- **Content quality**: Tone, clarity, uniqueness assessment
- **Keyword gap**: What keywords should this content target that it doesn't?
- **Internal linking opportunities**: What other content should this link to?
- **E-E-A-T deep analysis** (4.9): Source citation opportunities, experience indicators, authority signals
- **TF-IDF analysis** (4.18): Calculate term frequency vs inverse document frequency across client's content corpus
- **Semantic relevance** (4.18): NLP entity extraction, compare entities vs target topic
- **Content coverage scoring** (4.18): Compare content subtopics vs competitor benchmarks, word count benchmarking
- **SERP feature opportunities** (4.19): PAA question identification, featured snippet format recommendations

**LLM prompt structure**:
```
You are an expert SEO analyst. Analyze the following content for:
1. AEO (Answer Engine Optimization) — can AI/voice assistants extract answers from this?
2. GEO (Generative Engine Optimization) — would AI search engines cite this content?
3. SXO (Search Experience Optimization) — is the user experience optimal?
4. E-E-A-T — does content demonstrate Experience, Expertise, Authoritativeness, Trustworthiness?
5. Content gaps — what's missing that competitors have?
6. SERP features — what featured snippet/PAA opportunities exist?
7. Semantic relevance — what NLP entities are missing for this topic?

Content type: {itemType}
Title: {title}
Content: {content (truncated to 8000 chars)}
Current keywords: {targetKeywords}
Current meta: {metaTitle}, {metaDescription}
Author: {authorName}
Last updated: {updatedAt}

Return JSON: { issues: [{ type, severity, description, suggestedFix }], keywords: [{ keyword, reason }], entities: [{ entity, relevance }] }
```

**Batch strategy**: Send 5 items per LLM call to reduce token usage. Use `gpt-4o-mini` for analysis (cost-effective).

**TF-IDF computation** (no LLM needed — computed in `scanner.js`):
- Build term-document matrix from all client content
- Calculate TF-IDF scores for each term in each document
- Flag items with low TF-IDF scores for target keywords vs corpus average

### Step 5 — Generate Suggested Fixes
For each issue found in Steps 3-4, if `autoSuggestFixes = true`:
- Generate a `WehowareSeoAnalyserSuggestion` record
- For meta tag issues: LLM generates suggested metaTitle/metaDescription
- For schema issues: Suggest correct schemaType
- For internal linking: Suggest specific URLs to link to (from fetched slugs)
- For content structure: Suggest heading reorganization
- For AEO: Suggest FAQ additions
- For keyword gaps: Suggest targetKeywords to add
- For E-E-A-T: Suggest author bio text, trust signal additions, source citation recommendations
- For readability: Suggest simplified sentence rewrites, transition word additions
- For freshness: Suggest updated statistics, date references, content refresh recommendations
- For URL optimization: Suggest optimized slug with target keywords
- For rich snippets: Suggest complete JSON-LD schema blocks (FAQPage, HowTo, Review, LocalBusiness)
- For SERP features: Suggest PAA question additions, featured snippet format restructuring
- For content coverage: Suggest missing subtopics to add, word count targets
- For multimedia: Suggest optimized image file names, alt text rewrites, caption text

**Suggestion generation prompt**:
```
For the following SEO issue, generate a suggested fix:
Issue: {issueType}
Current value: {currentValue}
Content title: {title}
Content type: {itemType}

Return JSON: { suggestedValue: "...", explanation: "..." }
```

### Step 6 — Cross-Content Analysis
- **Internal linking map**: Build a graph of all content → identify orphaned content, missing cross-links
- **Keyword cannibalization**: Detect multiple items targeting the same keyword
- **Content clusters**: Identify topic clusters that should be interlinked
- **Content gaps**: Topics that competitors cover but this client doesn't (based on keyword research)
- **Duplicate content detection** (4.14): Compare all items pairwise using cosine similarity on content text. Flag items with >80% similarity as `internal_duplicate`, >60% as `near_duplicate`. Use MinHash or SimHash for efficient comparison at scale.
- **Duplicate meta tags**: Find items sharing identical metaTitle or metaDescription
- **TF-IDF corpus analysis** (4.18): Build complete term-document matrix across all client content, identify terms with high discrimination value, flag items with low topical coverage

### Step 7 — Keyword Research Sync
- Sync discovered keywords to `WehowareSeoKeywordResearch` (shared with blog agent)
- Mark keywords with `status = "new"` for blog agent to pick up
- Update existing keywords with new search volume/difficulty data if available

### Step 8 — Compile Audit Report
- Aggregate all issues by category and severity
- Calculate overall SEO health score (percentage of items above minSeoScore)
- Generate summary: X items scanned, Y issues found, Z suggestions generated
- Store report summary in `WehowareSeoAnalyserRun.output`

### Step 9 — Persist Results
- All issues already created in Step 3-4
- All suggestions already created in Step 5
- Mark run as `succeeded`, set `finishedAt`, `durationMs`, `itemsScanned`, `issuesFound`, `suggestionsMade`
- Update `WehowareSeoAnalyserSetting.lastRunAt` and `nextRunAt`
- Release lock token

### Step 10 — Notify (Optional)
- If new critical issues found, create a notification for the client admin
- Store notification in existing notification system (if available)

---

## 6. LLM Integration

### 6.1 Provider
Same as blog agent: **OpenAI API** with pluggable architecture.
- Use `gpt-4o-mini` for analysis steps (cost-effective, sufficient for analysis)
- Use `gpt-4o` for suggestion generation (higher quality output)
- Pin model versions: `gpt-4o-mini-2024-07-18`, `gpt-4o-2024-08-06`

### 6.2 New Files
```
src/lib/seo-analyser/
├── analyser.js              # Main orchestrator — runSeoAnalyser()
├── scanner.js               # Content fetching + rule-based checks (meta, schema, links, headings, keywords)
├── llm-analyzer.js          # LLM-powered analysis (AEO, GEO, SXO, E-E-A-T, content gaps, SERP features)
├── suggestion-generator.js  # Generate suggested fixes
├── internal-links.js        # Internal linking graph builder
├── keyword-sync.js          # Sync keywords to WehowareSeoKeywordResearch
├── report.js                # Audit report compiler
├── cron.js                  # Cron dispatcher — runSeoAnalyserCronDispatcher()
├── utils.js                 # Shared utilities (slug validation, HTML parsing)
├── readability.js           # Flesch Reading Ease, sentence length, passive voice, transition words
├── freshness.js             # Content staleness, outdated dates/statistics, decay detection
├── technical-seo.js         # URL optimization, indexability, page depth, HTTPS, mixed content
├── web-vitals.js            # Core Web Vitals signals (image dimensions, lazy load, format, CLS)
├── rich-snippets.js         # Rich result schema validation (Review, Organization, LocalBusiness, Event, FAQ, HowTo)
├── tfidf.js                 # TF-IDF computation, term-document matrix, semantic relevance scoring
├── duplicate-detector.js    # Duplicate/near-duplicate content detection (MinHash/SimHash)
├── serp-features.js         # SERP feature optimization (PAA, image pack, video, featured snippet format)
└── multimedia-seo.js        # Image filenames, titles, captions, video transcripts, VideoObject schema
```

### 6.3 Reusable Utilities from Blog Agent
- `src/lib/seo-analyser/circuit-breaker.js` — shared with blog agent
- `src/lib/seo-analyser/rate-limiter.js` — shared with blog agent
- `src/lib/seo-analyser/pii-scrubber.js` — shared with blog agent
- `src/lib/seo-analyser/validator.js` — shared with blog agent

### 6.4 Token Budget
- Per item: max 3000 tokens (input + output) — increased from 2000 to accommodate E-E-A-T, SERP features, semantic relevance analysis
- Per run: max 80,000 tokens (configurable via `SEO_ANALYSER_MAX_TOKENS_PER_RUN`)
- Batch items (5 per call) to reduce total calls
- Track tokens in `WehowareSeoAnalyserRun.tokensUsed`
- **Rule-based checks (Steps 3, TF-IDF, duplicate detection) consume zero tokens** — only LLM-powered analysis (Step 4) and suggestion generation (Step 5) use tokens

---

## 7. Cron Integration

### 7.1 Register in JOBS

Add to `src/lib/cron/jobs.js`:
```javascript
import { runSeoAnalyserCronDispatcher } from "@/lib/seo-analyser/cron";

export const JOBS = {
  // ... existing jobs ...
  "seo-analyser-dispatcher": runSeoAnalyserCronDispatcher,
};
```

### 7.2 Cron Dispatcher

```javascript
// src/lib/seo-analyser/cron.js
export async function runSeoAnalyserCronDispatcher() {
  const now = new Date();
  // Fetch all clients with analyser enabled and nextRunAt <= now
  const settings = await prisma.wehowareSeoAnalyserSetting.findMany({
    where: {
      enabled: true,
      nextRunAt: { lte: now },
    },
    select: { clientId: true, scheduleFrequency: true },
  });

  let processed = 0;
  let errors = 0;

  for (const setting of settings) {
    try {
      await runSeoAnalyser(setting.clientId, "cron");
      processed++;
    } catch (err) {
      console.error(`[seo-analyser] Client ${setting.clientId} failed:`, err);
      errors++;
    }
  }

  return { processed, errors, total: settings.length };
}
```

### 7.3 Schedule Calculation

After each run, calculate `nextRunAt` based on `scheduleFrequency`:
- `now`: nextRunAt = null (manual only)
- `daily`: nextRunAt = tomorrow at scheduleHour UTC
- `weekly`: nextRunAt = next scheduleDayOfWeek at scheduleHour UTC
- `monthly`: nextRunAt = next month's scheduleDayOfMonth at scheduleHour UTC

### 7.4 Vercel Timeout Handling
- Set `export const maxDuration = 300` on cron route
- Process **1 client per cron invocation** (same as blog agent fix)
- Stale run cleanup: mark runs as `timeout` if `startedAt` > 5 minutes ago and status = `running`

---

## 8. API Routes

### 8.1 Settings API
```
GET    /api/v1/seo-analyser/settings          — Get analyser settings for active client
POST   /api/v1/seo-analyser/settings          — Update analyser settings
```

### 8.2 Run Management
```
POST   /api/v1/seo-analyser/run               — Trigger manual run (full client or single item)
GET    /api/v1/seo-analyser/runs               — List runs (paginated)
GET    /api/v1/seo-analyser/runs/:id           — Get run details
```

**POST /api/v1/seo-analyser/run** body options:
- Full run: `{}` (no body) — analyzes all content for the active client
- Single-item run: `{ "itemType": "blog", "itemId": "uuid" }` — analyzes only that one item
- `itemType` accepts: `blog`, `service`, `inventory`, `static_page`
- Rate limit: full run = 1 per 5 min per client; single-item = 1 per 2 min per item
- `clientId` always from auth context; `itemId` validated to belong to that client

### 8.3 Issues & Suggestions
```
GET    /api/v1/seo-analyser/issues             — List issues (filterable by itemType, status, severity, category)
GET    /api/v1/seo-analyser/issues/:id         — Get issue details
GET    /api/v1/seo-analyser/issues/by-item     — Get issues for a specific item (type + id)
POST   /api/v1/seo-analyser/issues/:id/dismiss — Dismiss an issue
```

### 8.4 Suggestion Approval Queue
```
GET    /api/v1/seo-analyser/suggestions        — List suggestions (filterable by status)
POST   /api/v1/seo-analyser/suggestions/:id/approve  — Approve suggestion
POST   /api/v1/seo-analyser/suggestions/:id/reject   — Reject suggestion
POST   /api/v1/seo-analyser/suggestions/:id/apply    — Apply approved suggestion to content
POST   /api/v1/seo-analyser/suggestions/batch-apply   — Apply multiple approved suggestions
```

### 8.5 Dashboard / Summary
```
GET    /api/v1/seo-analyser/dashboard          — Summary stats (total items, issues by severity, SEO health score, recent runs)
```

### 8.6 Auth & Access Control
All routes use `withAuth` with `{ allowedRoles: ["client", "employee", "admin"] }`.
`clientId` derived from auth context via `resolveClientId(user)` — never from request body.

---

## 9. UI / Frontend

### 9.1 Settings Tab on SEO Page

Add a new tab "Analyser" to `src/app/admin/seo/page.js`:

```
Tabs: Global Settings | Static Pages | Sitemap Config | Keywords | Analyser
```

**Analyser tab contents**:
- Enable/disable toggle
- Schedule frequency selector (Now, Daily, Weekly, Monthly)
- Day of week selector (if weekly)
- Day of month selector (if monthly)
- Hour selector (UTC)
- Content type checkboxes: Blogs, Services, Inventory, Static Pages
- Analysis type checkboxes (grouped):
  - **On-Page**: Meta Tags, Schema, Internal Links, Content Structure, Keyword Usage, Canonical, OG, Twitter, Robots, Image Alt, Headings
  - **E-E-A-T**: Author credibility, Trust signals, Source citations, Experience indicators
  - **Readability**: Flesch score, Sentence length, Passive voice, Transition words
  - **Freshness**: Content staleness, Date relevance, Historical optimization
  - **Technical SEO**: URL optimization, Indexability, Duplicate content, Page depth, HTTPS
  - **Core Web Vitals**: Image optimization, Lazy load, CLS indicators
  - **Rich Snippets**: Review/rating, Organization, LocalBusiness, Event schema
  - **Content Scoring**: TF-IDF, Semantic relevance, Word count benchmarking
  - **SERP Features**: People Also Ask, Image pack, Video carousel, Featured snippet format
  - **Multimedia**: Image file names, Title attributes, Video transcripts, Captions
- Min SEO score slider (0-100)
- Auto-suggest fixes toggle
- Language selector
- "Run Analysis Now" button
- Last run info + next run info

### 9.2 Accordion Component

Create `src/components/ui/accordion.js` — shadcn/ui accordion (Radix-based):

```jsx
<Accordion type="single" collapsible>
  <AccordionItem value="item-1">
    <AccordionTrigger>SEO Issues (3 found)</AccordionTrigger>
    <AccordionContent>
      {/* Issue list */}
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

### 9.3 Blog List Page Integration

In `src/app/admin/blogs/page.js`, add an accordion row below each blog row:

```
[Existing blog row: title, category, views, likes, read_time, seo_score, status, actions]
  ↓ Accordion (expandable):
  ┌─────────────────────────────────────────────────────────────┐
  │  SEO Health: 75/100 (3 issues, 2 suggestions)  [🔍 Check Now] │
  │                                                             │
  │  Issues:                                                    │
  │   ├── 🔴 Missing meta description [Suggest Fix]             │
  │   ├── 🟡 No internal links found [Suggest Fix]              │
  │   └── 🟢 Missing image alt text [Suggest Fix]               │
  │                                                             │
  │  Suggestions:                                               │
  │   ├── Pending: Add meta description (150 chars) → [Approve] [Reject] │
  │   └── Pending: Add 3 internal links → [Approve] [Reject]    │
  └─────────────────────────────────────────────────────────────┘
```

**"Check Now" button**:
- Runs the SEO analyser for **only this specific blog** (not all content)
- Shows loading spinner during analysis
- On completion, refreshes the accordion with updated issues + suggestions
- Rate-limited: 1 check per item per 2 minutes (prevents spam)
- Calls `POST /api/v1/seo-analyser/run` with `{ itemType: "blog", itemId: blog.id }`
- Uses the same 10-step pipeline but scoped to a single item (Steps 2-6 run for 1 item only)

**Implementation approach**:
- Batch fetch issues for current page's blog IDs in one API call (avoid N+1)
- Show accordion trigger with issue count badge (red/yellow/green based on severity)
- Expand to show issue list with severity icons, descriptions, and suggestion actions
- "Check Now" button at top-right of accordion content
- Button disabled + spinner while analysis running (track via run status polling)

### 9.4 Service List Page Integration

Same accordion pattern in `src/app/admin/services/page.js`, including the "Check Now" button scoped to `{ itemType: "service", itemId: service.id }`.

### 9.5 Inventory List Page Integration

Same accordion pattern in `src/app/admin/inventory/page.js`, including the "Check Now" button scoped to `{ itemType: "inventory", itemId: item.id }`.

### 9.6 Suggestion Review Modal

When user clicks "Approve" on a suggestion:
1. Show modal with: current value → suggested value (diff view if content)
2. "Apply Now" or "Apply Later" buttons
3. If applied: call `/api/v1/seo-analyser/suggestions/:id/apply`
4. Application updates the actual content item (blog/service/inventory) via Prisma
5. Recompute SEO score after applying
6. Mark suggestion as `applied`, mark issue as `resolved`

### 9.7 Dashboard Widget

Add to `src/app/admin/seo/page.js` Analyser tab:
- Overall SEO health score (gauge chart)
- Items scanned vs items with issues
- Issues by severity (bar chart)
- Issues by category (pie chart)
- Recent runs table (date, items scanned, issues found, duration)
- Top 5 critical issues across all content

---

## 10. Suggestion Application Logic

When a suggestion is applied, the system updates the actual content item:

```javascript
async function applySuggestion(suggestion) {
  const modelMap = {
    blog: "wehowareBlog",
    service: "wehowareService",
    inventory: "wehowareInventoryItem",
    static_page: "wehowareStaticPage",
  };
  const model = modelMap[suggestion.itemType];
  
  // Fetch current item
  const item = await prisma[model].findUnique({ where: { id: suggestion.itemId } });
  if (!item) throw new Error("Item not found — may have been deleted");

  // Apply suggestion
  let updateData = {};
  switch (suggestion.action) {
    case "set":
      updateData[suggestion.field] = suggestion.suggestedValue;
      break;
    case "append":
      updateData[suggestion.field] = (item[suggestion.field] || "") + suggestion.suggestedValue;
      break;
    case "prepend":
      updateData[suggestion.field] = suggestion.suggestedValue + (item[suggestion.field] || "");
      break;
  }

  // Sanitize if content field
  if (suggestion.field === "content") {
    updateData[suggestion.field] = sanitizeHtml(updateData[suggestion.field]);
  }

  // Recompute SEO score
  const merged = { ...item, ...updateData };
  updateData.seoScore = computeSeoScore({
    metaTitle: merged.metaTitle,
    metaDescription: merged.metaDescription,
    metaKeywords: merged.metaKeywords,
    thumbnail: merged.thumbnail,
    thumbnailAlt: merged.thumbnailAlt,
    openGraphTitle: merged.openGraphTitle,
    openGraphDescription: merged.openGraphDescription,
    openGraphImage: merged.openGraphImage,
    slug: merged.slug,
    content: merged.content,
    targetKeywords: merged.targetKeywords,
  });

  // Update item
  await prisma[model].update({ where: { id: suggestion.itemId }, data: updateData });

  // Mark suggestion as applied
  await prisma.wehowareSeoAnalyserSuggestion.update({
    where: { id: suggestion.id },
    data: { status: "applied", appliedAt: new Date() },
  });

  // Mark issue as resolved
  await prisma.wehowareSeoAnalyserIssue.update({
    where: { id: suggestion.issueId },
    data: { status: "applied", appliedAt: new Date() },
  });
}
```

---

## 11. Environment Variables

```env
# SEO Analyser — LLM
SEO_ANALYSER_OPENAI_API_KEY=           # Falls back to OPENAI_API_KEY if not set
SEO_ANALYSER_OPENAI_MODEL=gpt-4o-mini-2024-07-18
SEO_ANALYSER_SUGGESTION_MODEL=gpt-4o-2024-08-06

# SEO Analyser — Operational
SEO_ANALYSER_MAX_TOKENS_PER_RUN=80000
SEO_ANALYSER_RUN_TIMEOUT_MS=300000        # 5 minutes
SEO_ANALYSER_CRON_BATCH_SIZE=1            # 1 client per cron invocation
SEO_ANALYSER_MAX_CONCURRENT_LLM_CALLS=3
SEO_ANALYSER_CIRCUIT_BREAKER_THRESHOLD=5
SEO_ANALYSER_CIRCUIT_BREAKER_COOLDOWN_MS=30000
SEO_ANALYSER_STALE_RUN_TIMEOUT_MS=300000
SEO_ANALYSER_MAX_ITEMS_PER_RUN=500        # Skip items beyond this to avoid timeout
SEO_ANALYSER_LLM_BATCH_SIZE=5             # Items per LLM call
SEO_ANALYSER_LOG_RETENTION_DAYS=90
SEO_ANALYSER_ISSUE_RETENTION_DAYS=180
SEO_ANALYSER_SUGGESTION_EXPIRY_DAYS=30    # Suggestions expire if not approved in 30 days

# SEO Analyser — Analysis Thresholds
SEO_ANALYSER_DUPLICATE_SIMILARITY_THRESHOLD=0.80  # Flag as internal_duplicate above this
SEO_ANALYSER_NEAR_DUPLICATE_THRESHOLD=0.60        # Flag as near_duplicate above this
SEO_ANALYSER_FRESHNESS_STALE_MONTHS=12            # Flag content not updated in X months
SEO_ANALYSER_READABILITY_MIN_FLESCH=30            # Flag content below this Flesch score
SEO_ANALYSER_KEYWORD_STUFFING_PERCENT=3           # Flag keyword density above this %
SEO_ANALYSER_TFIDF_LOW_THRESHOLD=0.01            # Flag items with TF-IDF below this for target keywords
```

---

## 12. Security & Access Control

- **Auth**: All API routes use `withAuth` with `allowedRoles: ["client", "employee", "admin"]`
- **Client scoping**: `clientId` always from auth context, never from request body
- **Cron auth**: HMAC-verified via existing `/api/cron/[job]` route
- **PII scrubbing**: Before sending content to LLM, scrub PII (emails, phone numbers, addresses) using shared `pii-scrubber.js`
- **Prompt injection**: LLM output validated via `validator.js` — reject if output contains executable code or prompt injection patterns
- **Rate limiting**: Manual run trigger limited to 1 per 5 minutes per client
- **Data retention**: Issues expire after 180 days, logs after 90 days, suggestions after 30 days

---

## 13. New Files Summary

```
src/lib/seo-analyser/
├── analyser.js                  # Main orchestrator
├── scanner.js                   # Content fetching + rule-based checks
├── llm-analyzer.js              # LLM-powered analysis
├── suggestion-generator.js      # Suggested fix generation
├── internal-links.js            # Internal linking graph
├── keyword-sync.js              # Keyword research sync
├── report.js                    # Audit report compiler
├── cron.js                      # Cron dispatcher
└── utils.js                     # Shared utilities

src/app/api/v1/seo-analyser/
├── settings/route.js            # GET/POST settings
├── run/route.js                 # POST trigger run
├── runs/route.js                # GET list runs
├── runs/[id]/route.js           # GET run details
├── issues/route.js              # GET list issues
├── issues/[id]/route.js         # GET issue details
├── issues/[id]/dismiss/route.js # POST dismiss issue
├── issues/by-item/route.js      # GET issues for specific item
├── suggestions/route.js         # GET list suggestions
├── suggestions/[id]/approve/route.js   # POST approve
├── suggestions/[id]/reject/route.js    # POST reject
├── suggestions/[id]/apply/route.js     # POST apply
├── suggestions/batch-apply/route.js    # POST batch apply
└── dashboard/route.js           # GET summary stats

src/components/seo-analyser/
├── AnalyserSettings.jsx         # Settings tab content
├── AnalyserDashboard.jsx        # Dashboard widget
├── IssueAccordion.jsx           # Accordion for list pages
├── IssueList.jsx                # Issue list within accordion
├── SuggestionReview.jsx         # Suggestion review modal
├── SuggestionActions.jsx        # Approve/Reject buttons
└── SeoHealthBadge.jsx           # Health score badge

src/components/ui/
└── accordion.js                 # shadcn/ui accordion component
```

---

## 14. Implementation Phases

### Phase 1 — Database & Infrastructure (Week 1)
- Add Prisma models (6 new models + back-relations on WehowareClient)
- Run migration
- Create `src/lib/seo-analyser/` directory structure
- Implement `utils.js` (slug validation, HTML parsing helpers)

### Phase 2 — Scanner & Rule-Based Checks (Week 2)
- Implement `scanner.js` — fetch all content types
- Implement all rule-based checks from Section 4 (no LLM)
- Implement `internal-links.js` — build linking graph
- Create API routes for settings, issues, dashboard
- Add settings tab to SEO admin page

### Phase 3 — LLM Analysis (Week 3)
- Install `openai` npm package
- Implement `llm-analyzer.js` — AEO, GEO, SXO, E-E-A-T, SERP features, semantic relevance analysis
- Implement `suggestion-generator.js` — generate suggested fixes for all issue categories
- Implement `keyword-sync.js` — sync to WehowareSeoKeywordResearch
- Add circuit breaker, rate limiter, PII scrubber (shared with blog agent)

### Phase 3.5 — Advanced Analysis Modules (Week 3.5)
- Implement `readability.js` — Flesch score, sentence length, passive voice, transition words
- Implement `freshness.js` — staleness, outdated dates/statistics, decay detection
- Implement `technical-seo.js` — URL optimization, indexability, page depth, HTTPS
- Implement `web-vitals.js` — image dimensions, lazy load, format, CLS indicators
- Implement `rich-snippets.js` — Review, Organization, LocalBusiness, Event, FAQ, HowTo schema validation
- Implement `tfidf.js` — TF-IDF computation, term-document matrix, semantic relevance
- Implement `duplicate-detector.js` — MinHash/SimHash duplicate/near-duplicate detection
- Implement `serp-features.js` — PAA, image pack, video, featured snippet format
- Implement `multimedia-seo.js` — image filenames, titles, captions, video transcripts

### Phase 4 — UI Integration (Week 4)
- Create `accordion.js` shadcn/ui component
- Create `IssueAccordion.jsx`, `IssueList.jsx`, `SuggestionReview.jsx`
- Integrate accordion into blog list page
- Integrate accordion into service list page
- Integrate accordion into inventory list page
- Create dashboard widget with charts

### Phase 5 — Cron & Orchestration (Week 5)
- Implement `analyser.js` — main orchestrator with 10-step pipeline
- Implement `cron.js` — cron dispatcher
- Register in `JOBS` registry
- Add schedule calculation logic
- Add stale run cleanup
- Add manual run trigger API

### Phase 6 — Suggestion Application (Week 6)
- Implement suggestion application logic (Section 10)
- Create approval/rejection API routes
- Implement batch apply
- Add SEO score recompute after applying
- Add suggestion expiry job

### Phase 7 — Testing & Polish (Week 7)
- Unit tests for scanner, LLM analyzer, suggestion generator
- Integration tests for full pipeline
- Load test with 500+ items
- Add data retention cleanup job
- Documentation

---

## 15. Testing Strategy

### Unit Tests
```
tests/seo-analyser/
├── scanner.test.mjs              # Rule-based check accuracy
├── llm-analyzer.test.mjs         # LLM response parsing + validation
├── suggestion-generator.test.mjs # Suggestion generation
├── internal-links.test.mjs       # Link graph building + orphan detection
├── keyword-sync.test.mjs         # Keyword sync to research table
├── report.test.mjs               # Report compilation
├── cron.test.mjs                 # Cron dispatcher + schedule calculation
├── apply-suggestion.test.mjs     # Suggestion application + SEO score recompute
├── readability.test.mjs          # Flesch score, sentence length, passive voice
├── freshness.test.mjs            # Staleness, outdated dates detection
├── technical-seo.test.mjs        # URL optimization, indexability, HTTPS checks
├── web-vitals.test.mjs           # Image dimensions, lazy load, format detection
├── rich-snippets.test.mjs        # Schema validation for all rich result types
├── tfidf.test.mjs                # TF-IDF computation, term-document matrix
├── duplicate-detector.test.mjs   # MinHash/SimHash similarity detection
├── serp-features.test.mjs        # PAA, snippet format, table/list detection
├── multimedia-seo.test.mjs       # Image filenames, titles, captions, video
└── api-routes.test.mjs           # API route tests
```

### Critical Test Scenarios
- Client with 0 content items → should complete with 0 issues
- Client with 500+ blogs → pagination + timeout handling
- LLM returns invalid JSON → validator catches, retries
- LLM returns hallucinated suggestions → PII check, schema validation
- Concurrent runs for same client → lock token prevents
- Suggestion applied but item deleted between approve and apply → graceful error
- Cron replay → idempotency check via nextRunAt
- All content has perfect SEO → 0 issues, run succeeds
- All content has zero SEO fields → maximum issues, run succeeds
- Two blogs with 90% identical content → duplicate-detector flags correctly
- TF-IDF on 500 items → completes without memory overflow
- Content with 0 readability score → flagged as low_readability_score
- Content not updated in 2 years → flagged as stale_content
- URL with uppercase + underscores → flagged correctly
- Images without width/height → flagged as CLS risk
- Blog with FAQs but no FAQPage JSON-LD → flagged as missing_faqpage_schema

---

## 16. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| LLM hallucination in suggestions | Validator + human approval queue before any change applied |
| Token cost explosion | `gpt-4o-mini` for analysis, batch 5 items/call, max 80K tokens/run, rule-based checks use 0 tokens |
| Duplicate detection memory (500+ items) | Use MinHash/SimHash (O(n) not O(n²)), cap pairwise comparisons at 500 items |
| TF-IDF memory on large corpus | Use sparse term-document matrix, cap vocabulary at 10,000 terms |
| Rich snippet schema validation | Use JSON-LD parser, validate against schema.org types |
| Readability on non-English content | Skip Flesch score if language != en, use language-appropriate formula |
| Vercel timeout (300s) | 1 client per cron invocation, max 500 items/run, stale run cleanup |
| Concurrent runs | Lock token + active run check |
| Content deleted during analysis | Graceful error handling, skip deleted items |
| Suggestion applied to wrong item | Validate itemType + itemId match before applying |
| Large content causes token overflow | Truncate content to 8000 chars before LLM call |
| Broken internal link false positives | Validate slugs against DB, not just URL pattern |
| Keyword cannibalization false positives | Use exact keyword match, not fuzzy |
| Schedule drift | Recalculate nextRunAt after each run, not at fixed intervals |

---

## 17. Cost Estimates

| Operation | Token Usage | Cost (gpt-4o-mini) | Cost (gpt-4o) |
|-----------|-------------|---------------------|----------------|
| Analyze 1 item | ~3000 tokens | ~$0.00045 | ~$0.015 |
| Analyze 100 items (batched 5/call) | ~60,000 tokens | ~$0.009 | ~$0.30 |
| Generate 50 suggestions | ~25,000 tokens | N/A | ~$0.125 |
| Full run (100 items + 50 suggestions) | ~85,000 tokens | ~$0.009 + $0.125 = ~$0.13 | |
| Monthly (4 runs × 100 items) | ~340,000 tokens | ~$0.52/month | |

**Note**: Costs scale linearly with item count. Rule-based checks (E-E-A-T, readability, freshness, URL, indexability, Core Web Vitals, rich snippets, SERP features, multimedia, duplicate detection, TF-IDF) consume **zero tokens** — only LLM-powered analysis (Step 4) and suggestion generation (Step 5) use tokens. For clients with 500+ items, consider running analysis on a subset (e.g., only items modified since last run).

---

## 18. Production Readiness Checklist

- [ ] All 6 Prisma models have `client WehowareClient @relation` with `onDelete: Cascade`
- [ ] All API routes use `withAuth` with `allowedRoles`
- [ ] `clientId` always from auth context, never from request body
- [ ] LLM model versions pinned (no unversioned aliases)
- [ ] Circuit breaker for LLM calls
- [ ] Rate limiter for manual run triggers
- [ ] PII scrubbing before LLM calls
- [ ] Token budget enforcement per run
- [ ] Run timeout (5 minutes) with stale run cleanup
- [ ] Concurrency control via lock token
- [ ] Idempotent cron dispatcher (check nextRunAt before running)
- [ ] Suggestion application sanitizes HTML content
- [ ] SEO score recomputed after suggestion applied
- [ ] Data retention: issues 180d, logs 90d, suggestions 30d
- [ ] Accordion component accessible (ARIA attributes from Radix)
- [ ] Batch fetch issues for list pages (avoid N+1 queries)
- [ ] Graceful handling of deleted items during analysis
- [ ] Validator for LLM output (JSON schema + content safety)
- [ ] Error isolation per client in cron dispatcher
- [ ] Vercel `maxDuration = 300` on cron route
- [ ] Per-item "Check Now" validates itemId belongs to client before running
- [ ] Per-item run rate-limited: 1 per item per 2 minutes
- [ ] Single-item run skips cross-content analysis (Step 6) and keyword sync (Step 7)
- [ ] Accordion "Check Now" button shows loading state + auto-refreshes on completion
- [ ] Single-item run supersedes previous open issues for that item (mark old as `superseded`)
- [ ] Duplicate detection uses MinHash/SimHash (not O(n²) pairwise comparison)
- [ ] TF-IDF uses sparse matrix, caps vocabulary at 10,000 terms
- [ ] Readability checks skip non-English content or use language-appropriate formula
- [ ] Rich snippet schema validated against schema.org types
- [ ] Freshness check uses updatedAt, not createdAt
- [ ] URL optimization checks slug format (lowercase, hyphens, keywords)
- [ ] Core Web Vitals checks image dimensions in HTML content (not just media library)
- [ ] Mixed content detection scans for HTTP:// in content body
- [ ] SERP feature checks identify PAA opportunities via LLM + content structure
