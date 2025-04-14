"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import AdminHeader from "@/components/AdminHeader";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ThemeProvider } from "@/components/theme-provider";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  MessageSquare,
  Search,
  Settings,
  LogOut,
  Menu,
  X,
  FormInput,
  Link as LinkIcon,
  BarChart,
  Users,
  Building,
  NotebookPen,
} from "lucide-react";

// Centralized sidebar configuration with allowed roles for each item.
const sidebarMenu = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: <LayoutDashboard className="h-5 w-5" />,
    roles: ["admin", "employee", "client"],
  },
  {
    title: "Clients",
    href: "/admin/clients",
    icon: <Building className="h-5 w-5" />,
    roles: ["admin", "employee"],
  },
  {
    title: "Users",
    href: "/admin/users",
    icon: <Users className="h-5 w-5" />,
    roles: ["admin"],
  },
  {
    title: "Services",
    href: "/admin/services",
    icon: <Briefcase className="h-5 w-5" />,
    roles: ["admin", "employee", "client"],
  },
  {
    title: "Blogs",
    href: "/admin/blogs",
    icon: <FileText className="h-5 w-5" />,
    roles: ["admin", "employee", "client"],
  },
  {
    title: "SEO",
    href: "/admin/seo",
    icon: <Search className="h-5 w-5" />,
    roles: ["admin", "employee", "client"],
  },
  {
    title: "Keywords",
    href: "/admin/keywords",
    icon: <NotebookPen className="h-5 w-5" />,
    roles: ["admin", "employee", "client"],
  },
  {
    title: "Inquiries",
    href: "/admin/inquiries",
    icon: <MessageSquare className="h-5 w-5" />,
    roles: ["admin", "employee", "client"],
  },
  {
    title: "Integrations",
    href: "/admin/integrations",
    icon: <LinkIcon className="h-5 w-5" />,
    roles: ["admin", "employee", "client"],
  },
  {
    title: "Forms",
    href: "/admin/forms",
    icon: <FormInput className="h-5 w-5" />,
    roles: ["admin", "employee", "client"],
  },
  {
    title: "Reports",
    href: "/admin/reports",
    icon: <BarChart className="h-5 w-5" />,
    roles: ["admin", "employee", "client"],
  },
  {
    title: "Settings",
    href: "/admin/settings",
    icon: <Settings className="h-5 w-5" />,
    roles: ["admin", "employee", "client"],
  },
];

const AdminLayout = ({ children }) => {
  // Unconditionally call all hooks.
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Extract current role in lowercase (or empty string if not set).
  const role = user?.role?.toLowerCase() || "";

  // Filter sidebar items based on allowed roles.
  const allowedSidebarItems = sidebarMenu.filter((item) =>
    item.roles.includes(role)
  );

  // Determine if the current route is allowed for the user's role.
  // Find the base menu item corresponding to the current pathname.
  const currentMenuItem = sidebarMenu.find((item) => pathname.startsWith(item.href));

  // Check if the user's role is included in the allowed roles for this menu item.
  // Always allow the '/admin' dashboard itself.
  const isRouteAllowed =
    pathname === "/admin" || // Always allow dashboard
    (currentMenuItem && currentMenuItem.roles.includes(role));

  // Guard: if the current route isn’t allowed, show an error and redirect.
  useEffect(() => {
    // Add extra check: If isLoading is done, user exists, but role is somehow empty, treat as unauthorized.
    const effectivelyUnauthorized = !isLoading && user && !role;

    if (!isLoading && user && (!isRouteAllowed || effectivelyUnauthorized) && pathname !== "/admin") {
      toast.error("Access Denied: You don't have permission to view this page.");
      router.push("/admin"); // Redirect to base admin dashboard
    }
  }, [isLoading, user, role, isRouteAllowed, pathname, router]); // Added role dependency

  // Responsive sidebar behavior: adjust based on window width.
  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      setIsSidebarOpen(!mobile);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);

  // Render a loading state if auth is still loading,
  // an empty render if no user exists (handled elsewhere),
  // or the main layout UI otherwise.
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {isLoading ? (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="animate-pulse text-primary">
            <svg
              className="w-12 h-12"
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
            </svg>
          </div>
        </div>
      ) : !user ? // When there is no user, the redirection is assumed to be handled elsewhere.
      null : (
        <div className="min-h-screen flex bg-background">
          {/* Sidebar */}
          <div
            className={`${
              isSidebarOpen ? "w-64" : "w-0 lg:w-16"
            } fixed inset-y-0 z-50 flex flex-col transition-all duration-300 bg-muted/40 backdrop-blur-xl border-r border-gray-200 shadow-md`}
          >
            <div className="flex h-16 items-center justify-between px-4">
              {isSidebarOpen && (
                <Link
                  href="/admin"
                  className="flex items-center gap-2 font-semibold"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-6 w-6"
                  >
                    <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
                  </svg>
                  <span className="text-xl">Wehoware</span>
                </Link>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={toggleSidebar}
              >
                {isSidebarOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            </div>
            <ScrollArea className="flex-1 overflow-auto py-2">
              <nav className="grid gap-1 px-2">
                {allowedSidebarItems.map((item, index) => (
                  <Link
                    key={index}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${
                      pathname === item.href
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50 text-muted-foreground hover:text-accent-foreground"
                    } ${!isSidebarOpen && "justify-center"}`}
                  >
                    {item.icon}
                    {isSidebarOpen && <span>{item.title}</span>}
                  </Link>
                ))}
              </nav>
            </ScrollArea>
            <div className="mt-auto p-4">
              <ModeToggle />
              <Button
                variant="outline"
                className={`mt-4 w-full ${
                  !isSidebarOpen && "justify-center p-0 h-10 w-10"
                }`}
                onClick={logout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                {isSidebarOpen && <span>Logout</span>}
              </Button>
            </div>
          </div>

          {/* Mobile sidebar backdrop */}
          {isMobile && isSidebarOpen && (
            <div
              className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
              onClick={toggleSidebar}
            />
          )}

          {/* Main content */}
          <div
            className={`flex-1 overflow-auto ${
              isSidebarOpen ? "lg:ml-64" : "lg:ml-16"
            }`}
          >
            <AdminHeader />
            <main className="grid flex-1 items-start gap-4 p-4 sm:p-6 md:gap-8">
              <div className="w-full rounded-xl border border-gray-200 bg-card shadow-md p-6">
                {children}
              </div>
            </main>
          </div>
        </div>
      )}
    </ThemeProvider>
  );
};

export default AdminLayout;