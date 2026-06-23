"use client";

import { useState, useMemo, Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronUp, ArrowUpDown } from "lucide-react";

const SORT_COLUMNS = [
  { key: "label", label: "Employee" },
  { key: "reports_count", label: "Reports" },
  { key: "submitted_count", label: "Submitted" },
  { key: "draft_count", label: "Drafts" },
  { key: "total_hours", label: "Hours" },
  { key: "tasks_completed", label: "Tasks" },
  { key: "avg_hours_per_report", label: "Avg H/R" },
];

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
    if (sortKey !== key) return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3" />
    ) : (
      <ChevronDown className="h-3 w-3" />
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 animate-pulse bg-muted rounded-lg" />
        ))}
      </div>
    );
  }

  if (!sorted || sorted.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        No employee data for the selected filters.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {SORT_COLUMNS.map((col) => (
                <TableHead
                  key={col.key}
                  className={col.key === "label" ? "" : "text-right"}
                >
                  <button
                    className="flex items-center gap-1 hover:underline"
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
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() =>
                      setExpandedRow(isExpanded ? null : emp.user_id)
                    }
                  >
                    <TableCell className="font-medium">{emp.label}</TableCell>
                    <TableCell className="text-right">{emp.reports_count}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="default">{emp.submitted_count}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{emp.draft_count}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(emp.total_hours).toFixed(1)}h
                    </TableCell>
                    <TableCell className="text-right">
                      {emp.tasks_completed}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(emp.avg_hours_per_report).toFixed(1)}h
                    </TableCell>
                  </TableRow>
                  {isExpanded && details.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-muted/30 p-4">
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">
                            Task Details ({details.length} items)
                          </h4>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
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
                                    <TableCell className="text-xs">{d.report_date}</TableCell>
                                    <TableCell className="text-xs">{d.task_title}</TableCell>
                                    <TableCell className="text-xs">
                                      <Badge variant="outline">{d.task_status}</Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-right">
                                      {Number(d.hours_worked).toFixed(2)}h
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
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
                      <TableCell colSpan={7} className="bg-muted/30 p-4 text-sm text-muted-foreground">
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
    </div>
  );
}
