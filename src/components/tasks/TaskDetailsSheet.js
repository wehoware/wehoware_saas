"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import SubtaskList from "./SubtaskList";
import TimeTrackerPanel from "./TimeTrackerPanel";
import CommentForm from "./CommentForm";

const STATUS_VARIANT = {
  "To Do": "secondary",
  "In Progress": "default",
  Done: "outline",
  Backlog: "secondary",
};
const PRIORITY_VARIANT = {
  High: "destructive",
  Medium: "default",
  Low: "secondary",
};

function formatDate(d) {
  if (!d) return "Not set";
  try { return format(new Date(d), "MMM d, yyyy"); } catch { return d; }
}

function TaskCommentsPanel({ taskId }) {
  const [feed, setFeed] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFeed = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/tasks/${taskId}/activities`);
      if (res.ok) {
        const data = await res.json();
        setFeed(data.feed ?? []);
      }
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  return (
    <div className="space-y-4">
      <CommentForm taskId={taskId} onCommentAdded={fetchFeed} />
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : feed.length === 0 ? (
        <p className="text-xs text-muted-foreground">No comments or activity yet.</p>
      ) : (
        <ul className="space-y-3">
          {feed.map((item) => (
            <li key={item.id} className="text-sm border-b pb-2 last:border-b-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <span className="font-medium text-foreground">
                  {item.user ? `${item.user.first_name} ${item.user.last_name}` : "System"}
                </span>
                <span>·</span>
                <span>{new Date(item.created_at).toLocaleString()}</span>
                {item.feed_type === "comment" && <span className="text-blue-500">comment</span>}
              </div>
              {item.feed_type === "comment" ? (
                <p>{item.content}</p>
              ) : (
                <p className="text-muted-foreground">{item.activity_type?.replace(/_/g, " ")}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function TaskDetailsSheet({ task, isOpen, onOpenChange, userRole, onUpdateTask }) {
  const [activeTab, setActiveTab] = useState("overview");

  if (!task) return null;

  const assigneeName = task.assignee
    ? `${task.assignee.first_name ?? ""} ${task.assignee.last_name ?? ""}`.trim()
    : "Unassigned";

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={STATUS_VARIANT[task.status] ?? "secondary"}>{task.status ?? "No status"}</Badge>
            {task.priority && (
              <Badge variant={PRIORITY_VARIANT[task.priority] ?? "secondary"}>{task.priority}</Badge>
            )}
          </div>
          <SheetTitle className="text-base leading-snug">{task.title}</SheetTitle>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-3">
          <TabsList className="w-full grid grid-cols-4 h-8 text-xs">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="subtasks">Sub-tasks</TabsTrigger>
            <TabsTrigger value="time">Time</TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
          </TabsList>

          {/* Overview tab */}
          <TabsContent value="overview" className="mt-3 space-y-4">
            {task.description ? (
              <p className="text-sm text-muted-foreground">{task.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No description provided.</p>
            )}

            <Separator />

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <span className="font-medium text-muted-foreground">Status</span>
              <Badge variant={STATUS_VARIANT[task.status] ?? "secondary"} className="w-fit">
                {task.status ?? "—"}
              </Badge>

              <span className="font-medium text-muted-foreground">Priority</span>
              <span>{task.priority ?? "—"}</span>

              <span className="font-medium text-muted-foreground">Assignee</span>
              <span>{assigneeName}</span>

              <span className="font-medium text-muted-foreground">Due Date</span>
              <span>{formatDate(task.due_date ?? task.dueDate)}</span>

              <span className="font-medium text-muted-foreground">Client</span>
              <span>{task.client?.company_name ?? "—"}</span>

              {task.story_points != null && (
                <>
                  <span className="font-medium text-muted-foreground">Story Points</span>
                  <span>{task.story_points}</span>
                </>
              )}

              {task.estimated_hours != null && (
                <>
                  <span className="font-medium text-muted-foreground">Estimated</span>
                  <span>{Number(task.estimated_hours).toFixed(1)}h</span>
                </>
              )}

              {task.actual_hours != null && (
                <>
                  <span className="font-medium text-muted-foreground">Logged</span>
                  <span>{Number(task.actual_hours).toFixed(1)}h</span>
                </>
              )}

              <span className="font-medium text-muted-foreground">Created</span>
              <span>{formatDate(task.created_at ?? task.createdAt)}</span>
            </div>

            {/* Sub-task completion preview */}
            {task.subtask_count > 0 && (
              <>
                <Separator />
                <div className="text-sm">
                  <span className="font-medium text-muted-foreground">Sub-tasks: </span>
                  <span>{task.subtask_completed ?? 0} / {task.subtask_count} completed</span>
                </div>
              </>
            )}
          </TabsContent>

          {/* Sub-tasks tab */}
          <TabsContent value="subtasks" className="mt-3">
            <SubtaskList taskId={task.id} userRole={userRole} />
          </TabsContent>

          {/* Time tracking tab */}
          <TabsContent value="time" className="mt-3">
            <TimeTrackerPanel taskId={task.id} task={task} userRole={userRole} />
          </TabsContent>

          {/* Comments tab */}
          <TabsContent value="comments" className="mt-3">
            <TaskCommentsPanel taskId={task.id} />
          </TabsContent>
        </Tabs>

        <div className="mt-4 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
