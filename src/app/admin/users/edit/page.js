"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import { toast } from "react-hot-toast";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/auth-context";
import { Checkbox } from "@/components/ui/checkbox";
import SelectInput from "@/components/ui/select";

const ADMIN_ROLE_OPTIONS = [
  { value: "admin", label: "Administrator" },
  { value: "employee", label: "Employee" },
  { value: "client", label: "Client" },
];

const ADMIN_CLIENT_ROLE_OPTIONS = [
  { value: "client", label: "Client Owner" },
  { value: "manager", label: "Manager" },
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Viewer" },
];

const MANAGER_CLIENT_ROLE_OPTIONS = [
  { value: "manager", label: "Manager" },
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Viewer" },
];

export default function EditUserPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");
  const { user, isAdmin, isManager, isClientOwner, activeClient } = useAuth();
  const canAccess = isAdmin || isManager || isClientOwner;
  const isManagerOrOwner = isManager || isClientOwner;

  const [clients, setClients] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editUser, setEditUser] = useState({
    id: "",
    email: "",
    first_name: "",
    last_name: "",
    role: "client",
    client_role: "viewer",
    client_ids: [],
  });

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/users/${userId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to fetch user");
      }
      const { user: u } = await res.json();
      setEditUser({
        id: u.id || "",
        email: u.email || "",
        first_name: u.first_name || "",
        last_name: u.last_name || "",
        role: u.role || "client",
        client_role: u.client_role || "viewer",
        client_ids: u.client_ids || [],
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      toast.error(error.message || "Failed to fetch user details");
      router.push("/admin/users");
    }
  }, [userId, router]);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/clients");
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to fetch clients");
      const json = await res.json();
      setClients(json.clients || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
      toast.error("Failed to fetch client list");
    }
  }, []);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (!canAccess) {
      toast.error("Access Denied");
      router.push("/admin");
      return;
    }
    if (!userId) {
      toast.error("No user ID provided");
      router.push("/admin/users");
      return;
    }
    fetchUser();
    if (isAdmin) fetchClients();
  }, [user, canAccess, isAdmin, userId, router, fetchUser, fetchClients]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditUser((prev) => ({ ...prev, [name]: value }));
  };

  const handleClientCheckboxChange = (clientId, checked) => {
    setEditUser((prev) => {
      const current = Array.isArray(prev.client_ids) ? prev.client_ids : [];
      return {
        ...prev,
        client_ids: checked
          ? [...current, clientId]
          : current.filter((id) => id !== clientId),
      };
    });
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);

      const payload = {
        first_name: editUser.first_name,
        last_name: editUser.last_name,
      };

      if (isAdmin) {
        payload.role = editUser.role;
        payload.client_ids = editUser.client_ids || [];
        if (editUser.role === "client") {
          payload.client_role = editUser.client_role;
        }
      } else {
        // Managers and client owners can only change client_role (not system role or client_ids)
        payload.client_role = editUser.client_role;
      }

      const res = await fetch(`/api/v1/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update user");
      }

      toast.success("User updated successfully");
      router.push("/admin/users");
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error(`Error updating user: ${error.message || "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const showClientRoleField = isAdmin
    ? editUser.role === "client"
    : true; // Managers/owners always see client_role (they only edit client users)

  const clientRoleOptions = isAdmin ? ADMIN_CLIENT_ROLE_OPTIONS : MANAGER_CLIENT_ROLE_OPTIONS;

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <AdminPageHeader
        title="Edit User"
        description="Update user details and permissions"
      />
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Edit User</CardTitle>
          <CardDescription>Update details for the selected user.</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent>
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" value={editUser.email} disabled />
              <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-first_name">First Name</Label>
                <Input
                  id="edit-first_name"
                  name="first_name"
                  placeholder="John"
                  value={editUser.first_name}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label htmlFor="edit-last_name">Last Name</Label>
                <Input
                  id="edit-last_name"
                  name="last_name"
                  placeholder="Doe"
                  value={editUser.last_name}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            {isAdmin && (
              <div>
                <Label htmlFor="edit-role">User Role</Label>
                <SelectInput
                  id="edit-role"
                  name="role"
                  options={ADMIN_ROLE_OPTIONS}
                  value={editUser.role}
                  onChange={(e) =>
                    setEditUser((prev) => ({ ...prev, role: e.target.value }))
                  }
                />
              </div>
            )}

            {showClientRoleField && (
              <div>
                <Label htmlFor="edit-client_role">Client Role</Label>
                <SelectInput
                  id="edit-client_role"
                  name="client_role"
                  options={clientRoleOptions}
                  value={editUser.client_role}
                  onChange={(e) =>
                    setEditUser((prev) => ({ ...prev, client_role: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Defines what this user can do within the client account.
                </p>
              </div>
            )}

            {isAdmin && (
              <div>
                <Label htmlFor="client_associations">Client Associations</Label>
                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto border p-2 rounded-md">
                  {clients.length > 0 ? (
                    clients.map((client) => (
                      <div key={client.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`client-${client.id}`}
                          checked={editUser.client_ids?.includes(client.id)}
                          onCheckedChange={(checked) =>
                            handleClientCheckboxChange(client.id, checked)
                          }
                        />
                        <Label
                          htmlFor={`client-${client.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {client.company_name}
                        </Label>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No active clients found.</p>
                  )}
                </div>
              </div>
            )}

            {isManagerOrOwner && !isAdmin && activeClient && (
              <div className="p-3 rounded-md bg-muted/50 text-sm text-muted-foreground">
                Client: <strong>{activeClient.companyName || activeClient.name || "your organization"}</strong>
              </div>
            )}

            <div className="flex space-x-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/admin/users")}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? "Updating..." : "Update User"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
