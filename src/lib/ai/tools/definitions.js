// src/lib/ai/tools/definitions.js
// Tool definitions exposed to the LLM.
//
// These are the ONLY operations the AI can perform.
// All are scoped to the user's activeClientId at execution time.
// NO DELETE operations — only read, create, and update.
//
// DYNAMIC TOOL SELECTION: Tools are organized by category so that
// only the relevant subset is sent to the LLM per request, reducing
// token overhead and improving tool-calling accuracy with Qwen models.

// All 89 tool definitions (read, create, update — NO delete)
export const ALL_TOOLS = [
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
    }
];

// Category -> tool names mapping for dynamic selection
export const TOOL_CATEGORIES = {
  APPOINTMENT: ["get_appointments", "create_appointment", "update_appointment", "get_appointment_types", "create_appointment_type"],
  BANKING: ["get_bank_accounts", "get_transactions", "get_bills", "create_bill", "get_expenses"],
  BLOG: ["get_blogs", "create_blog", "update_blog", "get_blog_categories", "create_blog_category"],
  CLIENT: ["get_clients_info", "update_client_info", "get_settings"],
  CRM: ["get_crm_dashboard", "get_crm_contacts", "create_crm_contact", "update_crm_contact", "get_crm_deals", "create_crm_deal", "update_crm_deal", "get_crm_pipelines", "get_crm_activities", "create_crm_activity", "get_crm_contact_lists", "add_contact_to_list"],
  DAILY_REPORT: ["get_daily_reports", "get_daily_report_summary"],
  FORM: ["get_forms", "get_form_submissions", "create_form"],
  GOAL: ["get_goals", "create_goal", "update_goal"],
  INQUIRY: ["get_inquiries"],
  INTEGRATION: ["get_integrations", "get_integration_logs"],
  INVENTORY: ["get_inventory_items", "create_inventory_item", "update_inventory_item", "get_inventory_categories", "get_stock_movements"],
  INVOICE: ["get_invoices", "create_invoice", "update_invoice", "get_invoice_line_items", "get_invoice_settings", "update_invoice_settings"],
  REPORT: ["get_reports", "get_report_templates", "create_report", "get_dashboard_report"],
  SEO: ["get_seo_keywords", "get_seo_analyser_runs", "get_seo_analyser_issues", "get_seo_analyser_suggestions", "get_seo_settings"],
  SERVICE: ["get_services", "create_service", "update_service", "get_service_categories", "create_service_category"],
  SOCIAL_MEDIA: ["get_social_posts", "create_social_post", "update_social_post", "publish_social_post", "get_social_accounts", "get_social_analytics", "get_social_inbox", "reply_social_inbox"],
  TASKS: ["get_tasks", "create_task", "update_task", "get_task_stats", "get_task_comments", "add_task_comment", "get_subtasks", "create_subtask", "add_time_entry"],
  USER: ["get_team_members", "get_users"],
  VENDOR_CUSTOMER: ["get_vendors", "create_vendor", "get_customers", "create_customer"],
};

// Keyword -> category mapping for intent-based tool selection
export const CATEGORY_KEYWORDS = {
  APPOINTMENT: ["appointment", "booking", "schedule", "meeting", "calendar"],
  BANKING: ["bank", "account", "transaction", "transfer", "deposit", "withdrawal", "expense", "reimburse", "receipt", "spend"],
  BLOG: ["blog", "article", "post", "content", "category"],
  CLIENT: ["client", "company", "setting", "config", "preference"],
  CRM: ["contact", "lead", "customer", "deal", "pipeline", "stage", "activity", "crm", "sales", "opportunity"],
  DAILY_REPORT: ["daily report", "work report", "timesheet", "hours", "daily work"],
  FORM: ["form", "submission", "field", "survey"],
  GOAL: ["goal", "objective", "key result", "okr", "target"],
  INQUIRY: ["inquiry", "enquiry", "lead form", "contact form"],
  INTEGRATION: ["integration", "sync", "connect", "api key", "webhook"],
  INVENTORY: ["inventory", "stock", "product", "item", "sku", "warehouse"],
  INVOICE: ["invoice", "bill", "payment", "tax", "billing"],
  REPORT: ["report", "analytics", "dashboard", "statistics", "stats", "performance"],
  SEO: ["seo", "keyword", "search engine", "ranking", "analyser", "optimization", "meta tag", "schema"],
  SERVICE: ["service", "offering", "catalog"],
  SOCIAL_MEDIA: ["social", "post", "facebook", "instagram", "twitter", "tiktok", "publish", "schedule", "inbox", "message", "hashtag", "media"],
  TASKS: ["task", "todo", "to-do", "subtask", "comment", "time entry", "assign", "deadline", "due"],
  USER: ["user", "team", "member", "employee", "staff", "profile"],
  VENDOR_CUSTOMER: ["vendor", "supplier", "customer", "client"],
};

