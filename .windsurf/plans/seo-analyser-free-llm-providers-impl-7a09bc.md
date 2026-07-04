# Free LLM Multi-Provider System — Implementation Plan

Implementation of a provider-agnostic LLM layer using 7 free-tier AI providers (Groq, Cerebras, Gemini, OpenRouter, Mistral, GitHub Models, Moonshot/Kimi) with automatic failover, circuit breakers, per-client API key management, and a settings UI tab on the SEO admin page.

---

## 1. Prisma Schema Changes

**File**: `prisma/schema.prisma`

### 1.1 New Model: `WehowareSeoLlmProvider`

Add after `WehowareInventorySetting` (end of file):

```prisma
model WehowareSeoLlmProvider {
  id               String   @id @default(uuid()) @db.VarChar(36)
  clientId         String   @map("client_id") @db.VarChar(36)
  providerName     String   @map("provider_name") @db.VarChar(30)  // groq, cerebras, gemini, openrouter, mistral, github, moonshot
  isActive         Boolean  @default(false) @map("is_active")
  priority         Int      @default(99)
  isEnabled        Boolean  @default(true) @map("is_enabled")
  apiKeyEncrypted  String?  @map("api_key_encrypted") @db.Text     // AES-256-GCM encrypted
  healthStatus     String   @default("unknown") @map("health_status") @db.VarChar(20)  // healthy, rate_limited, error, circuit_open, unknown
  totalRequests    Int      @default(0) @map("total_requests")
  totalTokensUsed  Int      @default(0) @map("total_tokens_used")
  lastUsedAt       DateTime? @map("last_used_at")
  lastErrorAt      DateTime? @map("last_error_at")
  lastErrorMessage String?  @map("last_error_message") @db.Text
  rateLimitResetAt DateTime? @map("rate_limit_reset_at")
  circuitOpenUntil DateTime? @map("circuit_open_until")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")
  client           WehowareClient @relation(fields: [clientId], references: [id], onDelete: Cascade)

  @@unique([clientId, providerName])
  @@index([clientId, isActive])
  @@index([clientId, isEnabled, priority])
  @@map("wehoware_seo_llm_providers")
}
```

### 1.2 Add relation to `WehowareClient`

Add `seoLlmProviders WehowareSeoLlmProvider[]` to the `WehowareClient` model's relation list.

### 1.3 New Model: `WehowareSeoLlmSetting`

Per-client LLM configuration (mode, manual provider, auto-failover toggle):

```prisma
model WehowareSeoLlmSetting {
  id              String   @id @default(uuid()) @db.VarChar(36)
  clientId        String   @unique @map("client_id") @db.VarChar(36)
  providerMode    String   @default("auto") @map("provider_mode") @db.VarChar(10)  // auto | manual
  manualProvider  String?  @map("manual_provider") @db.VarChar(30)
  autoFailover    Boolean  @default(true) @map("auto_failover")
  timeoutMs       Int      @default(30000) @map("timeout_ms")
  circuitThreshold Int     @default(5) @map("circuit_threshold")
  circuitCooldownMs Int    @default(30000) @map("circuit_cooldown_ms")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  client          WehowareClient @relation(fields: [clientId], references: [id], onDelete: Cascade)

  @@map("wehoware_seo_llm_settings")
}
```

Add `seoLlmSetting WehowareSeoLlmSetting?` to `WehowareClient`.

---

## 2. Install Dependency

```bash
npm install openai
```

The `openai` npm package is OpenAI-compatible and works with all 7 providers by changing `baseURL` and `apiKey`.

---

## 3. Provider Abstraction Layer

**Directory**: `src/lib/llm-providers/`

### 3.1 Provider Registry (`src/lib/llm-providers/index.js`)

Exports `callLLM(prompt, options)` — the single entry point used by the SEO analyser pipeline.

- Loads provider priority order from DB (`WehowareSeoLlmProvider` ordered by `priority`)
- If mode = "manual", puts `manualProvider` first; if `autoFailover` is false, only uses that one
- Iterates providers, calling each module's `call()` method
- On 429: marks provider `rate_limited`, sets `rateLimitResetAt` from `Retry-After` header, continues to next
- On 500/502/503: increments circuit breaker counter, continues
- On success: tracks token usage, updates `healthStatus` to `healthy`, returns result
- If all fail: throws `AllProvidersExhaustedError`
- Before iterating, resets any providers whose `rateLimitResetAt` has passed

