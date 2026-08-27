// src/lib/ai/baddy-assistant.js
// Baddy AI assistant integration for the WeHowAre SaaS.
//
// SECURITY: This module enforces strict client isolation. The AI assistant
// can ONLY access data for the user's activeClientId. All tool calls are
// executed server-side with the user's clientId — the LLM never sees
// raw database access, only the results of scoped queries.
//
// CRITICAL RULE: NEVER delete data. The tool set exposed to the LLM
// only contains read (GET) and create (POST) operations. No DELETE
// or destructive operations are available.

import { prisma } from "@/lib/prisma";

// vLLM endpoint (running on the AI Brain)
const VLLM_BASE_URL = process.env.VLLM_BASE_URL || "http://localhost:18020/v1";
const VLLM_API_KEY = process.env.VLLM_API_KEY || "wehoware-vllm-2026";
const VLLM_MODEL = process.env.VLLM_MODEL || "qwen3.8-27b";

// Mem0 memory bridge endpoint (running on the AI Brain)
const MEM0_BRIDGE_URL = process.env.MEM0_BRIDGE_URL || "http://localhost:9097";

/**
 * Search Mem0 for relevant memories scoped to user + client.
 * Returns a context string to inject into the system prompt.
 */
async function searchMemories(userId, clientId, query) {
  try {
    const response = await fetch(`${MEM0_BRIDGE_URL}/memory/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, client_id: clientId, query, limit: 5 }),
      signal: AbortSignal.timeout(8000), // Don't block chat if Mem0 is slow
    });
    if (!response.ok) return "";
    const data = await response.json();
    const memories = data.memories?.results || data.memories || [];
    if (!memories.length) return "";
    const memoryTexts = memories.map(m => m.memory || m.text || "").filter(Boolean);
    if (!memoryTexts.length) return "";
    return `\n\n## What you remember about this user:\n${memoryTexts.map(t => `- ${t}`).join("\n")}\n`;
  } catch (err) {
    // Memory is a nice-to-have — don't fail the chat if Mem0 is down
    console.error("[baddy] Memory search failed (non-fatal):", err.message);
    return "";
  }
}

/**
 * Store a conversation in Mem0 for future recall.
 * Called after the chat completes. Non-blocking — errors are logged but don't affect the user.
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

// SaaS API base URL for internal tool calls (same process, no HTTP needed)
// We call the Prisma client directly for security — no HTTP round-trip.

/**
 * Build the system prompt for the AI assistant, scoped to the user's client.
 * This tells baddy who they are, what client they're working with, and
 * enforces the data safety rules.
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
1. **NEVER delete data.** You cannot and must not delete any records. If a user asks to delete something, refuse and explain that deletion is not permitted by policy.
2. **STRICT CLIENT ISOLATION.** You can ONLY access data for ${clientName}. You must never reference, query, or expose data belonging to other clients. If a user asks about another client's data, refuse.
3. **Be helpful but safe.** You can create tasks, contacts, and other records. You can read and summarize CRM data, invoices, tasks, social media, SEO, and reports. You cannot modify billing, delete records, or access other clients' data.

## What you can do:
- View and create CRM contacts, deals, and activities
- View and create tasks and subtasks
- View invoices, expenses, bills, and transactions
- View social media posts, analytics, and inbox
- View SEO keywords and analyser results
- View blog posts and services
- View appointments
- View dashboard reports and team performance
- View client information (only for ${clientName})

## How to respond:
- Be concise and direct
- When showing data, format it clearly (tables, lists)
- When creating records, confirm what you created
- If you don't have enough data, say so
- Never make up data — if a tool returns empty, say "No records found"

## Memory:
You have persistent memory across conversations. If the system prompt includes a "What you remember about this user" section, use that context to personalize your responses. You remember user preferences, past requests, and important context. If a user tells you a preference, acknowledge that you'll remember it.

You are part of the WeHowAre platform. Be professional, helpful, and always prioritize data safety.`;
}

/**
 * Tool definitions exposed to the LLM.
 * These are the ONLY operations the AI can perform.
 * All are scoped to the user's activeClientId.
 */
export function getToolDefinitions() {
  return [
    {
      type: "function",
      function: {
        name: "get_crm_dashboard",
        description: "Get CRM dashboard statistics — contact counts, deal values, pipeline summary",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "get_crm_contacts",
        description: "Get CRM contacts (leads and customers). Returns up to 20 by default.",
        parameters: {
          type: "object",
          properties: {
            search: { type: "string", description: "Search term (name, email, company)" },
            limit: { type: "integer", description: "Max results (default 20, max 50)" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_crm_contact",
        description: "Create a new CRM contact (lead or customer). NEVER deletes — only creates.",
        parameters: {
          type: "object",
          properties: {
            first_name: { type: "string" },
            last_name: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            company: { type: "string" },
            type: { type: "string", enum: ["Lead", "Customer"], description: "Default: Lead" },
          },
          required: ["first_name", "last_name", "email"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_crm_deals",
        description: "Get CRM deals (sales opportunities)",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["Open", "Won", "Lost"], description: "Filter by status" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_tasks",
        description: "Get tasks with optional status and priority filters",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["To_Do", "In_Progress", "Done", "Backlog"] },
            priority: { type: "string", enum: ["Low", "Medium", "High"] },
            limit: { type: "integer", description: "Max results (default 20)" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_task",
        description: "Create a new task. NEVER deletes — only creates.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string" },
            priority: { type: "string", enum: ["Low", "Medium", "High"], description: "Default: Medium" },
            description: { type: "string" },
          },
          required: ["title"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_task_stats",
        description: "Get task statistics — counts by status",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "get_invoices",
        description: "Get invoices with optional status filter",
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
        name: "get_expenses",
        description: "Get business expenses with optional status filter",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["Pending", "Approved", "Rejected", "Reimbursed"] },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_dashboard_report",
        description: "Get main dashboard report — total tasks, completion rate, hours tracked, overdue count",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "get_social_posts",
        description: "Get social media posts with optional status filter",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["Draft", "Scheduled", "Published", "Failed"] },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_social_analytics",
        description: "Get aggregated social media analytics — impressions, likes, shares per platform",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "get_seo_keywords",
        description: "Get SEO keywords being tracked",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "get_blogs",
        description: "Get blog posts with optional status filter",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["Draft", "Published", "Archived"] },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_appointments",
        description: "Get appointments with optional status filter",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["Pending", "Confirmed", "Cancelled", "Completed", "NoShow"] },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_clients_info",
        description: "Get information about the current client (the user's active client only)",
        parameters: { type: "object", properties: {} },
      },
    },
  ];
}

/**
 * Execute a tool call with strict client isolation.
 * All queries are scoped to clientId — there is NO way for the LLM
 * to access data from other clients.
 *
 * @param {string} toolName - The function name called by the LLM
 * @param {object} args - The arguments from the LLM
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
      // ─── CRM ───────────────────────────────────────────────
      case "get_crm_dashboard": {
        const contacts = await prisma.wehowareCrmContact.count({ where: { clientId, active: true } });
        const leads = await prisma.wehowareCrmContact.count({ where: { clientId, active: true, type: "Lead" } });
        const customers = await prisma.wehowareCrmContact.count({ where: { clientId, active: true, type: "Customer" } });
        const deals = await prisma.wehowareCrmDeal.count({ where: { clientId } });
        const openDeals = await prisma.wehowareCrmDeal.count({ where: { clientId, status: "Open" } });
        const wonDeals = await prisma.wehowareCrmDeal.count({ where: { clientId, status: "Won" } });
        return JSON.stringify({
          contacts: { total: contacts, leads, customers },
          deals: { total: deals, open: openDeals, won: wonDeals },
        });
      }

      case "get_crm_contacts": {
        const where = { clientId, active: true };
        if (args.search) {
          where.OR = [
            { firstName: { contains: args.search } },
            { lastName: { contains: args.search } },
            { email: { contains: args.search } },
            { company: { contains: args.search } },
          ];
        }
        const contacts = await prisma.wehowareCrmContact.findMany({
          where, take: limit, orderBy: { createdAt: "desc" },
          select: { id: true, firstName: true, lastName: true, email: true, phone: true, company: true, type: true, status: true, source: true, createdAt: true },
        });
        return JSON.stringify({ contacts, total: contacts.length });
      }

      case "create_crm_contact": {
        // Dedup by email within the same client
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
            company: args.company || null,
            type: args.type || "Lead",
            status: "New", source: "Manual",
          },
        });
        return JSON.stringify({ message: "Contact created", contact: { id: contact.id, firstName: contact.firstName, lastName: contact.lastName, email: contact.email } });
      }

      case "get_crm_deals": {
        const where = { clientId };
        if (args.status) where.status = args.status;
        const deals = await prisma.wehowareCrmDeal.findMany({
          where, take: limit, orderBy: { createdAt: "desc" },
          select: { id: true, title: true, value: true, status: true, createdAt: true },
        });
        return JSON.stringify({ deals, total: deals.length });
      }

      // ─── Tasks ─────────────────────────────────────────────
      case "get_tasks": {
        const where = { clientId };
        if (args.status) where.status = args.status;
        if (args.priority) where.priority = args.priority;
        const tasks = await prisma.wehowareTask.findMany({
          where, take: limit, orderBy: { createdAt: "desc" },
          select: { id: true, title: true, priority: true, status: true, dueDate: true, assigneeId: true, createdAt: true },
        });
        return JSON.stringify({ tasks, total: tasks.length });
      }

      case "create_task": {
        const task = await prisma.wehowareTask.create({
          data: {
            clientId, createdBy: userId,
            title: args.title,
            priority: args.priority || "Medium",
            description: args.description || null,
          },
        });
        return JSON.stringify({ message: "Task created", task: { id: task.id, title: task.title, priority: task.priority } });
      }

      case "get_task_stats": {
        const total = await prisma.wehowareTask.count({ where: { clientId } });
        const todo = await prisma.wehowareTask.count({ where: { clientId, status: "To_Do" } });
        const inProgress = await prisma.wehowareTask.count({ where: { clientId, status: "In_Progress" } });
        const done = await prisma.wehowareTask.count({ where: { clientId, status: "Done" } });
        return JSON.stringify({ total, todo, inProgress, done });
      }

      // ─── Accounting ────────────────────────────────────────
      case "get_invoices": {
        const where = { clientId };
        if (args.status) where.status = args.status;
        const invoices = await prisma.wehowareInvoice.findMany({
          where, take: limit, orderBy: { createdAt: "desc" },
          select: { id: true, invoiceNumber: true, clientName: true, status: true, total: true, currency: true, invoiceDate: true, dueDate: true },
        });
        return JSON.stringify({ invoices, total: invoices.length });
      }

      case "get_expenses": {
        const where = { clientId };
        if (args.status) where.status = args.status;
        const expenses = await prisma.wehowareExpense.findMany({
          where, take: limit, orderBy: { createdAt: "desc" },
          select: { id: true, description: true, amount: true, status: true, createdAt: true },
        });
        return JSON.stringify({ expenses, total: expenses.length });
      }

      // ─── Dashboard ─────────────────────────────────────────
      case "get_dashboard_report": {
        const totalTasks = await prisma.wehowareTask.count({ where: { clientId } });
        const doneTasks = await prisma.wehowareTask.count({ where: { clientId, status: "Done" } });
        const overdue = await prisma.wehowareTask.count({
          where: { clientId, dueDate: { lt: new Date() }, status: { not: "Done" } },
        });
        const contacts = await prisma.wehowareCrmContact.count({ where: { clientId, active: true } });
        const invoices = await prisma.wehowareInvoice.count({ where: { clientId } });
        const unpaidInvoices = await prisma.wehowareInvoice.count({ where: { clientId, status: { in: ["Pending", "Overdue"] } } });
        return JSON.stringify({
          tasks: { total: totalTasks, done: doneTasks, overdue, completionRate: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0 },
          crm: { totalContacts: contacts },
          invoices: { total: invoices, unpaid: unpaidInvoices },
        });
      }

      // ─── Social Media ──────────────────────────────────────
      case "get_social_posts": {
        const where = { clientId };
        if (args.status) where.status = args.status;
        const posts = await prisma.wehowareSocialPost.findMany({
          where, take: limit, orderBy: { createdAt: "desc" },
          select: { id: true, content: true, status: true, scheduledFor: true, createdAt: true },
        });
        return JSON.stringify({ posts: posts.map(p => ({ ...p, content: p.content?.slice(0, 200) })), total: posts.length });
      }

      case "get_social_analytics": {
        const accounts = await prisma.wehowareSocialAccount.count({ where: { clientId, status: "Active" } });
        const posts = await prisma.wehowareSocialPost.count({ where: { clientId } });
        const published = await prisma.wehowareSocialPost.count({ where: { clientId, status: "Published" } });
        return JSON.stringify({ activeAccounts: accounts, totalPosts: posts, publishedPosts: published });
      }

      // ─── SEO ───────────────────────────────────────────────
      case "get_seo_keywords": {
        const keywords = await prisma.wehowareClientKeyword.findMany({
          where: { clientId }, take: limit, orderBy: { createdAt: "desc" },
          select: { id: true, keyword: true, createdAt: true },
        });
        return JSON.stringify({ keywords, total: keywords.length });
      }

      // ─── Content ───────────────────────────────────────────
      case "get_blogs": {
        const where = { clientId };
        if (args.status) where.status = args.status;
        const blogs = await prisma.wehowareBlog.findMany({
          where, take: limit, orderBy: { createdAt: "desc" },
          select: { id: true, title: true, slug: true, status: true, views: true, createdAt: true },
        });
        return JSON.stringify({ blogs, total: blogs.length });
      }

      // ─── Appointments ──────────────────────────────────────
      case "get_appointments": {
        const where = { clientId };
        if (args.status) where.status = args.status;
        const appointments = await prisma.wehowareAppointment.findMany({
          where, take: limit, orderBy: { createdAt: "desc" },
          select: { id: true, name: true, email: true, status: true, date: true, time: true, createdAt: true },
        });
        return JSON.stringify({ appointments, total: appointments.length });
      }

      // ─── Client Info ───────────────────────────────────────
      case "get_clients_info": {
        const client = await prisma.wehowareClient.findUnique({
          where: { id: clientId },
          select: { id: true, companyName: true, contactPerson: true, email: true, website: true, industry: true, domain: true, active: true },
        });
        return JSON.stringify({ client });
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
 * Call vLLM to generate a response, with tool calling support.
 * Handles multi-turn tool call loops (LLM calls tool → we execute → LLM generates final response).
 *
 * @param {object} params
 * @param {string} params.systemPrompt - The client-scoped system prompt
 * @param {array} params.messages - Chat history [{role, content}]
 * @param {string} params.clientId - Enforced client scope
 * @param {string} params.userId - User ID for createdBy fields
 * @param {boolean} params.enableThinking - Whether to enable thinking mode
 * @returns {asyncGenerator} - Yields content chunks for streaming
 */
export async function* chatWithBaddy({ systemPrompt, messages, clientId, userId, enableThinking = false }) {
  const tools = getToolDefinitions();

  // ─── Memory recall: search for relevant past conversations ──────
  const lastUserMessage = [...messages].reverse().find(m => m.role === "user");
  let memoryContext = "";
  if (lastUserMessage) {
    memoryContext = await searchMemories(userId, clientId, lastUserMessage.content);
  }

  const fullMessages = [
    { role: "system", content: systemPrompt + memoryContext },
    ...messages,
  ];

  let maxToolRounds = 5; // Prevent infinite tool call loops
  let finalResponse = "";

  while (maxToolRounds-- > 0) {
    // Call vLLM
    const response = await fetch(`${VLLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${VLLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: VLLM_MODEL,
        messages: fullMessages,
        tools,
        tool_choice: "auto",
        stream: false,
        max_tokens: 2048,
        chat_template_kwargs: { enable_thinking: enableThinking },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      yield `⚠️ AI service error: ${response.status}. Please try again.`;
      return;
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;

    if (!message) {
      yield "⚠️ No response from AI. Please try again.";
      return;
    }

    // If the LLM made tool calls, execute them and continue the loop
    if (message.tool_calls && message.tool_calls.length > 0) {
      // Add the assistant message with tool calls to history
      fullMessages.push({
        role: "assistant",
        content: message.content || "",
        tool_calls: message.tool_calls,
      });

      // Execute each tool call (scoped to clientId)
      for (const tc of message.tool_calls) {
        const toolName = tc.function.name;
        let toolArgs = {};
        try { toolArgs = JSON.parse(tc.function.arguments || "{}"); } catch {}

        // Execute with STRICT client isolation
        const result = await executeToolCall(toolName, toolArgs, clientId, userId);

        fullMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result,
        });
      }

      // Continue loop — LLM will generate final response with tool results
      continue;
    }

    // No tool calls — this is the final response
    finalResponse = message.content || "";
    if (finalResponse) {
      yield finalResponse;
    } else {
      finalResponse = "I don't have a response for that. Could you rephrase?";
      yield finalResponse;
    }

    // ─── Memory store: save this conversation for future recall ───
    if (lastUserMessage && finalResponse) {
      // Non-blocking — don't make the user wait for memory storage
      storeConversationMemory(userId, clientId, lastUserMessage.content, finalResponse);
    }

    return;
  }

  // Exhausted tool rounds
  yield "I've reached the maximum number of tool calls for this request. Please simplify your question.";
}
