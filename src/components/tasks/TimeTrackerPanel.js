"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { format } from "date-fns";

function formatDate(d) {
  if (!d) return "-";
  try { return format(new Date(d), "MMM d, yyyy"); } catch { return d; }
}

function TimeEntryRow({ entry, onDelete, canDelete }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Delete this time entry?")) return;
    setDeleting(true);
    try {
      await onDelete(entry.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-start gap-3 py-2 border-b last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{Number(entry.hours_spent).toFixed(1)}h</span>
          <span className="text-xs text-muted-foreground">{formatDate(entry.tracked_date)}</span>
          {entry.user && (
            <span className="text-xs text-muted-foreground">
              — {entry.user.first_name} {entry.user.last_name}
            </span>
          )}
        </div>
        {entry.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{entry.notes}</p>}
      </div>
      {canDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3 text-destructive" />}
        </Button>
      )}
    </div>
  );
}

export default function TimeTrackerPanel({ taskId, task, userRole }) {
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [hours, setHours] = useState("");
  const [notes, setNotes] = useState("");
  const [trackedDate, setTrackedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [entriesRes, summaryRes] = await Promise.all([
        fetch(`/api/v1/tasks/${taskId}/time-entries`),
        fetch(`/api/v1/tasks/${taskId}/time-summary`),
      ]);
      if (entriesRes.ok) {
        const d = await entriesRes.json();
        setEntries(d.entries ?? []);
      }
      if (summaryRes.ok) {
        setSummary(await summaryRes.json());
      }
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const quickLog = (h) => { setHours(String(h)); setShowForm(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const h = parseFloat(hours);
    if (isNaN(h) || h <= 0 || h > 24) {
      setFormError("Hours must be between 0.01 and 24");
      return;
    }
    if (!trackedDate) {
      setFormError("Date is required");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const res = await fetch(`/api/v1/tasks/${taskId}/time-entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours_spent: h, notes: notes.trim() || undefined, tracked_date: trackedDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to log time");
      toast.success("Time logged");
      setHours("");
      setNotes("");
      setShowForm(false);
      fetchData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (entryId) => {
    try {
      const res = await fetch(`/api/v1/tasks/${taskId}/time-entries/${entryId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const d = await res.json();
        throw new Error(d.error || "Failed to delete");
      }
      toast.success("Time entry deleted");
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const canLog = userRole === "admin" || userRole === "employee";

  return (
    <div className="space-y-4">
      {/* Summary */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : summary ? (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-md border p-2.5 text-center">
            <p className="text-xs text-muted-foreground">Estimated</p>
            <p className="text-lg font-bold">
              {summary.estimated_hours != null ? `${Number(summary.estimated_hours).toFixed(1)}h` : "—"}
            </p>
          </div>
          <div className="rounded-md border p-2.5 text-center">
            <p className="text-xs text-muted-foreground">Logged</p>
            <p className="text-lg font-bold">{Number(summary.actual_hours ?? 0).toFixed(1)}h</p>
          </div>
          <div className="rounded-md border p-2.5 text-center">
            <p className="text-xs text-muted-foreground">Remaining</p>
            <p className={`text-lg font-bold ${summary.remaining_hours < 0 ? "text-destructive" : ""}`}>
              {summary.remaining_hours != null ? `${Number(summary.remaining_hours).toFixed(1)}h` : "—"}
            </p>
          </div>
        </div>
      ) : null}

      {/* Quick log buttons */}
      {canLog && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Quick log:</span>
          {[0.5, 1, 2, 4].map((h) => (
            <Button key={h} variant="outline" size="sm" className="h-7 text-xs" onClick={() => quickLog(h)}>
              {h}h
            </Button>
          ))}
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-3 w-3 mr-1" />
            Custom
          </Button>
        </div>
      )}

      {/* Log time form */}
      {showForm && canLog && (
        <form onSubmit={handleSubmit} className="space-y-2 p-3 border rounded-md bg-muted/30">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium">Hours spent *</label>
              <Input
                type="number"
                step="0.25"
                min="0.01"
                max="24"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="e.g. 2"
                disabled={submitting}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Date *</label>
              <Input
                type="date"
                value={trackedDate}
                onChange={(e) => setTrackedDate(e.target.value)}
                disabled={submitting}
                max={format(new Date(), "yyyy-MM-dd")}
              />
            </div>
          </div>
          <Textarea
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            disabled={submitting}
          />
          {formError && <p className="text-xs text-destructive">{formError}</p>}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
              Log Time
            </Button>
          </div>
        </form>
      )}

      {/* Entries list */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Time entries ({entries.length})
        </p>
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">No time logged yet.</p>
        ) : (
          <div className="border rounded-md px-3 divide-y">
            {entries.map((e) => (
              <TimeEntryRow
                key={e.id}
                entry={e}
                onDelete={handleDelete}
                canDelete={canLog}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
