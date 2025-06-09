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
import { Loader2, Lock, Eye, EyeOff } from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import supabase from "@/lib/supabase";
import { toast } from "react-hot-toast";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/auth-context";
import { Checkbox } from "@/components/ui/checkbox";
import SelectInput from "@/components/ui/select";

export default function AddUserPage() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [clients, setClients] = useState([]);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New user form state
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    role: "client",
    client_ids: [],
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
        fetchClients();
      } catch (error) {
        console.error("Error checking user role:", error);
        toast.error("Failed to verify your access permissions");
        router.push("/admin");
      }
    };

    checkUserRole();
  }, [user, isAdmin, router]);

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

  const handleClientCheckboxChange = (clientId, checked) => {
    setNewUser((prev) => {
      const currentClientIds = prev.client_ids || [];
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

  const handleAddUser = async (e) => {
    e.preventDefault();

    if (!newUser.email || !newUser.password) {
      toast.error("Email and password are required to create a user.");
      return;
    }

    if (!isAdmin) {
      toast.error("Access Denied: Only employees can add new users");
      return;
    }

    if (
      newUser.role === "client" &&
      (!newUser.client_ids || newUser.client_ids.length === 0)
    ) {
      toast.error(
        "Validation Error: At least one client must be selected for client role"
      );
      return;
    }

    if (
      newUser.role === "employee" &&
      newUser.client_ids &&
      newUser.client_ids.length > 0
    ) {
      toast.error(
        "Validation Error: Employees should not have client associations set during creation."
      );
      return;
    }

    try {
      setIsSubmitting(true);
      // Call the backend API route to handle user creation securely
      const response = await fetch("/api/v1/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newUser),
      });

      const result = await response.json();

      if (!response.ok) {
        // Use the error message from the API response if available
        throw new Error(result.error || `API Error: ${response.statusText}`);
      }

      // If successful
      toast.success(result.message || "User added successfully!");
      router.push("/admin/users");
    } catch (error) {
      console.error("Error adding user:", error);
      toast.error(`Error adding user: ${error.message || "Unknown error"}`);
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
            <div className="relative">
              <Label htmlFor="password">
                Password <span className="text-destructive">*</span>
              </Label>
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={newUser.password}
                onChange={handleInputChange}
                required
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pt-5 pr-3 flex items-center"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                ) : (
                  <Eye className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                )}
              </button>
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
              <SelectInput
                id="role"
                name="role"
                options={[
                  { value: "admin", label: "Administrator" },
                  { value: "employee", label: "Employee" },
                  { value: "client", label: "Client" },
                ]}
                value={newUser.role}
                onChange={(e) =>
                  setNewUser((prev) => ({ ...prev, role: e.target.value }))
                }
              />
            </div>
            {newUser.role === "client" && (
              <div className="my-4">
                <Label htmlFor="client_id">
                  Client Associations{" "}
                  <span className="text-destructive">*</span>
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
                          checked={newUser.client_ids?.includes(client.id)} // Added safe navigation
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
                {newUser.role === "client" &&
                  newUser.client_ids?.length === 0 && (
                    <p className="text-xs text-destructive mt-1">
                      At least one client must be selected for client role.
                    </p>
                  )}
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
                {isSubmitting ? "Adding..." : "Add User"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
