// tests/setup.mjs — registers the custom ESM loader before tests run.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./loader.mjs", pathToFileURL("./tests/"));

// Deterministic env so secret/HMAC modules behave consistently in tests.
// Each value is a development-only constant; production must override.
process.env.APP_ENCRYPTION_KEY ??=
  "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8="; // 32 zeroed-pattern bytes
process.env.CRON_SECRET ??= "test-cron-secret";
process.env.EMAIL_PROVIDER_MODE ??= "log";
process.env.EMAIL_FROM_ADDRESS ??= "no-reply@test.local";
process.env.PLAID_CLIENT_ID ??= "test-client-id";
process.env.PLAID_SECRET ??= "test-secret";
process.env.PLAID_ENV ??= "sandbox";
