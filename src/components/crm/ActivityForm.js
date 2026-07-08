"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import SelectInput from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";

const ACTIVITY_TYPES = [
  { value: "Call", label: "Call" },
  { value: "Email", label: "Email" },
  { value: "Meeting", label: "Meeting" },
  { value: "Note", label: "Note" },
  { value: "Task", label: "Task" },
];

const DIRECTIONS = [
  { value: "Inbound", label: "Inbound" },
  { value: "Outbound", label: "Outbound" },
  { value: "Internal", label: "Internal" },
];

const EMPTY_FORM = {
  type: "Call",
  direction: "Outbound",
  title: "",
  description: "",
  contact_id: "",
  deal_id: "",
  scheduled_at: "",
  duration_minutes: "",
};

export default function ActivityForm({ open, onOpenChange, onSaved }) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [contacts, setContacts] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFormData(EMPTY_FORM);
      fetch("/api/v1/crm/contacts?limit=100")
        .then((r) => r.json())
        .then(({ data }) => {
          setContacts(
            (data || []).map((c) => ({
              value: c.id,
              label: `${c.first_name} ${c.last_name}`.trim(),
            }))
          );
        })
        .catch(() => {});
    }
  }, [open]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title) {
      toast.error("Title is required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        contact_id: formData.contact_id || null,
        deal_id: formData.deal_id || null,
        scheduled_at: formData.scheduled_at || null,
        duration_minutes: formData.duration_minutes ? Number(formData.duration_minutes) : null,
      };

      const res = await fetch("/api/v1/crm/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create activity");
      }

      toast.success("Activity created");
      onOpenChange(false);
      if (onSaved) onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Activity</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="type">Type</Label>
              <SelectInput
                id="type"
                name="type"
                options={ACTIVITY_TYPES}
                value={formData.type}
                onChange={handleChange}
              />
            </div>
            <div>
              <Label htmlFor="direction">Direction</Label>
              <SelectInput
                id="direction"
                name="direction"
                options={DIRECTIONS}
                value={formData.direction}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Follow-up call with John"
            />
          </div>

          <div>
            <Label htmlFor="contact_id">Contact</Label>
            <SelectInput
              id="contact_id"
              name="contact_id"
              options={[{ value: "", label: "— None —" }, ...contacts]}
              value={formData.contact_id}
              onChange={handleChange}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="scheduled_at">Scheduled At</Label>
              <Input
                id="scheduled_at"
                name="scheduled_at"
                type="datetime-local"
                value={formData.scheduled_at}
                onChange={handleChange}
              />
            </div>
            <div>
              <Label htmlFor="duration_minutes">Duration (minutes)</Label>
              <Input
                id="duration_minutes"
                name="duration_minutes"
                type="number"
                value={formData.duration_minutes}
                onChange={handleChange}
                placeholder="30"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              placeholder="Activity details..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Activity
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
