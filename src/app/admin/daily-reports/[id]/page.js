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
import { ArrowLeft, Send, Undo2 } from "lucide-react";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
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

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {report.summary || "No summary provided."}
          </p>
          <div className="mt-4 grid gap-2 text-sm">
            <div>
              <span className="font-medium">Total Hours:</span>{" "}
              {Number(report.totalHours || 0).toFixed(2)}
            </div>
            {report.submittedAt && (
              <div>
                <span className="font-medium">Submitted:</span>{" "}
                {formatDate(report.submittedAt)}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Work Items</h3>
        {(!report.items || report.items.length === 0) ? (
          <div className="text-sm text-muted-foreground">No work items.</div>
        ) : (
          report.items.map((item, idx) => (
            <Card key={item.id || idx}>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium">Item {idx + 1}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 py-0 pb-4 text-sm">
                <div><span className="font-medium">Task:</span> {item.task?.title || item.task_id || "—"}</div>
                {item.subtask_id && <div><span className="font-medium">Subtask:</span> {item.subtask_id}</div>}
                <div className="flex gap-4">
                  <div><span className="font-medium">Start:</span> {item.start_time ? item.start_time.slice(11, 16) : "—"}</div>
                  <div><span className="font-medium">End:</span> {item.end_time ? item.end_time.slice(11, 16) : "—"}</div>
                  <div><span className="font-medium">Hours:</span> {Number(item.hours_worked || 0).toFixed(2)}</div>
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
