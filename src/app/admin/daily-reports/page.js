"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";
import DailyReportList from "@/components/daily-reports/DailyReportList";
import DailyReportFilters from "@/components/daily-reports/DailyReportFilters";

export default function DailyReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({});
  const [employees, setEmployees] = useState([]);

  async function fetchReports(currentPage = 1, currentFilters = filters) {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("page", String(currentPage));
      qs.set("limit", "10");
      if (currentFilters.start_date) qs.set("start_date", currentFilters.start_date);
      if (currentFilters.end_date) qs.set("end_date", currentFilters.end_date);
      if (currentFilters.status) qs.set("status", currentFilters.status);
      if (currentFilters.user_id) qs.set("user_id", currentFilters.user_id);

      const res = await fetch(`/api/v1/daily-reports?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch reports");
      setReports(data.reports || []);
      setTotal(data.total || 0);
      setPage(data.page || 1);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        qs.set("page", "1");
        qs.set("limit", "10");
        if (filters.start_date) qs.set("start_date", filters.start_date);
        if (filters.end_date) qs.set("end_date", filters.end_date);
        if (filters.status) qs.set("status", filters.status);
        if (filters.user_id) qs.set("user_id", filters.user_id);
        const res = await fetch(`/api/v1/daily-reports?${qs.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to fetch reports");
        if (!cancelled) {
          setReports(data.reports || []);
          setTotal(data.total || 0);
          setPage(data.page || 1);
        }
      } catch (err) {
        if (!cancelled) toast.error(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [filters]);

  useEffect(() => {
    async function loadEmployees() {
      try {
        const res = await fetch("/api/v1/daily-reports/analytics/employees");
        const data = await res.json();
        if (res.ok) setEmployees(data.employees || []);
      } catch {
        // ignore — employee filter is optional
      }
    }
    loadEmployees();
  }, []);

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this report?")) return;
    try {
      const res = await fetch(`/api/v1/daily-reports/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      toast.success("Report deleted");
      fetchReports(page, filters);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSubmit = async (id) => {
    try {
      const res = await fetch(`/api/v1/daily-reports/${id}/submit`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      toast.success("Report submitted");
      fetchReports(page, filters);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleUnsubmit = async (id) => {
    try {
      const res = await fetch(`/api/v1/daily-reports/${id}/unsubmit`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to unsubmit");
      toast.success("Report unsubmitted");
      fetchReports(page, filters);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const totalPages = Math.ceil(total / 10);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Daily Work Reports</h1>
        <Button asChild>
          <Link href="/admin/daily-reports/new">New Report</Link>
        </Button>
      </div>

      <DailyReportFilters
        filters={filters}
        employees={employees}
        onChange={setFilters}
        onApply={(f) => { setFilters(f); fetchReports(1, f); }}
        onClear={() => { setFilters({}); fetchReports(1, {}); }}
      />

      <DailyReportList
        reports={reports}
        loading={loading}
        onDelete={handleDelete}
        onSubmit={handleSubmit}
        onUnsubmit={handleUnsubmit}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => fetchReports(page - 1, filters)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => fetchReports(page + 1, filters)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
