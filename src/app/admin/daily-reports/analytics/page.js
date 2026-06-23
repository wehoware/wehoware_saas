"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import DailyReportAnalyticsFilters from "@/components/daily-reports/DailyReportAnalyticsFilters";
import DailyReportAnalyticsSummary from "@/components/daily-reports/DailyReportAnalyticsSummary";
import DailyReportAnalyticsTable from "@/components/daily-reports/DailyReportAnalyticsTable";

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Daily Report Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Review employee work reports with detailed breakdowns and trends.
          </p>
        </div>
      </div>

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
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <DailyReportAnalyticsSummary
        summary={data?.summary}
        isLoading={loading}
      />

      {/* Trend Table */}
      {data?.trend && data.trend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Hours Trend ({filters.granularity || "daily"})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Reports</TableHead>
                    <TableHead className="text-right">Submitted</TableHead>
                    <TableHead className="text-right">Drafts</TableHead>
                    <TableHead className="text-right">Total Hours</TableHead>
                    <TableHead className="text-right">Tasks Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.trend.map((t) => (
                    <TableRow key={t.period}>
                      <TableCell className="font-medium">{t.period}</TableCell>
                      <TableCell className="text-right">{t.reports}</TableCell>
                      <TableCell className="text-right">{t.submitted}</TableCell>
                      <TableCell className="text-right">{t.drafts}</TableCell>
                      <TableCell className="text-right">
                        {Number(t.total_hours).toFixed(1)}h
                      </TableCell>
                      <TableCell className="text-right">
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

      {/* Per-Employee Table */}
      <Card>
        <CardHeader>
          <CardTitle>Per-Employee Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <DailyReportAnalyticsTable
            perEmployee={data?.per_employee}
            taskDetails={data?.task_details}
            isLoading={loading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
