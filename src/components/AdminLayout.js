"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import AdminHeader from "@/components/AdminHeader";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Calendar,
  ReceiptText,
  CreditCard,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Calculator,
  Wallet,
  Receipt,
  UserSquare,
  PieChart,
  Link2,
  Target,
  ClipboardList,
} from "lucide-react";

// Sidebar configuration. Each entry is either a flat link or a group with children.
// Groups auto-expand when the current pathname matches any child href.
const ACCOUNTING_GROUP_ID = "accounting";
const TASKS_GROUP_ID = "tasks";

const sidebarSections = [
  {
    type: "link",
    title: "Dashboard",
    href: "/admin",
    icon: <LayoutDashboard className="h-5 w-5" />,
    roles: ["admin", "employee", "client"],
    matchExact: true,
  },
  {
    type: "link",
    title: "Clients",
    href: "/admin/clients",
    icon: <Building className="h-5 w-5" />,
    roles: ["admin", "employee"],
  },
  {
    type: "link",
    title: "Users",
    href: "/admin/users",
    icon: <Users className="h-5 w-5" />,
    roles: ["admin", "client"],
    clientRoles: ["manager"],
  },
  {
    type: "group",
    id: ACCOUNTING_GROUP_ID,
    title: "Accounting",
    icon: <Calculator className="h-5 w-5" />,
    roles: ["admin", "employee", "client"],
    children: [
      {
        title: "Dashboard",
        href: "/admin/accounting",
        icon: <PieChart className="h-4 w-4" />,
        roles: ["admin", "employee", "client"],
        matchExact: true,
      },
      {
        title: "Invoices",
        href: "/admin/accounting/invoices",
        icon: <ReceiptText className="h-4 w-4" />,
        roles: ["admin", "client"],
      },
      {
        title: "Bills",
        href: "/admin/accounting/bills",
        icon: <Receipt className="h-4 w-4" />,
        roles: ["admin", "employee"],
      },
      {
        title: "Transactions",
        href: "/admin/accounting/transactions",
        icon: <CreditCard className="h-4 w-4" />,
        roles: ["admin", "client"],
      },
      {
        title: "Expenses",
        href: "/admin/accounting/expenses",
        icon: <Wallet className="h-4 w-4" />,
        roles: ["admin", "employee"],
      },
      {
        title: "Vendors",
        href: "/admin/accounting/vendors",
        icon: <UserSquare className="h-4 w-4" />,
        roles: ["client", "admin"],
      },
      {
        title: "Customers",
        href: "/admin/accounting/customers",
        icon: <Users className="h-4 w-4" />,
        roles: ["client", "admin"],
      },
      {
        title: "Reports",
        href: "/admin/accounting/reports",
        icon: <BarChart className="h-4 w-4" />,
        roles: ["admin", "employee", "client"],
      },
      {
        title: "Bank Feeds",
        href: "/admin/accounting/integrations/plaid",
        icon: <Link2 className="h-4 w-4" />,
        roles: ["admin", "employee", "client"],
      },
      {
        title: "Settings",
        href: "/admin/accounting/settings",
        icon: <Settings className="h-4 w-4" />,
        roles: ["admin"],
      },
    ],
  },
  {
    type: "group",
    id: TASKS_GROUP_ID,
    title: "Tasks",
    icon: <CheckCircle className="h-5 w-5" />,
    roles: ["admin", "employee"],
    children: [
      {
        title: "All Tasks",
        href: "/admin/tasks",
        icon: <ClipboardList className="h-4 w-4" />,
        roles: ["admin", "employee"],
      },
      {
        title: "Reports",
        href: "/admin/tasks/reports",
        icon: <BarChart className="h-4 w-4" />,
        roles: ["admin"],
      },
      {
        title: "Goals",
        href: "/admin/tasks/goals",
        icon: <Target className="h-4 w-4" />,
        roles: ["admin", "employee"],
      },
    ],
  },
  {
    type: "link",
    title: "Appointments",
    href: "/admin/appointments",
    icon: <Calendar className="h-5 w-5" />,
    roles: ["admin", "client"],
  },
  {
    type: "link",
    title: "Services",
    href: "/admin/services",
    icon: <Briefcase className="h-5 w-5" />,
    roles: ["admin", "employee", "client"],
  },
  {
    type: "link",
    title: "Blogs",
    href: "/admin/blogs",
    icon: <FileText className="h-5 w-5" />,
    roles: ["admin", "employee", "client"],
  },
  {
    type: "link",
    title: "SEO",
    href: "/admin/seo",
    icon: <Search className="h-5 w-5" />,
    roles: ["admin", "employee", "client"],
  },
  {
    type: "link",
    title: "Inquiries",
    href: "/admin/inquiries",
    icon: <MessageSquare className="h-5 w-5" />,
    roles: ["admin", "employee", "client"],
  },
  {
    type: "link",
    title: "Integrations",
    href: "/admin/integrations",
    icon: <LinkIcon className="h-5 w-5" />,
    roles: ["admin", "employee", "client"],
  },
  {
    type: "link",
    title: "Forms",
    href: "/admin/forms",
    icon: <FormInput className="h-5 w-5" />,
    roles: ["admin", "employee", "client"],
  },
  {
    type: "link",
    title: "Reports",
    href: "/admin/reports",
    icon: <BarChart className="h-5 w-5" />,
    roles: ["admin", "employee", "client"],
  },
  {
    type: "link",
    title: "Settings",
    href: "/admin/settings",
    icon: <Settings className="h-5 w-5" />,
    roles: ["admin", "employee", "client"],
  },
];

