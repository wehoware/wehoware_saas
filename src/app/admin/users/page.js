"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Users,
  ArrowUpDown,
  Loader2,
  UserCog,
  Mail,
  Building2,
  ShieldCheck,
} from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import { toast } from "react-hot-toast";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/auth-context";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import SelectInput from "@/components/ui/select";

const ROLE_BADGE_VARIANT = {
  admin: "destructive",
  employee: "default",
  manager: "default",
  editor: "secondary",
  viewer: "outline",
  client: "outline",
};

function getRoleBadgeVariant(systemRole, clientRole) {
  if (systemRole === "admin") return "destructive";
  if (systemRole === "employee") return "default";
  if (clientRole) return ROLE_BADGE_VARIANT[clientRole] ?? "outline";
  return "outline";
}

function getRoleDisplayLabel(systemRole, clientRole) {
  if (systemRole === "admin") return "Admin";
  if (systemRole === "employee") return "Employee";
  if (clientRole) return clientRole.charAt(0).toUpperCase() + clientRole.slice(1);
  return systemRole;
}

export default function UsersPage() {
  const router = useRouter();
  const { user, isAdmin, isEmployee, isManager, activeClient } = useAuth();
  const canAccess = isAdmin || isEmployee || isManager;
  const canCreate = isAdmin || isManager;

  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (!canAccess) {
      router.push("/admin");
    }
  }, [user, canAccess, router]);

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/v1/users");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `API Error: ${response.statusText}`);
      }

      const sorted = [...data.users].sort((a, b) => {
        const fieldA = a[sortField];
        const fieldB = b[sortField];
        if (fieldA < fieldB) return sortOrder === "asc" ? -1 : 1;
        if (fieldA > fieldB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });

      setUsers(sorted);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error(error.message || "Failed to fetch users");
    } finally {
      setIsLoading(false);
    }
  }, [sortField, sortOrder]);

  useEffect(() => {
    if (!user || !canAccess) return;
    fetchUsers();
  }, [user, canAccess, activeClient?.id, fetchUsers]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    fetchUsers();
  };

  const openDeleteDialog = (targetUser) => {
    setUserToDelete(targetUser);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    try {
      setDeleteLoading(true);
      const response = await fetch(`/api/v1/users/${userToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData?.error || `Failed to delete user (${response.status})`);
      }

      toast.success(`User "${userToDelete.email}" deleted successfully`);
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error(error.message || "Failed to delete user");
    } finally {
      setDeleteLoading(false);
    }
  };

  const roleFilterOptions = isAdmin
    ? [
        { value: "all", label: "All Roles" },
        { value: "admin", label: "Administrators" },
        { value: "employee", label: "Employees" },
        { value: "client", label: "Clients" },
      ]
    : [
        { value: "all", label: "All Roles" },
        { value: "manager", label: "Managers" },
        { value: "editor", label: "Editors" },
        { value: "viewer", label: "Viewers" },
      ];

  const filteredUsers = users.filter((u) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      u.first_name?.toLowerCase().includes(searchLower) ||
      u.last_name?.toLowerCase().includes(searchLower) ||
      u.email?.toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;
    if (roleFilter === "all") return true;

    // Admins filter by system role; managers filter by client_role
    if (isAdmin) return u.role === roleFilter;
    return u.client_role === roleFilter;
  });

  if (!user || !canAccess) {
    return (
      <div className="w-full h-[60vh] flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pageTitle = isAdmin ? "User Management" : "Team Members";
  const pageDescription = isAdmin
    ? "Manage all user accounts and permissions"
    : "Manage your team members and their access levels";

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <AdminPageHeader
        title={pageTitle}
        description={pageDescription}
        icon={<Users className="h-6 w-6 mr-2" />}
        {...(canCreate && {
          actionLabel: "Add User",
          actionIcon: <Plus size={16} />,
          onAction: () => router.push("/admin/users/add"),
        })}
      />

      <div className="mt-8">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div className="space-y-1">
              <CardTitle className="text-base font-medium">
                {isAdmin ? "All Users" : "Team Members"} ({users.length})
              </CardTitle>
              <CardDescription>Browse and manage user accounts.</CardDescription>
            </div>
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>

          <Separator />

          <CardContent>
            <div className="mt-4 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <SelectInput
                    id="role-filter"
                    name="role_filter"
                    options={roleFilterOptions}
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                  />
                </div>
              </div>

              {isLoading ? (
                <div className="py-20 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Loading users...</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead className="[&_tr]:border-b">
                        <tr className="border-b transition-colors hover:bg-muted/50">
                          <th
                            className="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer"
                            onClick={() => handleSort("first_name")}
                          >
                            Name <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                          </th>
                          <th
                            className="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer"
                            onClick={() => handleSort("email")}
                          >
                            Email <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                          </th>
                          <th
                            className="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer"
                            onClick={() => handleSort("role")}
                          >
                            Role <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                          </th>
                          {isAdmin && (
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                              Client
                            </th>
                          )}
                          <th
                            className="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer"
                            onClick={() => handleSort("created_at")}
                          >
                            Created <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                          </th>
                          {canCreate && (
                            <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                              Actions
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((u) => (
                          <tr key={u.id} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-4">
                              <div className="flex items-center space-x-2">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <UserCog className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                  {u.first_name} {u.last_name}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center">
                                <Mail className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                                {u.email}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <Badge
                                variant={getRoleBadgeVariant(u.role, u.client_role)}
                                className="capitalize"
                              >
                                {u.role === "admin" && (
                                  <ShieldCheck className="h-3 w-3 mr-1" />
                                )}
                                {getRoleDisplayLabel(u.role, u.client_role)}
                              </Badge>
                            </td>
                            {isAdmin && (
                              <td className="py-3 px-4">
                                {u.client_id ? (
                                  <div className="flex items-center">
                                    <Building2 className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                                    {u.wehoware_user_clients?.[0]?.client_id
                                      ? u.client_id
                                      : "—"}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                            )}
                            <td className="py-3 px-4 text-muted-foreground">
                              {new Date(u.created_at).toLocaleDateString()}
                            </td>
                            {canCreate && (
                              <td className="py-3 px-4 text-right">
                                <div className="flex justify-end space-x-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      router.push(`/admin/users/edit?userId=${u.id}`)
                                    }
                                  >
                                    <Edit className="h-3.5 w-3.5 mr-1" />
                                    Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openDeleteDialog(u)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                                    Delete
                                  </Button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {filteredUsers.length === 0 && (
                    <div className="text-center py-10">
                      <Users className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium">No users found</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Try changing your search or filter criteria
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Are you sure?"
        message={`This will permanently delete the user "${userToDelete?.email}" and all associated data. This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        isLoading={deleteLoading}
        loadingLabel="Deleting..."
        variant="destructive"
      />
    </div>
  );
}