### 3.2 Base Provider Module (`src/lib/llm-providers/base.js`)

Shared factory function that creates a provider module from a config object. All 7 providers share the same logic — only config differs.

```javascript
// Config shape:
{
  name: "groq",
  baseUrl: "https://api.groq.com/openai/v1",
  apiKeyEnv: "GROQ_API_KEY",
  analysisModel: "llama-3.3-70b-versatile",
  suggestionModel: "llama-3.3-70b-versatile",
  maxTokens: 3000,
  defaultRateLimits: { rpm: 30, rpd: 1000, tpm: 6000 },
}
```

The factory returns an object with:
- `isConfigured(clientId, decryptedKey)` — checks if API key exists (DB or env)
- `isCircuitBroken(state)` — checks circuit breaker timestamp
- `isRateLimited(state)` — checks rate limit timestamp
- `call(prompt, options, apiKey)` — makes the OpenAI-compatible API call
- `handleError(error)` — classifies error (429, 5xx, timeout, other)

### 3.3 Provider Configs (7 files)

Each file exports a config object + creates the module via the base factory:

| File | Provider | Base URL | Analysis Model | Suggestion Model |
|------|----------|----------|---------------|-----------------|
| `groq.js` | Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` | `llama-3.3-70b-versatile` |
| `cerebras.js` | Cerebras | `https://api.cerebras.ai/v1` | `llama3.1-8b-70b` | `llama3.1-8b-70b` |
| `gemini.js` | Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai/` | `gemini-2.5-flash` | `gemini-2.5-flash` |
| `openrouter.js` | OpenRouter | `https://openrouter.ai/api/v1` | `meta-llama/llama-3.3-70b-instruct:free` | `moonshotai/kimi-k2.6:free` |
| `mistral.js` | Mistral | `https://api.mistral.ai/v1` | `mistral-small-latest` | `mistral-small-latest` |
| `github.js` | GitHub Models | `https://models.inference.ai.azure.com/` | `gpt-4o` | `gpt-4o` |
| `moonshot.js` | Moonshot/Kimi | `https://api.moonshot.ai/v1` | `kimi-k2.6` | `kimi-k2.6` |

### 3.4 Health Tracker (`src/lib/llm-providers/health.js`)

Functions:
- `getProviderState(providerName)` — returns in-memory circuit breaker state
- `recordFailure(providerName)` — increments failure count, opens circuit if threshold reached
- `recordSuccess(providerName)` — resets failure count, closes circuit
- `markRateLimited(providerName, retryAfterMs)` — sets rate limit reset timestamp
- `isAvailable(providerName)` — checks circuit + rate limit status

Circuit breaker state is kept in-memory (module-level Map) — not persisted to DB on every call. DB `healthStatus` is updated periodically (every N calls or on state change).

### 3.5 JSON Sanitizer (`src/lib/llm-providers/json-sanitizer.js`)

Handles provider-specific JSON quirks:
- Strips markdown code fences (` ```json ... ``` `) from Gemini/Mistral responses
- Validates parsed JSON against expected schema
- Returns `{ valid, data, error }`

---

## 4. API Routes

**Directory**: `src/app/api/v1/seo/llm-providers/`

All routes use `withAuth` from `src/app/api/utils/auth-middleware.js` with `allowedRoles: ["client", "employee", "admin"]`.

### 4.1 `GET /api/v1/seo/llm-providers`

Returns all 7 providers with their status, config, and usage stats for the active client. Seeds provider rows in DB if they don't exist yet (first call per client).

Response shape:
```json
{
  "data": [
    {
      "providerName": "groq",
      "displayName": "Groq",
      "priority": 1,
      "isEnabled": true,
      "isActive": false,
      "healthStatus": "healthy",
      "isConfigured": true,
      "totalRequests": 45,
      "totalTokensUsed": 45230,
      "lastUsedAt": "2026-07-01T...",
      "rateLimitResetAt": null,
      "models": { "analysis": "llama-3.3-70b-versatile", "suggestion": "llama-3.3-70b-versatile" },
      "freeQuota": { "rpm": 30, "rpd": 1000, "tpm": 6000 },
      "signupUrl": "https://console.groq.com/keys"
    },
    ...
  ],
  "settings": {
    "providerMode": "auto",
    "manualProvider": null,
    "autoFailover": true
  }
}
```

