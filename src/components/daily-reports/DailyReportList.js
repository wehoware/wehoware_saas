"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, Trash2, Send, Undo2, FileText, Clock, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getInitials(first, last) {
  const f = first?.charAt(0) || "";
  const l = last?.charAt(0) || "";
  return (f + l).toUpperCase() || "?";
}

const STATUS_STYLES = {
  draft: "bg-yellow-500/10 text-yellow-600",
  submitted: "bg-green-500/10 text-green-600",
};

function StatusBadge({ status }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
      STATUS_STYLES[status] || "bg-muted text-muted-foreground"
    )}>
      <span className={cn(
        "h-1.5 w-1.5 rounded-full",
        status === "submitted" ? "bg-green-500" : status === "draft" ? "bg-yellow-500" : "bg-muted-foreground"
      )} />
      {status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown"}
    </span>
  );
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
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              {[...Array(8)].map((_, i) => (
                <TableHead key={i}><Skeleton className="h-5 w-full" /></TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(8)].map((_, i) => (
              <TableRow key={i}>
                {[...Array(8)].map((_, j) => (
                  <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  // Deduplicate by id (guard against API pagination overlaps)
  const uniqueReports = (reports || []).filter(
    (r, i, arr) => arr.findIndex((x) => x.id === r.id) === i
  );

  if (!reports || reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg border-dashed border-border/60">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 mb-4">
          <FileText className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <p className="text-sm font-medium">No daily work reports found</p>
        <p className="text-xs text-muted-foreground mt-1">
          Try adjusting your filters or create a new report.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-x-auto scrollbar-thin">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="w-[15%]">Date</TableHead>
            <TableHead className="w-[18%]">User</TableHead>
            <TableHead className="w-[10%]">Start</TableHead>
            <TableHead className="w-[10%]">End</TableHead>
            <TableHead className="w-[12%]">Status</TableHead>
            <TableHead className="w-[10%]">Items</TableHead>
            <TableHead className="w-[12%]">Total Hours</TableHead>
            <TableHead className="w-[13%] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {uniqueReports.map((report) => {
            const perms = report._permissions || {};
            const fullName = report.user
              ? `${report.user.first_name || ""} ${report.user.last_name || ""}`.trim() || report.user.email
              : "—";
            return (
              <TableRow
                key={report.id}
                className="hover:bg-muted/40 transition-colors"
              >
                <TableCell className="min-w-0">
                  <Link
                    href={`/admin/daily-reports/${report.id}`}
                    className="font-medium hover:underline"
                  >
                    {formatDate(report.reportDate)}
                  </Link>
                </TableCell>
                <TableCell className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="text-[10px]">
                        {report.user ? getInitials(report.user.first_name, report.user.last_name) : "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm truncate" title={fullName}>
                      {fullName}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {report.start_time ? report.start_time.slice(11, 16) : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {report.end_time ? report.end_time.slice(11, 16) : "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <StatusBadge status={report.status} />
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <ListTodo className="h-3.5 w-3.5" />
                    {report.items?.length ?? 0}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-1 text-sm font-medium tabular-nums">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    {Number(report.totalHours || 0).toFixed(2)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {perms.canEdit && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link href={`/admin/daily-reports/${report.id}?edit=1`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    )}
                    {perms.canSubmit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onSubmit(report.id)}
                        title="Submit"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {perms.canUnsubmit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onUnsubmit(report.id)}
                        title="Unsubmit"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {perms.canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onDelete(report.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
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
