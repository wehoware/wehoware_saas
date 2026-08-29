// src/lib/ai/tools/execution.js
// Tool execution engine for the Baddy AI assistant.
//
// SECURITY: This module enforces strict client isolation. Every query is
// scoped to the clientId passed in. The LLM never gets raw DB access —
// only the results of scoped queries. NO DELETE operations are available.

import { prisma } from "@/lib/prisma";

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