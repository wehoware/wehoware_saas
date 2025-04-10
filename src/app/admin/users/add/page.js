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
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import supabase from "@/lib/supabase";
import { toast } from "react-hot-toast";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/auth-context";

export default function AddUserPage() {
  const router = useRouter();
  const { user, isEmployee } = useAuth();
  const [clients, setClients] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New user form state
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
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
        fetchClients();
      } catch (error) {
        console.error("Error checking user role:", error);
        toast.error("Failed to verify your access permissions");
        router.push("/admin");
      }
    };

    checkUserRole();
  }, [user, isEmployee, router]);

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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewUser((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddUser = async (e) => {
    e.preventDefault();

    if (!newUser.email || !newUser.password) {
      toast.error("Validation Error: Email and password are required");
      return;
    }

    try {
      setIsSubmitting(true);
      // 1. Create auth user
      const { data: authData, error: authError } =
        await supabase.auth.admin.createUser({
          email: newUser.email,
          password: newUser.password,
          email_confirm: true,
        });
      if (authError) throw authError;

      // 2. Get the new user ID
      const userId = authData.user.id;

      // 3. Create profile
      const profileData = {
        id: userId,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        role: newUser.role,
        client_id: newUser.role === "client" ? newUser.client_id : null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const { error: profileError } = await supabase
        .from("wehoware_profiles")
        .insert(profileData);

      if (profileError) {
        // If profile creation fails, delete the auth user to avoid orphaned users
        await supabase.auth.admin.deleteUser(userId);
        throw profileError;
      }

      toast.success("User added successfully");
      router.push("/users");
    } catch (error) {
      console.error("Error adding user:", error);
      toast.error(error.message || "Failed to add user");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <AdminPageHeader
        title="Add New User"
        description="Create a new user account and set their permissions"
      />
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Add New User</CardTitle>
          <CardDescription>
            Fill out the form below to create a new user account.
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent>
          <form onSubmit={handleAddUser} className="space-y-4">
            <div>
              <Label htmlFor="email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="user@example.com"
                value={newUser.email}
                onChange={handleInputChange}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">
                Password <span className="text-destructive">*</span>
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={newUser.password}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  name="first_name"
                  placeholder="John"
                  value={newUser.first_name}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  name="last_name"
                  placeholder="Doe"
                  value={newUser.last_name}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="my-4">
              <Label htmlFor="role">
                User Role <span className="text-destructive">*</span>
              </Label>
              <select
                value={newUser.role}
                onValueChange={(value) =>
                  setNewUser((prev) => ({ ...prev, role: value }))
                }
              >
                <option value="admin">administrators</option>
                <option value="employee">employees</option>
                <option value="client">clients</option>
              </select>
            </div>
            {newUser.role === "client" && (
              <div className="my-4">
                <Label htmlFor="client_id">
                  Client Association <span className="text-destructive">*</span>
                </Label>
                <select
                  value={newUser.client_id}
                  onValueChange={(value) =>
                    setNewUser((prev) => ({ ...prev, client_id: value }))
                  }
                >
                  <option value="">select client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.company_name}
                    </option>
                  ))}
                </select>
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
                {isSubmitting ? "Adding..." : "Add User"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
