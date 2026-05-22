"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "react-hot-toast";
import SubtaskForm from "./SubtaskForm";
import TaskCompletionBar from "./TaskCompletionBar";

const STATUS_COLORS = {
  "To Do": "secondary",
  "In Progress": "default",
  Done: "outline",
  Backlog: "secondary",
};

export default function SubtaskList({ taskId, userRole }) {
  const [subtasks, setSubtasks] = useState([]);
  const [total, setTotal] = useState(0);
  const [completionPct, setCompletionPct] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const fetchSubtasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/tasks/${taskId}/subtasks`);
      if (!res.ok) throw new Error("Failed to load sub-tasks");
      const data = await res.json();
      setSubtasks(data.subtasks ?? []);
      setTotal(data.total ?? 0);
      setCompletionPct(data.completion_percentage ?? 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchSubtasks();
  }, [fetchSubtasks]);

  const handleToggleDone = async (subtask) => {
    const newStatus = subtask.status === "Done" ? "To Do" : "Done";
    try {
      const res = await fetch(`/api/v1/tasks/${taskId}/subtasks/${subtask.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to update sub-task");
      }
      fetchSubtasks();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (subtaskId) => {
    if (!confirm("Delete this sub-task?")) return;
    try {
      const res = await fetch(`/api/v1/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        const d = await res.json();
        throw new Error(d.error || "Failed to delete sub-task");
      }
      toast.success("Sub-task deleted");
      fetchSubtasks();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleCreated = () => {
    setShowForm(false);
    fetchSubtasks();
    toast.success("Sub-task added");
  };

  const canEdit = userRole === "admin" || userRole === "employee";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Sub-tasks ({total})
        </button>
        {canEdit && !collapsed && (
          <Button variant="ghost" size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        )}
      </div>

      {!collapsed && (
        <>
          {total > 0 && (
            <TaskCompletionBar completed={Math.round((completionPct / 100) * total)} total={total} />
          )}

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : subtasks.length === 0 && !showForm ? (
            <p className="text-xs text-muted-foreground py-2">No sub-tasks yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {subtasks.map((s) => (
                <li
                  key={s.id}
                  className="flex items-start gap-2.5 p-2 rounded-md hover:bg-muted/50 group"
                >
                  <Checkbox
                    checked={s.status === "Done"}
                    onCheckedChange={() => canEdit && handleToggleDone(s)}
                    disabled={!canEdit}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <span
                      className={`text-sm ${s.status === "Done" ? "line-through text-muted-foreground" : ""}`}
                    >
                      {s.title}
                    </span>
                    {s.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.description}</p>
                    )}
                  </div>
                  <Badge variant={STATUS_COLORS[s.status] ?? "secondary"} className="text-xs shrink-0">
                    {s.status}
                  </Badge>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                      onClick={() => handleDelete(s.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {showForm && canEdit && (
            <SubtaskForm
              taskId={taskId}
              onCreated={handleCreated}
              onCancel={() => setShowForm(false)}
            />
          )}
        </>
      )}
    </div>
  );
}
