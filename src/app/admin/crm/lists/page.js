"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Loader2,
  List as ListIcon,
  Trash2,
  Edit,
  Users,
} from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "react-hot-toast";

const EMPTY_FORM = {
  name: "",
  description: "",
  color: "",
};

export default function ListsPage() {
  const router = useRouter();
  const { activeClient, user, isLoading: authLoading } = useAuth();
  const [lists, setLists] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingList, setEditingList] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [listToDelete, setListToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchLists = useCallback(async () => {
    if (!activeClient) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/crm/lists");
      if (!res.ok) throw new Error("Failed to fetch lists");
      const { data } = await res.json();
      setLists(data || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [activeClient]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/login");
      } else if (activeClient) {
        fetchLists();
      }
    }
  }, [authLoading, user, activeClient, router, fetchLists]);

  const handleCreate = () => {
    setEditingList(null);
    setFormData(EMPTY_FORM);
    setFormOpen(true);
  };

  const handleEdit = (list) => {
    setEditingList(list);
    setFormData({
      name: list.name || "",
      description: list.description || "",
      color: list.color || "",
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error("Name is required");
      return;
    }

    setSaving(true);
    try {
      const url = editingList ? `/api/v1/crm/lists/${editingList.id}` : "/api/v1/crm/lists";
      const method = editingList ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save list");
      }

      toast.success(editingList ? "List updated" : "List created");
      setFormOpen(false);
      setEditingList(null);
      fetchLists();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!listToDelete) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/v1/crm/lists/${listToDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete list");
      toast.success("List deleted");
      setDeleteDialogOpen(false);
      setListToDelete(null);
      fetchLists();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Contact Lists"
        description="Organize contacts into segmented lists"
        actionLabel="New List"
        actionIcon={<Plus className="h-4 w-4" />}
        onAction={handleCreate}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListIcon className="h-5 w-5" />
            Lists ({lists.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : lists.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No lists found. Create one to get started.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {lists.map((list) => (
                <Card key={list.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {list.color && (
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: list.color }}
                          />
                        )}
                        <h3 className="font-medium">{list.name}</h3>
                      </div>
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {list.member_count}
                      </Badge>
                    </div>
                    {list.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {list.description}
                      </p>
                    )}
                    <div className="flex gap-1 mt-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(list)}>
                        <Edit className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setListToDelete(list);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingList ? "Edit List" : "New List"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="VIP Customers"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                rows={2}
                placeholder="High-value customers for targeted campaigns"
              />
            </div>
            <div>
              <Label htmlFor="color">Color (hex)</Label>
              <Input
                id="color"
                name="color"
                value={formData.color}
                onChange={(e) => setFormData((p) => ({ ...p, color: e.target.value }))}
                placeholder="#3b82f6"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingList ? "Save Changes" : "Create List"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete List"
        description={`Are you sure you want to delete "${listToDelete?.name}"? Contacts will remain, only the list grouping will be removed.`}
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
