"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "react-hot-toast";
import DailyReportList from "@/components/daily-reports/DailyReportList";
import DailyReportFilters from "@/components/daily-reports/DailyReportFilters";
import AdminPageHeader from "@/components/AdminPageHeader";
import { useAuth } from "@/contexts/auth-context";
import { Plus, FileText, CheckCircle2, Clock, TrendingUp, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

function StatCard({ title, value, subtitle, icon: Icon, accent }) {
  return (
    <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", accent)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

export default function DailyReportsPage() {
  const { isAdmin, isClient } = useAuth();
  const canViewAnalytics = isAdmin || isClient;
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filters, setFilters] = useState({});
  const [employees, setEmployees] = useState([]);
  const [summary, setSummary] = useState(null);
  const sentinelRef = useRef(null);

  // Fetch summary stats (admin/client only)
  const fetchSummary = useCallback(async () => {
    if (!canViewAnalytics) return;
    try {
      const res = await fetch("/api/v1/daily-reports/analytics/summary?granularity=monthly");
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary || null);
      }
    } catch {
      // silent — stats are optional
    }
  }, [canViewAnalytics]);

  // Fetch first page
  const fetchReports = useCallback(async (currentFilters = filters) => {
    setLoading(true);
    setPage(1);
    setHasMore(true);
    try {
      const qs = new URLSearchParams();
      qs.set("page", "1");
      qs.set("limit", String(PAGE_SIZE));
      if (currentFilters.start_date) qs.set("start_date", currentFilters.start_date);
      if (currentFilters.end_date) qs.set("end_date", currentFilters.end_date);
      if (currentFilters.status) qs.set("status", currentFilters.status);
      if (currentFilters.user_id) qs.set("user_id", currentFilters.user_id);

      const res = await fetch(`/api/v1/daily-reports?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch reports");
      setReports(data.reports || []);
      setTotal(data.total || 0);
      setHasMore((data.reports?.length || 0) < (data.total || 0));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Load more (infinite scroll)
  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const qs = new URLSearchParams();
      qs.set("page", String(nextPage));
      qs.set("limit", String(PAGE_SIZE));
      if (filters.start_date) qs.set("start_date", filters.start_date);
      if (filters.end_date) qs.set("end_date", filters.end_date);
      if (filters.status) qs.set("status", filters.status);
      if (filters.user_id) qs.set("user_id", filters.user_id);

      const res = await fetch(`/api/v1/daily-reports?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch reports");
      const newReports = data.reports || [];
      setReports((prev) => [...prev, ...newReports]);
      setPage(nextPage);
      setHasMore(newReports.length > 0 && nextPage * PAGE_SIZE < (data.total || 0));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingMore(false);
    }
  }, [page, loadingMore, loading, hasMore, filters]);

  // Initial load
  useEffect(() => {
    fetchReports(filters);
    fetchSummary();
  }, [fetchReports, fetchSummary]);

  // Load employees for filter
  useEffect(() => {
    async function loadEmployees() {
      try {
        const res = await fetch("/api/v1/daily-reports/analytics/employees");
        const data = await res.json();
        if (res.ok) setEmployees(data.employees || []);
      } catch {
        // ignore
      }
    }
    loadEmployees();
  }, []);

  // Infinite scroll observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, hasMore, loadingMore, loading]);

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this report?")) return;
    try {
      const res = await fetch(`/api/v1/daily-reports/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      toast.success("Report deleted");
      fetchReports(filters);
      fetchSummary();
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
      fetchReports(filters);
      fetchSummary();
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
      fetchReports(filters);
      fetchSummary();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="flex-1 space-y-4">
      <AdminPageHeader
        title="Daily Work Reports"
        description="Track and manage daily work reports from your team."
        actionLabel="New Report"
        actionIcon={<Plus className="mr-2 h-4 w-4" />}
        onAction={() => window.location.href = "/admin/daily-reports/new"}
      />

      {/* Stat cards (admin/client only) */}
      {canViewAnalytics && summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Reports"
            value={summary.total_reports}
            subtitle="All time"
            icon={FileText}
            accent="text-blue-500 bg-blue-500/10"
          />
          <StatCard
            title="Submitted"
            value={summary.submitted_count}
            subtitle={`${summary.draft_count} drafts pending`}
            icon={CheckCircle2}
            accent="text-green-500 bg-green-500/10"
          />
          <StatCard
            title="Total Hours"
            value={summary.total_hours?.toFixed(1) || "0"}
            subtitle={`${summary.avg_hours_per_report?.toFixed(1) || "0"} avg per report`}
            icon={Clock}
            accent="text-orange-500 bg-orange-500/10"
          />
          <StatCard
            title="Tasks Completed"
            value={summary.tasks_completed}
            subtitle="Unique tasks worked on"
            icon={Target}
            accent="text-purple-500 bg-purple-500/10"
          />
        </div>
      )}

      {/* Filters */}
      <DailyReportFilters
        filters={filters}
        employees={employees}
        onChange={setFilters}
        onApply={(f) => { setFilters(f); fetchReports(f); }}
        onClear={() => { setFilters({}); fetchReports({}); }}
      />

      {/* Reports list */}
      <DailyReportList
        reports={reports}
        loading={loading}
        onDelete={handleDelete}
        onSubmit={handleSubmit}
        onUnsubmit={handleUnsubmit}
      />

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-1" />
      {loadingMore && (
        <div className="flex items-center justify-center py-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-foreground" />
            Loading more reports...
          </div>
        </div>
      )}
      {!hasMore && reports.length > 0 && !loadingMore && (
        <div className="text-center py-4 text-xs text-muted-foreground">
          You&apos;ve reached the end — {reports.length} of {total} reports loaded.
        </div>
      )}
    </div>
  );
}
