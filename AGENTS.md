# Baddy AI Brain - Project Configuration

## CRITICAL RULES (READ FIRST — ALWAYS ENFORCE)
1. **NEVER delete existing data.** This applies to ALL systems: the WeHowAre SaaS database, Open WebUI models/tools/knowledge bases, agent configurations, and any other persistent state. Agents may create, read, and update data — but deletion is strictly prohibited unless explicitly approved by the user in writing.
2. **No destructive operations without explicit user confirmation.** This includes: dropping tables, truncating data, `rm -rf`, force-pushing git history, deleting Docker volumes, or any action that causes irreversible data loss.
3. **AI agents must not call DELETE endpoints on the SaaS API.** The SaaS API tool only exposes GET and POST (create) methods. DELETE/PATCH(deactivate) endpoints exist in the codebase but must not be wired into agent tools.

## Architecture Overview
- **LLM Serving**: vLLM (Qwen3.8-27B W4A16, DFlash2) on RTX 3090 — `http://localhost:18020/v1` (key: `wehoware-vllm-2026`)
- **Agent Harness**: Hermes Agent v0.20.6 — CLI, gateway, WhatsApp, 6 specialist profiles (cto, cfo, seo, developer, marketing, support)
- **Frontend**: Open WebUI v0.11.0 (Docker, port 8080) — admin: `support@wehoware.com` / `Wehoware@Support#1`
- **SaaS**: WeHowAre SaaS (Next.js 16, port 3000) — API key: `whk_9275d8b899508f38e2bca550ea3f4304`
- **Memory**: Mem0 Bridge (port 9097) — persistent conversation memory via Qdrant
- **Search**: SearXNG (port 8888)
- **Detailed reference**: `~/.hermes/DETAILED_REFERENCE.md` — full config, commands, architecture docs

## Hermes Agent
- **Config**: `~/.hermes/config.yaml` (main), `~/.hermes/.env` (secrets)
- **SOUL.md**: `~/.hermes/SOUL.md` (Baddy CEO personality)
- **Model**: `qwen3.8-27b` via vLLM, 128K context, thinking disabled
- **Gateway**: `hermes-gateway.service` (systemd user service)
- **WhatsApp**: Bot number 918801007460, allowed users: 16475104134
- **Profiles**: `hermes profile use cto|cfo|seo|developer|marketing|support`
- **MCP Servers**: context7, wolfram, wehoware-saas (28 tools). OAuth-needed: sentry, stripe, notion, cloudflare, vercel, hugging_face, wordpress-com, postman (disabled until `hermes mcp login`)
- **Skills**: 88 enabled (custom: wehoware-saas-ops, vllm-management, baddy-delegation, seo-audit, system-monitor)
- **Dashboard**: `admin.wehoware.ca` (Hermes) + `admin.wehoware.ca/keys/` (OWUI Key Admin)

## Key Services
- **vLLM**: `vllm.service` (port 18020, auto-start)
- **Gateway**: `hermes-gateway.service` (WhatsApp, survives logout)
- **Hermes Dashboard**: `hermes-dashboard.service` (port 9119)
- **Caddy**: `caddy.service` (port 9120, reverse proxy)
- **OWUI Key Admin**: `owui-key-admin.service` (port 9098)
- **Mem0 Bridge**: `mem0-bridge.service` (port 9097)
- **SaaS**: `npm run dev` in `/home/baddy/wehoware_saas/` (port 3000)

## WhatsApp Personal AI Assistant Enhancements (2026-09-09)

### What was implemented

**Quick Wins (immediate impact):**
- WhatsApp display: `tool_progress: concise`, `interim_assistant_messages: true`, `busy_ack_detail: true`
- Browser-use plugin enabled + 9 new toolsets added to WhatsApp (browser, tts, stt, image_gen, vision, cronjob, code_execution, x_search, kanban)
- Total WhatsApp tools: 19 toolsets (was 10)

