"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { Plus, Edit, Trash, Clock, Globe, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import ConfirmDialog from "@/components/ui/confirm-dialog";

/** Map API snake_case shape → component display shape */
function mapType(a) {
  return {
    id: a.id,
    name: a.name ?? "",
    description: a.description ?? "",
    duration: Number(a.duration) || 30,
    color: a.color ?? "#4f46e5",
    link: a.slug ?? "",
    active: a.active ?? true,
    requiresConfirmation: a.requires_confirmation ?? false,
    price: a.price != null ? Number(a.price) : null,
    currency: a.currency ?? "USD",
  };
}

const BLANK_TYPE = {
  name: "",
  description: "",
  duration: 30,
  color: "#4f46e5",
  link: "",
  active: true,
  requiresConfirmation: false,
  price: null,
};

export function AppointmentTypes() {
  const [appointmentTypes, setAppointmentTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentType, setCurrentType] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState(null);

  useEffect(() => {
    fetchTypes();
  }, []);

  async function fetchTypes() {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/appointment-types");
      if (!res.ok) throw new Error("Failed to load appointment types");
      const json = await res.json();
      setAppointmentTypes((json.data || []).map(mapType));
    } catch (err) {
      console.error("Error fetching appointment types:", err);
      toast.error("Failed to load appointment types");
    } finally {
      setLoading(false);
    }
  }

  const handleCreateNew = () => {
    setCurrentType({ ...BLANK_TYPE });
    setIsCreating(true);
    setIsEditing(false);
  };

  const handleEdit = (type) => {
    setCurrentType({ ...type });
    setIsEditing(true);
    setIsCreating(false);
  };

  const handleDelete = (type) => {
    setTypeToDelete(type);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!typeToDelete) return;
    try {
      setDeleteLoading(true);
      const res = await fetch(`/api/v1/appointment-types/${typeToDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete appointment type");
      setAppointmentTypes((prev) => prev.filter((t) => t.id !== typeToDelete.id));
      toast.success("Appointment type deleted");
    } catch (err) {
      toast.error(err.message || "Failed to delete appointment type");
    } finally {
      setDeleteLoading(false);
      setDeleteDialogOpen(false);
      setTypeToDelete(null);
    }
  };

  const handleSave = async () => {
    if (!currentType?.name?.trim()) {
      toast.error("Name is required");
      return;
    }
    const payload = {
      name: currentType.name.trim(),
      description: currentType.description?.trim() ?? "",
      duration: Number(currentType.duration) || 30,
      color: currentType.color,
      slug: currentType.link?.trim() ?? "",
      active: currentType.active,
      requires_confirmation: currentType.requiresConfirmation,
      price: currentType.price != null && currentType.price !== "" ? Number(currentType.price) : null,
    };

    try {
      setSaving(true);
      let res;
      if (isCreating) {
        res = await fetch("/api/v1/appointment-types", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/v1/appointment-types/${currentType.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to save appointment type");
      }
      const json = await res.json();
      const saved = mapType(json.data ?? json);
      if (isCreating) {
        setAppointmentTypes((prev) => [...prev, saved]);
        toast.success("Appointment type created");
      } else {
        setAppointmentTypes((prev) =>
          prev.map((t) => (t.id === saved.id ? saved : t))
        );
        toast.success("Appointment type updated");
      }
      setIsCreating(false);
      setIsEditing(false);
      setCurrentType(null);
    } catch (err) {
      toast.error(err.message || "Failed to save appointment type");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setIsEditing(false);
    setCurrentType(null);
  };

  const handleToggleActive = async (type) => {
    const newActive = !type.active;
    // Optimistic update
    setAppointmentTypes((prev) =>
      prev.map((t) => (t.id === type.id ? { ...t, active: newActive } : t))
    );
    try {
      const res = await fetch(`/api/v1/appointment-types/${type.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: newActive }),
      });
      if (!res.ok) throw new Error("Failed to update status");
    } catch (err) {
      // Revert on failure
      setAppointmentTypes((prev) =>
        prev.map((t) => (t.id === type.id ? { ...t, active: !newActive } : t))
      );
      toast.error("Failed to update appointment type status");
    }
  };

  const handleCopyLink = (link) => {
    if (!link) {
      toast.error("No booking link available");
      return;
    }
    navigator.clipboard
      .writeText(`${window.location.origin}/book/${link}`)
      .then(() => toast.success("Link copied to clipboard!"))
      .catch(() => toast.error("Failed to copy link"));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Appointment Types</h2>
        <Button onClick={handleCreateNew}>
          <Plus className="mr-2 h-4 w-4" /> New Appointment Type
        </Button>
      </div>

      {appointmentTypes.length === 0 ? (
        <Card className="p-8 flex flex-col items-center justify-center text-center">
          <Clock className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold mb-2">No appointment types yet</h3>
          <p className="text-gray-500 mb-4">
            Create your first appointment type to start accepting bookings.
          </p>
          <Button onClick={handleCreateNew}>
            <Plus className="mr-2 h-4 w-4" /> Create Appointment Type
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {appointmentTypes.map((type) => (
            <Card key={type.id} className="p-4 flex flex-col h-full">
              <div className="flex items-start justify-between">
                <div
                  className="w-4 h-4 rounded-full mt-1 flex-shrink-0"
                  style={{ backgroundColor: type.color }}
                />
                <div className="ml-2 flex-1 min-w-0">
                  <h3 className="font-semibold text-lg">{type.name}</h3>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{type.description}</p>
                </div>
                <div className="flex space-x-1 ml-2">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(type)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(type)}>
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-4 space-y-2 flex-1">
                <div className="flex items-center text-sm">
                  <Clock className="h-4 w-4 mr-2 text-gray-500" />
                  <span>{type.duration} minutes</span>
                </div>
                {type.link && (
                  <div className="flex items-center text-sm">
                    <Globe className="h-4 w-4 mr-2 text-gray-500 flex-shrink-0" />
                    <span className="truncate text-gray-600">{type.link}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-1 h-6 w-6 flex-shrink-0"
                      onClick={() => handleCopyLink(type.link)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {type.requiresConfirmation && (
                  <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded inline-block">
                    Requires confirmation
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t flex justify-between items-center">
                <div className="text-sm font-medium">
                  {type.price ? `$${Number(type.price).toFixed(2)}` : "Free"}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Active</span>
                  <Switch
                    checked={type.active}
                    onCheckedChange={() => handleToggleActive(type)}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {(isCreating || isEditing) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {isCreating ? "Create New Appointment Type" : "Edit Appointment Type"}
            </h2>

            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={currentType?.name ?? ""}
                  onChange={(e) =>
                    setCurrentType({ ...currentType, name: e.target.value })
                  }
                  placeholder="e.g. 30-Minute Consultation"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={currentType?.description ?? ""}
                  onChange={(e) =>
                    setCurrentType({ ...currentType, description: e.target.value })
                  }
                  placeholder="Briefly describe this appointment type"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="5"
                  step="5"
                  value={currentType?.duration ?? 30}
                  onChange={(e) =>
                    setCurrentType({
                      ...currentType,
                      duration: parseInt(e.target.value) || 30,
                    })
                  }
                />
              </div>

              <div>
                <Label htmlFor="color">Color</Label>
                <div className="flex items-center space-x-3">
                  <Input
                    id="color"
                    type="color"
                    value={currentType?.color ?? "#4f46e5"}
                    onChange={(e) =>
                      setCurrentType({ ...currentType, color: e.target.value })
                    }
                    className="w-14 h-10 p-1 cursor-pointer"
                  />
                  <span className="text-sm text-gray-600">{currentType?.color}</span>
                </div>
              </div>

              <div>
                <Label htmlFor="link">Booking Slug</Label>
                <div className="flex items-center border rounded-md overflow-hidden">
                  <span className="text-sm text-gray-500 px-3 py-2 bg-gray-50 border-r whitespace-nowrap">
                    /book/
                  </span>
                  <Input
                    id="link"
                    value={currentType?.link ?? ""}
                    onChange={(e) =>
                      setCurrentType({ ...currentType, link: e.target.value })
                    }
                    placeholder="my-appointment"
                    className="border-0 rounded-none focus-visible:ring-0"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="price">Price (leave empty for free)</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={currentType?.price ?? ""}
                  onChange={(e) =>
                    setCurrentType({
                      ...currentType,
                      price: e.target.value !== "" ? parseFloat(e.target.value) : null,
                    })
                  }
                  placeholder="0.00"
                />
              </div>

              <div className="flex items-center justify-between py-1">
                <Label htmlFor="requiresConfirmation" className="cursor-pointer">
                  Requires confirmation
                </Label>
                <Switch
                  id="requiresConfirmation"
                  checked={currentType?.requiresConfirmation ?? false}
                  onCheckedChange={(checked) =>
                    setCurrentType({ ...currentType, requiresConfirmation: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between py-1">
                <Label htmlFor="active" className="cursor-pointer">
                  Active
                </Label>
                <Switch
                  id="active"
                  checked={currentType?.active ?? true}
                  onCheckedChange={(checked) =>
                    setCurrentType({ ...currentType, active: checked })
                  }
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-2">
              <Button variant="outline" onClick={handleCancel} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : isCreating ? (
                  "Create"
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Appointment Type?"
        message={`This will permanently delete "${typeToDelete?.name}". Any existing appointments of this type will be unaffected. This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        isLoading={deleteLoading}
        loadingLabel="Deleting…"
        variant="destructive"
      />
    </div>
  );
}
