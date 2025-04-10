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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import supabase from "@/lib/supabase";
import { toast } from "react-hot-toast";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/auth-context";

export default function EditUserPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");

  const { user, isEmployee } = useAuth();
  const [clients, setClients] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editUser, setEditUser] = useState({
    id: "",
    email: "",
    first_name: "",
    last_name: "",
    role: "client",
    client_id: "",
  });

  useEffect(() => {
    const checkUserRole = async () => {
      try {
        if (!user) {
          router.push("/login");
          return;
        }
        if (!isEmployee) {
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
  }, [user, isEmployee, userId, router]);

  const fetchUser = async () => {
    try {
      const { data, error } = await supabase
        .from("wehoware_profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (error) throw error;
      setEditUser({
        id: data.id,
        email: data.email || "", // Typically email will be available via auth data
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        role: data.role || "client",
        client_id: data.client_id || "",
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      toast.error(error.message || "Failed to fetch user details");
      router.push("/admin/users");
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

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditUser((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);

      const profileData = {
        first_name: editUser.first_name,
        last_name: editUser.last_name,
        role: editUser.role,
        client_id: editUser.role === "client" ? editUser.client_id : null,
        updated_at: new Date(),
      };

      const { error } = await supabase
        .from("wehoware_profiles")
        .update(profileData)
        .eq("id", editUser.id);
      if (error) throw error;

      toast.success("User updated successfully");
      router.push("/admin/users");
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error(error.message || "Failed to update user");
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
              <Input
                id="edit-email"
                value={editUser.email}
                disabled
                className="bg-muted"
              />
              <p className="text-sm text-muted-foreground">
                Email cannot be changed
              </p>
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
              <Select
                value={editUser.role}
                onValueChange={(value) =>
                  setEditUser((prev) => ({ ...prev, role: value }))
                }
              >
                <SelectTrigger id="edit-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editUser.role === "client" && (
              <div>
                <Label htmlFor="edit-client_id">
                  Client Association <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={editUser.client_id}
                  onValueChange={(value) =>
                    setEditUser((prev) => ({ ...prev, client_id: value }))
                  }
                >
                  <SelectTrigger id="edit-client_id">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex space-x-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/users")}
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
