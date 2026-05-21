/**
 * Symmetric AES-256-GCM encryption helpers for secrets at rest
 * (Plaid access tokens, Stripe secret keys, webhook secrets, etc.).
 *
 * Key management:
 * - Dev/test: read APP_ENCRYPTION_KEY from env (base64 32 bytes).
 * - Prod on AWS: the value of APP_ENCRYPTION_KEY should be fetched from
 *   AWS Secrets Manager by Amplify at deploy time and injected as an env var.
 *
 * Output format (self-describing, versioned):
 *   v1:<base64(iv)>:<base64(ciphertext)>:<base64(authTag)>
 *
 * Never log ciphertext.  Never log decrypted plaintext.
 */
import crypto from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const VERSION = "v1";

let cachedKey = null;

function loadKey() {
  if (cachedKey) return cachedKey;
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "APP_ENCRYPTION_KEY is required (base64-encoded 32 bytes). " +
        "Generate one via: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
    );
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `APP_ENCRYPTION_KEY must decode to 32 bytes (got ${buf.length})`
    );
  }
  cachedKey = buf;
  return cachedKey;
}

/**
 * Encrypt a plaintext string to a self-describing token string.
 * Empty/null input returns null.
 */
export function encryptSecret(plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === "") {
    return null;
  }
  if (typeof plaintext !== "string") {
    throw new TypeError("encryptSecret expects a string");
  }
  const key = loadKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64"),
    encrypted.toString("base64"),
    authTag.toString("base64"),
  ].join(":");
}

/**
 * Decrypt a token produced by encryptSecret. Returns null if input is null.
 * Throws on malformed / tampered input.
 */
export function decryptSecret(token) {
  if (token === null || token === undefined || token === "") return null;
  if (typeof token !== "string") {
    throw new TypeError("decryptSecret expects a string");
  }
  const parts = token.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("decryptSecret: malformed token (version/parts mismatch)");
  }
  const [, ivB64, dataB64, tagB64] = parts;
  const key = loadKey();
  const iv = Buffer.from(ivB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  return plaintext.toString("utf8");
}

/**
 * Constant-time HMAC-SHA256 hex digest.  Used to sign cron-job requests.
 */
export function hmacSha256(secret, payload) {
  if (typeof secret !== "string" || !secret) {
    throw new Error("hmacSha256: secret is required");
  }
  return crypto
    .createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("hex");
}

/**
 * Constant-time comparison for two hex strings.  Returns false on any mismatch
 * including length differences.  Safe against timing attacks.
 */
export function safeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(a, "hex"),
      Buffer.from(b, "hex")
    );
  } catch {
    return false;
  }
}

/**
 * SHA256 hex digest helper (not secret-safe; used for idempotency keys /
 * file hashing).
 */
export function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

// Exposed for tests that want to reset the cached key between cases
export function __resetKeyCacheForTests() {
  cachedKey = null;
}
