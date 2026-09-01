"use client";

import { useState, useMemo, Fragment } from "react";
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
import { ChevronDown, ChevronUp, ArrowUpDown, Clock, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const SORT_COLUMNS = [
  { key: "label", label: "Employee" },
  { key: "reports_count", label: "Reports" },
  { key: "submitted_count", label: "Submitted" },
  { key: "draft_count", label: "Drafts" },
  { key: "total_hours", label: "Hours" },
  { key: "tasks_completed", label: "Tasks" },
  { key: "avg_hours_per_report", label: "Avg H/R" },
];

const TASK_STATUS_STYLES = {
  Done: "bg-green-500/10 text-green-600",
  "In Progress": "bg-yellow-500/10 text-yellow-600",
  "To Do": "bg-orange-500/10 text-orange-600",
  Backlog: "bg-muted text-muted-foreground",
};

function getInitials(label) {
  if (!label) return "?";
  const parts = label.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return label.slice(0, 2).toUpperCase();
}

export default function DailyReportAnalyticsTable({
  perEmployee,
  taskDetails,
  isLoading,
}) {
  const [sortKey, setSortKey] = useState("total_hours");
  const [sortDir, setSortDir] = useState("desc");
  const [expandedRow, setExpandedRow] = useState(null);

  const sorted = useMemo(() => {
    if (!perEmployee) return [];
    const arr = [...perEmployee];
    arr.sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      if (typeof aVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
    return arr;
  }, [perEmployee, sortKey, sortDir]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const getSortIcon = (key) => {
    if (sortKey !== key) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3" />
    ) : (
      <ChevronDown className="h-3 w-3" />
    );
  };

  if (isLoading) {
    return (
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              {[...Array(7)].map((_, i) => (
                <TableHead key={i}><Skeleton className="h-5 w-full" /></TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                {[...Array(7)].map((_, j) => (
                  <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (!sorted || sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg border-dashed border-border/60">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 mb-4">
          <Target className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <p className="text-sm font-medium">No employee data</p>
        <p className="text-xs text-muted-foreground mt-1">
          No data for the selected filters.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-x-auto scrollbar-thin">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="bg-muted/30">
            {SORT_COLUMNS.map((col) => (
              <TableHead
                key={col.key}
                className={col.key === "label" ? "w-[22%]" : "text-right"}
              >
                <button
                  className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  {getSortIcon(col.key)}
                </button>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((emp) => {
            const isExpanded = expandedRow === emp.user_id;
            const details = taskDetails?.[emp.user_id] || [];
            return (
              <Fragment key={emp.user_id}>
                <TableRow
                  className="cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() =>
                    setExpandedRow(isExpanded ? null : emp.user_id)
                  }
                >
                  <TableCell className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="text-[10px]">
                          {getInitials(emp.label)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" title={emp.label}>
                          {emp.label}
                        </p>
                        {emp.email && (
                          <p className="text-xs text-muted-foreground truncate" title={emp.email}>
                            {emp.email}
                          </p>
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 ml-auto" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-auto" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{emp.reports_count}</TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center rounded-full bg-green-500/10 text-green-600 px-2 py-0.5 text-xs font-medium tabular-nums">
                      {emp.submitted_count}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center rounded-full bg-yellow-500/10 text-yellow-600 px-2 py-0.5 text-xs font-medium tabular-nums">
                      {emp.draft_count}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="flex items-center justify-end gap-1 text-sm tabular-nums">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {Number(emp.total_hours).toFixed(1)}h
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{emp.tasks_completed}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                    {Number(emp.avg_hours_per_report).toFixed(1)}h
                  </TableCell>
                </TableRow>

                {/* Expanded task details */}
                {isExpanded && details.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="bg-muted/20 py-4">
                      <div className="space-y-3">
                        <p className="text-sm font-medium">
                          Task Details ({details.length} items)
                        </p>
                        <div className="overflow-x-auto rounded-md border border-border/40">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/30">
                                <TableHead className="text-xs">Date</TableHead>
                                <TableHead className="text-xs">Task</TableHead>
                                <TableHead className="text-xs">Status</TableHead>
                                <TableHead className="text-xs text-right">Hours</TableHead>
                                <TableHead className="text-xs">Description</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {details.slice(0, 20).map((d, i) => (
                                <TableRow key={i}>
                                  <TableCell className="text-xs whitespace-nowrap">{d.report_date}</TableCell>
                                  <TableCell className="text-xs">{d.task_title}</TableCell>
                                  <TableCell className="text-xs">
                                    <span className={cn(
                                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                                      TASK_STATUS_STYLES[d.task_status] || "bg-muted text-muted-foreground"
                                    )}>
                                      {d.task_status}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-xs text-right tabular-nums">
                                    {Number(d.hours_worked).toFixed(2)}h
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate" title={d.description || ""}>
                                    {d.description || "—"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        {details.length > 20 && (
                          <p className="text-xs text-muted-foreground">
                            Showing 20 of {details.length} items.
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {isExpanded && details.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="bg-muted/20 py-6 text-center text-sm text-muted-foreground">
                      No task details for this employee.
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
