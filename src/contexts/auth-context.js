"use client";

// src/contexts/auth-context.js
// Primary auth context — provides login, logout, active client switching,
// and role helpers to the entire component tree.
//
// MIGRATION CHANGES (Supabase → NextAuth + MySQL/Prisma):
//   login()  — now calls NextAuth signIn('credentials') instead of POSTing
//               directly; then fetches enriched user data from GET /api/v1/auth.
//   logout() — now calls NextAuth signOut() instead of DELETE /api/v1/auth.
//   initializeAuth() — unchanged; still calls GET /api/v1/auth.
//   All response shapes and context values are preserved for backward compat.

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { signIn, signOut as nextAuthSignOut } from "next-auth/react";
import { toast } from "react-hot-toast";

const AuthContext = createContext(undefined);

const ACTIVE_CLIENT_ID_KEY = "wehoware_activeClientId";
// Cookie name read by the API auth middleware so every request is scoped to
// the currently selected client without requiring each page to pass
// ?clientId= explicitly. Keep in sync with src/app/api/utils/auth-middleware.js.
const ACTIVE_CLIENT_COOKIE = "wehoware_active_client_id";

function writeActiveClientCookie(clientId) {
  if (typeof document === "undefined") return;
  if (clientId) {
    // 30-day, SameSite=Lax so it's sent on same-origin fetches; not HttpOnly
    // because this is a client-writable scoping hint, not a credential.
    document.cookie = `${ACTIVE_CLIENT_COOKIE}=${encodeURIComponent(
      clientId
    )}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  } else {
    document.cookie = `${ACTIVE_CLIENT_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }
}

// Paths accessible without authentication
const PUBLIC_PATH_PREFIXES = ["/login", "/blog", "/about", "/contact", "/services"];

function isPublicPath(pathname) {
  if (pathname === "/") return true;
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

/** Fetch enriched current user from the server-side session. */
async function fetchCurrentUser() {
  try {
    const response = await fetch("/api/v1/auth", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.user ?? null;
  } catch {
    return null;
  }
}

/** Resolve which client should be active at startup. */
function resolveInitialActiveClient(user) {
  if (!user) return null;

  if (["employee", "admin"].includes(user.role)) {
    if (!user.accessibleClients?.length) return null;

    let savedId = null;
    try {
      savedId = localStorage.getItem(ACTIVE_CLIENT_ID_KEY);
    } catch {
      // localStorage unavailable (SSR / private browsing) — non-fatal
    }

    if (savedId) {
      const saved = user.accessibleClients.find((c) => c.id === savedId);
      if (saved) return saved;
    }

    return (
      user.accessibleClients.find((c) => c.isPrimary) ||
      user.accessibleClients[0]
    );
  }

  if (user.role === "client") {
    return user.clientDetails ?? null;
  }

  return null;
}

function syncActiveClientStorage(initialActiveClient) {
  try {
    if (initialActiveClient) {
      const savedId = localStorage.getItem(ACTIVE_CLIENT_ID_KEY);
      if (savedId !== initialActiveClient.id) {
        localStorage.setItem(ACTIVE_CLIENT_ID_KEY, initialActiveClient.id);
      }
    } else {
      localStorage.removeItem(ACTIVE_CLIENT_ID_KEY);
    }
  } catch {
    // non-fatal
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clientUrl, setClientUrl] = useState(null);
  const [activeClient, setActiveClient] = useState(null);
  const router = useRouter();
  const pathname = usePathname();

  // ------------------------------------------------------------------
  // Initialize auth state — runs on mount and on pathname change.
  // Reads the NextAuth JWT session via GET /api/v1/auth.
  // ------------------------------------------------------------------
  function clearAuthState() {
    setUser(null);
    setActiveClient(null);
    setClientUrl(null);
    writeActiveClientCookie(null);
  }

  function redirectIfNeeded(targetPath) {
    if (!isPublicPath(targetPath)) {
      router.replace("/login");
    }
  }

  function handleAuthenticatedUser(fetchedUser) {
    setUser(fetchedUser);
    const initialActiveClient = resolveInitialActiveClient(fetchedUser);
    setActiveClient(initialActiveClient);
    setClientUrl(initialActiveClient?.website ?? null);
    writeActiveClientCookie(initialActiveClient?.id ?? null);
    syncActiveClientStorage(initialActiveClient);
    if (pathname === "/login") {
      router.replace("/admin");
    }
  }

  function handleUnauthenticatedUser() {
    clearAuthState();
    redirectIfNeeded(pathname);
  }

  function handleAuthError() {
    clearAuthState();
    redirectIfNeeded(pathname);
  }

  useEffect(() => {
    let cancelled = false;

    const initializeAuth = async () => {
      try {
        setLoading(true);
        const fetchedUser = await fetchCurrentUser();

        if (cancelled) return;

        if (fetchedUser) {
          handleAuthenticatedUser(fetchedUser);
        } else {
          handleUnauthenticatedUser();
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Error initializing auth:", error);
        handleAuthError();
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------------
  // login — delegates credential verification to NextAuth, then fetches
  // the enriched user object (accessible clients, etc.) from the API.
  // ------------------------------------------------------------------
  const login = async (email, password) => {
    try {
      const result = await signIn("credentials", {
        email: typeof email === "string" ? email.trim().toLowerCase() : email,
        password,
        redirect: false,
      });

      if (!result?.ok || result?.error) {
        throw new Error(
          result?.error === "CredentialsSignin"
            ? "Invalid email or password"
            : (result?.error ?? "Login failed")
        );
      }

      // Session cookie is now set — fetch enriched user data
      const fetchedUser = await fetchCurrentUser();

      if (!fetchedUser) {
        throw new Error("Failed to load user profile after login");
      }

      setUser(fetchedUser);

      const initialActiveClient = resolveInitialActiveClient(fetchedUser);
      setActiveClient(initialActiveClient);
      setClientUrl(initialActiveClient?.website ?? null);
      writeActiveClientCookie(initialActiveClient?.id ?? null);

      try {
        if (initialActiveClient) {
          localStorage.setItem(ACTIVE_CLIENT_ID_KEY, initialActiveClient.id);
        } else {
          localStorage.removeItem(ACTIVE_CLIENT_ID_KEY);
        }
      } catch {
        // non-fatal
      }

      router.replace("/admin");
      toast.success("Logged in successfully");
      return true;
    } catch (error) {
      console.error("Login error:", error);
      toast.error(error.message || "Login failed");
      return false;
    }
  };

  // ------------------------------------------------------------------
  // logout — clears local state and signs out via NextAuth.
  // ------------------------------------------------------------------
  const logout = async () => {
    try {
      try {
        localStorage.removeItem(ACTIVE_CLIENT_ID_KEY);
      } catch {
        // non-fatal
      }

      await nextAuthSignOut({ redirect: false });

      setUser(null);
      setActiveClient(null);
      setClientUrl(null);
      writeActiveClientCookie(null);

      router.replace("/login");
      toast.success("Logged out successfully");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Logout failed");
    }
  };

  // ------------------------------------------------------------------
  // switchClient — employees/admins change the active client context.
  // ------------------------------------------------------------------
  const switchClient = (clientId) => {
    if (!user || !["employee", "admin", "client"].includes(user.role)) {
      toast.error("Only employees can switch clients");
      return;
    }

    const client = user.accessibleClients?.find((c) => c.id === clientId);
    if (!client) {
      toast.error("Client not found");
      return;
    }

    setActiveClient(client);
    setClientUrl(client.website ?? null);
    writeActiveClientCookie(client.id);
    toast.success(`Switched to ${client.name}`);

    try {
      localStorage.setItem(ACTIVE_CLIENT_ID_KEY, client.id);
    } catch {
      // non-fatal
    }
  };

  const isAdmin = user?.role === "admin";
  const isEmployee = user?.role === "employee";
  const isClient = user?.role === "client";

  // Per-client role helpers (from activeClientRole resolved server-side)
  const activeClientRole = user?.activeClientRole ?? null;
  const isClientOwner = activeClientRole === "client";
  const isManager = activeClientRole === "manager";
  const isEditor = activeClientRole === "editor";
  const isViewer = activeClientRole === "viewer";

  // Coarse permission helpers
  const canInvite = isAdmin || isEmployee || isClientOwner || isManager;
  const canManageUsers = isAdmin || isEmployee || isClientOwner;
  const canViewTeam = isAdmin || isEmployee || isClientOwner || isManager;
  const canEditContent = isAdmin || isEmployee || isClientOwner || isManager || isEditor;

  const value = {
    user,
    loading,
    activeClient,
    isAuthenticated: !!user,
    isAdmin,
    isEmployee,
    isClient,
    activeClientRole,
    isClientOwner,
    isManager,
    isEditor,
    isViewer,
    canInvite,
    canManageUsers,
    canViewTeam,
    canEditContent,
    clientUrl,
    login,
    logout,
    switchClient,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
