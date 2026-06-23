"use client";

import * as React from "react";
import {
  ChevronDown,
  LogOut,
  Menu,
  Search,
  Settings,
  User,
  Users,
  TrainFront,
  NotebookPen,
  Mail,
  Shield,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/auth-context";

const AdminHeader = ({ className }) => {
  const {
    user,
    activeClient,
    switchClient,
    isEmployee,
    isAdmin,
    isClientOwner,
    isManager,
    canViewTeam,
    activeClientRole,
    logout,
  } = useAuth();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  // Compute user initials with memoization for performance.
  const userInitials = React.useMemo(() => {
    if (!user) return "U";
    const first = user.firstName?.trim().charAt(0) || "";
    const last = user.lastName?.trim().charAt(0) || "";
    if (first || last) return (first + last).toUpperCase();
    return user.email?.charAt(0).toUpperCase() || "U";
  }, [user]);

  return (
    <header
      className={`w-full border-b border-border bg-background ${className}`}
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between py-2">
          {/* Left Section: Search and Client Switcher */}
          <div className="flex items-center gap-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." className="pl-8" />
            </div>
            {/* Client Switcher: Visible for employees or admins with accessible clients */}
            {user?.accessibleClients?.length > 0 && (
              <div className="hidden md:block ">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <span className="max-w-[150px] truncate">
                        {activeClient?.name || "select client"}
                      </span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-60">
                    <DropdownMenuLabel>Switch Client</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {user.accessibleClients.map((client) => (
                      <DropdownMenuItem
                        key={client.id}
                        className={
                          client.id === activeClient?.id ? "bg-accent" : ""
                        }
                        onClick={() => switchClient(client.id)}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="truncate">{client.name}</span>
                          {client.isPrimary && (
                            <Badge variant="outline" className="ml-2">
                              Primary
                            </Badge>
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
            {(isAdmin || isEmployee) && (
              <div className="hidden md:block ">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      Tools
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <TrainFront className="mr-2 h-4 w-4" />
                      Humaniser
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <NotebookPen className="mr-2 h-4 w-4" />
                      Keywords Analysis
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <NotebookPen className="mr-2 h-4 w-4" />
                      Competitor Analysis
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
            {canViewTeam && (
              <div className="hidden md:block">
                <Button
                  variant="outline"
                  className="flex items-center gap-2"
                  onClick={() => router.push("/admin/team")}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Team
                </Button>
              </div>
            )}
          </div>

          {/* Right Section: Desktop Profile Dropdown */}
          <div className="hidden items-center gap-4 md:flex">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.avatarUrl} alt={user?.firstName} />
                    <AvatarFallback>{userInitials}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start">
                    <span className="font-medium leading-tight">
                      {(user?.firstName && user.firstName.toUpperCase()) ||
                        (user?.lastName && user.lastName.toUpperCase()) ||
                        (user?.email && user.email.toUpperCase()) ||
                        "User"}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize leading-tight">
                      {activeClientRole ? `${activeClientRole} (client)` : (user?.role || "Role")}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {/* Profile summary header */}
                <div className="flex items-center gap-3 p-2">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user?.avatarUrl} alt={user?.firstName} />
                    <AvatarFallback>{userInitials}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col overflow-hidden">
                    <span className="truncate text-sm font-medium">
                      {user?.firstName || user?.lastName
                        ? `${user?.firstName || ""} ${user?.lastName || ""}`.trim()
                        : "User"}
                    </span>
                    {user?.email && (
                      <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate">{user.email}</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-muted-foreground capitalize">
                      <Shield className="h-3 w-3 shrink-0" />
                      {activeClientRole ? `${activeClientRole} (client)` : (user?.role || "Role")}
                    </span>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => router.push("/admin/settings")}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Account Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => router.push(`/admin/users/edit?userId=${user?.id}`)}
                >
                  <User className="mr-2 h-4 w-4" />
                  Edit Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-destructive focus:text-destructive"
                  onClick={() => logout()}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile Menu: Visible on smaller screens */}
          <div className="md:hidden">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 p-0">
                <SheetHeader className="p-6 pb-0">
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <div className="flex h-full flex-col p-6">
                  <div className="mb-4 flex flex-col gap-6">
                    {/* Mobile Search */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search..." className="pl-8" />
                    </div>

                    {/* Mobile Profile Summary */}
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage
                          src={user?.avatarUrl}
                          alt={user?.firstName}
                        />
                        <AvatarFallback>{userInitials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {user?.firstName || user?.lastName
                            ? `${user?.firstName || ""} ${
                                user?.lastName || ""
                              }`.trim()
                            : user?.email || "User"}
                        </div>
                        <div className="text-sm text-muted-foreground capitalize">
                          {activeClientRole ? `${activeClientRole} (client)` : (user?.role || "Role")}
                        </div>
                      </div>
                    </div>

                    {/* Mobile Client Selector for Employees */}
                    {(isEmployee || user?.role === 'client') && user?.accessibleClients?.length > 1 && (
                      <div className="border-t pt-4">
                        <div className="mb-2 text-sm font-medium">Client</div>
                        <div className="grid gap-2">
                          {user.accessibleClients.map((client) => (
                            <Button
                              key={client.id}
                              variant={
                                client.id === activeClient?.id
                                  ? "default"
                                  : "outline"
                              }
                              className="justify-start"
                              onClick={() => {
                                switchClient(client.id);
                                setIsMobileMenuOpen(false);
                              }}
                            >
                              {client.name}
                              {client.isPrimary && (
                                <Badge variant="outline" className="ml-2">
                                  Primary
                                </Badge>
                              )}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Mobile Profile Actions */}
                    <div className="mt-auto border-t pt-4">
                      <div className="grid gap-2">
                        <Button
                          variant="outline"
                          className="justify-start"
                          onClick={() => {
                            router.push(`/admin/users/edit?userId=${user?.id}`);
                            setIsMobileMenuOpen(false);
                          }}
                        >
                          <User className="mr-2 h-4 w-4" />
                          Edit Profile
                        </Button>
                        <Button
                          variant="outline"
                          className="justify-start text-destructive"
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            logout();
                          }}
                        >
                          <LogOut className="mr-2 h-4 w-4" />
                          Log out
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;