### 4.2 `PUT /api/v1/seo/llm-providers/keys`

Saves API keys for one or more providers. Keys are encrypted using existing `encryptSecret()` from `src/lib/crypto.js`.

Body: `{ keys: { groq: "key1", cerebras: "key2", ... } }`
- Empty string or null clears the key
- Keys encrypted via `encryptSecret()` before storing in `apiKeyEncrypted` field

### 4.3 `GET /api/v1/seo/llm-providers/keys`

Returns key status (configured/not-configured) — never returns actual key values.

### 4.4 `POST /api/v1/seo/llm-providers/:name/test`

Tests connectivity to a provider by making a simple "Say hello" prompt call. Uses decrypted DB key or env var fallback. Returns `{ success, model, latencyMs }` or `{ success: false, error }`.

### 4.5 `POST /api/v1/seo/llm-providers/:name/toggle`

Toggles `isEnabled` for a provider.

### 4.6 `POST /api/v1/seo/llm-providers/:name/priority`

Sets priority order. Body: `{ priority: 1 }`. Other providers are renumbered to avoid conflicts.

### 4.7 `POST /api/v1/seo/llm-providers/:name/reset`

Resets circuit breaker and rate limit state for a provider. Sets `healthStatus` back to `unknown`, clears `rateLimitResetAt` and `circuitOpenUntil`.

### 4.8 `PUT /api/v1/seo/llm-providers/mode`

Sets LLM provider mode. Body: `{ providerMode: "auto"|"manual", manualProvider: "groq"|null, autoFailover: true|false }`

Upserts `WehowareSeoLlmSetting` row for the client.

---

## 5. Settings UI

### 5.1 New Tab on SEO Page

**File**: `src/app/admin/seo/page.js`

Add a new `<TabsTrigger value="llm">LLM Providers</TabsTrigger>` and corresponding `<TabsContent>`.

### 5.2 New Component: `LlmProviderManager`

**File**: `src/components/seo/LlmProviderManager.jsx`

A client component that:
- Fetches providers from `GET /api/v1/seo/llm-providers` on mount
- Renders a mode toggle (Auto/Manual) with auto-failover switch
- Renders a table of 7 providers with columns: Provider Name, Status Badge, Priority, Tokens Used, Enabled Toggle, Actions
- Status badge colors: 🟢 healthy, 🟡 rate_limited, 🔴 error, ⚪ unknown
- Actions per provider: Test, Reset, Configure Key
- "Configure API Keys" button opens a dialog with password-type inputs for each provider
- "Test Provider" makes POST to `/test` endpoint, shows toast with result
- Manual mode shows a dropdown to select the primary provider
- Shows last failover event info if available

### 5.3 New Component: `ApiKeyDialog`

**File**: `src/components/seo/ApiKeyDialog.jsx`

Dialog/modal with:
- 7 password-type inputs (one per provider)
- "Get Key →" link next to each (links to provider signup page)
- Status indicator (✅ Configured / ❌ Not set) per provider
- Save button calls `PUT /api/v1/seo/llm-providers/keys`
- Warning text about key security

### 5.4 UI Components Used

All from existing shadcn/ui: `Card`, `Button`, `Input`, `Switch`, `Select`, `Badge`, `Table`, `Tabs`, `Label`, `Dialog` (AlertDialog), `toast` (react-hot-toast).

---

## 6. Environment Variables

Add to `.env`:

```env
# LLM Provider API Keys (server-wide fallback if not set per-client in DB)
GROQ_API_KEY=
CEREBRAS_API_KEY=
GEMINI_API_KEY=
OPENROUTER_API_KEY=
MISTRAL_API_KEY=
GITHUB_MODELS_TOKEN=
MOONSHOT_API_KEY=

# LLM Provider Configuration
SEO_LLM_PROVIDER_MODE=auto
SEO_LLM_MANUAL_PROVIDER=groq
SEO_LLM_AUTO_FAILOVER=true
SEO_LLM_TIMEOUT_MS=30000
SEO_LLM_CIRCUIT_BREAKER_THRESHOLD=5
SEO_LLM_CIRCUIT_BREAKER_COOLDOWN_MS=30000
```