**Phase 1 — Core capabilities:**
- TTS: Edge TTS (en-US-AriaNeural) configured for voice replies (free, no API key)
- Daily briefing: cron job at 7 AM daily (system health, GPU, disk, SaaS metrics)
- Hermes updated: v0.21.1 (was 170 commits behind)

**Phase 2 — Assistant capabilities:**
- Email: himalaya CLI installed, config template at ~/.config/himalaya/config.toml (user needs app password)
- Calendar: 5 calendar MCP tools added (list, add, search, cancel, today summary) — local SQLite
- Document ingestion: auto-ingest watcher every 5 min (PDF, DOCX, TXT → Cognee knowledge graph)
- Image generation: Pollinations.ai free API (no key needed) — MCP tool added

**Phase 3 — Intelligence:**
- Streaming responses: interim messages + tool progress enabled
- Smart routing: auxiliary model (Ollama qwen3:1.7b-fast) for compression, titles, memory, approvals
- Proactive monitoring: system health check every 30 min (alerts on service down, GPU temp, disk, RAM)
- Mem0 configured as memory provider for conversation continuity

**Phase 4 — Advanced:**
- Vision: LLaVA via Ollama for image/screenshot understanding
- Voice mode toggle: skill created (voice on/off via WhatsApp)
- Contact-aware context: CRM lookup script for incoming WhatsApp numbers
- Kanban: initialized and added to WhatsApp toolset for autonomous task execution

### Unified MCP Server
- Total tools: 29 (was 23)
- New: calendar_list_events, calendar_add_event, calendar_search_events, calendar_cancel_event, calendar_today_summary, image_generate

### Cron Jobs Active
1. daily_briefing — 0 7 * * * (7 AM daily)
2. system_health_monitor — */30 * * * * (every 30 min)
3. document_ingest_watcher — */5 * * * * (every 5 min)
4. crypto-agent-30min — */30 * * * * (existing)
5. daily-tasks-reminder — 0 10 * * * (existing)

### What user needs to do
1. Add email app password to ~/.config/himalaya/config.toml (for email integration)
2. Optionally set up Google OAuth for full Google Workspace integration (Calendar, Gmail, Drive)

## Hermes v0.21.1 Improvements (2026-09-09 Session 2)

### 1. Cron Continuity (all 5 jobs)
- All cron jobs now have `--continuity` enabled
- Each run sees the previous run's output (dedupes alerts, learns between runs)
- Jobs: daily_briefing, system_health_monitor, document_ingest_watcher, crypto-agent-30min, daily-tasks-reminder

### 2. Hermes Peer (bot-to-bot DMs)
- 7 peers registered: baddy, cto, cfo, seo, developer, marketing, support
- Specialists can now DM each other directly
- Results land in each agent's canonical Bot Chat (durable, inspectable)
- API_SERVER_KEY configured for peer authentication

### 3. DeepWiki MCP
- Installed: deepwiki (https://mcp.deepwiki.com/mcp)
- Can ask questions about any public GitHub repo
- Free, no auth required

### 4. Kanban Autonomous Task Execution
- 6 tasks created and assigned to specialists:
  - CTO: Audit SaaS authentication flow
  - CFO: Review monthly burn rate and runway
  - SEO: SEO keyword gap analysis for Q3
  - Developer: Optimize SaaS API response times
  - Marketing: Create Q3 content marketing calendar
  - Support: Review support ticket response times
- Kanban dispatcher runs embedded in gateway (60s interval)
- Tasks auto-assigned and dispatched to specialist profiles

### 5. MCP Health Checks
- Built-in automatic health checking (tools/mcp_tool_health.py)
- Suspect connections auto-detected and health-checked before tool calls
- No config needed — automatic in v0.21.0+

### Total MCP Servers: 4
- context7 (documentation)
- wehoware-saas (28 tools)
- wehoware-unified (29 tools)
- deepwiki (GitHub repo Q&A)

### Total Peers: 7
### Total Kanban Tasks: 6 (all running)
### Total Cron Jobs: 5 (all with continuity)
