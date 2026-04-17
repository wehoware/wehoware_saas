"use client";

// src/hooks/useAuth.js
// Legacy compatibility shim — re-exports useAuth and AuthProvider from
// the primary auth context so existing imports from this path continue
// to work without changes.
//
// MIGRATION NOTE:
//   The full auth implementation lives in src/contexts/auth-context.js.
//   This file previously used the Supabase client directly; it now delegates
//   entirely to the NextAuth-backed context. No Supabase imports remain here.

export { useAuth, AuthProvider } from "@/contexts/auth-context";
