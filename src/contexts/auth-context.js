"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeClient, setActiveClient] = useState(null);
  const router = useRouter();
  const pathname = usePathname();

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
          if (
            ["employee", "admin"].includes(data.user.role) &&
            data.user.accessibleClients?.length > 0
          ) {
            // Find primary client or use the first one
            const primaryClient =
              data.user.accessibleClients.find((c) => c.isPrimary) ||
              data.user.accessibleClients[0];
            setActiveClient(primaryClient);
          } else if (data.user.role === "client" && data.user.clientDetails) {
            // For client users, set their own client as active
            setActiveClient(data.user.clientDetails);
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
      if (
        ["employee", "admin"].includes(data.user.role) &&
        data.user.accessibleClients?.length > 0
      ) {
        // Find primary client or use the first one
        const primaryClient =
          data.user.accessibleClients.find((c) => c.isPrimary) ||
          data.user.accessibleClients[0];
        setActiveClient(primaryClient);
      } else if (data.user.role === "client" && data.user.clientDetails) {
        // For client users, set their own client as active
        setActiveClient(data.user.clientDetails);
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
    if (!user || !["employee", "admin"].includes(user.role)) {
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

    // Update any API calls to include the new client ID
    // This happens automatically through the auth middleware
  };

  // Auth context value
  const value = {
    user,
    loading,
    activeClient,
    isAuthenticated: !!user,
    isClient: user?.role === "client",
    isEmployee: user?.role === "employee" || user?.role === "admin",
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
