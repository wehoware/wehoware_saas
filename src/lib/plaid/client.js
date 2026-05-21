/**
 * Plaid SDK client factory — env-aware (sandbox/development/production).
 *
 * Configuration (env):
 *   PLAID_CLIENT_ID       required
 *   PLAID_SECRET          required
 *   PLAID_ENV             one of "sandbox" | "development" | "production" (default "sandbox")
 *   PLAID_WEBHOOK_URL     optional; passed to /item/create so Plaid sends
 *                         item/transaction webhooks to us
 *   PLAID_PRODUCTS        comma-separated, default "transactions"
 *   PLAID_COUNTRY_CODES   comma-separated, default "US,CA"
 *
 * For tests, call `__setPlaidClientForTests(mockClient)` to swap the SDK.
 */
let injected = null;

/** Swap in a mock PlaidApi for tests. Pass null to restore default. */
export function __setPlaidClientForTests(client) {
  injected = client;
}

export function plaidEnv() {
  return (process.env.PLAID_ENV || "sandbox").toLowerCase();
}

export function plaidProducts() {
  const raw = process.env.PLAID_PRODUCTS || "transactions";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function plaidCountryCodes() {
  const raw = process.env.PLAID_COUNTRY_CODES || "US,CA";
  return raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

export async function getPlaidClient() {
  if (injected) return injected;
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  if (!clientId || !secret) {
    throw new Error(
      "Plaid is not configured: set PLAID_CLIENT_ID and PLAID_SECRET"
    );
  }

  const { Configuration, PlaidApi, PlaidEnvironments } = await import("plaid");
  const env = plaidEnv();
  const basePath = PlaidEnvironments[env];
  if (!basePath) {
    throw new Error(
      `Unknown PLAID_ENV=${env}. Must be one of sandbox|development|production.`
    );
  }

  const configuration = new Configuration({
    basePath,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  });
  return new PlaidApi(configuration);
}
