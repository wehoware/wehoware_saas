// src/lib/ai/baddy-assistant.js
// Baddy AI assistant integration for the WeHowAre SaaS.
//
// SECURITY: This module enforces strict client isolation. The AI assistant
// can ONLY access data for the user's activeClientId. All tool calls are
// executed server-side with the user's clientId — the LLM never sees
// raw database access, only the results of scoped queries.
//
// CRITICAL RULE: NEVER delete data. The tool set exposed to the LLM
// contains read (GET), create (POST), and update (PATCH/PUT) operations.
// No DELETE or destructive operations are available.

import { prisma } from "@/lib/prisma";

// vLLM endpoint (running on the AI Brain)
const VLLM_BASE_URL = process.env.VLLM_BASE_URL || "http://localhost:18020/v1";
const VLLM_API_KEY = process.env.VLLM_API_KEY || "wehoware-vllm-2026";
const VLLM_MODEL = process.env.VLLM_MODEL || "qwen3.8-27b";

// Mem0 memory bridge endpoint (running on the AI Brain)
const MEM0_BRIDGE_URL = process.env.MEM0_BRIDGE_URL || "http://localhost:9097";

/**
 * Search Mem0 for relevant memories scoped to user + client.
 */
async function searchMemories(userId, clientId, query) {
  try {
    const response = await fetch(`${MEM0_BRIDGE_URL}/memory/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, client_id: clientId, query, limit: 5 }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return "";
    const data = await response.json();
    const memories = data.memories?.results || data.memories || [];
    if (!memories.length) return "";
    const memoryTexts = memories.map(m => m.memory || m.text || "").filter(Boolean);
    if (!memoryTexts.length) return "";
    return `\n\n## What you remember about this user:\n${memoryTexts.map(t => `- ${t}`).join("\n")}\n`;
  } catch (err) {
    console.error("[baddy] Memory search failed (non-fatal):", err.message);
    return "";
  }
}

/**
 * Store a conversation in Mem0 for future recall.
 */
async function storeConversationMemory(userId, clientId, userMessage, assistantResponse) {
  try {
    await fetch(`${MEM0_BRIDGE_URL}/memory/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        client_id: clientId,
        messages: [
          { role: "user", content: userMessage },
          { role: "assistant", content: assistantResponse },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    console.error("[baddy] Memory store failed (non-fatal):", err.message);
  }
}

/**
 * Build the system prompt for the AI assistant, scoped to the user's client.
 * Includes full database architecture knowledge so Baddy knows all tables,
 * fields, and relationships.
 */
export function buildSystemPrompt(user, client) {
  const clientName = client?.companyName || "Unknown Client";
  const clientDomain = client?.domain || "N/A";
  const clientIndustry = client?.industry || "N/A";
  const userName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;
  const userRole = user.role;
  const clientRole = user.activeClientRole || user.role;

  return `You are Baddy, the AI assistant for ${clientName} (domain: ${clientDomain}, industry: ${clientIndustry}).

You are integrated directly into the WeHowAre SaaS platform. You help the user "${userName}" (role: ${userRole}, client role: ${clientRole}) manage their business data.

## CRITICAL RULES — ALWAYS ENFORCE:
1. **NEVER delete data.** You cannot and must not delete any records. If a user asks to delete something, refuse and explain that deletion is not permitted by policy. You CAN create and update records.
2. **STRICT CLIENT ISOLATION.** You can ONLY access data for ${clientName}. You must never reference, query, or expose data belonging to other clients.
3. **Be helpful but safe.** You can create, read, and update records across ALL modules. You cannot delete records or access other clients' data.

## What you can do (90+ tools across all modules):
- **CRM**: Contacts (create/update/search), Deals (create/update), Pipelines, Stages, Activities, Contact Lists
- **Tasks**: Create/update tasks, subtasks, comments, time entries, activities
- **Social Media**: Create/schedule/publish posts, manage accounts, view inbox, reply to messages
- **Invoices**: Create/update invoices, line items, settings
- **Appointments**: Create/update appointments, appointment types
- **Blogs**: Create/update blogs, categories, FAQs
- **Services**: Create/update services, categories, FAQs
- **Forms**: Create/view forms, fields, submissions
- **Reports**: Generate reports, view templates, team performance
- **Inventory**: Items, categories, stock movements, settings
- **Goals**: Create/update goals, key results, link tasks
- **Vendors/Customers**: Create/update vendors and customers
- **Banking**: Bank accounts, transactions, bills, bill payments
- **Expenses**: Create/view expenses, approve/reject
- **Users/Team**: View team members, user management
- **Client/Settings**: View/update client info, settings
- **SEO**: Keywords, analyser runs, issues, suggestions, settings
- **Daily Reports**: View/create daily work reports, analytics
- **Inquiries**: View inquiries
- **Integrations**: View integration status and logs

## Database Architecture Reference:

### Core Tables:
- **wehoware_clients**: id, companyName, contactPerson, contactNumber, email, address, website, industry, domain, active, publicSlug
- **wehoware_profiles**: id, email, passwordHash, firstName, lastName, avatarUrl, role (admin/employee/client), clientId, settings (JSON), lastReminderSentAt
- **wehoware_user_clients**: id, userId, clientId, role (client/manager/editor/viewer), isPrimary, active
- **wehoware_user_invites**: id, email, clientId, role, invitedBy, token, status (pending/accepted/expired), expiresAt

### CRM Tables:
- **wehoware_crm_contacts**: id, clientId, type (Lead/Customer), status (New/Contacted/Qualified/Converted/Lost), source (Manual/Website/Form/Social/Appointment/Inquiry), firstName, lastName, email, phone, company, jobTitle, avatarUrl, website, linkedinUrl, socialProfiles (JSON), socialPlatform, notes, tags (JSON), customFields (JSON), assignedTo, active, createdBy, updatedBy
- **wehoware_crm_deals**: id, clientId, pipelineId, stageId, contactId, title, value (Decimal), currency, status (Open/Won/Lost), expectedCloseDate, closedAt, closedReason, notes, tags (JSON), assignedTo, active, createdBy, updatedBy
- **wehoware_crm_pipelines**: id, clientId, name, description, isDefault, active, createdBy, updatedBy
- **wehoware_crm_pipeline_stages**: id, pipelineId, name, stageType (Lead/Qualified/Proposal/Negotiation/Won/Lost/Custom), displayOrder, color, active, createdBy, updatedBy
- **wehoware_crm_activities**: id, clientId, contactId, dealId, type (Call/Email/Meeting/Note/Task), direction (Inbound/Outbound/Internal), title, description, scheduledAt, completedAt, durationMinutes, metadata (JSON), active, createdBy, updatedBy
- **wehoware_crm_contact_lists**: id, clientId, name, description, color, filters (JSON), active, createdBy, updatedBy
- **wehoware_crm_contact_list_memberships**: id, listId, contactId, clientId, createdAt

### Task Tables:
- **wehoware_tasks**: id, clientId, title, description, dueDate, priority (Low/Medium/High), status (To_Do/In_Progress/Done/Backlog), assigneeId, createdBy, subtaskCount, subtaskCompleted, estimatedHours, actualHours, remainingHours, storyPoints
- **wehoware_subtasks**: id, taskId, title, description, status, assigneeId, orderIndex, completedAt, createdBy
- **wehoware_task_comments**: id, taskId, userId, content, createdAt
- **wehoware_task_activities**: id, taskId, userId, activityType, details (JSON), createdAt
- **wehoware_task_time_entries**: id, taskId, subtaskId, userId, hoursSpent, notes, trackedDate, createdAt

### Content Tables:
- **wehoware_blogs**: id, clientId, title, slug, excerpt, content, thumbnail, thumbnailAlt, status (Draft/Published/Archived), categoryId, featured, readTime, views, likes, tags (JSON), publishedAt, scheduledPublishAt, metaTitle, metaDescription, metaKeywords, canonicalUrl, robotsMeta, schemaType, seoScore, targetKeywords (JSON), showToc, showAuthorBox, ctaHeading, ctaBody, ctaButtonText, ctaButtonUrl, allowSocialShare, createdBy, updatedBy
- **wehoware_blog_categories**: id, clientId, name, slug, description, iconUrl, active, createdBy, updatedBy
- **wehoware_blog_faqs**: id, clientId, blogId, question, answer, displayOrder, active
- **wehoware_blog_versions**: id, blogId, versionNum, title, content, excerpt, status, savedBy, savedAt
- **wehoware_services**: id, clientId, title, slug, description, content, thumbnail, thumbnailAlt, active, categoryId, fee (Decimal), feeCurrency, serviceCode, featured, rating, reviewsCount, tags (JSON), duration, scheduledPublishAt, metaTitle, metaDescription, metaKeywords, canonicalUrl, robotsMeta, schemaType, seoScore, targetKeywords (JSON), ctaHeading, ctaBody, ctaButtonText, ctaButtonUrl, allowSocialShare, views, createdBy, updatedBy
- **wehoware_service_categories**: id, clientId, name, slug, description, iconUrl, active, createdBy, updatedBy
- **wehoware_service_faqs**: id, clientId, serviceId, question, answer, displayOrder, active
- **wehoware_static_pages**: id, clientId, pageSlug, title, content, templateName, layout (JSON), metaTitle, metaDescription, metaKeywords, isActive

### Social Media Tables:
- **wehoware_social_platforms**: id, name, platformCode, logoUrl, oauthConfig (JSON), rateLimits (JSON), active
- **wehoware_social_accounts**: id, clientId, platformId, accountName, accountHandle, accountId, accessToken, refreshToken, tokenExpiresAt, profileData (JSON), status (Active/Disconnected/Error/Paused), lastSyncedAt, syncError, createdBy, updatedBy
- **wehoware_social_posts**: id, clientId, title, content, mediaUrls (JSON), hashtags (JSON), scheduledFor, publishedAt, status (Draft/Scheduled/Publishing/Published/PartiallyPublished/Failed/Cancelled), postType (Text/Image/Video/Carousel/Story/Reel), targetAccounts (JSON), publishResults (JSON), errorDetails (JSON), createdBy, updatedBy
- **wehoware_social_account_posts**: id, postId, accountId, platformPostId, platformUrl, status (Pending/Publishing/Published/Failed/Retrying), publishedAt, errorDetails (JSON), metrics (JSON)
- **wehoware_social_post_analytics**: id, accountPostId, metricType, metricValue, recordedAt
- **wehoware_social_inbox_conversations**: id, clientId, accountId, platformCode, platformConversationId, participantName, participantHandle, participantAvatar, participantId, lastMessageAt, lastMessagePreview, unreadCount, status (Open/Archived), metadata (JSON), lastSyncedAt
- **wehoware_social_inbox_messages**: id, conversationId, platformMessageId, direction (Inbound/Outbound), senderName, senderHandle, senderAvatar, content, mediaUrls (JSON), isRead, sentAt, metadata (JSON)

### Finance Tables:
- **wehoware_invoices**: id, clientId, customerId, invoiceNumber, clientName, clientEmail, invoiceDate, dueDate, status (Draft/Pending/Paid/Overdue/Cancelled), subtotal, taxRate, taxAmount, total, currency, notes, paidAt, amountPaid, reconciledAt, billingStartDate, billingEndDate, shareToken, createdBy, updatedBy
- **wehoware_invoice_line_items**: id, invoiceId, clientId, description, quantity, unitPrice, total, sortOrder
- **wehoware_invoice_settings**: id, clientId, companyName, companyEmail, companyPhone, companyAddress, taxNumber, logoUrl, invoiceFormat, nextInvoiceNumber, defaultCurrency, defaultTaxRate, defaultNotes, templateConfig (JSON), templateId
- **wehoware_expenses**: id, clientId, submittedBy, description, category (OfficeSupplies/Travel/Meals/ProfessionalServices/Software/Hardware/Marketing/Utilities/Rent/Other), amount, taxAmount, currency, expenseDate, receiptUrl, status (Pending/Approved/Rejected/Reimbursed), approvedBy, approvedAt, rejectedReason, reimbursedAt, notes, billId
- **wehoware_transactions**: id, clientId, transactionDate, description, amount, type (Income/Expense/Transfer/Other), status (Pending/Completed/Failed), reference, currency, notes, invoiceId, bankAccountId, direction (Incoming/Outgoing), matchedAmount, reconciliation (Unreconciled/Matched/Confirmed), source (Manual/Bank/Invoice/Bill), sourceId, createdBy, updatedBy
- **wehoware_bills**: id, clientId, vendorId, billNumber, reference, billDate, dueDate, status (Draft/Pending/PartiallyPaid/Paid/Overdue), subtotal, taxRate, taxAmount, total, amountPaid, currency, notes, paidAt, createdBy, updatedBy
- **wehoware_bill_line_items**: id, billId, clientId, description, quantity, unitPrice, total, sortOrder
- **wehoware_bill_payments**: id, billId, clientId, paymentDate, amount, method, reference, notes, bankAccountId, createdBy
- **wehoware_vendors**: id, clientId, name, contactPerson, email, phone, address, taxNumber, website, notes, active, createdBy, updatedBy
- **wehoware_customers**: id, clientId, name, contactPerson, email, phone, billingAddress, shippingAddress, taxNumber, website, paymentTerms, currency, notes, active, createdBy, updatedBy
- **wehoware_bank_accounts**: id, clientId, name, institutionName, type (Checking/Savings/Credit), mask, currency, balance, plaidItemId, plaidAccountId, accessTokenEnc, lastSyncAt, isActive, createdBy
- **wehoware_bank_statement_entries**: id, clientId, plaidItemId, bankAccountId, source (Plaid/Manual), externalId, postedAt, amount, currency, description, merchantName, category, pending, rawJson (JSON), reconciliation, matchedTransactionId, importedAt
- **wehoware_accounting_settings**: id, clientId, defaultCurrency, defaultTaxRate, fiscalYearStart, billNumberFormat, nextBillNumber, expenseCategoriesJson (JSON), reminderEnabled, reminderDaysBefore

### Inventory Tables:
- **wehoware_inventory_items**: id, clientId, categoryId, title, slug, type (product/service), sku, description, content, thumbnail, thumbnailAlt, price (Decimal), currency, priceVisible, quantity, reorderThreshold, status, tags (JSON), featured, active, attributes (JSON), images (JSON), videos (JSON), metaTitle, metaDescription, metaKeywords, canonicalUrl, robotsMeta, schemaType, seoScore, targetKeywords (JSON), ctaHeading, ctaBody, ctaButtonText, ctaButtonUrl, allowSocialShare, views, createdBy, updatedBy
- **wehoware_inventory_categories**: id, clientId, name, slug, description, iconUrl, active, createdBy, updatedBy
- **wehoware_inventory_stock_movements**: id, itemId, clientId, movementType, quantityChange, quantityAfter, reason, createdBy, createdAt
- **wehoware_inventory_settings**: id, clientId, defaultCurrency, lowStockThreshold, autoArchiveDays, enableStockTracking, enableLowStockAlerts, enablePublicListing, enableInquiries, enableTestDrive, defaultItemType, listingPageTitle, listingPageDescription, contactEmail, contactPhone, businessHours, address, socialFacebook, socialInstagram, socialTwitter, socialYoutube, seoTitle, seoDescription, seoKeywords

### Appointment Tables:
- **wehoware_appointments**: id, clientId, appointmentTypeId, guestName, guestEmail, guestPhone, scheduledAt, status (Pending/Confirmed/Cancelled/Completed/NoShow), location, meetingLink, address, notes, timezone, createdBy, updatedBy, bookingToken
- **wehoware_appointment_types**: id, clientId, name, description, duration, color, slug, active, requiresConfirmation, price (Decimal), currency, createdBy

### Form Tables:
- **wehoware_form_templates**: id, clientId, title, description, status (Active/Inactive/Draft), successMessage, redirectUrl, notificationEmails (JSON), createdBy, updatedBy
- **wehoware_form_fields**: id, clientId, formTemplateId, fieldType (text/textarea/email/phone/number/select/checkbox/radio/date/file/url), label, placeholder, helpText, required, fieldOrder, defaultValue, options (JSON), validationRules (JSON), cssClass
- **wehoware_form_submissions**: id, clientId, formTemplateId, submissionData (JSON), submittedAt, ipAddress, userAgent, status (New/Reviewed/Converted), notes, tags (JSON), updatedBy

### Goal Tables:
- **wehoware_goals**: id, clientId, title, description, type (Goal/Objective), status (Not_Started/In_Progress/Completed/On_Hold/Cancelled), startDate, endDate, progressPercentage, ownerId, createdBy
- **wehoware_goal_key_results**: id, goalId, title, targetValue (Decimal), currentValue (Decimal), unit, weight, status (Not_Started/In_Progress/Completed/At_Risk)
- **wehoware_goal_task_links**: id, goalId, taskId, contributionPct
- **wehoware_achievements**: id, clientId, userId, title, description, badgeType, achievedAt

### Report Tables:
- **wehoware_reports**: id, clientId, templateId, title, description, reportData (JSON), dateRangeStart, dateRangeEnd, status (Draft/Generated/Scheduled/Archived), isScheduled, scheduleFrequency, lastGeneratedAt, nextGenerationAt, createdBy, updatedBy
- **wehoware_report_templates**: id, clientId, title, description, reportType, layout (JSON), components (JSON), isSystemTemplate, createdBy, updatedBy
- **wehoware_report_shares**: id, clientId, reportId, accessToken, recipientEmail, recipientName, message, expiresAt, lastAccessedAt, createdBy

### SEO Tables:
- **wehoware_client_keywords**: id, clientId, employeeId, keywords (JSON)
- **wehoware_seo_analyser_runs**: id, clientId, contentType, contentId, contentSlug, contentTitle, status, scoreBefore, scoreAfter, issuesCount, suggestionsCount, tokensUsed, llmProvider, llmModel, errorMessage, createdAt, completedAt
- **wehoware_seo_analyser_issues**: id, clientId, runId, itemType, itemId, itemTitle, itemSlug, category, issueType, severity, title, description, currentValue, recommendedValue, status
- **wehoware_seo_analyser_suggestions**: id, clientId, issueId, itemType, itemId, fixType, fieldName, action, currentValue, suggestedValue, explanation, status, approvedBy, approvedAt, rejectedBy, rejectedAt, appliedBy, appliedAt, appliedResult
- **wehoware_seo_analyser_settings**: id, clientId, enabled, scheduleFrequency, scanBlogs, scanServices, scanInventory, scanStaticPages, minSeoScore, checkMetaTags, checkSchema, checkInternalLinks, checkContentStructure, checkAeo, checkGeo, checkSxo, checkKeywordUsage, checkCanonical, checkOpenGraph, checkTwitterCards, checkRobotsMeta, checkImageAlt, checkHeadingStructure, checkEeat, checkReadability, checkContentFreshness, checkUrlOptimization, checkIndexability, checkDuplicateContent, checkPageDepth, checkHttps, checkWebVitals, checkRichSnippets, checkTfidf, checkContentCoverage, checkSerpFeatures, checkMultimediaSeo, autoSuggestFixes, language
- **wehoware_seo_llm_providers**: id, clientId, providerName, isActive, priority, isEnabled, apiKeyEncrypted, healthStatus, totalRequests, totalTokensUsed, analysisModel, suggestionModel
- **wehoware_seo_llm_settings**: id, clientId, providerMode, manualProvider, autoFailover, timeoutMs, circuitThreshold, circuitCooldownMs

### Daily Report Tables:
- **wehoware_daily_work_reports**: id, userId, clientId, creatorRole, reportDate, startTime, endTime, summary, totalHours, status (draft/submitted/approved/rejected), submittedBy, submittedAt
- **wehoware_daily_work_report_items**: id, reportId, taskId, subtaskId, startTime, endTime, hoursWorked, description, sequence

### Other Tables:
- **wehoware_inquiries**: id, clientId, name, email, phone, subject, message, serviceId, status (New/Contacted/Converted/Closed), ipAddress, userAgent, updatedBy
- **wehoware_integrations**: id, clientId, providerId, name, apiKey, apiSecret, accessToken, refreshToken, tokenExpiresAt, config (JSON), status (Active/Inactive/Error/Expired), lastSyncAt, syncFrequency, createdBy, updatedBy
- **wehoware_integration_logs**: id, clientId, integrationId, operation, status (Success/Failed/InProgress), details (JSON), startTime, endTime, recordsProcessed, errorMessage
- **wehoware_settings**: id, clientId, settingKey, settingValue, settingGroup
- **wehoware_notification_preferences**: id, clientId, preferenceKey, description, enabled
- **wehoware_reminder_rules**: id, clientId, name, reminderType, triggerDays, template, active, lastRunAt, createdBy
- **wehoware_email_logs**: id, clientId, toAddress, fromAddress, subject, template, bodyText, bodyHtml, context (JSON), status (Queued/Sent/Failed), providerMessageId, errorMessage, attemptCount, sentAt
- **wehoware_attachments**: id, clientId, billId, expenseId, fileName, fileUrl, fileType, fileSize
- **wehoware_agent_sessions**: id, clientId, userId, title, status, metadata (JSON)
- **wehoware_agent_messages**: id, sessionId, clientId, userId, role, content, toolCalls (JSON), toolResults (JSON), steps (JSON), totalTimeMs

## How to respond:
- Be concise and direct
- **Use rich Markdown formatting** for all responses:
  - Use **tables** for tabular data (contacts, deals, invoices, tasks)
  - Use **bold** for key metrics, numbers, and important alerts
  - Use **headers** (##, ###) to organize longer responses into sections
  - Use **bullet lists** for summaries and **numbered lists** for steps
  - Use **emojis** sparingly to add personality (📊 for dashboards, ⏰ for overdue, ✅ for completed, ⚠️ for warnings)
  - Use \`inline code\` for field names, IDs, and technical values
- When showing data, ALWAYS use markdown tables — never plain text columns
- When creating records, confirm what you created with a summary table
- If you don't have enough data, say so
- Never make up data — if a tool returns empty, say "No records found"
- For dashboard summaries, use a header with the client name and a summary table
- For overdue items, use ⚠️ and red text emphasis (bold)
- Keep responses scannable — use sections and tables, not walls of text

## Memory:
You have persistent memory across conversations. If the system prompt includes a "What you remember about this user" section, use that context to personalize your responses. You remember user preferences, past requests, and important context. If a user tells you a preference, acknowledge that you'll remember it.

You are part of the WeHowAre platform. Be professional, helpful, and always prioritize data safety.`;
}

/**
 * Tool definitions exposed to the LLM.
 * These are the ONLY operations the AI can perform.
 * All are scoped to the user's activeClientId.
 * NO DELETE operations — only read, create, and update.
 */
export function getToolDefinitions() {
  return [
    // ═══════════════════════════════════════════════════════════════
    // CRM MODULE (12 tools)
    // ═══════════════════════════════════════════════════════════════
    {
      type: "function",
      function: {
        name: "get_crm_dashboard",
        description: "Get CRM dashboard statistics — contact counts by type/status, deal counts by status, pipeline value, activity stats",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "get_crm_contacts",
        description: "Get CRM contacts (leads and customers) with all fields. Returns up to 20 by default. Filter by type, status, source, or search term.",
        parameters: {
          type: "object",
          properties: {
            search: { type: "string", description: "Search term (firstName, lastName, email, company, phone)" },
            type: { type: "string", enum: ["Lead", "Customer"], description: "Filter by contact type" },
            status: { type: "string", enum: ["New", "Contacted", "Qualified", "Converted", "Lost"], description: "Filter by status" },
            source: { type: "string", enum: ["Manual", "Website", "Form", "Social", "Appointment", "Inquiry"], description: "Filter by source" },
            limit: { type: "integer", description: "Max results (default 20, max 50)" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_crm_contact",
        description: "Create a new CRM contact with full field access. Dedup by email within same client.",
        parameters: {
          type: "object",
          properties: {
            first_name: { type: "string", description: "First name" },
            last_name: { type: "string", description: "Last name" },
            email: { type: "string", description: "Email address" },
            phone: { type: "string", description: "Phone number" },
            company: { type: "string", description: "Company name" },
            job_title: { type: "string", description: "Job title" },
            website: { type: "string", description: "Website URL" },
            linkedin_url: { type: "string", description: "LinkedIn profile URL" },
            type: { type: "string", enum: ["Lead", "Customer"], description: "Contact type. Default: Lead" },
            status: { type: "string", enum: ["New", "Contacted", "Qualified", "Converted", "Lost"], description: "Status. Default: New" },
            source: { type: "string", enum: ["Manual", "Website", "Form", "Social", "Appointment", "Inquiry"], description: "Lead source. Default: Manual" },
            notes: { type: "string", description: "Notes about the contact" },
            tags: { type: "array", items: { type: "string" }, description: "Tags for categorization" },
            assigned_to: { type: "string", description: "User ID to assign this contact to" },
          },
          required: ["first_name", "last_name", "email"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_crm_contact",
        description: "Update an existing CRM contact. Can update any field including status, type, notes, tags, assignment.",
        parameters: {
          type: "object",
          properties: {
            contact_id: { type: "string", description: "The contact ID to update" },
            first_name: { type: "string" },
            last_name: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            company: { type: "string" },
            job_title: { type: "string" },
            website: { type: "string" },
            linkedin_url: { type: "string" },
            type: { type: "string", enum: ["Lead", "Customer"] },
            status: { type: "string", enum: ["New", "Contacted", "Qualified", "Converted", "Lost"] },
            source: { type: "string", enum: ["Manual", "Website", "Form", "Social", "Appointment", "Inquiry"] },
            notes: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            assigned_to: { type: "string" },
          },
          required: ["contact_id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_crm_deals",
        description: "Get CRM deals (sales opportunities) with full details. Filter by status.",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["Open", "Won", "Lost"], description: "Filter by status" },
            limit: { type: "integer", description: "Max results (default 20)" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_crm_deal",
        description: "Create a new CRM deal (sales opportunity) linked to a pipeline stage.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Deal title" },
            value: { type: "number", description: "Deal value" },
            currency: { type: "string", description: "Currency code (e.g. USD, CAD). Default: CAD" },
            pipeline_id: { type: "string", description: "Pipeline ID (use get_crm_pipelines to find)" },
            stage_id: { type: "string", description: "Stage ID (use get_crm_pipelines to find stages)" },
            contact_id: { type: "string", description: "Associated contact ID" },
            expected_close_date: { type: "string", description: "Expected close date (ISO date string)" },
            notes: { type: "string" },
            assigned_to: { type: "string", description: "User ID to assign to" },
          },
          required: ["title", "value", "pipeline_id", "stage_id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_crm_deal",
        description: "Update an existing CRM deal — change status, value, stage, close date, etc.",
        parameters: {
          type: "object",
          properties: {
            deal_id: { type: "string", description: "The deal ID to update" },
            title: { type: "string" },
            value: { type: "number" },
            currency: { type: "string" },
            stage_id: { type: "string", description: "Move to a different pipeline stage" },
            status: { type: "string", enum: ["Open", "Won", "Lost"] },
            expected_close_date: { type: "string" },
            closed_at: { type: "string", description: "Close date (set when status changes to Won/Lost)" },
            closed_reason: { type: "string" },
            notes: { type: "string" },
            assigned_to: { type: "string" },
          },
          required: ["deal_id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_crm_pipelines",
        description: "Get all CRM pipelines with their stages (for deal management)",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "get_crm_activities",
        description: "Get CRM activities (calls, emails, meetings, notes) for a contact or deal",
        parameters: {
          type: "object",
          properties: {
            contact_id: { type: "string", description: "Filter by contact ID" },
            deal_id: { type: "string", description: "Filter by deal ID" },
            limit: { type: "integer", description: "Max results (default 20)" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_crm_activity",
        description: "Create a CRM activity (call, email, meeting, note) linked to a contact or deal",
        parameters: {
          type: "object",
          properties: {
            contact_id: { type: "string", description: "Associated contact ID" },
            deal_id: { type: "string", description: "Associated deal ID" },
            direction: { type: "string", enum: ["Inbound", "Outbound", "Internal"], description: "Direction of interaction" },
            title: { type: "string", description: "Activity title (e.g. 'Follow-up call')" },
            description: { type: "string", description: "Activity details" },
            scheduled_at: { type: "string", description: "Scheduled date/time (ISO string)" },
            duration_minutes: { type: "integer", description: "Duration in minutes" },
          },
          required: ["title"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_crm_contact_lists",
        description: "Get CRM contact lists (segments/groups) for this client",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "add_contact_to_list",
        description: "Add a contact to a contact list",
        parameters: {
          type: "object",
          properties: {
            contact_id: { type: "string", description: "Contact ID to add" },
            list_id: { type: "string", description: "List ID to add to" },
          },
          required: ["contact_id", "list_id"],
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // TASKS MODULE (9 tools)
    // ═══════════════════════════════════════════════════════════════
    {
      type: "function",
      function: {
        name: "get_tasks",
        description: "Get tasks with optional status, priority, and assignee filters. Returns full task details.",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["To_Do", "In_Progress", "Done", "Backlog"] },
            priority: { type: "string", enum: ["Low", "Medium", "High"] },
            assignee_id: { type: "string", description: "Filter by assignee user ID" },
            limit: { type: "integer", description: "Max results (default 20)" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_task",
        description: "Create a new task with full field access.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Task title" },
            description: { type: "string", description: "Task description" },
            priority: { type: "string", enum: ["Low", "Medium", "High"], description: "Default: Medium" },
            status: { type: "string", enum: ["To_Do", "In_Progress", "Done", "Backlog"], description: "Default: To_Do" },
            due_date: { type: "string", description: "Due date (ISO date string)" },
            assignee_id: { type: "string", description: "User ID to assign to" },
            estimated_hours: { type: "number", description: "Estimated hours to complete" },
            story_points: { type: "integer", description: "Story points" },
          },
          required: ["title"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_task",
        description: "Update an existing task — change status, priority, assignee, due date, etc.",
        parameters: {
          type: "object",
          properties: {
            task_id: { type: "string", description: "The task ID to update" },
            title: { type: "string" },
            description: { type: "string" },
            priority: { type: "string", enum: ["Low", "Medium", "High"] },
            status: { type: "string", enum: ["To_Do", "In_Progress", "Done", "Backlog"] },
            due_date: { type: "string" },
            assignee_id: { type: "string" },
            estimated_hours: { type: "number" },
            story_points: { type: "integer" },
          },
          required: ["task_id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_task_stats",
        description: "Get task statistics — counts by status, priority, overdue count",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "get_task_comments",
        description: "Get comments on a task",
        parameters: {
          type: "object",
          properties: {
            task_id: { type: "string", description: "Task ID" },
          },
          required: ["task_id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "add_task_comment",
        description: "Add a comment to a task",
        parameters: {
          type: "object",
          properties: {
            task_id: { type: "string", description: "Task ID" },
            content: { type: "string", description: "Comment content" },
          },
          required: ["task_id", "content"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_subtasks",
        description: "Get subtasks for a task",
        parameters: {
          type: "object",
          properties: {
            task_id: { type: "string", description: "Task ID" },
          },
          required: ["task_id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_subtask",
        description: "Create a subtask under a parent task",
        parameters: {
          type: "object",
          properties: {
            task_id: { type: "string", description: "Parent task ID" },
            title: { type: "string", description: "Subtask title" },
            description: { type: "string" },
            assignee_id: { type: "string" },
          },
          required: ["task_id", "title"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "add_time_entry",
        description: "Log time spent on a task",
        parameters: {
          type: "object",
          properties: {
            task_id: { type: "string", description: "Task ID" },
            hours_spent: { type: "number", description: "Hours spent" },
            notes: { type: "string", description: "What was worked on" },
            tracked_date: { type: "string", description: "Date of work (ISO string). Default: today" },
          },
          required: ["task_id", "hours_spent"],
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // SOCIAL MEDIA MODULE (8 tools)
    // ═══════════════════════════════════════════════════════════════
    {
      type: "function",
      function: {
        name: "get_social_posts",
        description: "Get social media posts with optional status filter. Includes content, hashtags, scheduled time, publish results.",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["Draft", "Scheduled", "Publishing", "Published", "PartiallyPublished", "Failed", "Cancelled"] },
            limit: { type: "integer", description: "Max results (default 20)" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_social_post",
        description: "Create a social media post (draft or scheduled). Specify target accounts and content.",
        parameters: {
          type: "object",
          properties: {
            content: { type: "string", description: "Post content/caption" },
            title: { type: "string", description: "Internal title for the post" },
            media_urls: { type: "array", items: { type: "string" }, description: "Media URLs to attach" },
            hashtags: { type: "array", items: { type: "string" }, description: "Hashtags (without #)" },
            target_account_ids: { type: "array", items: { type: "string" }, description: "Account IDs to post to" },
            post_type: { type: "string", enum: ["Text", "Image", "Video", "Carousel", "Story", "Reel"], description: "Default: Text" },
            status: { type: "string", enum: ["Draft", "Scheduled"], description: "Default: Draft" },
            scheduled_for: { type: "string", description: "Schedule time (ISO string). Required if status=Scheduled" },
          },
          required: ["content"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_social_post",
        description: "Update a social media post (content, schedule, hashtags, etc.)",
        parameters: {
          type: "object",
          properties: {
            post_id: { type: "string", description: "Post ID to update" },
            content: { type: "string" },
            title: { type: "string" },
            media_urls: { type: "array", items: { type: "string" } },
            hashtags: { type: "array", items: { type: "string" } },
            target_account_ids: { type: "array", items: { type: "string" } },
            scheduled_for: { type: "string" },
            status: { type: "string", enum: ["Draft", "Scheduled", "Cancelled"] },
          },
          required: ["post_id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "publish_social_post",
        description: "Immediately publish a social media post to all target platforms",
        parameters: {
          type: "object",
          properties: {
            post_id: { type: "string", description: "Post ID to publish" },
          },
          required: ["post_id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_social_accounts",
        description: "Get connected social media accounts (Facebook, Instagram, Twitter, TikTok) with status and profile info",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "get_social_analytics",
        description: "Get aggregated social media analytics — active accounts, total posts, published posts, per-post metrics",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "get_social_inbox",
        description: "Get social media inbox conversations (DMs and comments) with unread counts",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Max results (default 20)" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "reply_social_inbox",
        description: "Reply to a social media inbox conversation",
        parameters: {
          type: "object",
          properties: {
            conversation_id: { type: "string", description: "Conversation ID to reply to" },
            content: { type: "string", description: "Reply message content" },
          },
          required: ["conversation_id", "content"],
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // INVOICE MODULE (6 tools)
    // ═══════════════════════════════════════════════════════════════
    {
      type: "function",
      function: {
        name: "get_invoices",
        description: "Get invoices with optional status filter. Includes line items, totals, tax, payment status.",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["Draft", "Pending", "Paid", "Overdue", "Cancelled"] },
            limit: { type: "integer", description: "Max results (default 20)" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_invoice",
        description: "Create a new invoice with line items. Invoice number auto-generated from settings.",
        parameters: {
          type: "object",
          properties: {
            customer_id: { type: "string", description: "Customer ID (from get_customers)" },
            client_name: { type: "string", description: "Bill-to name" },
            client_email: { type: "string", description: "Bill-to email" },
            invoice_date: { type: "string", description: "Invoice date (ISO). Default: today" },
            due_date: { type: "string", description: "Due date (ISO)" },
            currency: { type: "string", description: "Currency code. Default: CAD" },
            tax_rate: { type: "number", description: "Tax rate percentage. Default: 0" },
            notes: { type: "string" },
            line_items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  description: { type: "string" },
                  quantity: { type: "number" },
                  unit_price: { type: "number" },
                },
              },
              description: "Invoice line items",
            },
          },
          required: ["client_name", "due_date", "line_items"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_invoice",
        description: "Update an invoice — change status, dates, notes, etc. Can mark as Paid.",
        parameters: {
          type: "object",
          properties: {
            invoice_id: { type: "string", description: "Invoice ID" },
            status: { type: "string", enum: ["Draft", "Pending", "Paid", "Overdue", "Cancelled"] },
            due_date: { type: "string" },
            notes: { type: "string" },
            client_name: { type: "string" },
            client_email: { type: "string" },
            tax_rate: { type: "number" },
          },
          required: ["invoice_id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_invoice_line_items",
        description: "Get line items for a specific invoice",
        parameters: {
          type: "object",
          properties: {
            invoice_id: { type: "string", description: "Invoice ID" },
          },
          required: ["invoice_id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_invoice_settings",
        description: "Get invoice settings (company info, invoice format, default currency, tax rate)",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "update_invoice_settings",
        description: "Update invoice settings (company name, address, tax number, default currency, etc.)",
        parameters: {
          type: "object",
          properties: {
            company_name: { type: "string" },
            company_email: { type: "string" },
            company_phone: { type: "string" },
            company_address: { type: "string" },
            tax_number: { type: "string" },
            default_currency: { type: "string" },
            default_tax_rate: { type: "number" },
            default_notes: { type: "string" },
          },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // APPOINTMENT MODULE (5 tools)
    // ═══════════════════════════════════════════════════════════════
    {
      type: "function",
      function: {
        name: "get_appointments",
        description: "Get appointments with optional status filter. Includes guest info, scheduled time, location, meeting link.",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["Pending", "Confirmed", "Cancelled", "Completed", "NoShow"] },
            limit: { type: "integer", description: "Max results (default 20)" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_appointment",
        description: "Create a new appointment",
        parameters: {
          type: "object",
          properties: {
            guest_name: { type: "string", description: "Guest name" },
            guest_email: { type: "string", description: "Guest email" },
            guest_phone: { type: "string", description: "Guest phone" },
            scheduled_at: { type: "string", description: "Appointment date/time (ISO string)" },
            appointment_type_id: { type: "string", description: "Appointment type ID" },
            location: { type: "string", description: "Location (e.g. 'Office', 'Zoom')" },
            meeting_link: { type: "string", description: "Meeting URL (Zoom, Google Meet, etc.)" },
            notes: { type: "string" },
            timezone: { type: "string", description: "Timezone (e.g. 'America/Toronto')" },
            status: { type: "string", enum: ["Pending", "Confirmed"], description: "Default: Pending" },
          },
          required: ["guest_name", "guest_email", "scheduled_at"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_appointment",
        description: "Update an appointment — confirm, cancel, reschedule, add meeting link, etc.",
        parameters: {
          type: "object",
          properties: {
            appointment_id: { type: "string", description: "Appointment ID" },
            status: { type: "string", enum: ["Pending", "Confirmed", "Cancelled", "Completed", "NoShow"] },
            scheduled_at: { type: "string", description: "New date/time" },
            location: { type: "string" },
            meeting_link: { type: "string" },
            notes: { type: "string" },
          },
          required: ["appointment_id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_appointment_types",
        description: "Get appointment types (durations, prices, descriptions)",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "create_appointment_type",
        description: "Create a new appointment type",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Type name (e.g. '30-min consultation')" },
            description: { type: "string" },
            duration: { type: "integer", description: "Duration in minutes" },
            color: { type: "string", description: "Calendar color (hex). Default: #4f46e5" },
            price: { type: "number", description: "Price. Default: 0" },
            currency: { type: "string", description: "Default: CAD" },
            requires_confirmation: { type: "boolean", description: "Default: false" },
          },
          required: ["name", "duration"],
        },
      },
    },
    // Spread all additional module tools
    ...ALL_EXTRA_TOOLS,
  ];
}


// ═══════════════════════════════════════════════════════════════
// BLOG MODULE (5 tools) — appended to getToolDefinitions via separate export
// ═══════════════════════════════════════════════════════════════
const BLOG_TOOLS = [
    {
      type: "function",
      function: {
        name: "get_blogs",
        description: "Get blog posts with optional status filter. Includes title, slug, views, SEO score, category.",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["Draft", "Published", "Archived"] },
            limit: { type: "integer", description: "Max results (default 20)" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_blog",
        description: "Create a new blog post with full SEO fields",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Blog title" },
            slug: { type: "string", description: "URL slug (auto-generated from title if omitted)" },
            excerpt: { type: "string", description: "Short summary" },
            content: { type: "string", description: "Full blog content (HTML or Markdown)" },
            category_id: { type: "string", description: "Category ID" },
            status: { type: "string", enum: ["Draft", "Published", "Archived"], description: "Default: Draft" },
            featured: { type: "boolean", description: "Featured post. Default: false" },
            tags: { type: "array", items: { type: "string" } },
            meta_title: { type: "string", description: "SEO meta title" },
            meta_description: { type: "string", description: "SEO meta description" },
            meta_keywords: { type: "string", description: "SEO meta keywords" },
            canonical_url: { type: "string" },
            published_at: { type: "string", description: "Publish date (ISO). Required if status=Published" },
          },
          required: ["title"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_blog",
        description: "Update an existing blog post — content, SEO fields, status, etc.",
        parameters: {
          type: "object",
          properties: {
            blog_id: { type: "string", description: "Blog ID" },
            title: { type: "string" },
            slug: { type: "string" },
            excerpt: { type: "string" },
            content: { type: "string" },
            category_id: { type: "string" },
            status: { type: "string", enum: ["Draft", "Published", "Archived"] },
            featured: { type: "boolean" },
            tags: { type: "array", items: { type: "string" } },
            meta_title: { type: "string" },
            meta_description: { type: "string" },
            meta_keywords: { type: "string" },
            canonical_url: { type: "string" },
            published_at: { type: "string" },
          },
          required: ["blog_id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_blog_categories",
        description: "Get blog categories for this client",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "create_blog_category",
        description: "Create a new blog category",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Category name" },
            description: { type: "string" },
          },
          required: ["name"],
        },
      },
    },
];

// ═══════════════════════════════════════════════════════════════
// SERVICE MODULE (5 tools)
// ═══════════════════════════════════════════════════════════════
const SERVICE_TOOLS = [
    {
      type: "function",
      function: {
        name: "get_services",
        description: "Get services with optional status filter. Includes title, slug, fee, views, SEO score.",
        parameters: {
          type: "object",
          properties: {
            active: { type: "boolean", description: "Filter by active status" },
            limit: { type: "integer", description: "Max results (default 20)" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_service",
        description: "Create a new service with full SEO fields",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Service title" },
            slug: { type: "string", description: "URL slug (auto-generated if omitted)" },
            description: { type: "string", description: "Short description" },
            content: { type: "string", description: "Full service content (HTML or Markdown)" },
            category_id: { type: "string", description: "Category ID" },
            fee: { type: "number", description: "Service fee" },
            fee_currency: { type: "string", description: "Currency. Default: CAD" },
            service_code: { type: "string" },
            duration: { type: "string", description: "Service duration (e.g. '1 hour')" },
            active: { type: "boolean", description: "Default: true" },
            featured: { type: "boolean", description: "Default: false" },
            tags: { type: "array", items: { type: "string" } },
            meta_title: { type: "string" },
            meta_description: { type: "string" },
            meta_keywords: { type: "string" },
          },
          required: ["title"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_service",
        description: "Update an existing service",
        parameters: {
          type: "object",
          properties: {
            service_id: { type: "string", description: "Service ID" },
            title: { type: "string" },
            slug: { type: "string" },
            description: { type: "string" },
            content: { type: "string" },
            category_id: { type: "string" },
            fee: { type: "number" },
            fee_currency: { type: "string" },
            service_code: { type: "string" },
            duration: { type: "string" },
            active: { type: "boolean" },
            featured: { type: "boolean" },
            tags: { type: "array", items: { type: "string" } },
            meta_title: { type: "string" },
            meta_description: { type: "string" },
            meta_keywords: { type: "string" },
          },
          required: ["service_id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_service_categories",
        description: "Get service categories for this client",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "create_service_category",
        description: "Create a new service category",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Category name" },
            description: { type: "string" },
          },
          required: ["name"],
        },
      },
    },
];

// ═══════════════════════════════════════════════════════════════
// FORM MODULE (3 tools)
// ═══════════════════════════════════════════════════════════════
const FORM_TOOLS = [
    {
      type: "function",
      function: {
        name: "get_forms",
        description: "Get form templates with their fields and submission counts",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "get_form_submissions",
        description: "Get form submissions for a specific form template",
        parameters: {
          type: "object",
          properties: {
            form_id: { type: "string", description: "Form template ID" },
            status: { type: "string", enum: ["New", "Reviewed", "Converted"] },
            limit: { type: "integer", description: "Max results (default 20)" },
          },
          required: ["form_id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_form",
        description: "Create a new form template with fields",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Form title" },
            description: { type: "string" },
            success_message: { type: "string", description: "Message shown after submission" },
            notification_emails: { type: "array", items: { type: "string" }, description: "Emails to notify on submission" },
            fields: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field_type: { type: "string", enum: ["text", "textarea", "email", "phone", "number", "select", "checkbox", "radio", "date", "file", "url"] },
                  label: { type: "string" },
                  placeholder: { type: "string" },
                  required: { type: "boolean" },
                  field_order: { type: "integer" },
                  options: { type: "array", items: { type: "string" }, description: "Options for select/radio/checkbox" },
                },
              },
            },
          },
          required: ["title"],
        },
      },
    },
];

// ═══════════════════════════════════════════════════════════════
// REPORT MODULE (4 tools)
// ═══════════════════════════════════════════════════════════════
const REPORT_TOOLS = [
    {
      type: "function",
      function: {
        name: "get_reports",
        description: "Get reports for this client. Includes status, date range, schedule info.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Max results (default 20)" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_report_templates",
        description: "Get report templates available for this client",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "create_report",
        description: "Create a new report from a template",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Report title" },
            template_id: { type: "string", description: "Template ID" },
            description: { type: "string" },
            date_range_start: { type: "string", description: "Start date (ISO)" },
            date_range_end: { type: "string", description: "End date (ISO)" },
          },
          required: ["title", "template_id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_dashboard_report",
        description: "Get main dashboard report — total tasks, completion rate, overdue count, contacts, invoices, unpaid invoices",
        parameters: { type: "object", properties: {} },
      },
    },
];

// ═══════════════════════════════════════════════════════════════
// INVENTORY MODULE (5 tools)
// ═══════════════════════════════════════════════════════════════
const INVENTORY_TOOLS = [
    {
      type: "function",
      function: {
        name: "get_inventory_items",
        description: "Get inventory items with stock levels, prices, categories",
        parameters: {
          type: "object",
          properties: {
            category_id: { type: "string", description: "Filter by category" },
            active: { type: "boolean", description: "Filter by active status" },
            limit: { type: "integer", description: "Max results (default 20)" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_inventory_item",
        description: "Create a new inventory item",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Item title" },
            sku: { type: "string", description: "SKU" },
            description: { type: "string" },
            category_id: { type: "string" },
            price: { type: "number" },
            currency: { type: "string", description: "Default: CAD" },
            quantity: { type: "integer", description: "Initial stock quantity. Default: 0" },
            reorder_threshold: { type: "integer", description: "Low stock alert threshold. Default: 5" },
            tags: { type: "array", items: { type: "string" } },
            featured: { type: "boolean" },
            active: { type: "boolean", description: "Default: true" },
          },
          required: ["title"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_inventory_item",
        description: "Update an inventory item — price, stock, description, etc.",
        parameters: {
          type: "object",
          properties: {
            item_id: { type: "string", description: "Item ID" },
            title: { type: "string" },
            sku: { type: "string" },
            description: { type: "string" },
            category_id: { type: "string" },
            price: { type: "number" },
            currency: { type: "string" },
            quantity: { type: "integer" },
            reorder_threshold: { type: "integer" },
            status: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            featured: { type: "boolean" },
            active: { type: "boolean" },
          },
          required: ["item_id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_inventory_categories",
        description: "Get inventory categories for this client",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "get_stock_movements",
        description: "Get stock movement history for an item",
        parameters: {
          type: "object",
          properties: {
            item_id: { type: "string", description: "Item ID" },
            limit: { type: "integer", description: "Max results (default 20)" },
          },
          required: ["item_id"],
        },
      },
    },
];

// ═══════════════════════════════════════════════════════════════
// GOALS MODULE (3 tools)
// ═══════════════════════════════════════════════════════════════
const GOAL_TOOLS = [
    {
      type: "function",
      function: {
        name: "get_goals",
        description: "Get goals with key results and progress",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["Not_Started", "In_Progress", "Completed", "On_Hold", "Cancelled"] },
            limit: { type: "integer", description: "Max results (default 20)" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_goal",
        description: "Create a new goal with start/end dates",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Goal title" },
            description: { type: "string" },
            start_date: { type: "string", description: "Start date (ISO)" },
            end_date: { type: "string", description: "End date (ISO)" },
            owner_id: { type: "string", description: "Owner user ID" },
          },
          required: ["title", "start_date", "end_date"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_goal",
        description: "Update a goal — status, progress, dates, description",
        parameters: {
          type: "object",
          properties: {
            goal_id: { type: "string", description: "Goal ID" },
            title: { type: "string" },
            description: { type: "string" },
            status: { type: "string", enum: ["Not_Started", "In_Progress", "Completed", "On_Hold", "Cancelled"] },
            progress_percentage: { type: "integer", description: "0-100" },
            end_date: { type: "string" },
            owner_id: { type: "string" },
          },
          required: ["goal_id"],
        },
      },
    },
];

// ═══════════════════════════════════════════════════════════════
// VENDOR & CUSTOMER MODULE (4 tools)
// ═══════════════════════════════════════════════════════════════
const VENDOR_CUSTOMER_TOOLS = [
    {
      type: "function",
      function: {
        name: "get_vendors",
        description: "Get vendors (suppliers) for this client",
        parameters: {
          type: "object",
          properties: {
            active: { type: "boolean", description: "Filter by active status" },
            limit: { type: "integer", description: "Max results (default 20)" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_vendor",
        description: "Create a new vendor",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Vendor name" },
            contact_person: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            address: { type: "string" },
            tax_number: { type: "string" },
            website: { type: "string" },
            notes: { type: "string" },
          },
          required: ["name"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_customers",
        description: "Get customers for this client",
        parameters: {
          type: "object",
          properties: {
            active: { type: "boolean", description: "Filter by active status" },
            limit: { type: "integer", description: "Max results (default 20)" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_customer",
        description: "Create a new customer",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Customer name" },
            contact_person: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            billing_address: { type: "string" },
            shipping_address: { type: "string" },
            tax_number: { type: "string" },
            website: { type: "string" },
            payment_terms: { type: "string", description: "e.g. 'Net 30', 'Due on receipt'" },
            currency: { type: "string", description: "Default: CAD" },
            notes: { type: "string" },
          },
          required: ["name"],
        },
      },
    },
];

// ═══════════════════════════════════════════════════════════════
// BANKING & BILLS MODULE (5 tools)
// ═══════════════════════════════════════════════════════════════
const BANKING_TOOLS = [
    {
      type: "function",
      function: {
        name: "get_bank_accounts",
        description: "Get bank accounts for this client with balances",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "get_transactions",
        description: "Get transactions with optional filters. Includes direction, reconciliation status, linked invoice.",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["Pending", "Completed", "Failed"] },
            direction: { type: "string", enum: ["Incoming", "Outgoing"] },
            bank_account_id: { type: "string" },
            limit: { type: "integer", description: "Max results (default 20)" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_bills",
        description: "Get bills (accounts payable) with optional status filter",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["Draft", "Pending", "PartiallyPaid", "Paid", "Overdue"] },
            limit: { type: "integer", description: "Max results (default 20)" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_bill",
        description: "Create a new bill (accounts payable) from a vendor",
        parameters: {
          type: "object",
          properties: {
            vendor_id: { type: "string", description: "Vendor ID" },
            bill_number: { type: "string", description: "Bill number" },
            bill_date: { type: "string", description: "Bill date (ISO). Default: today" },
            due_date: { type: "string", description: "Due date (ISO)" },
            currency: { type: "string", description: "Default: CAD" },
            tax_rate: { type: "number", description: "Tax rate %. Default: 0" },
            notes: { type: "string" },
            line_items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  description: { type: "string" },
                  quantity: { type: "number" },
                  unit_price: { type: "number" },
                },
              },
            },
          },
          required: ["vendor_id", "bill_number", "due_date", "line_items"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_expenses",
        description: "Get business expenses with optional status filter. Includes category, amount, receipt, approval status.",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["Pending", "Approved", "Rejected", "Reimbursed"] },
            category: { type: "string", enum: ["OfficeSupplies", "Travel", "Meals", "ProfessionalServices", "Software", "Hardware", "Marketing", "Utilities", "Rent", "Other"] },
            limit: { type: "integer", description: "Max results (default 20)" },
          },
        },
      },
    },
];

// ═══════════════════════════════════════════════════════════════
// USERS & TEAM MODULE (2 tools)
// ═══════════════════════════════════════════════════════════════
const USER_TOOLS = [
    {
      type: "function",
      function: {
        name: "get_team_members",
        description: "Get team members (users assigned to this client) with their roles",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "get_users",
        description: "Get all users in the system (admin only). Includes role, email, name, assigned clients.",
        parameters: {
          type: "object",
          properties: {
            role: { type: "string", enum: ["admin", "employee", "client"] },
            limit: { type: "integer", description: "Max results (default 20)" },
          },
        },
      },
    },
];

// ═══════════════════════════════════════════════════════════════
// CLIENT & SETTINGS MODULE (3 tools)
// ═══════════════════════════════════════════════════════════════
const CLIENT_TOOLS = [
    {
      type: "function",
      function: {
        name: "get_clients_info",
        description: "Get information about the current client (company name, domain, industry, contact info, website)",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "update_client_info",
        description: "Update the current client's information (company name, contact, website, industry, etc.)",
        parameters: {
          type: "object",
          properties: {
            company_name: { type: "string" },
            contact_person: { type: "string" },
            contact_number: { type: "string" },
            email: { type: "string" },
            address: { type: "string" },
            website: { type: "string" },
            industry: { type: "string" },
            domain: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_settings",
        description: "Get client settings (key-value pairs grouped by setting group)",
        parameters: {
          type: "object",
          properties: {
            group: { type: "string", description: "Filter by setting group" },
          },
        },
      },
    },
];

// ═══════════════════════════════════════════════════════════════
// SEO MODULE (5 tools)
// ═══════════════════════════════════════════════════════════════
const SEO_TOOLS = [
    {
      type: "function",
      function: {
        name: "get_seo_keywords",
        description: "Get SEO keywords being tracked for this client",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "get_seo_analyser_runs",
        description: "Get SEO analyser runs (content audits) with scores, issues, suggestions counts",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Max results (default 20)" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_seo_analyser_issues",
        description: "Get SEO analyser issues (problems found in content) with severity and recommendations",
        parameters: {
          type: "object",
          properties: {
            run_id: { type: "string", description: "Filter by run ID" },
            severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
            limit: { type: "integer", description: "Max results (default 20)" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_seo_analyser_suggestions",
        description: "Get SEO analyser suggestions (fix recommendations) with status (pending/approved/rejected/applied)",
        parameters: {
          type: "object",
          properties: {
            issue_id: { type: "string", description: "Filter by issue ID" },
            status: { type: "string", enum: ["pending", "approved", "rejected", "applied"] },
            limit: { type: "integer", description: "Max results (default 20)" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_seo_settings",
        description: "Get SEO analyser settings (scan options, check types, schedule frequency)",
        parameters: { type: "object", properties: {} },
      },
    },
];

// ═══════════════════════════════════════════════════════════════
// DAILY REPORTS MODULE (2 tools)
// ═══════════════════════════════════════════════════════════════
const DAILY_REPORT_TOOLS = [
    {
      type: "function",
      function: {
        name: "get_daily_reports",
        description: "Get daily work reports for this client. Includes hours, status, summary, items.",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["draft", "submitted", "approved", "rejected"] },
            limit: { type: "integer", description: "Max results (default 20)" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_daily_report_summary",
        description: "Get daily report analytics — total hours, report counts by status, employee breakdown",
        parameters: { type: "object", properties: {} },
      },
    },
];

// ═══════════════════════════════════════════════════════════════
// INQUIRIES MODULE (1 tool)
// ═══════════════════════════════════════════════════════════════
const INQUIRY_TOOLS = [
    {
      type: "function",
      function: {
        name: "get_inquiries",
        description: "Get customer inquiries (contact form submissions) with status",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["New", "Contacted", "Converted", "Closed"] },
            limit: { type: "integer", description: "Max results (default 20)" },
          },
        },
      },
    },
];

// ═══════════════════════════════════════════════════════════════
// INTEGRATIONS MODULE (2 tools)
// ═══════════════════════════════════════════════════════════════
const INTEGRATION_TOOLS = [
    {
      type: "function",
      function: {
        name: "get_integrations",
        description: "Get integrations for this client (Google, Microsoft, Zoom, etc.) with status and last sync time",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "get_integration_logs",
        description: "Get integration sync logs for troubleshooting",
        parameters: {
          type: "object",
          properties: {
            integration_id: { type: "string", description: "Filter by integration ID" },
            limit: { type: "integer", description: "Max results (default 10)" },
          },
        },
      },
    },
];

// Combine all tools into the full set
const ALL_EXTRA_TOOLS = [
  ...BLOG_TOOLS,
  ...SERVICE_TOOLS,
  ...FORM_TOOLS,
  ...REPORT_TOOLS,
  ...INVENTORY_TOOLS,
  ...GOAL_TOOLS,
  ...VENDOR_CUSTOMER_TOOLS,
  ...BANKING_TOOLS,
  ...USER_TOOLS,
  ...CLIENT_TOOLS,
  ...SEO_TOOLS,
  ...DAILY_REPORT_TOOLS,
  ...INQUIRY_TOOLS,
  ...INTEGRATION_TOOLS,
];

/**
 * Execute a tool call with strict client isolation.
 * All queries are scoped to clientId — there is NO way for the LLM
 * to access data from other clients.
 *
 * @param {string} toolName - The tool name to execute
 * @param {object} args - Arguments from the LLM
 * @param {string} clientId - The user's activeClientId (enforced scope)
 * @param {string} userId - The user's profile ID (for createdBy fields)
 * @returns {string} - JSON string result for the LLM
 */
export async function executeToolCall(toolName, args, clientId, userId) {
  if (!clientId) {
    return JSON.stringify({ error: "No active client context. Cannot execute tool calls." });
  }

  const limit = Math.min(args.limit || 20, 50);

  try {
    switch (toolName) {
      // ═══════════════════════════════════════════════════════════════
      // CRM MODULE
      // ═══════════════════════════════════════════════════════════════
      case "get_crm_dashboard": {
        const contacts = await prisma.wehowareCrmContact.count({ where: { clientId, active: true } });
        const leads = await prisma.wehowareCrmContact.count({ where: { clientId, active: true, type: "Lead" } });
        const customers = await prisma.wehowareCrmContact.count({ where: { clientId, active: true, type: "Customer" } });
        const deals = await prisma.wehowareCrmDeal.count({ where: { clientId } });
        const openDeals = await prisma.wehowareCrmDeal.count({ where: { clientId, status: "Open" } });
        const wonDeals = await prisma.wehowareCrmDeal.count({ where: { clientId, status: "Won" } });
        const lostDeals = await prisma.wehowareCrmDeal.count({ where: { clientId, status: "Lost" } });
        const activities = await prisma.wehowareCrmActivity.count({ where: { clientId, active: true } });
        const completedActivities = await prisma.wehowareCrmActivity.count({ where: { clientId, active: true, completedAt: { not: null } } });
        const dealValues = await prisma.wehowareCrmDeal.aggregate({ where: { clientId, status: "Open" }, _sum: { value: true } });
        const wonValues = await prisma.wehowareCrmDeal.aggregate({ where: { clientId, status: "Won" }, _sum: { value: true } });
        return JSON.stringify({
          contacts: { total: contacts, leads, customers },
          deals: { total: deals, open: openDeals, won: wonDeals, lost: lostDeals, openValue: dealValues._sum.value || 0, wonValue: wonValues._sum.value || 0 },
          activities: { total: activities, completed: completedActivities },
        });
      }

      case "get_crm_contacts": {
        const where = { clientId, active: true };
        if (args.type) where.type = args.type;
        if (args.status) where.status = args.status;
        if (args.source) where.source = args.source;
        if (args.search) {
          where.OR = [
            { firstName: { contains: args.search } },
            { lastName: { contains: args.search } },
            { email: { contains: args.search } },
            { company: { contains: args.search } },
            { phone: { contains: args.search } },
          ];
        }
        const contacts = await prisma.wehowareCrmContact.findMany({
          where, take: limit, orderBy: { createdAt: "desc" },
          select: { id: true, firstName: true, lastName: true, email: true, phone: true, company: true, jobTitle: true, type: true, status: true, source: true, website: true, linkedinUrl: true, notes: true, tags: true, assignedTo: true, createdAt: true, updatedAt: true },
        });
        return JSON.stringify({ contacts, total: contacts.length });
      }

      case "create_crm_contact": {
        const existing = await prisma.wehowareCrmContact.findFirst({
          where: { clientId, email: args.email, active: true },
        });
        if (existing) {
          return JSON.stringify({ message: "Contact already exists", contact: { id: existing.id, firstName: existing.firstName, lastName: existing.lastName, email: existing.email } });
        }
        const contact = await prisma.wehowareCrmContact.create({
          data: {
            clientId, createdBy: userId,
            firstName: args.first_name, lastName: args.last_name,
            email: args.email, phone: args.phone || null,
            company: args.company || null, jobTitle: args.job_title || null,
            website: args.website || null, linkedinUrl: args.linkedin_url || null,
            type: args.type || "Lead", status: args.status || "New", source: args.source || "Manual",
            notes: args.notes || null,
            tags: args.tags ? JSON.stringify(args.tags) : null,
            assignedTo: args.assigned_to || null,
          },
        });
        return JSON.stringify({ message: "Contact created", contact: { id: contact.id, firstName: contact.firstName, lastName: contact.lastName, email: contact.email, type: contact.type, status: contact.status } });
      }

      case "update_crm_contact": {
        const existing = await prisma.wehowareCrmContact.findFirst({
          where: { id: args.contact_id, clientId, active: true },
        });
        if (!existing) return JSON.stringify({ error: "Contact not found" });
        const data = { updatedBy: userId };
        if (args.first_name !== undefined) data.firstName = args.first_name;
        if (args.last_name !== undefined) data.lastName = args.last_name;
        if (args.email !== undefined) data.email = args.email;
        if (args.phone !== undefined) data.phone = args.phone;
        if (args.company !== undefined) data.company = args.company;
        if (args.job_title !== undefined) data.jobTitle = args.job_title;
        if (args.website !== undefined) data.website = args.website;
        if (args.linkedin_url !== undefined) data.linkedinUrl = args.linkedin_url;
        if (args.type !== undefined) data.type = args.type;
        if (args.status !== undefined) data.status = args.status;
        if (args.source !== undefined) data.source = args.source;
        if (args.notes !== undefined) data.notes = args.notes;
        if (args.tags !== undefined) data.tags = JSON.stringify(args.tags);
        if (args.assigned_to !== undefined) data.assignedTo = args.assigned_to;
        const contact = await prisma.wehowareCrmContact.update({ where: { id: args.contact_id }, data });
        return JSON.stringify({ message: "Contact updated", contact: { id: contact.id, firstName: contact.firstName, lastName: contact.lastName, status: contact.status, type: contact.type } });
      }

      case "get_crm_deals": {
        const where = { clientId };
        if (args.status) where.status = args.status;
        const deals = await prisma.wehowareCrmDeal.findMany({
          where, take: limit, orderBy: { createdAt: "desc" },
          select: { id: true, title: true, value: true, currency: true, status: true, expectedCloseDate: true, closedAt: true, closedReason: true, notes: true, tags: true, assignedTo: true, pipelineId: true, stageId: true, contactId: true, createdAt: true, updatedAt: true },
        });
        return JSON.stringify({ deals, total: deals.length });
      }

      case "create_crm_deal": {
        const deal = await prisma.wehowareCrmDeal.create({
          data: {
            clientId, createdBy: userId,
            title: args.title, value: parseFloat(args.value) || 0,
            currency: args.currency || "CAD",
            pipelineId: args.pipeline_id, stageId: args.stage_id,
            contactId: args.contact_id || null,
            expectedCloseDate: args.expected_close_date ? new Date(args.expected_close_date) : null,
            notes: args.notes || null,
            assignedTo: args.assigned_to || null,
            status: "Open",
          },
        });
        return JSON.stringify({ message: "Deal created", deal: { id: deal.id, title: deal.title, value: deal.value, status: deal.status } });
      }

      case "update_crm_deal": {
        const existing = await prisma.wehowareCrmDeal.findFirst({
          where: { id: args.deal_id, clientId },
        });
        if (!existing) return JSON.stringify({ error: "Deal not found" });
        const data = { updatedBy: userId };
        if (args.title !== undefined) data.title = args.title;
        if (args.value !== undefined) data.value = parseFloat(args.value);
        if (args.currency !== undefined) data.currency = args.currency;
        if (args.stage_id !== undefined) data.stageId = args.stage_id;
        if (args.status !== undefined) {
          data.status = args.status;
          if (args.status === "Won" || args.status === "Lost") {
            data.closedAt = args.closed_at ? new Date(args.closed_at) : new Date();
            if (args.closed_reason) data.closedReason = args.closed_reason;
          }
        }
        if (args.expected_close_date !== undefined) data.expectedCloseDate = args.expected_close_date ? new Date(args.expected_close_date) : null;
        if (args.notes !== undefined) data.notes = args.notes;
        if (args.assigned_to !== undefined) data.assignedTo = args.assigned_to;
        const deal = await prisma.wehowareCrmDeal.update({ where: { id: args.deal_id }, data });
        return JSON.stringify({ message: "Deal updated", deal: { id: deal.id, title: deal.title, status: deal.status, value: deal.value } });
      }

      case "get_crm_pipelines": {
        const pipelines = await prisma.wehowareCrmPipeline.findMany({
          where: { clientId, active: true },
          include: {
            stages: { where: { active: true }, orderBy: { displayOrder: "asc" }, select: { id: true, name: true, stageType: true, displayOrder: true, color: true } },
          },
        });
        return JSON.stringify({ pipelines });
      }

      case "get_crm_activities": {
        const where = { clientId, active: true };
        if (args.contact_id) where.contactId = args.contact_id;
        if (args.deal_id) where.dealId = args.deal_id;
        const activities = await prisma.wehowareCrmActivity.findMany({
          where, take: limit, orderBy: { createdAt: "desc" },
          select: { id: true, direction: true, title: true, description: true, scheduledAt: true, completedAt: true, durationMinutes: true, contactId: true, dealId: true, createdAt: true },
        });
        return JSON.stringify({ activities, total: activities.length });
      }

      case "create_crm_activity": {
        const activity = await prisma.wehowareCrmActivity.create({
          data: {
            clientId, createdBy: userId,
            contactId: args.contact_id || null,
            dealId: args.deal_id || null,
            direction: args.direction || "Outbound",
            title: args.title,
            description: args.description || null,
            scheduledAt: args.scheduled_at ? new Date(args.scheduled_at) : null,
            durationMinutes: args.duration_minutes || null,
          },
        });
        return JSON.stringify({ message: "Activity created", activity: { id: activity.id, title: activity.title, direction: activity.direction } });
      }

      case "get_crm_contact_lists": {
        const lists = await prisma.wehowareCrmContactList.findMany({
          where: { clientId, active: true },
          select: { id: true, name: true, description: true, color: true, _count: { select: { memberships: true } } },
        });
        return JSON.stringify({ lists });
      }

      case "add_contact_to_list": {
        const existing = await prisma.wehowareCrmContactListMembership.findFirst({
          where: { listId: args.list_id, contactId: args.contact_id, clientId },
        });
        if (existing) return JSON.stringify({ message: "Contact already in this list" });
        const membership = await prisma.wehowareCrmContactListMembership.create({
          data: { listId: args.list_id, contactId: args.contact_id, clientId },
        });
        return JSON.stringify({ message: "Contact added to list", membershipId: membership.id });
      }

      // ═══════════════════════════════════════════════════════════════
      // TASKS MODULE
      // ═══════════════════════════════════════════════════════════════
      case "get_tasks": {
        const where = { clientId };
        if (args.status) where.status = args.status;
        if (args.priority) where.priority = args.priority;
        if (args.assignee_id) where.assigneeId = args.assignee_id;
        const tasks = await prisma.wehowareTask.findMany({
          where, take: limit, orderBy: { createdAt: "desc" },
          select: { id: true, title: true, description: true, priority: true, status: true, dueDate: true, assigneeId: true, createdBy: true, subtaskCount: true, subtaskCompleted: true, estimatedHours: true, actualHours: true, storyPoints: true, createdAt: true, updatedAt: true },
        });
        return JSON.stringify({ tasks, total: tasks.length });
      }

      case "create_task": {
        const task = await prisma.wehowareTask.create({
          data: {
            clientId, createdBy: userId,
            title: args.title,
            description: args.description || null,
            priority: args.priority || "Medium",
            status: args.status || "To_Do",
            dueDate: args.due_date ? new Date(args.due_date) : null,
            assigneeId: args.assignee_id || null,
            estimatedHours: args.estimated_hours ? parseFloat(args.estimated_hours) : null,
            storyPoints: args.story_points || null,
          },
        });
        return JSON.stringify({ message: "Task created", task: { id: task.id, title: task.title, priority: task.priority, status: task.status } });
      }

      case "update_task": {
        const existing = await prisma.wehowareTask.findFirst({
          where: { id: args.task_id, clientId },
        });
        if (!existing) return JSON.stringify({ error: "Task not found" });
        const data = {};
        if (args.title !== undefined) data.title = args.title;
        if (args.description !== undefined) data.description = args.description;
        if (args.priority !== undefined) data.priority = args.priority;
        if (args.status !== undefined) data.status = args.status;
        if (args.due_date !== undefined) data.dueDate = args.due_date ? new Date(args.due_date) : null;
        if (args.assignee_id !== undefined) data.assigneeId = args.assignee_id;
        if (args.estimated_hours !== undefined) data.estimatedHours = parseFloat(args.estimated_hours);
        if (args.story_points !== undefined) data.storyPoints = args.story_points;
        const task = await prisma.wehowareTask.update({ where: { id: args.task_id }, data });
        return JSON.stringify({ message: "Task updated", task: { id: task.id, title: task.title, status: task.status, priority: task.priority } });
      }

      case "get_task_stats": {
        const total = await prisma.wehowareTask.count({ where: { clientId } });
        const todo = await prisma.wehowareTask.count({ where: { clientId, status: "To_Do" } });
        const inProgress = await prisma.wehowareTask.count({ where: { clientId, status: "In_Progress" } });
        const done = await prisma.wehowareTask.count({ where: { clientId, status: "Done" } });
        const backlog = await prisma.wehowareTask.count({ where: { clientId, status: "Backlog" } });
        const overdue = await prisma.wehowareTask.count({ where: { clientId, dueDate: { lt: new Date() }, status: { not: "Done" } } });
        const highPriority = await prisma.wehowareTask.count({ where: { clientId, priority: "High", status: { not: "Done" } } });
        return JSON.stringify({ total, todo, inProgress, done, backlog, overdue, highPriority });
      }

      case "get_task_comments": {
        const comments = await prisma.wehowareTaskComment.findMany({
          where: { taskId: args.task_id },
          orderBy: { createdAt: "asc" },
          select: { id: true, content: true, userId: true, createdAt: true },
        });
        return JSON.stringify({ comments, total: comments.length });
      }

      case "add_task_comment": {
        const comment = await prisma.wehowareTaskComment.create({
          data: { taskId: args.task_id, userId, content: args.content },
        });
        return JSON.stringify({ message: "Comment added", commentId: comment.id });
      }

      case "get_subtasks": {
        const subtasks = await prisma.wehowareSubtask.findMany({
          where: { taskId: args.task_id },
          orderBy: { orderIndex: "asc" },
          select: { id: true, title: true, description: true, status: true, assigneeId: true, orderIndex: true, completedAt: true, createdAt: true },
        });
        return JSON.stringify({ subtasks, total: subtasks.length });
      }

      case "create_subtask": {
        const maxOrder = await prisma.wehowareSubtask.findFirst({
          where: { taskId: args.task_id },
          orderBy: { orderIndex: "desc" },
          select: { orderIndex: true },
        });
        const subtask = await prisma.wehowareSubtask.create({
          data: {
            taskId: args.task_id, createdBy: userId,
            title: args.title, description: args.description || null,
            assigneeId: args.assignee_id || null,
            orderIndex: (maxOrder?.orderIndex || 0) + 1,
          },
        });
        await prisma.wehowareTask.update({
          where: { id: args.task_id },
          data: { subtaskCount: { increment: 1 } },
        });
        return JSON.stringify({ message: "Subtask created", subtask: { id: subtask.id, title: subtask.title } });
      }

      case "add_time_entry": {
        const entry = await prisma.wehowareTaskTimeEntry.create({
          data: {
            taskId: args.task_id, userId,
            hoursSpent: parseFloat(args.hours_spent),
            notes: args.notes || null,
            trackedDate: args.tracked_date ? new Date(args.tracked_date) : new Date(),
          },
        });
        await prisma.wehowareTask.update({
          where: { id: args.task_id },
          data: { actualHours: { increment: parseFloat(args.hours_spent) } },
        });
        return JSON.stringify({ message: "Time entry added", entryId: entry.id, hoursLogged: entry.hoursSpent });
      }

      // ═══════════════════════════════════════════════════════════════
      // SOCIAL MEDIA MODULE
      // ═══════════════════════════════════════════════════════════════
      case "get_social_posts": {
        const where = { clientId };
        if (args.status) where.status = args.status;
        const posts = await prisma.wehowareSocialPost.findMany({
          where, take: limit, orderBy: { createdAt: "desc" },
          select: { id: true, title: true, content: true, mediaUrls: true, hashtags: true, scheduledFor: true, publishedAt: true, status: true, postType: true, targetAccounts: true, publishResults: true, errorDetails: true, createdAt: true, updatedAt: true },
        });
        return JSON.stringify({ posts: posts.map(p => ({ ...p, content: p.content?.slice(0, 300) })), total: posts.length });
      }

      case "create_social_post": {
        const post = await prisma.wehowareSocialPost.create({
          data: {
            clientId, createdBy: userId,
            title: args.title || null,
            content: args.content,
            mediaUrls: args.media_urls ? JSON.stringify(args.media_urls) : JSON.stringify([]),
            hashtags: args.hashtags ? JSON.stringify(args.hashtags) : JSON.stringify([]),
            targetAccounts: args.target_account_ids ? JSON.stringify(args.target_account_ids) : JSON.stringify([]),
            postType: args.post_type || "Text",
            status: args.status || "Draft",
            scheduledFor: args.scheduled_for ? new Date(args.scheduled_for) : null,
          },
        });
        return JSON.stringify({ message: "Social post created", post: { id: post.id, title: post.title, status: post.status, postType: post.postType } });
      }

      case "update_social_post": {
        const existing = await prisma.wehowareSocialPost.findFirst({
          where: { id: args.post_id, clientId },
        });
        if (!existing) return JSON.stringify({ error: "Post not found" });
        const data = { updatedBy: userId };
        if (args.content !== undefined) data.content = args.content;
        if (args.title !== undefined) data.title = args.title;
        if (args.media_urls !== undefined) data.mediaUrls = JSON.stringify(args.media_urls);
        if (args.hashtags !== undefined) data.hashtags = JSON.stringify(args.hashtags);
        if (args.target_account_ids !== undefined) data.targetAccounts = JSON.stringify(args.target_account_ids);
        if (args.scheduled_for !== undefined) data.scheduledFor = args.scheduled_for ? new Date(args.scheduled_for) : null;
        if (args.status !== undefined) data.status = args.status;
        const post = await prisma.wehowareSocialPost.update({ where: { id: args.post_id }, data });
        return JSON.stringify({ message: "Post updated", post: { id: post.id, title: post.title, status: post.status } });
      }

      case "publish_social_post": {
        const post = await prisma.wehowareSocialPost.findFirst({
          where: { id: args.post_id, clientId },
        });
        if (!post) return JSON.stringify({ error: "Post not found" });
        await prisma.wehowareSocialPost.update({
          where: { id: args.post_id },
          data: { status: "Publishing", updatedBy: userId },
        });
        return JSON.stringify({ message: "Post publish initiated", post_id: args.post_id, note: "The post is now being published to all target platforms. Check status in a few moments." });
      }

      case "get_social_accounts": {
        const accounts = await prisma.wehowareSocialAccount.findMany({
          where: { clientId },
          select: { id: true, accountName: true, accountHandle: true, status: true, profileData: true, lastSyncedAt: true, syncError: true, createdAt: true },
        });
        return JSON.stringify({ accounts, total: accounts.length });
      }

      case "get_social_analytics": {
        const accounts = await prisma.wehowareSocialAccount.count({ where: { clientId, status: "Active" } });
        const posts = await prisma.wehowareSocialPost.count({ where: { clientId } });
        const published = await prisma.wehowareSocialPost.count({ where: { clientId, status: "Published" } });
        const scheduled = await prisma.wehowareSocialPost.count({ where: { clientId, status: "Scheduled" } });
        const failed = await prisma.wehowareSocialPost.count({ where: { clientId, status: "Failed" } });
        return JSON.stringify({ activeAccounts: accounts, totalPosts: posts, publishedPosts: published, scheduledPosts: scheduled, failedPosts: failed });
      }

      case "get_social_inbox": {
        const conversations = await prisma.wehowareSocialInboxConversation.findMany({
          where: { clientId },
          orderBy: { lastMessageAt: "desc" },
          take: limit,
          select: { id: true, platformCode: true, participantName: true, participantHandle: true, participantAvatar: true, lastMessagePreview: true, lastMessageAt: true, unreadCount: true, status: true },
        });
        return JSON.stringify({ conversations, total: conversations.length });
      }

      case "reply_social_inbox": {
        const conversation = await prisma.wehowareSocialInboxConversation.findFirst({
          where: { id: args.conversation_id, clientId },
        });
        if (!conversation) return JSON.stringify({ error: "Conversation not found" });
        const message = await prisma.wehowareSocialInboxMessage.create({
          data: {
            conversationId: args.conversation_id,
            platformMessageId: `reply_${Date.now()}`,
            direction: "Outbound",
            senderName: "WeHowAre Team",
            content: args.content,
            mediaUrls: JSON.stringify([]),
            isRead: true,
            sentAt: new Date(),
            metadata: JSON.stringify({ source: "ai_assistant" }),
          },
        });
        await prisma.wehowareSocialInboxConversation.update({
          where: { id: args.conversation_id },
          data: {
            lastMessageAt: new Date(),
            lastMessagePreview: args.content.slice(0, 200),
          },
        });
        return JSON.stringify({ message: "Reply sent", messageId: message.id, note: "Reply stored. Actual platform delivery may require sync." });
      }

      // ═══════════════════════════════════════════════════════════════
      // INVOICE MODULE
      // ═══════════════════════════════════════════════════════════════
      case "get_invoices": {
        const where = { clientId };
        if (args.status) where.status = args.status;
        const invoices = await prisma.wehowareInvoice.findMany({
          where, take: limit, orderBy: { createdAt: "desc" },
          select: { id: true, invoiceNumber: true, clientName: true, clientEmail: true, invoiceDate: true, dueDate: true, status: true, subtotal: true, taxRate: true, taxAmount: true, total: true, currency: true, notes: true, paidAt: true, amountPaid: true, customerId: true, createdAt: true, updatedAt: true },
        });
        return JSON.stringify({ invoices, total: invoices.length });
      }

      case "create_invoice": {
        // Get invoice settings for number generation
        const settings = await prisma.wehowareInvoiceSettings.findUnique({ where: { clientId } });
        const invoiceNumber = settings
          ? settings.invoiceFormat
              .replace("{YYYY}", new Date().getFullYear())
              .replace("{XXXX}", String(settings.nextInvoiceNumber).padStart(4, "0"))
          : `INV-${Date.now()}`;
        const taxRate = args.tax_rate !== undefined ? parseFloat(args.tax_rate) : (settings?.defaultTaxRate ? parseFloat(settings.defaultTaxRate) : 0);
        const currency = args.currency || settings?.defaultCurrency || "CAD";
        const lineItems = args.line_items || [];
        const subtotal = lineItems.reduce((sum, li) => sum + (parseFloat(li.quantity) * parseFloat(li.unit_price)), 0);
        const taxAmount = subtotal * (taxRate / 100);
        const total = subtotal + taxAmount;
        const invoice = await prisma.wehowareInvoice.create({
          data: {
            clientId, createdBy: userId,
            customerId: args.customer_id || null,
            invoiceNumber,
            clientName: args.client_name,
            clientEmail: args.client_email || null,
            invoiceDate: args.invoice_date ? new Date(args.invoice_date) : new Date(),
            dueDate: new Date(args.due_date),
            status: "Draft",
            subtotal,
            taxRate,
            taxAmount,
            total,
            currency,
            notes: args.notes || null,
          },
        });
        // Create line items
        for (let i = 0; i < lineItems.length; i++) {
          const li = lineItems[i];
          await prisma.wehowareInvoiceLineItem.create({
            data: {
              invoiceId: invoice.id, clientId,
              description: li.description,
              quantity: parseFloat(li.quantity),
              unitPrice: parseFloat(li.unit_price),
              total: parseFloat(li.quantity) * parseFloat(li.unit_price),
              sortOrder: i,
            },
          });
        }
        // Increment next invoice number
        if (settings) {
          await prisma.wehowareInvoiceSettings.update({
            where: { clientId },
            data: { nextInvoiceNumber: { increment: 1 } },
          });
        }
        return JSON.stringify({ message: "Invoice created", invoice: { id: invoice.id, invoiceNumber: invoice.invoiceNumber, total: invoice.total, currency: invoice.currency, status: invoice.status } });
      }

      case "update_invoice": {
        const existing = await prisma.wehowareInvoice.findFirst({
          where: { id: args.invoice_id, clientId },
        });
        if (!existing) return JSON.stringify({ error: "Invoice not found" });
        const data = { updatedBy: userId };
        if (args.status !== undefined) {
          data.status = args.status;
          if (args.status === "Paid") data.paidAt = new Date();
        }
        if (args.due_date !== undefined) data.dueDate = new Date(args.due_date);
        if (args.notes !== undefined) data.notes = args.notes;
        if (args.client_name !== undefined) data.clientName = args.client_name;
        if (args.client_email !== undefined) data.clientEmail = args.client_email;
        if (args.tax_rate !== undefined) data.taxRate = parseFloat(args.tax_rate);
        const invoice = await prisma.wehowareInvoice.update({ where: { id: args.invoice_id }, data });
        return JSON.stringify({ message: "Invoice updated", invoice: { id: invoice.id, invoiceNumber: invoice.invoiceNumber, status: invoice.status, total: invoice.total } });
      }

      case "get_invoice_line_items": {
        const lineItems = await prisma.wehowareInvoiceLineItem.findMany({
          where: { invoiceId: args.invoice_id, clientId },
          orderBy: { sortOrder: "asc" },
          select: { id: true, description: true, quantity: true, unitPrice: true, total: true, sortOrder: true },
        });
        return JSON.stringify({ lineItems, total: lineItems.length });
      }

      case "get_invoice_settings": {
        const settings = await prisma.wehowareInvoiceSettings.findUnique({ where: { clientId } });
        if (!settings) return JSON.stringify({ message: "No invoice settings found. Use update_invoice_settings to create them." });
        return JSON.stringify({ settings });
      }

      case "update_invoice_settings": {
        const existing = await prisma.wehowareInvoiceSettings.findUnique({ where: { clientId } });
        const data = {};
        if (args.company_name !== undefined) data.companyName = args.company_name;
        if (args.company_email !== undefined) data.companyEmail = args.company_email;
        if (args.company_phone !== undefined) data.companyPhone = args.company_phone;
        if (args.company_address !== undefined) data.companyAddress = args.company_address;
        if (args.tax_number !== undefined) data.taxNumber = args.tax_number;
        if (args.default_currency !== undefined) data.defaultCurrency = args.default_currency;
        if (args.default_tax_rate !== undefined) data.defaultTaxRate = parseFloat(args.default_tax_rate);
        if (args.default_notes !== undefined) data.defaultNotes = args.default_notes;
        if (existing) {
          const settings = await prisma.wehowareInvoiceSettings.update({ where: { clientId }, data });
          return JSON.stringify({ message: "Invoice settings updated", settings: { id: settings.id, companyName: settings.companyName, defaultCurrency: settings.defaultCurrency } });
        } else {
          const settings = await prisma.wehowareInvoiceSettings.create({ data: { clientId, ...data } });
          return JSON.stringify({ message: "Invoice settings created", settings: { id: settings.id, companyName: settings.companyName, defaultCurrency: settings.defaultCurrency } });
        }
      }

      // ═══════════════════════════════════════════════════════════════
      // APPOINTMENT MODULE
      // ═══════════════════════════════════════════════════════════════
      case "get_appointments": {
        const where = { clientId };
        if (args.status) where.status = args.status;
        const appointments = await prisma.wehowareAppointment.findMany({
          where, take: limit, orderBy: { scheduledAt: "desc" },
          select: { id: true, guestName: true, guestEmail: true, guestPhone: true, scheduledAt: true, status: true, location: true, meetingLink: true, address: true, notes: true, timezone: true, appointmentTypeId: true, createdAt: true, updatedAt: true },
        });
        return JSON.stringify({ appointments, total: appointments.length });
      }

      case "create_appointment": {
        const appointment = await prisma.wehowareAppointment.create({
          data: {
            clientId, createdBy: userId,
            appointmentTypeId: args.appointment_type_id || null,
            guestName: args.guest_name,
            guestEmail: args.guest_email,
            guestPhone: args.guest_phone || null,
            scheduledAt: new Date(args.scheduled_at),
            status: args.status || "Pending",
            location: args.location || null,
            meetingLink: args.meeting_link || null,
            address: args.address || null,
            notes: args.notes || null,
            timezone: args.timezone || "UTC",
          },
        });
        return JSON.stringify({ message: "Appointment created", appointment: { id: appointment.id, guestName: appointment.guestName, scheduledAt: appointment.scheduledAt, status: appointment.status } });
      }

      case "update_appointment": {
        const existing = await prisma.wehowareAppointment.findFirst({
          where: { id: args.appointment_id, clientId },
        });
        if (!existing) return JSON.stringify({ error: "Appointment not found" });
        const data = { updatedBy: userId };
        if (args.status !== undefined) data.status = args.status;
        if (args.scheduled_at !== undefined) data.scheduledAt = new Date(args.scheduled_at);
        if (args.location !== undefined) data.location = args.location;
        if (args.meeting_link !== undefined) data.meetingLink = args.meeting_link;
        if (args.notes !== undefined) data.notes = args.notes;
        const appointment = await prisma.wehowareAppointment.update({ where: { id: args.appointment_id }, data });
        return JSON.stringify({ message: "Appointment updated", appointment: { id: appointment.id, status: appointment.status, scheduledAt: appointment.scheduledAt } });
      }

      case "get_appointment_types": {
        const types = await prisma.wehowareAppointmentType.findMany({
          where: { clientId, active: true },
          select: { id: true, name: true, description: true, duration: true, color: true, price: true, currency: true, requiresConfirmation: true, slug: true },
        });
        return JSON.stringify({ appointmentTypes: types, total: types.length });
      }

      case "create_appointment_type": {
        const apptType = await prisma.wehowareAppointmentType.create({
          data: {
            clientId, createdBy: userId,
            name: args.name,
            description: args.description || null,
            duration: args.duration,
            color: args.color || "#4f46e5",
            price: args.price !== undefined ? parseFloat(args.price) : null,
            currency: args.currency || "CAD",
            requiresConfirmation: args.requires_confirmation || false,
          },
        });
        return JSON.stringify({ message: "Appointment type created", appointmentType: { id: apptType.id, name: apptType.name, duration: apptType.duration } });
      }

      // ═══════════════════════════════════════════════════════════════
      // BLOG MODULE
      // ═══════════════════════════════════════════════════════════════
      case "get_blogs": {
        const where = { clientId };
        if (args.status) where.status = args.status;
        const blogs = await prisma.wehowareBlog.findMany({
          where, take: limit, orderBy: { createdAt: "desc" },
          select: { id: true, title: true, slug: true, excerpt: true, status: true, categoryId: true, featured: true, views: true, likes: true, seoScore: true, publishedAt: true, createdAt: true, updatedAt: true },
        });
        return JSON.stringify({ blogs, total: blogs.length });
      }

      case "create_blog": {
        const slug = args.slug || args.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const blog = await prisma.wehowareBlog.create({
          data: {
            clientId, createdBy: userId,
            title: args.title,
            slug,
            excerpt: args.excerpt || null,
            content: args.content || null,
            categoryId: args.category_id || null,
            status: args.status || "Draft",
            featured: args.featured || false,
            tags: args.tags ? JSON.stringify(args.tags) : JSON.stringify([]),
            metaTitle: args.meta_title || null,
            metaDescription: args.meta_description || null,
            metaKeywords: args.meta_keywords || null,
            canonicalUrl: args.canonical_url || null,
            publishedAt: args.published_at ? new Date(args.published_at) : (args.status === "Published" ? new Date() : null),
          },
        });
        return JSON.stringify({ message: "Blog created", blog: { id: blog.id, title: blog.title, slug: blog.slug, status: blog.status } });
      }

      case "update_blog": {
        const existing = await prisma.wehowareBlog.findFirst({
          where: { id: args.blog_id, clientId },
        });
        if (!existing) return JSON.stringify({ error: "Blog not found" });
        const data = { updatedBy: userId };
        if (args.title !== undefined) data.title = args.title;
        if (args.slug !== undefined) data.slug = args.slug;
        if (args.excerpt !== undefined) data.excerpt = args.excerpt;
        if (args.content !== undefined) data.content = args.content;
        if (args.category_id !== undefined) data.categoryId = args.category_id;
        if (args.status !== undefined) {
          data.status = args.status;
          if (args.status === "Published" && !existing.publishedAt) {
            data.publishedAt = args.published_at ? new Date(args.published_at) : new Date();
          }
        }
        if (args.featured !== undefined) data.featured = args.featured;
        if (args.tags !== undefined) data.tags = JSON.stringify(args.tags);
        if (args.meta_title !== undefined) data.metaTitle = args.meta_title;
        if (args.meta_description !== undefined) data.metaDescription = args.meta_description;
        if (args.meta_keywords !== undefined) data.metaKeywords = args.meta_keywords;
        if (args.canonical_url !== undefined) data.canonicalUrl = args.canonical_url;
        if (args.published_at !== undefined) data.publishedAt = args.published_at ? new Date(args.published_at) : null;
        const blog = await prisma.wehowareBlog.update({ where: { id: args.blog_id }, data });
        return JSON.stringify({ message: "Blog updated", blog: { id: blog.id, title: blog.title, status: blog.status } });
      }

      case "get_blog_categories": {
        const categories = await prisma.wehowareBlogCategory.findMany({
          where: { clientId, active: true },
          select: { id: true, name: true, slug: true, description: true, _count: { select: { blogs: true } } },
        });
        return JSON.stringify({ categories, total: categories.length });
      }

      case "create_blog_category": {
        const slug = args.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const category = await prisma.wehowareBlogCategory.create({
          data: {
            clientId, createdBy: userId,
            name: args.name,
            slug,
            description: args.description || null,
          },
        });
        return JSON.stringify({ message: "Blog category created", category: { id: category.id, name: category.name, slug: category.slug } });
      }

      // ═══════════════════════════════════════════════════════════════
      // SERVICE MODULE
      // ═══════════════════════════════════════════════════════════════
      case "get_services": {
        const where = { clientId };
        if (args.active !== undefined) where.active = args.active;
        const services = await prisma.wehowareService.findMany({
          where, take: limit, orderBy: { createdAt: "desc" },
          select: { id: true, title: true, slug: true, description: true, active: true, categoryId: true, fee: true, feeCurrency: true, serviceCode: true, featured: true, views: true, seoScore: true, createdAt: true, updatedAt: true },
        });
        return JSON.stringify({ services, total: services.length });
      }

      case "create_service": {
        const slug = args.slug || args.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const service = await prisma.wehowareService.create({
          data: {
            clientId, createdBy: userId,
            title: args.title,
            slug,
            description: args.description || null,
            content: args.content || null,
            categoryId: args.category_id || null,
            fee: args.fee !== undefined ? parseFloat(args.fee) : null,
            feeCurrency: args.fee_currency || "CAD",
            serviceCode: args.service_code || null,
            duration: args.duration || null,
            active: args.active !== undefined ? args.active : true,
            featured: args.featured || false,
            tags: args.tags ? JSON.stringify(args.tags) : JSON.stringify([]),
            metaTitle: args.meta_title || null,
            metaDescription: args.meta_description || null,
            metaKeywords: args.meta_keywords || null,
          },
        });
        return JSON.stringify({ message: "Service created", service: { id: service.id, title: service.title, slug: service.slug, active: service.active } });
      }

      case "update_service": {
        const existing = await prisma.wehowareService.findFirst({
          where: { id: args.service_id, clientId },
        });
        if (!existing) return JSON.stringify({ error: "Service not found" });
        const data = { updatedBy: userId };
        if (args.title !== undefined) data.title = args.title;
        if (args.slug !== undefined) data.slug = args.slug;
        if (args.description !== undefined) data.description = args.description;
        if (args.content !== undefined) data.content = args.content;
        if (args.category_id !== undefined) data.categoryId = args.category_id;
        if (args.fee !== undefined) data.fee = parseFloat(args.fee);
        if (args.fee_currency !== undefined) data.feeCurrency = args.fee_currency;
        if (args.service_code !== undefined) data.serviceCode = args.service_code;
        if (args.duration !== undefined) data.duration = args.duration;
        if (args.active !== undefined) data.active = args.active;
        if (args.featured !== undefined) data.featured = args.featured;
        if (args.tags !== undefined) data.tags = JSON.stringify(args.tags);
        if (args.meta_title !== undefined) data.metaTitle = args.meta_title;
        if (args.meta_description !== undefined) data.metaDescription = args.meta_description;
        if (args.meta_keywords !== undefined) data.metaKeywords = args.meta_keywords;
        const service = await prisma.wehowareService.update({ where: { id: args.service_id }, data });
        return JSON.stringify({ message: "Service updated", service: { id: service.id, title: service.title, active: service.active } });
      }

      case "get_service_categories": {
        const categories = await prisma.wehowareServiceCategory.findMany({
          where: { clientId, active: true },
          select: { id: true, name: true, slug: true, description: true, _count: { select: { services: true } } },
        });
        return JSON.stringify({ categories, total: categories.length });
      }

      case "create_service_category": {
        const slug = args.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const category = await prisma.wehowareServiceCategory.create({
          data: {
            clientId, createdBy: userId,
            name: args.name,
            slug,
            description: args.description || null,
          },
        });
        return JSON.stringify({ message: "Service category created", category: { id: category.id, name: category.name, slug: category.slug } });
      }

      // ═══════════════════════════════════════════════════════════════
      // FORM MODULE
      // ═══════════════════════════════════════════════════════════════
      case "get_forms": {
        const forms = await prisma.wehowareFormTemplate.findMany({
          where: { clientId },
          select: { id: true, title: true, description: true, status: true, successMessage: true, _count: { select: { submissions: true, fields: true } } },
        });
        return JSON.stringify({ forms, total: forms.length });
      }

      case "get_form_submissions": {
        const where = { formTemplateId: args.form_id, clientId };
        if (args.status) where.status = args.status;
        const submissions = await prisma.wehowareFormSubmission.findMany({
          where, take: limit, orderBy: { submittedAt: "desc" },
          select: { id: true, submissionData: true, submittedAt: true, status: true, notes: true, ipAddress: true, updatedAt: true },
        });
        return JSON.stringify({ submissions, total: submissions.length });
      }

      case "create_form": {
        const form = await prisma.wehowareFormTemplate.create({
          data: {
            clientId, createdBy: userId,
            title: args.title,
            description: args.description || null,
            successMessage: args.success_message || "Thank you for your submission!",
            notificationEmails: args.notification_emails ? JSON.stringify(args.notification_emails) : JSON.stringify([]),
            status: "Draft",
          },
        });
        // Create fields if provided
        if (args.fields && Array.isArray(args.fields)) {
          for (let i = 0; i < args.fields.length; i++) {
            const f = args.fields[i];
            await prisma.wehowareFormField.create({
              data: {
                clientId,
                formTemplateId: form.id,
                fieldType: f.field_type || "text",
                label: f.label,
                placeholder: f.placeholder || null,
                helpText: null,
                required: f.required || false,
                fieldOrder: f.field_order !== undefined ? f.field_order : i,
                options: f.options ? JSON.stringify(f.options) : JSON.stringify([]),
                validationRules: JSON.stringify({}),
              },
            });
          }
        }
        return JSON.stringify({ message: "Form created", form: { id: form.id, title: form.title, status: form.status } });
      }

      // ═══════════════════════════════════════════════════════════════
      // REPORT MODULE
      // ═══════════════════════════════════════════════════════════════
      case "get_reports": {
        const reports = await prisma.wehowareReport.findMany({
          where: { clientId },
          take: limit, orderBy: { createdAt: "desc" },
          select: { id: true, title: true, description: true, status: true, dateRangeStart: true, dateRangeEnd: true, isScheduled: true, scheduleFrequency: true, lastGeneratedAt: true, createdAt: true },
        });
        return JSON.stringify({ reports, total: reports.length });
      }

      case "get_report_templates": {
        const templates = await prisma.wehowareReportTemplate.findMany({
          where: { clientId },
          select: { id: true, title: true, description: true, reportType: true, isSystemTemplate: true, createdAt: true },
        });
        return JSON.stringify({ templates, total: templates.length });
      }

      case "create_report": {
        const report = await prisma.wehowareReport.create({
          data: {
            clientId, createdBy: userId,
            templateId: args.template_id,
            title: args.title,
            description: args.description || null,
            dateRangeStart: args.date_range_start ? new Date(args.date_range_start) : null,
            dateRangeEnd: args.date_range_end ? new Date(args.date_range_end) : null,
            status: "Draft",
          },
        });
        return JSON.stringify({ message: "Report created", report: { id: report.id, title: report.title, status: report.status } });
      }

      case "get_dashboard_report": {
        const totalTasks = await prisma.wehowareTask.count({ where: { clientId } });
        const doneTasks = await prisma.wehowareTask.count({ where: { clientId, status: "Done" } });
        const overdueTasks = await prisma.wehowareTask.count({ where: { clientId, dueDate: { lt: new Date() }, status: { not: "Done" } } });
        const totalContacts = await prisma.wehowareCrmContact.count({ where: { clientId, active: true } });
        const totalInvoices = await prisma.wehowareInvoice.count({ where: { clientId } });
        const unpaidInvoices = await prisma.wehowareInvoice.count({ where: { clientId, status: { in: ["Pending", "Overdue"] } } });
        const invoiceTotals = await prisma.wehowareInvoice.aggregate({
          where: { clientId, status: { in: ["Pending", "Overdue"] } },
          _sum: { total: true },
        });
        const totalAppointments = await prisma.wehowareAppointment.count({ where: { clientId } });
        const upcomingAppointments = await prisma.wehowareAppointment.count({
          where: { clientId, scheduledAt: { gt: new Date() }, status: { in: ["Pending", "Confirmed"] } },
        });
        const totalBlogs = await prisma.wehowareBlog.count({ where: { clientId } });
        const publishedBlogs = await prisma.wehowareBlog.count({ where: { clientId, status: "Published" } });
        return JSON.stringify({
          tasks: { total: totalTasks, completed: doneTasks, completionRate: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0, overdue: overdueTasks },
          crm: { totalContacts },
          invoices: { total: totalInvoices, unpaid: unpaidInvoices, unpaidTotal: invoiceTotals._sum.total || 0 },
          appointments: { total: totalAppointments, upcoming: upcomingAppointments },
          content: { totalBlogs, publishedBlogs },
        });
      }

      // ═══════════════════════════════════════════════════════════════
      // INVENTORY MODULE
      // ═══════════════════════════════════════════════════════════════
      case "get_inventory_items": {
        const where = { clientId };
        if (args.category_id) where.categoryId = args.category_id;
        if (args.active !== undefined) where.active = args.active;
        const items = await prisma.wehowareInventoryItem.findMany({
          where, take: limit, orderBy: { createdAt: "desc" },
          select: { id: true, title: true, sku: true, description: true, price: true, currency: true, quantity: true, reorderThreshold: true, status: true, featured: true, active: true, categoryId: true, createdAt: true, updatedAt: true },
        });
        return JSON.stringify({ items, total: items.length });
      }

      case "create_inventory_item": {
        const slug = args.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const item = await prisma.wehowareInventoryItem.create({
          data: {
            clientId, createdBy: userId,
            title: args.title,
            slug,
            sku: args.sku || null,
            description: args.description || null,
            categoryId: args.category_id || null,
            price: args.price !== undefined ? parseFloat(args.price) : null,
            currency: args.currency || "CAD",
            quantity: args.quantity || 0,
            reorderThreshold: args.reorder_threshold || 5,
            tags: args.tags ? JSON.stringify(args.tags) : JSON.stringify([]),
            featured: args.featured || false,
            active: args.active !== undefined ? args.active : true,
          },
        });
        // Create initial stock movement if quantity > 0
        if (args.quantity && args.quantity > 0) {
          await prisma.wehowareInventoryStockMovement.create({
            data: {
              itemId: item.id, clientId, createdBy: userId,
              movementType: "initial",
              quantityChange: args.quantity,
              quantityAfter: args.quantity,
              reason: "Initial stock on item creation",
            },
          });
        }
        return JSON.stringify({ message: "Inventory item created", item: { id: item.id, title: item.title, sku: item.sku, quantity: item.quantity } });
      }

      case "update_inventory_item": {
        const existing = await prisma.wehowareInventoryItem.findFirst({
          where: { id: args.item_id, clientId },
        });
        if (!existing) return JSON.stringify({ error: "Item not found" });
        const data = { updatedBy: userId };
        if (args.title !== undefined) data.title = args.title;
        if (args.sku !== undefined) data.sku = args.sku;
        if (args.description !== undefined) data.description = args.description;
        if (args.category_id !== undefined) data.categoryId = args.category_id;
        if (args.price !== undefined) data.price = parseFloat(args.price);
        if (args.currency !== undefined) data.currency = args.currency;
        if (args.reorder_threshold !== undefined) data.reorderThreshold = args.reorder_threshold;
        if (args.status !== undefined) data.status = args.status;
        if (args.featured !== undefined) data.featured = args.featured;
        if (args.active !== undefined) data.active = args.active;
        if (args.tags !== undefined) data.tags = JSON.stringify(args.tags);
        // Handle quantity change with stock movement
        if (args.quantity !== undefined && args.quantity !== existing.quantity) {
          const change = args.quantity - existing.quantity;
          data.quantity = args.quantity;
          await prisma.wehowareInventoryStockMovement.create({
            data: {
              itemId: args.item_id, clientId, createdBy: userId,
              movementType: change > 0 ? "adjustment_in" : "adjustment_out",
              quantityChange: change,
              quantityAfter: args.quantity,
              reason: "Manual adjustment via AI assistant",
            },
          });
        }
        const item = await prisma.wehowareInventoryItem.update({ where: { id: args.item_id }, data });
        return JSON.stringify({ message: "Inventory item updated", item: { id: item.id, title: item.title, quantity: item.quantity, price: item.price } });
      }

      case "get_inventory_categories": {
        const categories = await prisma.wehowareInventoryCategory.findMany({
          where: { clientId, active: true },
          select: { id: true, name: true, slug: true, description: true, _count: { select: { items: true } } },
        });
        return JSON.stringify({ categories, total: categories.length });
      }

      case "get_stock_movements": {
        const movements = await prisma.wehowareInventoryStockMovement.findMany({
          where: { itemId: args.item_id, clientId },
          take: limit, orderBy: { createdAt: "desc" },
          select: { id: true, movementType: true, quantityChange: true, quantityAfter: true, reason: true, createdBy: true, createdAt: true },
        });
        return JSON.stringify({ movements, total: movements.length });
      }

      // ═══════════════════════════════════════════════════════════════
      // GOALS MODULE
      // ═══════════════════════════════════════════════════════════════
      case "get_goals": {
        const where = { clientId };
        if (args.status) where.status = args.status;
        const goals = await prisma.wehowareGoal.findMany({
          where, take: limit, orderBy: { createdAt: "desc" },
          include: {
            keyResults: { select: { id: true, title: true, targetValue: true, currentValue: true, unit: true, weight: true, status: true } },
          },
        });
        return JSON.stringify({ goals, total: goals.length });
      }

      case "create_goal": {
        const goal = await prisma.wehowareGoal.create({
          data: {
            clientId, createdBy: userId,
            title: args.title,
            description: args.description || null,
            startDate: new Date(args.start_date),
            endDate: new Date(args.end_date),
            ownerId: args.owner_id || null,
            status: "Not_Started",
          },
        });
        return JSON.stringify({ message: "Goal created", goal: { id: goal.id, title: goal.title, status: goal.status } });
      }

      case "update_goal": {
        const existing = await prisma.wehowareGoal.findFirst({
          where: { id: args.goal_id, clientId },
        });
        if (!existing) return JSON.stringify({ error: "Goal not found" });
        const data = {};
        if (args.title !== undefined) data.title = args.title;
        if (args.description !== undefined) data.description = args.description;
        if (args.status !== undefined) data.status = args.status;
        if (args.progress_percentage !== undefined) data.progressPercentage = args.progress_percentage;
        if (args.end_date !== undefined) data.endDate = new Date(args.end_date);
        if (args.owner_id !== undefined) data.ownerId = args.owner_id;
        const goal = await prisma.wehowareGoal.update({ where: { id: args.goal_id }, data });
        return JSON.stringify({ message: "Goal updated", goal: { id: goal.id, title: goal.title, status: goal.status, progressPercentage: goal.progressPercentage } });
      }

      // ═══════════════════════════════════════════════════════════════
      // VENDOR & CUSTOMER MODULE
      // ═══════════════════════════════════════════════════════════════
      case "get_vendors": {
        const where = { clientId };
        if (args.active !== undefined) where.active = args.active;
        const vendors = await prisma.wehowareVendor.findMany({
          where, take: limit, orderBy: { createdAt: "desc" },
          select: { id: true, name: true, contactPerson: true, email: true, phone: true, address: true, taxNumber: true, website: true, notes: true, active: true, createdAt: true },
        });
        return JSON.stringify({ vendors, total: vendors.length });
      }

      case "create_vendor": {
        const vendor = await prisma.wehowareVendor.create({
          data: {
            clientId, createdBy: userId,
            name: args.name,
            contactPerson: args.contact_person || null,
            email: args.email || null,
            phone: args.phone || null,
            address: args.address || null,
            taxNumber: args.tax_number || null,
            website: args.website || null,
            notes: args.notes || null,
          },
        });
        return JSON.stringify({ message: "Vendor created", vendor: { id: vendor.id, name: vendor.name } });
      }

      case "get_customers": {
        const where = { clientId };
        if (args.active !== undefined) where.active = args.active;
        const customers = await prisma.wehowareCustomer.findMany({
          where, take: limit, orderBy: { createdAt: "desc" },
          select: { id: true, name: true, contactPerson: true, email: true, phone: true, billingAddress: true, shippingAddress: true, taxNumber: true, website: true, paymentTerms: true, currency: true, notes: true, active: true, createdAt: true },
        });
        return JSON.stringify({ customers, total: customers.length });
      }

      case "create_customer": {
        const customer = await prisma.wehowareCustomer.create({
          data: {
            clientId, createdBy: userId,
            name: args.name,
            contactPerson: args.contact_person || null,
            email: args.email || null,
            phone: args.phone || null,
            billingAddress: args.billing_address || null,
            shippingAddress: args.shipping_address || null,
            taxNumber: args.tax_number || null,
            website: args.website || null,
            paymentTerms: args.payment_terms || null,
            currency: args.currency || "CAD",
            notes: args.notes || null,
          },
        });
        return JSON.stringify({ message: "Customer created", customer: { id: customer.id, name: customer.name } });
      }

      // ═══════════════════════════════════════════════════════════════
      // BANKING & BILLS MODULE
      // ═══════════════════════════════════════════════════════════════
      case "get_bank_accounts": {
        const accounts = await prisma.wehowareBankAccount.findMany({
          where: { clientId },
          select: { id: true, name: true, institutionName: true, type: true, mask: true, currency: true, balance: true, isActive: true, lastSyncAt: true, createdAt: true },
        });
        return JSON.stringify({ accounts, total: accounts.length });
      }

      case "get_transactions": {
        const where = { clientId };
        if (args.status) where.status = args.status;
        if (args.direction) where.direction = args.direction;
        if (args.bank_account_id) where.bankAccountId = args.bank_account_id;
        const transactions = await prisma.wehowareTransaction.findMany({
          where, take: limit, orderBy: { transactionDate: "desc" },
          select: { id: true, transactionDate: true, description: true, amount: true, status: true, reference: true, currency: true, notes: true, direction: true, reconciliation: true, source: true, invoiceId: true, bankAccountId: true, createdAt: true },
        });
        return JSON.stringify({ transactions, total: transactions.length });
      }

      case "get_bills": {
        const where = { clientId };
        if (args.status) where.status = args.status;
        const bills = await prisma.wehowareBill.findMany({
          where, take: limit, orderBy: { createdAt: "desc" },
          select: { id: true, billNumber: true, vendorId: true, billDate: true, dueDate: true, status: true, subtotal: true, taxRate: true, taxAmount: true, total: true, amountPaid: true, currency: true, notes: true, paidAt: true, createdAt: true },
        });
        return JSON.stringify({ bills, total: bills.length });
      }

      case "create_bill": {
        const lineItems = args.line_items || [];
        const subtotal = lineItems.reduce((sum, li) => sum + (parseFloat(li.quantity) * parseFloat(li.unit_price)), 0);
        const taxRate = args.tax_rate !== undefined ? parseFloat(args.tax_rate) : 0;
        const taxAmount = subtotal * (taxRate / 100);
        const total = subtotal + taxAmount;
        const bill = await prisma.wehowareBill.create({
          data: {
            clientId, createdBy: userId,
            vendorId: args.vendor_id,
            billNumber: args.bill_number,
            billDate: args.bill_date ? new Date(args.bill_date) : new Date(),
            dueDate: new Date(args.due_date),
            status: "Draft",
            subtotal,
            taxRate,
            taxAmount,
            total,
            currency: args.currency || "CAD",
            notes: args.notes || null,
          },
        });
        for (let i = 0; i < lineItems.length; i++) {
          const li = lineItems[i];
          await prisma.wehowareBillLineItem.create({
            data: {
              billId: bill.id, clientId,
              description: li.description,
              quantity: parseFloat(li.quantity),
              unitPrice: parseFloat(li.unit_price),
              total: parseFloat(li.quantity) * parseFloat(li.unit_price),
              sortOrder: i,
            },
          });
        }
        return JSON.stringify({ message: "Bill created", bill: { id: bill.id, billNumber: bill.billNumber, total: bill.total, status: bill.status } });
      }

      case "get_expenses": {
        const where = { clientId };
        if (args.status) where.status = args.status;
        if (args.category) where.category = args.category;
        const expenses = await prisma.wehowareExpense.findMany({
          where, take: limit, orderBy: { expenseDate: "desc" },
          select: { id: true, description: true, category: true, amount: true, taxAmount: true, currency: true, expenseDate: true, receiptUrl: true, status: true, approvedBy: true, approvedAt: true, rejectedReason: true, reimbursedAt: true, notes: true, submittedBy: true, createdAt: true },
        });
        return JSON.stringify({ expenses, total: expenses.length });
      }

      // ═══════════════════════════════════════════════════════════════
      // USERS & TEAM MODULE
      // ═══════════════════════════════════════════════════════════════
      case "get_team_members": {
        const userClients = await prisma.wehowareUserClient.findMany({
          where: { clientId, active: true },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true, role: true } },
          },
        });
        const members = userClients.map(uc => ({
          id: uc.user.id,
          firstName: uc.user.firstName,
          lastName: uc.user.lastName,
          email: uc.user.email,
          avatarUrl: uc.user.avatarUrl,
          systemRole: uc.user.role,
          clientRole: uc.role,
          isPrimary: uc.isPrimary,
        }));
        return JSON.stringify({ teamMembers: members, total: members.length });
      }

      case "get_users": {
        const where = {};
        if (args.role) where.role = args.role;
        const users = await prisma.wehowareProfile.findMany({
          where, take: limit, orderBy: { createdAt: "desc" },
          select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true, role: true, clientId: true, createdAt: true },
        });
        return JSON.stringify({ users, total: users.length });
      }

      // ═══════════════════════════════════════════════════════════════
      // CLIENT & SETTINGS MODULE
      // ═══════════════════════════════════════════════════════════════
      case "get_clients_info": {
        const client = await prisma.wehowareClient.findUnique({
          where: { id: clientId },
          select: { id: true, companyName: true, contactPerson: true, contactNumber: true, email: true, address: true, website: true, industry: true, domain: true, active: true, publicSlug: true, createdAt: true, updatedAt: true },
        });
        if (!client) return JSON.stringify({ error: "Client not found" });
        return JSON.stringify({ client });
      }

      case "update_client_info": {
        const data = {};
        if (args.company_name !== undefined) data.companyName = args.company_name;
        if (args.contact_person !== undefined) data.contactPerson = args.contact_person;
        if (args.contact_number !== undefined) data.contactNumber = args.contact_number;
        if (args.email !== undefined) data.email = args.email;
        if (args.address !== undefined) data.address = args.address;
        if (args.website !== undefined) data.website = args.website;
        if (args.industry !== undefined) data.industry = args.industry;
        if (args.domain !== undefined) data.domain = args.domain;
        const client = await prisma.wehowareClient.update({ where: { id: clientId }, data });
        return JSON.stringify({ message: "Client info updated", client: { id: client.id, companyName: client.companyName, domain: client.domain } });
      }

      case "get_settings": {
        const where = { clientId };
        if (args.group) where.settingGroup = args.group;
        const settings = await prisma.wehowareSetting.findMany({
          where,
          select: { id: true, settingKey: true, settingValue: true, settingGroup: true, updatedAt: true },
        });
        return JSON.stringify({ settings, total: settings.length });
      }

      // ═══════════════════════════════════════════════════════════════
      // SEO MODULE
      // ═══════════════════════════════════════════════════════════════
      case "get_seo_keywords": {
        const keywords = await prisma.wehowareClientKeyword.findMany({
          where: { clientId },
          select: { id: true, employeeId: true, keywords: true, createdAt: true, updatedAt: true },
        });
        return JSON.stringify({ keywords, total: keywords.length });
      }

      case "get_seo_analyser_runs": {
        const runs = await prisma.wehowareSeoAnalyserRun.findMany({
          where: { clientId },
          take: limit, orderBy: { createdAt: "desc" },
          select: { id: true, contentType: true, contentSlug: true, contentTitle: true, status: true, scoreBefore: true, scoreAfter: true, issuesCount: true, suggestionsCount: true, llmProvider: true, llmModel: true, createdAt: true, completedAt: true },
        });
        return JSON.stringify({ runs, total: runs.length });
      }

      case "get_seo_analyser_issues": {
        const where = { clientId };
        if (args.run_id) where.runId = args.run_id;
        if (args.severity) where.severity = args.severity;
        const issues = await prisma.wehowareSeoAnalyserIssue.findMany({
          where, take: limit, orderBy: { createdAt: "desc" },
          select: { id: true, runId: true, itemType: true, itemTitle: true, itemSlug: true, category: true, issueType: true, severity: true, title: true, description: true, currentValue: true, recommendedValue: true, status: true, createdAt: true },
        });
        return JSON.stringify({ issues, total: issues.length });
      }

      case "get_seo_analyser_suggestions": {
        const where = { clientId };
        if (args.issue_id) where.issueId = args.issue_id;
        if (args.status) where.status = args.status;
        const suggestions = await prisma.wehowareSeoAnalyserSuggestion.findMany({
          where, take: limit, orderBy: { createdAt: "desc" },
          select: { id: true, issueId: true, itemType: true, fixType: true, fieldName: true, action: true, currentValue: true, suggestedValue: true, explanation: true, status: true, approvedBy: true, approvedAt: true, appliedBy: true, appliedAt: true, createdAt: true },
        });
        return JSON.stringify({ suggestions, total: suggestions.length });
      }

      case "get_seo_settings": {
        const settings = await prisma.wehowareSeoAnalyserSetting.findUnique({ where: { clientId } });
        if (!settings) return JSON.stringify({ message: "No SEO analyser settings found for this client." });
        return JSON.stringify({ settings });
      }

      // ═══════════════════════════════════════════════════════════════
      // DAILY REPORTS MODULE
      // ═══════════════════════════════════════════════════════════════
      case "get_daily_reports": {
        const where = { clientId };
        if (args.status) where.status = args.status;
        const reports = await prisma.wehowareDailyWorkReport.findMany({
          where, take: limit, orderBy: { reportDate: "desc" },
          select: { id: true, userId: true, creatorRole: true, reportDate: true, startTime: true, endTime: true, summary: true, totalHours: true, status: true, submittedAt: true, createdAt: true },
        });
        return JSON.stringify({ reports, total: reports.length });
      }

      case "get_daily_report_summary": {
        const total = await prisma.wehowareDailyWorkReport.count({ where: { clientId } });
        const draft = await prisma.wehowareDailyWorkReport.count({ where: { clientId, status: "draft" } });
        const submitted = await prisma.wehowareDailyWorkReport.count({ where: { clientId, status: "submitted" } });
        const approved = await prisma.wehowareDailyWorkReport.count({ where: { clientId, status: "approved" } });
        const rejected = await prisma.wehowareDailyWorkReport.count({ where: { clientId, status: "rejected" } });
        const hoursAgg = await prisma.wehowareDailyWorkReport.aggregate({
          where: { clientId, status: "approved" },
          _sum: { totalHours: true },
        });
        return JSON.stringify({
          total,
          byStatus: { draft, submitted, approved, rejected },
          totalApprovedHours: hoursAgg._sum.totalHours || 0,
        });
      }

      // ═══════════════════════════════════════════════════════════════
      // INQUIRIES MODULE
      // ═══════════════════════════════════════════════════════════════
      case "get_inquiries": {
        const where = { clientId };
        if (args.status) where.status = args.status;
        const inquiries = await prisma.wehowareInquiry.findMany({
          where, take: limit, orderBy: { createdAt: "desc" },
          select: { id: true, name: true, email: true, phone: true, subject: true, message: true, serviceId: true, status: true, createdAt: true, updatedAt: true },
        });
        return JSON.stringify({ inquiries, total: inquiries.length });
      }

      // ═══════════════════════════════════════════════════════════════
      // INTEGRATIONS MODULE
      // ═══════════════════════════════════════════════════════════════
      case "get_integrations": {
        const integrations = await prisma.wehowareIntegration.findMany({
          where: { clientId },
          select: { id: true, name: true, status: true, lastSyncAt: true, syncFrequency: true, providerId: true, createdAt: true, updatedAt: true },
        });
        return JSON.stringify({ integrations, total: integrations.length });
      }

      case "get_integration_logs": {
        const where = { clientId };
        if (args.integration_id) where.integrationId = args.integration_id;
        const logs = await prisma.wehowareIntegrationLog.findMany({
          where, take: Math.min(args.limit || 10, 50), orderBy: { startTime: "desc" },
          select: { id: true, integrationId: true, operation: true, status: true, startTime: true, endTime: true, recordsProcessed: true, errorMessage: true },
        });
        return JSON.stringify({ logs, total: logs.length });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (err) {
    console.error(`[baddy] Tool call error (${toolName}):`, err);
    return JSON.stringify({ error: `Failed to execute ${toolName}: ${err.message}` });
  }
}

/**
 * Main chat function — async generator that yields text chunks for streaming.
 * Sends a message to the LLM with tool-calling support.
 * Handles multi-turn tool calls (up to 10 iterations) and stores conversation
 * memory in Mem0.
 *
 * @param {object} params - { systemPrompt, messages, clientId, userId, enableThinking }
 * @yields {string} - text chunks of the assistant response
 */
export async function* chatWithBaddy({ systemPrompt, messages, clientId, userId, enableThinking }) {
  if (!clientId) {
    yield "I don't have an active client context. Please select a client workspace first, then I can help you manage their data.";
    return;
  }

  // Build system prompt with memory
  const lastUserMsg = [...messages].reverse().find(m => m.role === "user")?.content || "";
  const memoryContext = await searchMemories(userId, clientId, lastUserMsg);
  const fullSystemPrompt = systemPrompt + memoryContext;

  // Prepare messages for the LLM
  const llmMessages = [
    { role: "system", content: fullSystemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ];

  const tools = getToolDefinitions();
  const MAX_ITERATIONS = 10;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    // Call vLLM with streaming
    const response = await fetch(`${VLLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${VLLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: VLLM_MODEL,
        messages: llmMessages,
        tools,
        tool_choice: "auto",
        temperature: 0.7,
        max_tokens: 4096,
        stream: true,
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "Unknown error");
      console.error("[baddy] vLLM error:", response.status, errText);
      yield `I encountered an error connecting to the AI model (HTTP ${response.status}). Please try again in a moment.`;
      return;
    }

    // Parse SSE stream from vLLM
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";
    let toolCalls = [];
    let finishReason = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE lines
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          if (!delta) continue;
          if (delta.content) {
            fullContent += delta.content;
            yield delta.content;
          }
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index || 0;
              if (!toolCalls[idx]) {
                toolCalls[idx] = { id: tc.id, function: { name: "", arguments: "" } };
              }
              if (tc.id) toolCalls[idx].id = tc.id;
              if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
              if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
            }
          }
          if (parsed.choices?.[0]?.finish_reason) {
            finishReason = parsed.choices[0].finish_reason;
          }
        } catch (e) {
          // Skip unparseable chunks
        }
      }
    }

    // Build assistant message for next iteration
    const assistantMessage = { role: "assistant", content: fullContent || null };
    if (toolCalls.length > 0) {
      assistantMessage.tool_calls = toolCalls.filter(Boolean).map(tc => ({
        id: tc.id,
        type: "function",
        function: tc.function,
      }));
    }
    llmMessages.push(assistantMessage);

    // If there are tool calls, execute them
    if (toolCalls.length > 0 && toolCalls.some(tc => tc?.function?.name)) {
      for (const toolCall of toolCalls.filter(Boolean)) {
        if (!toolCall?.function?.name) continue;
        const toolName = toolCall.function.name;
        let toolArgs = {};
        try {
          toolArgs = JSON.parse(toolCall.function.arguments || "{}");
        } catch (e) {
          console.error("[baddy] Failed to parse tool args:", toolCall.function.arguments);
        }

        // Execute the tool
        const result = await executeToolCall(toolName, toolArgs, clientId, userId);

        // Add tool result to conversation
        llmMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }
      // Continue to next iteration — LLM will process tool results
      continue;
    }

    // No tool calls — we have a final response
    // Store conversation in Mem0 (async, non-blocking)
    storeConversationMemory(userId, clientId, lastUserMsg, fullContent);
    return;
  }

  // Exceeded max iterations
  yield "\n\n*I've reached the maximum number of tool calls for this request. Here's what I've gathered so far — please ask me a more specific question if you need further details.*";
}
