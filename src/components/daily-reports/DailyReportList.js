"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, Trash2, Send, Undo2 } from "lucide-react";

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

export default function DailyReportList({
  reports,
  loading,
  onDelete,
  onSubmit,
  onUnsubmit,
  currentUser,
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (!reports || reports.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        No daily work reports found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Total Hours</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.map((report) => {
            const perms = report._permissions || {};
            return (
              <TableRow key={report.id}>
                <TableCell>
                  <Link
                    href={`/admin/daily-reports/${report.id}`}
                    className="font-medium hover:underline"
                  >
                    {formatDate(report.reportDate)}
                  </Link>
                </TableCell>
                <TableCell>
                  {report.user
                    ? `${report.user.first_name || ""} ${report.user.last_name || ""}`.trim() || report.user.email
                    : "—"}
                </TableCell>
                <TableCell>{statusBadge(report.status)}</TableCell>
                <TableCell>{report.items?.length ?? 0}</TableCell>
                <TableCell>{Number(report.totalHours || 0).toFixed(2)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {perms.canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                      >
                        <Link href={`/admin/daily-reports/${report.id}?edit=1`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                    {perms.canSubmit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onSubmit(report.id)}
                        title="Submit"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                    {perms.canUnsubmit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onUnsubmit(report.id)}
                        title="Unsubmit"
                      >
                        <Undo2 className="h-4 w-4" />
                      </Button>
                    )}
                    {perms.canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(report.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
