"use client";

import * as React from "react";
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Search,
  Settings,
  User,
} from "lucide-react";
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
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";

const AdminHeader = ({ className }) => {
  const { user, activeClient, switchClient, logout, isEmployee } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const router = useRouter();

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (!user) return "U";
    const firstName = user.firstName || "";
    const lastName = user.lastName || "";
    return (
      `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() ||
      user.email.charAt(0).toUpperCase()
    );
  };

  return (
    <header
      className={`w-full border-b border-border bg-background ${className}`}
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between py-2">
          {/* Logo */}
          <div className="flex items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." className="pl-8" />
            </div>

            {/* Client Dropdown - Only visible to employees */}
            {isEmployee && user?.accessibleClients?.length > 0 && (
              <div className="hidden md:block">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <span className="max-w-[150px] truncate">
                        {activeClient?.name || "Select Client"}
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
          </div>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-4 md:flex">
            <span className="text-xs text-muted-foreground capitalize">
              {user?.role || "Role"}
            </span>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                3
              </span>
            </Button>

            {/* User dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.avatarUrl} alt={user?.firstName} />
                    <AvatarFallback>{getUserInitials()}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start text-sm">
                    <span className="font-medium">
                      {(user?.firstName && user.firstName.toUpperCase()) ||
                        (user?.lastName && user.lastName.toUpperCase()) ||
                        (user?.email && user.email.toUpperCase()) ||
                        "User"}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/admin/profile")}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push("/admin/settings")}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile menu */}
          <div className="md:hidden">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <div className="flex h-full flex-col">
                  <div className="mb-4 flex flex-col gap-6">
                    {/* Mobile search */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search..." className="pl-8" />
                    </div>

                    {/* Mobile profile summary */}
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage
                          src={user?.avatarUrl}
                          alt={user?.firstName}
                        />
                        <AvatarFallback>{getUserInitials()}</AvatarFallback>
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
                          {user?.role || "Role"}
                        </div>
                      </div>
                    </div>

                    {/* Mobile client selector (for employees) */}
                    {isEmployee && user?.accessibleClients?.length > 0 && (
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
                  </div>

                  <div className="mt-auto border-t pt-4">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        router.push("/admin/profile");
                        setIsMobileMenuOpen(false);
                      }}
                    >
                      <User className="mr-2 h-4 w-4" />
                      My Profile
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start mt-2"
                      onClick={() => {
                        router.push("/admin/settings");
                        setIsMobileMenuOpen(false);
                      }}
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start mt-2 text-destructive"
                      onClick={logout}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Log Out
                    </Button>
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
