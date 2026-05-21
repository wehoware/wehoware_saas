import { test } from "node:test";
import assert from "node:assert/strict";
import {
  encryptSecret,
  decryptSecret,
  hmacSha256,
  safeEqualHex,
  sha256Hex,
  __resetKeyCacheForTests,
} from "@/lib/crypto";

test("encryptSecret/decryptSecret round-trip preserves the plaintext", () => {
  const plaintext = "access-sandbox-abc123-supersecret";
  const cipher = encryptSecret(plaintext);
  assert.notEqual(cipher, plaintext);
  assert.match(cipher, /^v1:/);
  assert.equal(decryptSecret(cipher), plaintext);
});

test("encryptSecret produces different ciphertext for same input (random IV)", () => {
  const a = encryptSecret("same-input");
  const b = encryptSecret("same-input");
  assert.notEqual(a, b);
  assert.equal(decryptSecret(a), "same-input");
  assert.equal(decryptSecret(b), "same-input");
});

test("encryptSecret handles unicode + long strings", () => {
  const plaintext = "🔐 secret — " + "x".repeat(2000);
  const cipher = encryptSecret(plaintext);
  assert.equal(decryptSecret(cipher), plaintext);
});

test("encryptSecret returns null for null/empty/undefined", () => {
  assert.equal(encryptSecret(null), null);
  assert.equal(encryptSecret(undefined), null);
  assert.equal(encryptSecret(""), null);
});

test("decryptSecret returns null for null/empty input", () => {
  assert.equal(decryptSecret(null), null);
  assert.equal(decryptSecret(""), null);
});

test("decryptSecret rejects malformed token", () => {
  assert.throws(() => decryptSecret("not-a-token"), /malformed/);
  assert.throws(() => decryptSecret("v1:a:b"), /malformed/);
  assert.throws(() => decryptSecret("v9:a:b:c"), /malformed/);
});

test("decryptSecret detects tampering via auth tag mismatch", () => {
  const cipher = encryptSecret("hello world");
  // Flip a byte in the ciphertext segment.
  const parts = cipher.split(":");
  const tampered = Buffer.from(parts[2], "base64");
  tampered[0] ^= 0xff;
  parts[2] = tampered.toString("base64");
  const bad = parts.join(":");
  assert.throws(() => decryptSecret(bad));
});

test("encryptSecret throws on missing key", () => {
  const original = process.env.APP_ENCRYPTION_KEY;
  process.env.APP_ENCRYPTION_KEY = "";
  __resetKeyCacheForTests();
  try {
    assert.throws(() => encryptSecret("x"), /APP_ENCRYPTION_KEY/);
  } finally {
    process.env.APP_ENCRYPTION_KEY = original;
    __resetKeyCacheForTests();
  }
});

test("encryptSecret throws on key with wrong length", () => {
  const original = process.env.APP_ENCRYPTION_KEY;
  process.env.APP_ENCRYPTION_KEY = Buffer.from("short").toString("base64");
  __resetKeyCacheForTests();
  try {
    assert.throws(() => encryptSecret("x"), /32 bytes/);
  } finally {
    process.env.APP_ENCRYPTION_KEY = original;
    __resetKeyCacheForTests();
  }
});

test("hmacSha256 is deterministic and hex-encoded", () => {
  const sig1 = hmacSha256("secret", "1700000000./api/cron/foo");
  const sig2 = hmacSha256("secret", "1700000000./api/cron/foo");
  assert.equal(sig1, sig2);
  assert.match(sig1, /^[0-9a-f]{64}$/);
});

test("hmacSha256 differs on payload change", () => {
  const a = hmacSha256("secret", "payload-a");
  const b = hmacSha256("secret", "payload-b");
  assert.notEqual(a, b);
});

test("safeEqualHex returns true only for matching hex strings", () => {
  const a = hmacSha256("secret", "x");
  assert.equal(safeEqualHex(a, a), true);
  assert.equal(safeEqualHex(a, a.replace("a", "b")), false);
  assert.equal(safeEqualHex(a, a.slice(1)), false); // length mismatch
  assert.equal(safeEqualHex(null, a), false);
  assert.equal(safeEqualHex(a, null), false);
});

test("sha256Hex returns 64-char hex digest", () => {
  const digest = sha256Hex("hello");
  assert.match(digest, /^[0-9a-f]{64}$/);
});
