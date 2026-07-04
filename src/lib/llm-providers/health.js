/**
 * Circuit breaker and rate-limit health tracking for LLM providers.
 *
 * State is kept in-memory (module-level Map) for speed — DB healthStatus
 * is updated on state transitions only.
 */

const DEFAULT_THRESHOLD = 5;
const DEFAULT_COOLDOWN_MS = 30000;

/**
 * @typedef {Object} ProviderState
 * @property {number} failureCount
 * @property {Date|null} circuitOpenUntil
 * @property {Date|null} rateLimitResetAt
 */

/** @type {Map<string, ProviderState>} */
const states = new Map();

/**
 * Get or initialize state for a provider.
 * @param {string} providerName
 * @returns {ProviderState}
 */
function getState(providerName) {
  if (!states.has(providerName)) {
    states.set(providerName, {
      failureCount: 0,
      circuitOpenUntil: null,
      rateLimitResetAt: null,
    });
  }
  return states.get(providerName);
}

/**
 * Check if the circuit breaker is open for a provider.
 * @param {string} providerName
 * @returns {boolean}
 */
export function isCircuitBroken(providerName) {
  const state = getState(providerName);
  if (!state.circuitOpenUntil) return false;
  if (Date.now() < state.circuitOpenUntil.getTime()) return true;
  // Half-open: circuit cooldown expired, reset
  state.circuitOpenUntil = null;
  state.failureCount = 0;
  return false;
}

/**
 * Check if the provider is currently rate-limited.
 * @param {string} providerName
 * @returns {boolean}
 */
export function isRateLimited(providerName) {
  const state = getState(providerName);
  if (!state.rateLimitResetAt) return false;
  if (Date.now() < state.rateLimitResetAt.getTime()) return true;
  // Rate limit window expired, clear
  state.rateLimitResetAt = null;
  return false;
}

/**
 * Check if a provider is available (not circuit-broken and not rate-limited).
 * @param {string} providerName
 * @returns {boolean}
 */
export function isAvailable(providerName) {
  return !isCircuitBroken(providerName) && !isRateLimited(providerName);
}

/**
 * Record a successful call — resets failure count and closes circuit.
 * @param {string} providerName
 */
export function recordSuccess(providerName) {
  const state = getState(providerName);
  state.failureCount = 0;
  state.circuitOpenUntil = null;
}

/**
 * Record a failure — increments counter and opens circuit if threshold reached.
 * @param {string} providerName
 * @param {number} [threshold] - Failure threshold (default from env or 5)
 * @param {number} [cooldownMs] - Cooldown duration in ms (default from env or 30000)
 */
export function recordFailure(
  providerName,
  threshold = Number.parseInt(process.env.SEO_LLM_CIRCUIT_BREAKER_THRESHOLD, 10) || DEFAULT_THRESHOLD,
  cooldownMs = Number.parseInt(process.env.SEO_LLM_CIRCUIT_BREAKER_COOLDOWN_MS, 10) || DEFAULT_COOLDOWN_MS
) {
  const state = getState(providerName);
  state.failureCount += 1;
  if (state.failureCount >= threshold) {
    state.circuitOpenUntil = new Date(Date.now() + cooldownMs);
  }
}

/**
 * Mark a provider as rate-limited with a reset timestamp.
 * @param {string} providerName
 * @param {number} retryAfterMs - Milliseconds until rate limit resets
 */
export function markRateLimited(providerName, retryAfterMs) {
  const state = getState(providerName);
  const resetAt = new Date(Date.now() + (retryAfterMs || 300000));
  state.rateLimitResetAt = resetAt;
  return resetAt;
}

/**
 * Reset all state for a provider (used by manual "Reset" button).
 * @param {string} providerName
 */
export function resetProvider(providerName) {
  states.set(providerName, {
    failureCount: 0,
    circuitOpenUntil: null,
    rateLimitResetAt: null,
  });
}

/**
 * Get a snapshot of the current state for diagnostics.
 * @param {string} providerName
 * @returns {{ failureCount: number, circuitOpenUntil: Date|null, rateLimitResetAt: Date|null }}
 */
export function getProviderState(providerName) {
  const state = getState(providerName);
  return {
    failureCount: state.failureCount,
    circuitOpenUntil: state.circuitOpenUntil,
    rateLimitResetAt: state.rateLimitResetAt,
  };
}
