"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "react-hot-toast";
import { useAuth } from "@/contexts/auth-context";
import AdminPageHeader from "@/components/AdminPageHeader";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import SelectInput from "@/components/ui/select";
import {
  Loader2,
  Plus,
  Trash2,
  Users,
  Mail,
  ShieldCheck,
  UserCog,
} from "lucide-react";

export default function TeamPage() {
  const router = useRouter();
  const { user, isAdmin, isEmployee, isClientOwner, activeClient, canInvite, canManageUsers } = useAuth();

  const [team, setTeam] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (!isAdmin && !isEmployee && !isClientOwner && !canManageUsers) {
      toast.error("Access Denied");
      router.push("/admin");
    }
  }, [user, isAdmin, isEmployee, isClientOwner, canManageUsers, router]);

  useEffect(() => {
    if (!activeClient?.id) return;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/v1/team");
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to fetch team");
        const data = await res.json();
        if (!cancelled) setTeam(data.team || []);
      } catch (error) {
        if (!cancelled) {
          console.error("Error fetching team:", error);
          toast.error(error.message || "Failed to fetch team");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeClient?.id]);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) {
      toast.error("Please enter a valid email.");
      return;
    }

    setInviteSubmitting(true);
    try {
      const res = await fetch("/api/v1/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          client_id: activeClient.id,
          role: inviteRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send invitation");
      }
      toast.success(data.message || "Invitation sent!");
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("viewer");
    } catch (error) {
      console.error("Invite error:", error);
      toast.error(error.message || "Failed to send invitation");
    } finally {
      setInviteSubmitting(false);
    }
  };

  const openDeleteDialog = (member) => {
    setMemberToDelete(member);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!memberToDelete) return;
    try {
      setDeleteLoading(true);
      const res = await fetch(`/api/v1/team?user_id=${encodeURIComponent(memberToDelete.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to remove member");
      toast.success("Team member removed");
      setTeam((prev) => prev.filter((m) => m.id !== memberToDelete.id));
      setDeleteDialogOpen(false);
      setMemberToDelete(null);
    } catch (error) {
      console.error("Remove error:", error);
      toast.error(error.message || "Failed to remove member");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleRoleChange = async (memberId, newRole) => {
    try {
      const res = await fetch("/api/v1/team", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: memberId, role: newRole }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to update role");
      toast.success("Role updated");
      setTeam((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, client_role: newRole } : m))
      );
    } catch (error) {
      console.error("Role update error:", error);
      toast.error(error.message || "Failed to update role");
    }
  };

  const filteredTeam = team.filter((m) => {
    const term = searchTerm.toLowerCase();
    return (
      m.first_name?.toLowerCase().includes(term) ||
      m.last_name?.toLowerCase().includes(term) ||
      m.email?.toLowerCase().includes(term) ||
      m.client_role?.toLowerCase().includes(term)
    );
  });

  const roleBadgeVariant = (role) => {
    switch (role) {
      case "client": return "destructive";
      case "manager": return "default";
      case "editor": return "secondary";
      case "viewer": return "outline";
      default: return "outline";
    }
  };

  if (!canManageUsers) {
    return (
      <div className="w-full h-[60vh] flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <AdminPageHeader
        title="Team Management"
        description={`Manage team members for ${activeClient?.name || "your client"}`}
        icon={<Users className="h-6 w-6 mr-2" />}
        actionLabel={canInvite ? "Invite Member" : undefined}
        actionIcon={canInvite ? <Plus size={16} /> : undefined}
        onAction={canInvite ? () => setInviteOpen(true) : undefined}
      />

      <div className="mt-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div className="space-y-1">
              <CardTitle className="text-base font-medium">
                Team Members ({team.length})
              </CardTitle>
              <CardDescription>Browse and manage team members.</CardDescription>
            </div>
            <div className="relative max-w-sm">
              <Input
                placeholder="Search team..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <Separator />
          <CardContent>
            {isLoading ? (
              <div className="py-20 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Loading team...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="[&_tr]:border-b">
                    <tr className="border-b transition-colors hover:bg-muted/50">
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Name</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Email</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Role</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Added</th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTeam.map((member) => (
                      <tr key={member.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <UserCog className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              {member.first_name} {member.last_name}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center">
                            <Mail className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                            {member.email}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {canManageUsers && member.client_role !== "client" ? (
                            <SelectInput
                              id={`role-${member.id}`}
                              name={`role_${member.id}`}
                              options={[
                                { value: "manager", label: "Manager" },
                                { value: "editor", label: "Editor" },
                                { value: "viewer", label: "Viewer" },
                              ]}
                              value={member.client_role}
                              onChange={(e) => handleRoleChange(member.id, e.target.value)}
                              className="w-32"
                            />
                          ) : (
                            <Badge variant={roleBadgeVariant(member.client_role)} className="capitalize">
                              {member.client_role === "client" && <ShieldCheck className="h-3 w-3 mr-1" />}
                              {member.client_role}
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {new Date(member.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {member.client_role !== "client" && canManageUsers && (
                            <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(member)}>
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              Remove
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredTeam.length === 0 && (
                      <tr>
                        <td colSpan="5" className="p-4 text-center h-24">
                          <div className="flex flex-col items-center justify-center">
                            <Users className="h-8 w-8 text-muted-foreground mb-2" />
                            <p className="text-sm font-medium">No team members found.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invite Dialog */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Invite Team Member</CardTitle>
              <CardDescription>Send an invitation to join your team.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <Label htmlFor="invite-email">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@example.com"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="invite-role">Role</Label>
                  <SelectInput
                    id="invite-role"
                    name="invite_role"
                    options={[
                      { value: "manager", label: "Manager" },
                      { value: "editor", label: "Editor" },
                      { value: "viewer", label: "Viewer" },
                    ]}
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                  />
                </div>
                <div className="flex space-x-4 pt-2">
                  <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)} disabled={inviteSubmitting}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={inviteSubmitting}>
                    {inviteSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {inviteSubmitting ? "Sending..." : "Send Invite"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Remove Team Member?"
        message={`This will remove "${memberToDelete?.email}" from the team. Their account will remain but they will lose access to this client.`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        isLoading={deleteLoading}
        loadingLabel="Removing..."
        variant="destructive"
      />
    </div>
  );
}