Note: `APP_ENCRYPTION_KEY` already exists in the project for `src/lib/crypto.js` — reused for encrypting API keys.

---

## 7. File Manifest

### New Files (14)

| File | Purpose |
|------|---------|
| `src/lib/llm-providers/index.js` | Provider router + `callLLM()` entry point |
| `src/lib/llm-providers/base.js` | Base provider factory (shared logic) |
| `src/lib/llm-providers/groq.js` | Groq config |
| `src/lib/llm-providers/cerebras.js` | Cerebras config |
| `src/lib/llm-providers/gemini.js` | Gemini config |
| `src/lib/llm-providers/openrouter.js` | OpenRouter config |
| `src/lib/llm-providers/mistral.js` | Mistral config |
| `src/lib/llm-providers/github.js` | GitHub Models config |
| `src/lib/llm-providers/moonshot.js` | Moonshot/Kimi config |
| `src/lib/llm-providers/health.js` | Circuit breaker + rate limit state |
| `src/lib/llm-providers/json-sanitizer.js` | JSON response cleaning |
| `src/components/seo/LlmProviderManager.jsx` | Provider management UI |
| `src/components/seo/ApiKeyDialog.jsx` | API key configuration dialog |
| `src/app/api/v1/seo/llm-providers/route.js` | GET (list) + PUT (keys) + PUT (mode) |

### Modified Files (3)

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add `WehowareSeoLlmProvider`, `WehowareSeoLlmSetting` models + relations on `WehowareClient` |
| `src/app/admin/seo/page.js` | Add "LLM Providers" tab + import `LlmProviderManager` |
| `package.json` | Add `openai` dependency |

### Route Structure

Since Next.js App Router uses file-based routing, the dynamic routes will be:

```
src/app/api/v1/seo/llm-providers/
├── route.js                    # GET (list), PUT (keys), PUT (mode)
├── [name]/
│   ├── test/route.js           # POST — test provider
│   ├── toggle/route.js         # POST — toggle enable
│   ├── priority/route.js       # POST — set priority
│   └── reset/route.js          # POST — reset circuit breaker
```

---

## 8. Implementation Order

1. **Install `openai`** — `npm install openai`
2. **Prisma schema** — Add 2 new models + relations, run `npx prisma db push`
3. **Provider modules** — Create `src/lib/llm-providers/` with all 11 files
4. **API routes** — Create route handlers under `src/app/api/v1/seo/llm-providers/`
5. **UI components** — Create `LlmProviderManager.jsx` + `ApiKeyDialog.jsx`
6. **Wire into SEO page** — Add tab to `src/app/admin/seo/page.js`
7. **Env vars** — Add to `.env`
8. **Test** — Verify provider list loads, keys save, test button works

---

## 9. Key Design Decisions

- **Reuse existing `src/lib/crypto.js`** — `encryptSecret()`/`decryptSecret()` already implemented with AES-256-GCM using `APP_ENCRYPTION_KEY`. No new crypto module needed.
- **In-memory circuit breaker** — Circuit breaker state lives in a module-level Map (not DB) for speed. DB `healthStatus` is updated on state changes only.
- **Env var fallback for API keys** — If a provider has no `apiKeyEncrypted` in DB, the system falls back to the env var (e.g., `GROQ_API_KEY`). This allows server-wide config without per-client setup.
- **OpenRouter serves Kimi K2.6** — OpenRouter's suggestion model is `moonshotai/kimi-k2.6:free`, giving free Kimi access without a separate key. Direct Moonshot access is also available as provider #7 for higher quota.
- **Base factory pattern** — All 7 providers share identical logic via `base.js`. Only config (baseUrl, model names, rate limits) differs. Adding a new provider = 1 new file with ~15 lines.
- **No separate `WehowareSeoAnalyserSetting` changes** — The LLM provider system is self-contained in its own models. The SEO analyser pipeline (when built) will simply call `callLLM()` from `src/lib/llm-providers/index.js`.