// Tool name -> category reverse lookup
export const TOOL_TO_CATEGORY = {
  "add_contact_to_list": "CRM",
  "add_task_comment": "TASKS",
  "add_time_entry": "TASKS",
  "create_appointment": "APPOINTMENT",
  "create_appointment_type": "APPOINTMENT",
  "create_bill": "BANKING",
  "create_blog": "BLOG",
  "create_blog_category": "BLOG",
  "create_crm_activity": "CRM",
  "create_crm_contact": "CRM",
  "create_crm_deal": "CRM",
  "create_customer": "VENDOR_CUSTOMER",
  "create_form": "FORM",
  "create_goal": "GOAL",
  "create_inventory_item": "INVENTORY",
  "create_invoice": "INVOICE",
  "create_report": "REPORT",
  "create_service": "SERVICE",
  "create_service_category": "SERVICE",
  "create_social_post": "SOCIAL_MEDIA",
  "create_subtask": "TASKS",
  "create_task": "TASKS",
  "create_vendor": "VENDOR_CUSTOMER",
  "get_appointment_types": "APPOINTMENT",
  "get_appointments": "APPOINTMENT",
  "get_bank_accounts": "BANKING",
  "get_bills": "BANKING",
  "get_blog_categories": "BLOG",
  "get_blogs": "BLOG",
  "get_clients_info": "CLIENT",
  "get_crm_activities": "CRM",
  "get_crm_contact_lists": "CRM",
  "get_crm_contacts": "CRM",
  "get_crm_dashboard": "CRM",
  "get_crm_deals": "CRM",
  "get_crm_pipelines": "CRM",
  "get_customers": "VENDOR_CUSTOMER",
  "get_daily_report_summary": "DAILY_REPORT",
  "get_daily_reports": "DAILY_REPORT",
  "get_dashboard_report": "REPORT",
  "get_expenses": "BANKING",
  "get_form_submissions": "FORM",
  "get_forms": "FORM",
  "get_goals": "GOAL",
  "get_inquiries": "INQUIRY",
  "get_integration_logs": "INTEGRATION",
  "get_integrations": "INTEGRATION",
  "get_inventory_categories": "INVENTORY",
  "get_inventory_items": "INVENTORY",
  "get_invoice_line_items": "INVOICE",
  "get_invoice_settings": "INVOICE",
  "get_invoices": "INVOICE",
  "get_report_templates": "REPORT",
  "get_reports": "REPORT",
  "get_seo_analyser_issues": "SEO",
  "get_seo_analyser_runs": "SEO",
  "get_seo_analyser_suggestions": "SEO",
  "get_seo_keywords": "SEO",
  "get_seo_settings": "SEO",
  "get_service_categories": "SERVICE",
  "get_services": "SERVICE",
  "get_settings": "CLIENT",
  "get_social_accounts": "SOCIAL_MEDIA",
  "get_social_analytics": "SOCIAL_MEDIA",
  "get_social_inbox": "SOCIAL_MEDIA",
  "get_social_posts": "SOCIAL_MEDIA",
  "get_stock_movements": "INVENTORY",
  "get_subtasks": "TASKS",
  "get_task_comments": "TASKS",
  "get_task_stats": "TASKS",
  "get_tasks": "TASKS",
  "get_team_members": "USER",
  "get_transactions": "BANKING",
  "get_users": "USER",
  "get_vendors": "VENDOR_CUSTOMER",
  "publish_social_post": "SOCIAL_MEDIA",
  "reply_social_inbox": "SOCIAL_MEDIA",
  "update_appointment": "APPOINTMENT",
  "update_blog": "BLOG",
  "update_client_info": "CLIENT",
  "update_crm_contact": "CRM",
  "update_crm_deal": "CRM",
  "update_goal": "GOAL",
  "update_inventory_item": "INVENTORY",
  "update_invoice": "INVOICE",
  "update_invoice_settings": "INVOICE",
  "update_service": "SERVICE",
  "update_social_post": "SOCIAL_MEDIA",
  "update_task": "TASKS",
};

