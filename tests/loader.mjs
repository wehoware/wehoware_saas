// tests/loader.mjs
// Custom Node ESM resolver that:
//   1. Maps the Next.js `@/` alias to `./src/`
//   2. Redirects `next/server`, `@/lib/prisma`, `@/lib/auth`,
//      `@/lib/invoiceTemplates`, `@/lib/storage` to in-repo test mocks
// so API route handlers can be imported and exercised without running a
// live Next.js dev server.

import { pathToFileURL, fileURLToPath } from "node:url";
import { resolve as pathResolve, dirname } from "node:path";
import { existsSync, statSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const testsDir = __dirname;
const srcDir = pathResolve(__dirname, "..", "src");

const MOCKS = {
  "next/server": pathResolve(testsDir, "mocks", "next-server.mjs"),
  "@/lib/prisma": pathResolve(testsDir, "mocks", "prisma.mjs"),
  "@/lib/auth": pathResolve(testsDir, "mocks", "auth.mjs"),
  "@/lib/invoiceTemplates": pathResolve(testsDir, "mocks", "invoice-templates.mjs"),
  "@/lib/storage": pathResolve(testsDir, "mocks", "storage.mjs"),
  "@/lib/sanitize": pathResolve(testsDir, "mocks", "sanitize.mjs"),
};

function toFileHref(absolute) {
  return pathToFileURL(absolute).href;
}

const EXT_CANDIDATES = [".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx"];

function resolveWithExtension(absolute) {
  if (existsSync(absolute) && statSync(absolute).isFile()) {
    return absolute;
  }
  for (const ext of EXT_CANDIDATES) {
    const candidate = absolute + ext;
    if (existsSync(candidate)) return candidate;
  }
  if (existsSync(absolute) && statSync(absolute).isDirectory()) {
    for (const ext of EXT_CANDIDATES) {
      const candidate = pathResolve(absolute, "index" + ext);
      if (existsSync(candidate)) return candidate;
    }
  }
  return absolute;
}

export async function resolve(specifier, context, nextResolve) {
  if (MOCKS[specifier]) {
    return nextResolve(toFileHref(MOCKS[specifier]), context);
  }
  if (specifier.startsWith("@/")) {
    const absolute = pathResolve(srcDir, specifier.slice(2));
    return nextResolve(toFileHref(resolveWithExtension(absolute)), context);
  }
  // Resolve extensionless relative imports (./foo, ../bar) the same way
  // Next.js does via its bundler: try .js, .mjs, .cjs, etc.
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !/\.[a-z]+$/i.test(specifier) &&
    context.parentURL
  ) {
    const parentDir = dirname(fileURLToPath(context.parentURL));
    const absolute = pathResolve(parentDir, specifier);
    const resolved = resolveWithExtension(absolute);
    if (resolved !== absolute) {
      return nextResolve(toFileHref(resolved), context);
    }
  }
  return nextResolve(specifier, context);
}
