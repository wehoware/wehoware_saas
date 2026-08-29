// src/app/api/auth/[...nextauth]/route.js
// NextAuth v5 catch-all route — handles all /api/auth/* requests:
//   POST /api/auth/callback/credentials  — credential sign-in
//   POST /api/auth/signout               — sign-out
//   GET  /api/auth/session               — session fetch
//   GET  /api/auth/csrf                  — CSRF token
//   GET  /api/auth/providers             — available providers

import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
