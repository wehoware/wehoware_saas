"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import TimePicker from "@/components/ui/time-picker";
import DatePicker from "@/components/ui/date-picker";
import SearchableSelect from "@/components/ui/searchable-select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, CalendarDays, Clock, FileText, ListTodo, Save } from "lucide-react";
import { toast } from "react-hot-toast";
import { toastError } from "@/lib/toast-error";
import { toLocalISODate, formatDuration } from "@/lib/date-utils";

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
    toLocalISODate(initialReport?.reportDate) || toLocalISODate(new Date())
  );
  const [reportStartTime, setReportStartTime] = useState(
    initialReport?.start_time ? initialReport.start_time.slice(11, 16) : ""
  );
  const [reportEndTime, setReportEndTime] = useState(
    initialReport?.end_time ? initialReport.end_time.slice(11, 16) : ""
  );
  const [summary, setSummary] = useState(initialReport?.summary || "");
  const [items, setItems] = useState(
    (initialReport?.items || []).map((it) => {
      const startTime = it.start_time ? it.start_time.slice(11, 16) : "";
      const endTime = it.end_time ? it.end_time.slice(11, 16) : "";
      const stored = it.hours_worked == null ? null : Number(it.hours_worked);
      const computed = computeHours(startTime, endTime);
      // Treat a stored value that differs from the computed diff as a
      // deliberate manual override; matching values stay auto-computed.
      const hoursManual =
        stored != null && !Number.isNaN(stored) &&
        (computed <= 0 || Math.abs(stored - computed) > 0.005);
      return {
        id: it.id,
        taskId: it.task_id || it.taskId || "",
        subtaskId: it.subtask_id || it.subtaskId || "",
        startTime,
        endTime,
        hoursWorked: stored == null || Number.isNaN(stored) ? "" : stored.toFixed(2),
        hoursManual,
        description: it.description || "",
      };
    }) || []
  );
  const [saving, setSaving] = useState(false);

  const addItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      { taskId: "", subtaskId: "", startTime: "", endTime: "", hoursWorked: "", hoursManual: false, description: "" },
    ]);
  }, []);

  const removeItem = useCallback((index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const taskOptions = useMemo(
    () =>
      (tasks || []).map((t) => ({
        value: t.id,
        label: `${t.title}${t.client?.companyName ? ` — ${t.client.companyName}` : ""}`,
      })),
    [tasks]
  );

  const updateItem = useCallback((index, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };
      if (field === "hoursWorked") {
        // Typing in the field marks it manual; clearing it returns to auto.
        item.hoursManual = value !== "";
      } else if ((field === "startTime" || field === "endTime") && !item.hoursManual) {
        const computed = computeHours(item.startTime, item.endTime);
        item.hoursWorked = computed > 0 ? computed.toFixed(2) : "";
      }
      next[index] = item;
      return next;
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!reportDate) {
      toast.error("Please select a report date");
      return;
    }
    if (
      reportStartTime &&
      reportEndTime &&
      reportEndTime <= reportStartTime
    ) {
      toast.error("End time must be after start time");
      return;
    }
    const badItem = items.find(
      (it) => it.taskId && it.startTime && it.endTime && it.endTime <= it.startTime
    );
    if (badItem) {
      toast.error("An item's end time must be after its start time");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        report_date: reportDate,
        start_time: reportStartTime ? `2000-01-01T${reportStartTime}:00Z` : null,
        end_time: reportEndTime ? `2000-01-01T${reportEndTime}:00Z` : null,
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
      toastError(err, "Failed to save report");
    } finally {
      setSaving(false);
    }
  };

  const totalHours = computeHours(reportStartTime, reportEndTime);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Report details */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Report Details</CardTitle>
              <p className="text-xs text-muted-foreground">Date and overall working hours for this report.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Report Date</Label>
              <DatePicker
                name="report_date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                placeholder="Select report date"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Total Hours</Label>
              <div className="flex h-10 items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-3">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-semibold tabular-nums">
                  {formatDuration(totalHours)}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({totalHours.toFixed(2)} hrs)
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="report_start_time">Start Time</Label>
              <TimePicker
                id="report_start_time"
                value={reportStartTime}
                onChange={(e) => setReportStartTime(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="report_end_time">End Time</Label>
              <TimePicker
                id="report_end_time"
                value={reportEndTime}
                onChange={(e) => setReportEndTime(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Start/end times determine this report&apos;s total hours. Work item times are tracked individually.
          </p>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Summary</CardTitle>
              <p className="text-xs text-muted-foreground">A short overview of the day&apos;s work.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            id="summary"
            rows={8}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Describe your overall progress today..."
            className="min-h-40 resize-y"
          />
        </CardContent>
      </Card>

      {/* Work items */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
              <ListTodo className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold">Work Items</h3>
              {items.length > 0 && (
                <Badge variant="secondary">{items.length}</Badge>
              )}
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="h-4 w-4 mr-1" />
            Add Item
          </Button>
        </div>

        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 py-10 text-center">
            <ListTodo className="h-7 w-7 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No items added. Click &quot;Add Item&quot; to start logging work.
            </p>
          </div>
        )}

        {items.map((item, idx) => {
          const duration = computeHours(item.startTime, item.endTime);
          return (
            <Card key={idx} className="relative border-border/60 shadow-sm">
              <CardHeader className="py-3 border-b border-border/40 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {idx + 1}
                    </span>
                    <CardTitle className="text-sm font-medium">Work Item</CardTitle>
                    {duration > 0 && (
                      <Badge variant="secondary" className="text-[10px]">
                        {formatDuration(duration)}
                      </Badge>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeItem(idx)}
                    title="Remove item"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 pt-4 pb-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label>Task</Label>
                    <SearchableSelect
                      options={taskOptions}
                      value={item.taskId}
                      onChange={(v) => updateItem(idx, "taskId", v)}
                      placeholder="Select task"
                      searchPlaceholder="Search tasks…"
                      emptyText="No tasks found."
                      clearable
                      clearLabel="No task"
                    />
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
                    <TimePicker
                      value={item.startTime}
                      onChange={(e) => updateItem(idx, "startTime", e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>End Time</Label>
                    <TimePicker
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
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-border/40 pt-4">
        <Button type="button" variant="outline" onClick={() => router.push("/admin/daily-reports")}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          <Save className="h-4 w-4 mr-1.5" />
          {saving ? "Saving..." : "Save Report"}
        </Button>
      </div>
    </form>
  );
}
