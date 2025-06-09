"use client";

import { useState, useEffect } from "react";
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
import supabase from "@/lib/supabase";
import { toast } from "react-hot-toast";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/auth-context";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import SelectInput from "@/components/ui/select";

export default function UsersPage() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  useEffect(() => {
    const checkUserRole = async () => {
      try {
        if (!user) {
          router.push("/login");
          return;
        }
        if (!isAdmin) {
          toast.error("Access Denied: Only employees can access this page");
          router.push("/admin");
          return;
        }
        fetchUsers();
        fetchClients();
      } catch (error) {
        console.error("Error checking user role:", error);
        toast.error("Failed to verify your access permissions");
        router.push("/admin");
      }
    };

    checkUserRole();
  }, [user, isAdmin, router]);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      // Fetch users from the secure API endpoint
      const response = await fetch("/api/v1/users");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `API Error: ${response.statusText}`);
      }

      // Apply client-side sorting (API doesn't handle sorting yet)
      const sortedUsers = [...data.users].sort((a, b) => {
        const fieldA = a[sortField];
        const fieldB = b[sortField];

        if (fieldA < fieldB) {
          return sortOrder === "asc" ? -1 : 1;
        }
        if (fieldA > fieldB) {
          return sortOrder === "asc" ? 1 : -1;
        }
        return 0;
      });

      setUsers(sortedUsers || []);
    } catch (error) {
      console.error("Error fetching users via API:", error);
      toast.error(error.message || "Failed to fetch users");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from("wehoware_clients")
        .select("id, company_name")
        .eq("active", true)
        .order("company_name");
      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
      toast.error("Failed to fetch client list");
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    fetchUsers();
  };

  const openDeleteDialog = (user) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    try {
      setDeleteLoading(true);
      // Call the server-side API endpoint to delete the user
      const response = await fetch(`/api/v1/users/${userToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        // Attempt to parse error message from API response body
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          // If no JSON body, use status text
          errorData = { error: response.statusText };
        }
        throw new Error(
          errorData?.error ||
            `Failed to delete user (Status: ${response.status})`
        );
      }

      // If deletion was successful (e.g., 204 No Content or 200 OK)
      toast.success(`User "${userToDelete.email}" deleted successfully`);
      setUsers(users.filter((u) => u.id !== userToDelete.id)); // Update UI state
      setDeleteDialogOpen(false); // Close the dialog
      setUserToDelete(null); // Reset user to delete
    } catch (error) {
      console.error("Error deleting user via API:", error);
      toast.error(error.message || "Failed to delete user");
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    const searchTermLower = searchTerm.toLowerCase();
    const matchesSearch =
      user.first_name?.toLowerCase().includes(searchTermLower) ||
      user.last_name?.toLowerCase().includes(searchTermLower) ||
      user.email?.toLowerCase().includes(searchTermLower);
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (!isAdmin) {
    return (
      <div className="w-full h-[60vh] flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <AdminPageHeader
        title="User Management"
        description="Manage all user accounts and permissions"
        icon={<Users className="h-6 w-6 mr-2" />}
        actionLabel="Add User"
        actionIcon={<Plus size={16} />}
        onAction={() => router.push("/admin/users/add")}
      />

      <div className="mt-8">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div className="space-y-1">
              <CardTitle className="text-base font-medium">
                All Users ({users.length})
              </CardTitle>
              <CardDescription>
                Browse and manage user accounts.
              </CardDescription>
            </div>
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search users..."
                value={searchTerm}
                onChange={handleSearch}
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
                    options={[
                      { value: "all", label: "All Roles" },
                      { value: "admin", label: "Administrators" },
                      { value: "employee", label: "Employees" },
                      { value: "client", label: "Clients" },
                    ]}
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                  />
                </div>
              </div>

              {/* User List */}
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
                        <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                          <th
                            className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 cursor-pointer"
                            onClick={() => handleSort("first_name")}
                          >
                            Name <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                          </th>
                          <th
                            className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 cursor-pointer"
                            onClick={() => handleSort("email")}
                          >
                            Email <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                          </th>
                          <th
                            className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 cursor-pointer"
                            onClick={() => handleSort("role")}
                          >
                            Role <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                          </th>
                          <th
                            className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 cursor-pointer"
                          >
                            Client
                          </th>
                          <th
                            className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 cursor-pointer"
                            onClick={() => handleSort("created_at")}
                          >
                            Created <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                          </th>
                          <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((user) => {
                          // Find client details if available
                          const client = clients.find(
                            (c) => c.id === user.client_id
                          );
                          return (
                            <tr
                              key={user.id}
                              className="border-b hover:bg-muted/50"
                            >
                              <td className="py-3 px-4">
                                <div className="flex items-center space-x-2">
                                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                    <UserCog className="h-4 w-4 text-primary" />
                                  </div>
                                  <div>
                                    {user.first_name} {user.last_name}
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center">
                                  <Mail className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                                  {user.email}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <Badge
                                  variant={
                                    user.role === "admin"
                                      ? "destructive"
                                      : user.role === "employee"
                                      ? "default"
                                      : "outline"
                                  }
                                  className="capitalize"
                                >
                                  {user.role === "admin" && (
                                    <ShieldCheck className="h-3 w-3 mr-1" />
                                  )}
                                  {user.role}
                                </Badge>
                              </td>
                              <td className="py-3 px-4">
                                {user.client_id ? (
                                  <div className="flex items-center">
                                    <Building2 className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                                    {client?.company_name || "Unknown"}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">
                                    —
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-muted-foreground">
                                {new Date(user.created_at).toLocaleDateString()}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex justify-end space-x-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      router.push(
                                        `/admin/users/edit?userId=${user.id}`
                                      )
                                    }
                                  >
                                    <Edit className="h-3.5 w-3.5 mr-1" />
                                    Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openDeleteDialog(user)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                                    Delete
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
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
