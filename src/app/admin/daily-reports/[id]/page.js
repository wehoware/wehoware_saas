"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import DailyReportForm from "@/components/daily-reports/DailyReportForm";
import { toast } from "react-hot-toast";
import { ArrowLeft, Send, Undo2, Clock, LogIn, LogOut, ListTodo } from "lucide-react";
import { formatDateOnly, formatTime12h, formatDuration } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

const formatDate = formatDateOnly;

function formatTimestamp(tsStr) {
  if (!tsStr) return "—";
  const d = new Date(tsStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusBadge(status) {
  if (status === "draft")
    return <Badge variant="secondary">Draft</Badge>;
  if (status === "submitted")
    return <Badge variant="default">Submitted</Badge>;
  return <Badge>{status}</Badge>;
}

export default function DailyReportDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id;
  const editMode = searchParams.get("edit") === "1";

  const [report, setReport] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [reportRes, tasksRes] = await Promise.all([
          fetch(`/api/v1/daily-reports/${id}`),
          fetch("/api/v1/daily-reports/assignable-tasks"),
        ]);
        const reportData = await reportRes.json();
        const tasksData = await tasksRes.json();
        let loadedTasks = tasksData.tasks || [];
        if (reportRes.ok) setReport(reportData);

        // Supplement with tasks referenced by existing items that may not be
        // in the assignable list (e.g. reassigned since report creation)
        const itemTaskIds = new Set(
          (reportData.items || []).map((it) => it.task_id || it.taskId).filter(Boolean)
        );
        const loadedIds = new Set(loadedTasks.map((t) => t.id));
        const missingIds = [...itemTaskIds].filter((tid) => !loadedIds.has(tid));

        if (missingIds.length > 0) {
          // Fetch missing tasks individually (simpler than batch query from client)
          const missingTasks = await Promise.all(
            missingIds.map(async (tid) => {
              try {
                const r = await fetch(`/api/v1/tasks/${tid}`);
                const d = await r.json();
                return r.ok ? d : null;
              } catch {
                return null;
              }
            })
          );
          loadedTasks = loadedTasks.concat(missingTasks.filter(Boolean));
        }

        setTasks(loadedTasks);
      } catch {
        toast.error("Failed to load report");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleSave = async (payload) => {
    const res = await fetch(`/api/v1/daily-reports/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to update report");
    toast.success("Report updated");
    setReport(data);
  };

  const handleSubmit = async () => {
    const res = await fetch(`/api/v1/daily-reports/${id}/submit`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to submit");
    toast.success("Report submitted");
    setReport(data);
  };

  const handleUnsubmit = async () => {
    const res = await fetch(`/api/v1/daily-reports/${id}/unsubmit`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to unsubmit");
    toast.success("Report unsubmitted");
    setReport(data);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!report) {
    return <div className="text-muted-foreground">Report not found.</div>;
  }

  const perms = report._permissions || {};

  if (editMode && perms.canEdit) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/admin/daily-reports/${id}`}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Edit Report</h1>
        </div>
        <DailyReportForm initialReport={report} tasks={tasks} onSave={handleSave} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/daily-reports">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">
            Report for {formatDate(report.reportDate)}
          </h1>
          {statusBadge(report.status)}
        </div>
        <div className="flex items-center gap-2">
          {perms.canEdit && (
            <Button variant="outline" asChild>
              <Link href={`/admin/daily-reports/${id}?edit=1`}>Edit</Link>
            </Button>
          )}
          {perms.canSubmit && (
            <Button onClick={handleSubmit}>
              <Send className="h-4 w-4 mr-1" />
              Submit
            </Button>
          )}
          {perms.canUnsubmit && (
            <Button variant="secondary" onClick={handleUnsubmit}>
              <Undo2 className="h-4 w-4 mr-1" />
              Unsubmit
            </Button>
          )}
        </div>
      </div>

      {/* Time summary tiles */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Start Time", value: formatTime12h(report.start_time), icon: LogIn, accent: "text-green-500 bg-green-500/10" },
          { label: "End Time", value: formatTime12h(report.end_time), icon: LogOut, accent: "text-red-500 bg-red-500/10" },
          { label: "Total Hours", value: `${Number(report.totalHours || 0).toFixed(2)} hrs`, icon: Clock, accent: "text-orange-500 bg-orange-500/10" },
        ].map(({ label, value, icon: Icon, accent }) => (
          <Card key={label} className="border-border/60 shadow-sm">
            <CardContent className="flex items-center gap-3 py-4">
              <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", accent)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className="text-sm font-semibold tabular-nums truncate">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {report.summary || "No summary provided."}
          </p>
          {report.submittedAt && (
            <p className="mt-4 text-xs text-muted-foreground">
              Submitted on {formatTimestamp(report.submittedAt)}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium">Work Items</h3>
          {(report.items?.length ?? 0) > 0 && (
            <Badge variant="secondary">{report.items.length}</Badge>
          )}
        </div>
        {(!report.items || report.items.length === 0) ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 py-10 text-center">
            <ListTodo className="h-7 w-7 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No work items.</p>
          </div>
        ) : (
          report.items.map((item, idx) => (
            <Card key={item.id || idx} className="border-border/60 shadow-sm">
              <CardHeader className="py-3 border-b border-border/40 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {idx + 1}
                    </span>
                    <CardTitle className="text-sm font-medium">
                      {item.task?.title || item.task_id || "Work Item"}
                    </CardTitle>
                  </div>
                  <Badge variant="secondary" className="tabular-nums">
                    {formatDuration(item.hours_worked)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-2 pt-4 pb-4 text-sm">
                {item.subtask_id && <div><span className="font-medium">Subtask:</span> {item.subtask_id}</div>}
                <div className="flex gap-6 text-muted-foreground">
                  <div><span className="font-medium text-foreground">Start:</span> {formatTime12h(item.start_time)}</div>
                  <div><span className="font-medium text-foreground">End:</span> {formatTime12h(item.end_time)}</div>
                </div>
                {item.description && <div><span className="font-medium">Description:</span> {item.description}</div>}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
