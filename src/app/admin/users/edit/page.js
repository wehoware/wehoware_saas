"use client";

import { useState, useEffect } from "react";
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

export default function EditUserPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");
  const { user, isAdmin } = useAuth();
  const [clients, setClients] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editUser, setEditUser] = useState({
    id: "",
    email: "", // Email is fetched but typically not editable here
    first_name: "",
    last_name: "",
    role: "client",
    client_ids: [], // This will store IDs from wehoware_user_clients
  });

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
        if (!userId) {
          toast.error("No user ID provided");
          router.push("/admin/users");
          return;
        }
        fetchUser();
        fetchClients();
      } catch (error) {
        console.error("Error checking user role:", error);
        toast.error("Failed to verify your access permissions");
        router.push("/admin");
      }
    };

    checkUserRole();
  }, [user, isAdmin, userId, router]);

  const fetchUser = async () => {
    try {
      const res = await fetch(`/api/v1/users/${userId}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to fetch user");
      const json = await res.json();
      const u = json.user;
      setEditUser({
        id: u.id || "",
        email: u.email || "",
        first_name: u.first_name || "",
        last_name: u.last_name || "",
        role: u.role || "client",
        client_ids: u.client_ids || [],
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      toast.error(error.message || "Failed to fetch user details");
      router.push("/admin/users");
    }
  };

  const fetchClients = async () => {
    try {
      const res = await fetch("/api/v1/clients");
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to fetch clients");
      const json = await res.json();
      setClients(json.clients || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
      toast.error("Failed to fetch client list");
    }
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditUser((prev) => ({ ...prev, [name]: value }));
  };

  const handleClientCheckboxChange = (clientId, checked) => {
    setEditUser((prev) => {
      // Ensure we always have a valid array, even if prev.client_ids is undefined
      const currentClientIds = Array.isArray(prev.client_ids) ? prev.client_ids : [];
      
      if (checked) {
        // Add client ID if checked and not already present
        return { ...prev, client_ids: [...currentClientIds, clientId] };
      } else {
        // Remove client ID if unchecked
        return {
          ...prev,
          client_ids: currentClientIds.filter((id) => id !== clientId),
        };
      }
    });
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/v1/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: editUser.first_name,
          last_name: editUser.last_name,
          role: editUser.role,
          client_ids: editUser.client_ids || [],
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to update user");
      toast.success("User updated successfully");
      router.push("/admin/users");
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error(`Error updating user: ${error.message || "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <AdminPageHeader
        title="Edit User"
        description="Update user details and permissions"
      />
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Edit User</CardTitle>
          <CardDescription>
            Update details for the selected user.
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent>
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" value={editUser.email} disabled />
              <p className="text-sm ">Email cannot be changed</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-first_name">First Name</Label>
                <Input
                  id="edit-first_name"
                  name="first_name"
                  placeholder="John"
                  value={editUser.first_name}
                  onChange={handleEditInputChange}
                />
              </div>
              <div>
                <Label htmlFor="edit-last_name">Last Name</Label>
                <Input
                  id="edit-last_name"
                  name="last_name"
                  placeholder="Doe"
                  value={editUser.last_name}
                  onChange={handleEditInputChange}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-role">User Role</Label>
              <SelectInput
                id="edit-role"
                name="role"
                options={[
                  { value: "admin", label: "Administrator" },
                  { value: "employee", label: "Employee" },
                  { value: "client", label: "Client" },
                ]}
                value={editUser.role}
                onChange={(e) =>
                  setEditUser((prev) => ({ ...prev, role: e.target.value }))
                }
              />
            </div>
            {(editUser.role === "admin" ||
              editUser.role === "employee" ||
              editUser.role === "client") && (
              <div>
                <Label htmlFor="client_associations">
                  Client Associations
                </Label>
                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto border p-2 rounded-md">
                  {clients.length > 0 ? (
                    clients.map((client) => (
                      <div
                        key={client.id}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={`client-${client.id}`}
                          // Ensure editUser.client_ids is checked before calling includes
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
                    <p className="text-sm text-muted-foreground">
                      No active clients found.
                    </p>
                  )}
                </div>
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
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isSubmitting ? "Updating..." : "Update User"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