// ─── Role-based tool access control ──────────────────────────────────
// Defines which tool categories each role can access.
// - admin/employee: ALL categories (full platform management)
// - client (owner) / manager: All categories except USER (can't list users across platform)
// - editor: Content + CRM + Tasks + Appointments + Social + Blog + Service + SEO + Forms + Inquiries
// - viewer: Read-only tools (get_*) — no create/update tools

export const ROLE_TOOL_CATEGORIES = {
  admin: null,   // null = all categories
  employee: null, // null = all categories
  client: [
    "CRM", "TASKS", "SOCIAL_MEDIA", "INVOICE", "APPOINTMENT", "BLOG",
    "SERVICE", "FORM", "REPORT", "INVENTORY", "GOAL", "VENDOR_CUSTOMER",
    "BANKING", "DAILY_REPORT", "INQUIRY", "INTEGRATION", "CLIENT", "SEO",
  ],
  manager: [
    "CRM", "TASKS", "SOCIAL_MEDIA", "INVOICE", "APPOINTMENT", "BLOG",
    "SERVICE", "FORM", "REPORT", "INVENTORY", "GOAL", "VENDOR_CUSTOMER",
    "BANKING", "DAILY_REPORT", "INQUIRY", "INTEGRATION", "CLIENT", "SEO",
  ],
  editor: [
    "CRM", "TASKS", "SOCIAL_MEDIA", "APPOINTMENT", "BLOG",
    "SERVICE", "FORM", "INQUIRY", "SEO",
  ],
  viewer: [
    "CRM", "TASKS", "SOCIAL_MEDIA", "INVOICE", "APPOINTMENT", "BLOG",
    "SERVICE", "FORM", "REPORT", "INVENTORY", "GOAL", "VENDOR_CUSTOMER",
    "BANKING", "DAILY_REPORT", "INQUIRY", "INTEGRATION", "CLIENT", "SEO",
  ],
};

// Tools that are read-only (safe for viewer role)
const READ_ONLY_TOOL_NAMES = new Set(
  Object.values(TOOL_CATEGORIES)
    .flat()
    .filter(name => name.startsWith("get_"))
);

/**
 * Filter tools based on the user's role and per-client role.
 *
 * - admin/employee: all tools
 * - client/manager: all categories except USER
 * - editor: content + CRM + tasks + social + blog + service + SEO + forms
 * - viewer: read-only tools only (get_*)
 *
 * @param {array} tools - Array of tool definition objects
 * @param {string} userRole - Global role: "admin" | "employee" | "client"
 * @param {string|null} clientRole - Per-client role: "client" | "manager" | "editor" | "viewer"
 * @returns {array} Filtered tool definitions
 */