function filterSectionsByRole(sections, role, activeClientRole) {
  const visible = [];
  for (const section of sections) {
    if (!section.roles.includes(role)) continue;
    // Sections with clientRoles are only visible when the user's activeClientRole matches
    if (role === "client" && section.clientRoles && !section.clientRoles.includes(activeClientRole)) {
      continue;
    }
    if (section.type === "link") {
      visible.push(section);
      continue;
    }
    const allowedChildren = (section.children || []).filter((c) =>
      c.roles.includes(role)
    );
    if (allowedChildren.length === 0) continue;
    visible.push({ ...section, children: allowedChildren });
  }
  return visible;
}

function isLinkActive(href, pathname, matchExact) {
  if (matchExact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function findActiveRoute(sections, pathname) {
  for (const section of sections) {
    if (section.type === "link") {
      if (isLinkActive(section.href, pathname, section.matchExact)) {
        return { section, child: null };
      }
      continue;
    }
    for (const child of section.children) {
      if (isLinkActive(child.href, pathname, child.matchExact)) {
        return { section, child };
      }
    }
  }
  return null;
}

const AdminLayout = ({ children }) => {
  // Unconditionally call all hooks.
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Extract current role in lowercase (or empty string if not set).
  const role = user?.role?.toLowerCase() || "";

  // Filter sidebar items based on allowed roles (groups + nested children).
  const allowedSections = useMemo(
    () => filterSectionsByRole(sidebarSections, role, user?.activeClientRole),
    [role, user?.activeClientRole]
  );

  // Find the active section/child for the current pathname.
  const activeRoute = useMemo(
    () => findActiveRoute(allowedSections, pathname),
    [allowedSections, pathname]
  );

  // Track which groups the user has manually toggled.
  // A group is shown as expanded if the user explicitly toggled it OR
  // if it contains the active route (computed at render time, not via effect).
  const [groupOverrides, setGroupOverrides] = useState({});

  const isGroupExpanded = (groupId) =>
    Object.hasOwn(groupOverrides, groupId)
      ? groupOverrides[groupId]
      : activeRoute?.section?.id === groupId;

  const toggleGroup = (groupId) => {
    const currentlyExpanded = isGroupExpanded(groupId);
    setGroupOverrides((prev) => ({ ...prev, [groupId]: !currentlyExpanded }));
  };

  // Always allow the '/admin' dashboard. Otherwise allow only routes that
  // appear in the user's allowed sections.
  const isRouteAllowed = pathname === "/admin" || Boolean(activeRoute);

  // Guard: if the current route isn’t allowed, show an error and redirect.
  useEffect(() => {
    // Add extra check: If isLoading is done, user exists, but role is somehow empty, treat as unauthorized.
    const effectivelyUnauthorized = !isLoading && user && !role;

    if (
      !isLoading &&
      user &&
      (!isRouteAllowed || effectivelyUnauthorized) &&
      pathname !== "/admin"
    ) {
      toast.error(
        "Access Denied: You don't have permission to view this page."
      );
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
    <>
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
      ) : !user ? null : ( // When there is no user, the redirection is assumed to be handled elsewhere.
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
                {allowedSections.map((section) => {
                  if (section.type === "link") {
                    const active = isLinkActive(
                      section.href,
                      pathname,
                      section.matchExact
                    );
                    return (
                      <Link
                        key={section.href}
                        href={section.href}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${
                          active
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent/50 text-muted-foreground hover:text-accent-foreground"
                        } ${!isSidebarOpen && "justify-center"}`}
                      >
                        {section.icon}
                        {isSidebarOpen && <span>{section.title}</span>}
                      </Link>
                    );
                  }

                  // Group rendering
                  const isExpanded = isGroupExpanded(section.id);
                  const hasActiveChild = section.children.some((child) =>
                    isLinkActive(child.href, pathname, child.matchExact)
                  );
                  return (
                    <div key={section.id} className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => {
                          if (!isSidebarOpen) return;
                          toggleGroup(section.id);
                        }}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all w-full text-left ${
                          hasActiveChild
                            ? "text-accent-foreground"
                            : "text-muted-foreground hover:text-accent-foreground"
                        } ${!isSidebarOpen && "justify-center"} hover:bg-accent/50`}
                        aria-expanded={isExpanded}
                      >
                        {section.icon}
                        {isSidebarOpen && (
                          <>
                            <span className="flex-1">{section.title}</span>
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </>
                        )}
                      </button>
                      {isSidebarOpen && isExpanded && (
                        <div className="mt-1 ml-3 border-l border-border pl-3 flex flex-col gap-1">
                          {section.children.map((child) => {
                            const childActive = isLinkActive(
                              child.href,
                              pathname,
                              child.matchExact
                            );
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-all ${
                                  childActive
                                    ? "bg-accent text-accent-foreground"
                                    : "hover:bg-accent/50 text-muted-foreground hover:text-accent-foreground"
                                }`}
                              >
                                {child.icon}
                                <span>{child.title}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </ScrollArea>
            <div className="mt-auto p-4">
              {/* <ModeToggle /> */}
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
    </>
  );
};

export default AdminLayout;
