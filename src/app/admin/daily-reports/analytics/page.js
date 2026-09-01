"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import DailyReportAnalyticsFilters from "@/components/daily-reports/DailyReportAnalyticsFilters";
import DailyReportAnalyticsSummary from "@/components/daily-reports/DailyReportAnalyticsSummary";
import DailyReportAnalyticsTable from "@/components/daily-reports/DailyReportAnalyticsTable";
import AdminPageHeader from "@/components/AdminPageHeader";
import { ArrowLeft, TrendingUp, Users, BarChart3 } from "lucide-react";
import Link from "next/link";

const DEFAULT_FILTERS = {
  date_from: "",
  date_to: "",
  user_id: "",
  status: "",
  granularity: "daily",
};

function buildQuery(filters) {
  const params = new URLSearchParams();
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  if (filters.user_id) params.set("user_id", filters.user_id);
  if (filters.status) params.set("status", filters.status);
  if (filters.granularity) params.set("granularity", filters.granularity);
  return params.toString();
}

function downloadCSV(data, filename) {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers
      .map((h) => {
        const val = row[h];
        const str = val === null || val === undefined ? "" : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      })
      .join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// Simple inline bar chart for trend data
function TrendChart({ trend, granularity }) {
  if (!trend || trend.length === 0) return null;

  const maxHours = Math.max(...trend.map((t) => t.total_hours), 1);
  const maxReports = Math.max(...trend.map((t) => t.reports), 1);

  return (
    <div className="space-y-4">
      {/* Hours bar chart */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Total Hours</p>
        <div className="flex items-end gap-1 h-32">
          {trend.slice(-20).map((t) => {
            const heightPct = (t.total_hours / maxHours) * 100;
            return (
              <div
                key={t.period}
                className="flex-1 min-w-[20px] flex flex-col items-center gap-1 group relative"
              >
                <div className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                  {Number(t.total_hours).toFixed(1)}h
                </div>
                <div
                  className="w-full rounded-t bg-primary/80 group-hover:bg-primary transition-colors"
                  style={{ height: `${Math.max(heightPct, 2)}%` }}
                />
                <div className="text-[9px] text-muted-foreground truncate w-full text-center" title={t.period}>
                  {t.period.slice(5)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reports bar chart */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Reports</p>
        <div className="flex items-end gap-1 h-24">
          {trend.slice(-20).map((t) => {
            const heightPct = (t.reports / maxReports) * 100;
            return (
              <div
                key={t.period}
                className="flex-1 min-w-[20px] flex flex-col items-center gap-1 group relative"
              >
                <div className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                  {t.reports}
                </div>
                <div
                  className="w-full rounded-t bg-blue-500/60 group-hover:bg-blue-500 transition-colors"
                  style={{ height: `${Math.max(heightPct, 2)}%` }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function DailyReportAnalyticsPage() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [employees, setEmployees] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadEmployees() {
      try {
        const res = await fetch("/api/v1/daily-reports/analytics/employees");
        const json = await res.json();
        if (res.ok) setEmployees(json.employees || []);
      } catch {
        // ignore
      }
    }
    loadEmployees();
  }, []);

  const fetchAnalytics = useCallback(async (f) => {
    setLoading(true);
    setError(null);
    try {
      const qs = buildQuery(f);
      const res = await fetch(
        `/api/v1/daily-reports/analytics/summary${qs ? `?${qs}` : ""}`
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to load analytics");
        setData(null);
      } else {
        setData(json);
      }
    } catch {
      setError("Failed to load analytics");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics(appliedFilters);
  }, [appliedFilters, fetchAnalytics]);

  const handleApply = (f) => {
    setAppliedFilters(f);
  };

  const handleClear = () => {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
  };

  const handleExport = () => {
    if (!data?.per_employee) return;
    setExporting(true);
    try {
      const csvData = data.per_employee.map((emp) => ({
        Employee: emp.label,
        Email: emp.email,
        Reports: emp.reports_count,
        Submitted: emp.submitted_count,
        Drafts: emp.draft_count,
        Total_Hours: Number(emp.total_hours).toFixed(2),
        Tasks_Completed: emp.tasks_completed,
        Avg_Hours_Per_Report: Number(emp.avg_hours_per_report).toFixed(2),
      }));
      downloadCSV(csvData, `daily-report-analytics-${Date.now()}.csv`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex-1 space-y-4">
      <AdminPageHeader
        title="Daily Report Analytics"
        description="Review employee work reports with detailed breakdowns and trends."
        backLink="/admin/daily-reports"
        backIcon={<ArrowLeft className="h-4 w-4" />}
      />

      <DailyReportAnalyticsFilters
        filters={filters}
        employees={employees}
        onChange={setFilters}
        onApply={handleApply}
        onClear={handleClear}
        onExport={handleExport}
        exporting={exporting}
      />

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <BarChart3 className="h-4 w-4" />
              {error}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary stat cards */}
      <DailyReportAnalyticsSummary
        summary={data?.summary}
        isLoading={loading}
      />

      {/* Trend chart + table */}
      {data?.trend && data.trend.length > 0 && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Hours & Reports Trend
            </CardTitle>
            <CardDescription>
              {filters.granularity || "daily"} view — last 20 periods
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart trend={data.trend} granularity={filters.granularity} />

            {/* Trend table */}
            <div className="mt-6 overflow-x-auto rounded-md border border-border/40 scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs">Period</TableHead>
                    <TableHead className="text-xs text-right">Reports</TableHead>
                    <TableHead className="text-xs text-right">Submitted</TableHead>
                    <TableHead className="text-xs text-right">Drafts</TableHead>
                    <TableHead className="text-xs text-right">Total Hours</TableHead>
                    <TableHead className="text-xs text-right">Tasks Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.trend.map((t) => (
                    <TableRow key={t.period} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="font-medium text-sm">{t.period}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{t.reports}</TableCell>
                      <TableCell className="text-right text-sm">
                        <span className="inline-flex items-center rounded-full bg-green-500/10 text-green-600 px-2 py-0.5 text-xs font-medium tabular-nums">
                          {t.submitted}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        <span className="inline-flex items-center rounded-full bg-yellow-500/10 text-yellow-600 px-2 py-0.5 text-xs font-medium tabular-nums">
                          {t.drafts}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {Number(t.total_hours).toFixed(1)}h
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {t.tasks_completed}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-Employee table */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Per-Employee Breakdown
          </CardTitle>
          <CardDescription>
            Click any row to expand task details
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <DailyReportAnalyticsTable
              perEmployee={data?.per_employee}
              taskDetails={data?.task_details}
              isLoading={loading}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
