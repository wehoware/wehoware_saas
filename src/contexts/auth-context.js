"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "react-hot-toast";

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clientUrl, setClientUrl] = useState(null);
  const [activeClient, setActiveClient] = useState(null); // State for the full client object
  const router = useRouter();
  const pathname = usePathname();

  // Local storage key
  const ACTIVE_CLIENT_ID_KEY = "wehoware_activeClientId";

  // Initialize auth state on load
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/v1/auth", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        const data = await response.json();

        if (response.ok && data.user) {
          setUser(data.user);

          // Set initial active client
          let initialActiveClient = null;
          const savedClientId = localStorage.getItem(ACTIVE_CLIENT_ID_KEY);

          if (
            ["employee", "admin"].includes(data.user.role) &&
            data.user.accessibleClients?.length > 0
          ) {
            // Try restoring from localStorage first for employee/admin
            if (savedClientId) {
              initialActiveClient =
                data.user.accessibleClients.find(
                  (c) => c.id === savedClientId
                ) || null;
            }
            // If not restored or invalid, find primary or use the first one
            if (!initialActiveClient) {
              initialActiveClient =
                data.user.accessibleClients.find((c) => c.isPrimary) ||
                data.user.accessibleClients[0];
            }
          } else if (data.user.role === "client" && data.user.clientDetails) {
            // For client users, set their own client as active (localStorage isn't strictly needed but doesn't hurt)
            initialActiveClient = data.user.clientDetails;
          }

          setActiveClient(initialActiveClient);
          setClientUrl(initialActiveClient?.website); // Set clientUrl from website field

          // Save/update the determined active client ID to localStorage
          if (initialActiveClient) {
            if (initialActiveClient.id !== savedClientId) {
              localStorage.setItem(
                ACTIVE_CLIENT_ID_KEY,
                initialActiveClient.id
              );
            }
          } else {
            localStorage.removeItem(ACTIVE_CLIENT_ID_KEY);
          }

          // Redirect to admin if on login page
          if (pathname === "/login") {
            router.replace("/admin");
          }
        } else if (
          pathname !== "/login" &&
          pathname !== "/" &&
          !pathname.startsWith("/blog") &&
          !pathname.startsWith("/about") &&
          !pathname.startsWith("/contact") &&
          !pathname.startsWith("/services")
        ) {
          // Only redirect to login if not on public pages
          router.replace("/login");
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
        if (
          pathname !== "/login" &&
          pathname !== "/" &&
          !pathname.startsWith("/blog") &&
          !pathname.startsWith("/about") &&
          !pathname.startsWith("/contact") &&
          !pathname.startsWith("/services")
        ) {
          router.replace("/login");
        }
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, [pathname]);

  // Login function
  const login = async (email, password) => {
    try {
      const response = await fetch("/api/v1/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      setUser(data.user);

      // Set initial active client
      let initialActiveClient = null;
      if (
        ["employee", "admin"].includes(data.user.role) &&
        data.user.accessibleClients?.length > 0
      ) {
        initialActiveClient =
          data.user.accessibleClients.find((c) => c.isPrimary) ||
          data.user.accessibleClients[0];
      } else if (data.user.role === "client" && data.user.clientDetails) {
        initialActiveClient = data.user.clientDetails;
      }

      setActiveClient(initialActiveClient);
      setClientUrl(initialActiveClient?.website); // Set clientUrl from website field

      if (initialActiveClient) {
        localStorage.setItem(ACTIVE_CLIENT_ID_KEY, initialActiveClient.id);
      } else {
        localStorage.removeItem(ACTIVE_CLIENT_ID_KEY);
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

  // Logout function
  const logout = async () => {
    try {
      // Clear saved client ID before logging out
      localStorage.removeItem(ACTIVE_CLIENT_ID_KEY);

      await fetch("/api/v1/auth", {
        method: "DELETE",
      });

      setUser(null);
      setActiveClient(null);
      router.replace("/login");
      toast.success("Logged out successfully");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Logout failed");
    }
  };

  // Switch active client (for employees)
  const switchClient = (clientId) => {
    if (!user || !["employee", "admin", "client"].includes(user.role)) {
      toast.error("Only employees can switch clients");
      return;
    }

    const client = user.accessibleClients.find((c) => c.id === clientId);
    if (!client) {
      toast.error("Client not found");
      return;
    }

    setActiveClient(client);
    toast.success(`Switched to ${client.name}`);

    // Save the newly selected client ID to localStorage
    localStorage.setItem(ACTIVE_CLIENT_ID_KEY, client.id);

    // Update any API calls to include the new client ID
    // This happens automatically through the auth middleware
  };

  // Determine roles - ensure user and user.role exist
  const isAdmin = user?.role === "admin";
  const isEmployee = user?.role === "employee";
  const isClient = user?.role === "client";

  // Auth context value
  const value = {
    user,
    loading,
    activeClient,
    isAuthenticated: !!user,
    isAdmin,
    isEmployee,
    isClient,
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