export function filterToolsByRole(tools, userRole, clientRole) {
  // Admins and employees get all tools
  if (userRole === "admin" || userRole === "employee") {
    return tools;
  }

  // For client-role users, use their per-client role
  const effectiveRole = clientRole || "viewer";
  const allowedCategories = ROLE_TOOL_CATEGORIES[effectiveRole] || ROLE_TOOL_CATEGORIES.viewer;

  if (!allowedCategories) {
    return tools; // null = all
  }

  const allowedCategorySet = new Set(allowedCategories);

  // For viewers, only allow read-only tools
  if (effectiveRole === "viewer") {
    return tools.filter(t => READ_ONLY_TOOL_NAMES.has(t.function.name));
  }

  // For other roles, filter by allowed categories
  return tools.filter(t => {
    const category = TOOL_TO_CATEGORY[t.function.name];
    return category && allowedCategorySet.has(category);
  });
}

/**
 * Get all tool definitions (full set — use sparingly).
 * Prefer getRelevantTools() for dynamic selection.
 */
export function getToolDefinitions() {
  return ALL_TOOLS;
}

/**
 * Get tool definitions by category name.
 * @param {string} category - Category key (e.g. "CRM", "TASKS", "SOCIAL_MEDIA")
 * @returns {array} Tool definition objects for that category
 */
export function getToolsByCategory(category) {
  const names = TOOL_CATEGORIES[category] || [];
  const nameSet = new Set(names);
  return ALL_TOOLS.filter(t => nameSet.has(t.function.name));
}

/**
 * Dynamically select relevant tools based on the user's message.
 *
 * This implements intent-based tool selection: the user's message is
 * matched against keyword patterns to determine which module categories
 * are relevant. Only those tools are sent to the LLM, reducing token
 * overhead and improving Qwen's tool-calling accuracy.
 *
 * Always includes the "CLIENT" category (dashboard, settings) as a fallback
 * so the assistant can always provide a general overview.
 *
 * ROLE-BASED FILTERING: After selecting relevant tools by intent, the
 * result is filtered by the user's role and per-client role. Viewers
 * get read-only tools; editors get content+CRM+tasks; managers/clients
 * get everything except user management; admins/employees get all.
 *
 * @param {string} userMessage - The latest user message
 * @param {number} maxTools - Maximum tools to return (default 25)
 * @param {object} roleContext - { userRole, clientRole } for role-based filtering
 * @returns {array} Tool definition objects relevant to the message
 */
export function getRelevantTools(userMessage, maxTools = 25, roleContext = null) {
  if (!userMessage || typeof userMessage !== "string") {
    // No message — return a default set of common tools
    let defaultTools = [
      ...getToolsByCategory("CLIENT"),
      ...getToolsByCategory("CRM"),
      ...getToolsByCategory("TASKS"),
    ];
    if (roleContext) {
      defaultTools = filterToolsByRole(defaultTools, roleContext.userRole, roleContext.clientRole);
    }
    return defaultTools.slice(0, maxTools);
  }

  const msgLower = userMessage.toLowerCase();
  const matchedCategories = new Set();

  // Always include CLIENT (dashboard/settings) as a baseline
  matchedCategories.add("CLIENT");

  // Match keywords to categories
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (msgLower.includes(kw)) {
        matchedCategories.add(category);
        break;
      }
    }
  }

  // If no categories matched, include a broad default set
  if (matchedCategories.size <= 1) {
    matchedCategories.add("CRM");
    matchedCategories.add("TASKS");
    matchedCategories.add("REPORT");
  }

  // Collect tools from matched categories
  let selected = [];
  for (const cat of matchedCategories) {
    selected.push(...getToolsByCategory(cat));
  }

  // Deduplicate by tool name
  const seen = new Set();
  selected = selected.filter(t => {
    if (seen.has(t.function.name)) return false;
    seen.add(t.function.name);
    return true;
  });

  // If we still have too few tools, add dashboard + report as fallback
  if (selected.length < 5) {
    const fallback = getToolsByCategory("REPORT");
    for (const t of fallback) {
      if (!seen.has(t.function.name)) {
        selected.push(t);
        seen.add(t.function.name);
      }
    }
  }

  // Apply role-based filtering
  if (roleContext) {
    selected = filterToolsByRole(selected, roleContext.userRole, roleContext.clientRole);
  }

  return selected.slice(0, maxTools);
}
