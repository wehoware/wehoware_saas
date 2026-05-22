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
import { Loader2, Eye, EyeOff } from "lucide-react";
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

const MANAGER_ROLE_OPTIONS = [
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

export default function AddUserPage() {
  const router = useRouter();
  const { user, isAdmin, isManager, activeClient } = useAuth();
  const canAccess = isAdmin || isManager;

  const [clients, setClients] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    role: "client",
    client_role: "viewer",
    client_ids: [],
  });

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
    // Managers: pre-set role and client
    if (isManager && !isAdmin) {
      setNewUser((prev) => ({
        ...prev,
        role: "client",
        client_role: "viewer",
        client_ids: activeClient?.id ? [activeClient.id] : [],
      }));
    } else {
      fetchClients();
    }
  }, [user, canAccess, isManager, isAdmin, activeClient?.id, router]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewUser((prev) => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (e) => {
    const role = e.target.value;
    setNewUser((prev) => ({
      ...prev,
      role,
      // Reset client_role and client_ids when switching away from client role
      client_role: role === "client" ? (prev.client_role || "viewer") : prev.client_role,
      client_ids: role === "client" ? prev.client_ids : [],
    }));
  };

  const handleClientCheckboxChange = (clientId, checked) => {
    setNewUser((prev) => {
      const current = prev.client_ids || [];
      return {
        ...prev,
        client_ids: checked
          ? [...current, clientId]
          : current.filter((id) => id !== clientId),
      };
    });
  };

  const handleAddUser = async (e) => {
    e.preventDefault();

    if (!newUser.email || !newUser.password) {
      toast.error("Email and password are required");
      return;
    }
    if (newUser.role === "client" && isAdmin && (!newUser.client_ids || newUser.client_ids.length === 0)) {
      toast.error("At least one client must be selected for client role");
      return;
    }
    if (newUser.role === "client" && !newUser.client_role) {
      toast.error("Client role is required");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `API Error: ${response.statusText}`);
      }

      toast.success(result.message || "User added successfully!");
      router.push("/admin/users");
    } catch (error) {
      console.error("Error adding user:", error);
      toast.error(`Error adding user: ${error.message || "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleOptions = isAdmin ? ADMIN_ROLE_OPTIONS : MANAGER_ROLE_OPTIONS;
  const clientRoleOptions = isAdmin ? ADMIN_CLIENT_ROLE_OPTIONS : MANAGER_CLIENT_ROLE_OPTIONS;
  const showClientRoleField = newUser.role === "client";
  const showClientSelection = isAdmin && newUser.role === "client";

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <AdminPageHeader
        title="Add New User"
        description={
          isManager && !isAdmin
            ? "Create a new team member for your organization"
            : "Create a new user account and set their permissions"
        }
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
                options={roleOptions}
                value={newUser.role}
                onChange={handleRoleChange}
                disabled={isManager && !isAdmin}
              />
              {isManager && !isAdmin && (
                <p className="text-xs text-muted-foreground mt-1">
                  Team members are always created as Client users.
                </p>
              )}
            </div>

            {showClientRoleField && (
              <div className="my-4">
                <Label htmlFor="client_role">
                  Client Role <span className="text-destructive">*</span>
                </Label>
                <SelectInput
                  id="client_role"
                  name="client_role"
                  options={clientRoleOptions}
                  value={newUser.client_role}
                  onChange={(e) =>
                    setNewUser((prev) => ({ ...prev, client_role: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Defines what this user can do within the client account.
                </p>
              </div>
            )}

            {showClientSelection && (
              <div className="my-4">
                <Label htmlFor="client_id">
                  Client Associations <span className="text-destructive">*</span>
                </Label>
                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto border p-2 rounded-md">
                  {clients.length > 0 ? (
                    clients.map((client) => (
                      <div key={client.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`client-${client.id}`}
                          checked={newUser.client_ids?.includes(client.id)}
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
                {newUser.client_ids?.length === 0 && (
                  <p className="text-xs text-destructive mt-1">
                    At least one client must be selected.
                  </p>
                )}
              </div>
            )}

            {isManager && !isAdmin && activeClient && (
              <div className="my-4 p-3 rounded-md bg-muted/50 text-sm text-muted-foreground">
                This user will be added to: <strong>{activeClient.companyName || activeClient.name || "your organization"}</strong>
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
                {isSubmitting ? "Adding..." : "Add User"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
