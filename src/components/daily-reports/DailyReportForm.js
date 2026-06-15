"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";

function toIsoDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function computeHours(start, end) {
  if (!start || !end) return 0;
  const s = new Date(`2000-01-01T${start}`);
  const e = new Date(`2000-01-01T${end}`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  const diff = (e.getTime() - s.getTime()) / (1000 * 60 * 60);
  return Math.max(0, diff);
}

export default function DailyReportForm({ initialReport, tasks, onSave }) {
  const router = useRouter();
  const [reportDate, setReportDate] = useState(
    toIsoDate(initialReport?.reportDate) || toIsoDate(new Date())
  );
  const [summary, setSummary] = useState(initialReport?.summary || "");
  const [items, setItems] = useState(
    (initialReport?.items || []).map((it) => ({
      id: it.id,
      taskId: it.task_id || it.taskId || "",
      subtaskId: it.subtask_id || it.subtaskId || "",
      startTime: it.start_time ? it.start_time.slice(11, 16) : "",
      endTime: it.end_time ? it.end_time.slice(11, 16) : "",
      hoursWorked: it.hours_worked === undefined ? "" : Number(it.hours_worked).toFixed(2),
      description: it.description || "",
    })) || []
  );
  const [saving, setSaving] = useState(false);

  const addItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      { taskId: "", subtaskId: "", startTime: "", endTime: "", hoursWorked: "", description: "" },
    ]);
  }, []);

  const removeItem = useCallback((index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateItem = useCallback((index, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      if (field === "startTime" || field === "endTime") {
        const computed = computeHours(next[index].startTime, next[index].endTime);
        if (computed > 0 && !next[index].hoursWorked) {
          next[index] = { ...next[index], hoursWorked: computed.toFixed(2) };
        }
      }
      return next;
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        report_date: reportDate,
        summary: summary || null,
        items: items
          .filter((it) => it.taskId)
          .map((it, idx) => ({
            task_id: it.taskId,
            subtask_id: it.subtaskId || null,
            start_time: it.startTime ? `2000-01-01T${it.startTime}:00Z` : null,
            end_time: it.endTime ? `2000-01-01T${it.endTime}:00Z` : null,
            hours_worked: it.hoursWorked ? Number(it.hoursWorked) : null,
            description: it.description || null,
            sequence: idx,
          })),
      };

      await onSave(payload);
      router.push("/admin/daily-reports");
    } catch (err) {
      toast.error(err.message || "Failed to save report");
    } finally {
      setSaving(false);
    }
  };

  const totalHours = items.reduce((sum, it) => sum + (Number(it.hoursWorked) || 0), 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="report_date">Report Date</Label>
          <Input
            id="report_date"
            type="date"
            required
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Total Hours</Label>
          <div className="h-10 flex items-center text-sm font-medium">
            {totalHours.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="summary">Summary</Label>
        <Textarea
          id="summary"
          rows={3}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Describe your overall progress today..."
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Work Items</h3>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="h-4 w-4 mr-1" />
            Add Item
          </Button>
        </div>

        {items.length === 0 && (
          <div className="text-sm text-muted-foreground">
            No items added. Click &quot;Add Item&quot; to start logging work.
          </div>
        )}

        {items.map((item, idx) => (
          <Card key={idx} className="relative">
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Item {idx + 1}</CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => removeItem(idx)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 py-0 pb-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label>Task</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    value={item.taskId}
                    onChange={(e) => updateItem(idx, "taskId", e.target.value)}
                  >
                    <option value="">Select task</option>
                    {(tasks || []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                        {t.client?.companyName ? ` — ${t.client.companyName}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Subtask</Label>
                  <Input
                    placeholder="Optional subtask ID"
                    value={item.subtaskId}
                    onChange={(e) => updateItem(idx, "subtaskId", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={item.startTime}
                    onChange={(e) => updateItem(idx, "startTime", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={item.endTime}
                    onChange={(e) => updateItem(idx, "endTime", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Hours Worked</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="24"
                    value={item.hoursWorked}
                    onChange={(e) => updateItem(idx, "hoursWorked", e.target.value)}
                    placeholder="Auto"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Description</Label>
                <Textarea
                  rows={2}
                  value={item.description}
                  onChange={(e) => updateItem(idx, "description", e.target.value)}
                  placeholder="What did you work on?"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Report"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/admin/daily-reports")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
