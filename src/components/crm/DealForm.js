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

const DEAL_STATUSES = [
  { value: "Open", label: "Open" },
  { value: "Won", label: "Won" },
  { value: "Lost", label: "Lost" },
];

const EMPTY_FORM = {
  title: "",
  contact_id: "",
  pipeline_id: "",
  stage_id: "",
  value: "",
  currency: "USD",
  status: "Open",
  priority: "Medium",
  expected_close_date: "",
  description: "",
};

export default function DealForm({ open, onOpenChange, deal = null, pipeline = null, onSaved }) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [contacts, setContacts] = useState([]);
  const [stages, setStages] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (deal) {
      setFormData({
        title: deal.title || "",
        contact_id: deal.contact_id || "",
        pipeline_id: deal.pipeline_id || "",
        stage_id: deal.stage_id || "",
        value: deal.value ? String(deal.value) : "",
        currency: deal.currency || "USD",
        status: deal.status || "Open",
        priority: deal.priority || "Medium",
        expected_close_date: deal.expected_close_date
          ? new Date(deal.expected_close_date).toISOString().split("T")[0]
          : "",
        description: deal.description || "",
      });
    } else {
      setFormData({
        ...EMPTY_FORM,
        pipeline_id: pipeline?.id || "",
        stage_id: pipeline?.stages?.[0]?.id || "",
      });
    }
  }, [deal, open, pipeline]);

  useEffect(() => {
    if (open) {
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

      if (pipeline) {
        setStages(
          (pipeline.stages || []).map((s) => ({
            value: s.id,
            label: s.name,
          }))
        );
      } else if (deal?.pipeline) {
        fetch(`/api/v1/crm/pipelines/${deal.pipeline_id}`)
          .then((r) => r.json())
          .then(({ data }) => {
            if (data?.stages) {
              setStages(
                data.stages.map((s) => ({ value: s.id, label: s.name }))
              );
            }
          })
          .catch(() => {});
      }
    }
  }, [open, pipeline, deal]);

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
    if (!formData.pipeline_id) {
      toast.error("Pipeline is required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        value: formData.value ? Number(formData.value) : 0,
        expected_close_date: formData.expected_close_date || null,
        contact_id: formData.contact_id || null,
      };

      const url = deal ? `/api/v1/crm/deals/${deal.id}` : "/api/v1/crm/deals";
      const method = deal ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save deal");
      }

      toast.success(deal ? "Deal updated" : "Deal created");
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{deal ? "Edit Deal" : "New Deal"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Website redesign project"
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

          <div>
            <Label htmlFor="stage_id">Stage</Label>
            <SelectInput
              id="stage_id"
              name="stage_id"
              options={stages}
              value={formData.stage_id}
              onChange={handleChange}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="value">Value</Label>
              <Input
                id="value"
                name="value"
                type="number"
                value={formData.value}
                onChange={handleChange}
                placeholder="5000"
              />
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                placeholder="USD"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status">Status</Label>
              <SelectInput
                id="status"
                name="status"
                options={DEAL_STATUSES}
                value={formData.status}
                onChange={handleChange}
              />
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <SelectInput
                id="priority"
                name="priority"
                options={[
                  { value: "Low", label: "Low" },
                  { value: "Medium", label: "Medium" },
                  { value: "High", label: "High" },
                  { value: "Urgent", label: "Urgent" },
                ]}
                value={formData.priority}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="expected_close_date">Expected Close Date</Label>
            <Input
              id="expected_close_date"
              name="expected_close_date"
              type="date"
              value={formData.expected_close_date}
              onChange={handleChange}
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              placeholder="Deal details..."
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {deal ? "Save Changes" : "Create Deal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
