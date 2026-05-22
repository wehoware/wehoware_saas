"use client";

import React, { useState, useEffect, useCallback } from "react";
import AdminPageHeader from "@/components/AdminPageHeader";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "react-hot-toast";
import { useAuth } from "@/contexts/auth-context";
import { format, subDays } from "date-fns";
import { Download, RefreshCw, AlertTriangle, TrendingUp, Clock, CheckCircle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const PRIORITY_COLORS = { High: "#ef4444", Medium: "#f59e0b", Low: "#22c55e" };
const STATUS_COLORS = { "To Do": "#94a3b8", "In Progress": "#3b82f6", Done: "#22c55e", Backlog: "#8b5cf6" };

function MetricsCard({ title, value, sub, icon: Icon, color = "text-foreground" }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function TaskReportsPage() {
  const { activeClient } = useAuth();
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dashboard, setDashboard] = useState(null);
  const [teamPerf, setTeamPerf] = useState(null);
  const [overdue, setOverdue] = useState(null);
  const [history, setHistory] = useState(null);
  const [cycleTime, setCycleTime] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });

    try {
      const [dashRes, teamRes, overdueRes, histRes, cycleRes] = await Promise.all([
        fetch(`/api/v1/reports/dashboard?${params}`),
        fetch(`/api/v1/reports/team-performance?${params}`),
        fetch(`/api/v1/reports/overdue-tasks`),
        fetch(`/api/v1/reports/completion-history?${params}&granularity=weekly`),
        fetch(`/api/v1/reports/cycle-time?${params}`),
      ]);

      if (dashRes.ok) setDashboard(await dashRes.json());
      if (teamRes.ok) setTeamPerf(await teamRes.json());
      if (overdueRes.ok) setOverdue(await overdueRes.json());
      if (histRes.ok) setHistory(await histRes.json());
      if (cycleRes.ok) setCycleTime(await cycleRes.json());
    } catch (err) {
      toast.error("Failed to load reports");
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (activeClient?.id) fetchAll();
  }, [activeClient?.id, fetchAll]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ format: "csv", date_from: dateFrom, date_to: dateTo });
      const res = await fetch(`/api/v1/reports/export?${params}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tasks-export-${dateFrom}-to-${dateTo}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  };

  const byStatusData = dashboard
    ? Object.entries(dashboard.by_status).map(([name, value]) => ({ name, value }))
    : [];

  const byPriorityData = dashboard
    ? Object.entries(dashboard.by_priority).map(([name, value]) => ({ name, value }))
    : [];

  const historyData = history?.history?.map((h) => ({
    period: h.period,
    Completed: h.completed_count,
  })) ?? [];

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <AdminPageHeader
        title="Task Reports"
        description="Comprehensive analytics and team performance metrics."
      />

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
            </div>
            <Button onClick={fetchAll} variant="outline" size="sm">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Refresh
            </Button>
            <Button onClick={handleExport} variant="outline" size="sm" disabled={exporting}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {exporting ? "Exporting..." : "Export CSV"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary metrics */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : dashboard ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricsCard
            title="Total Tasks"
            value={dashboard.total_tasks}
            icon={TrendingUp}
          />
          <MetricsCard
            title="Completion Rate"
            value={`${dashboard.completion_rate?.toFixed(1) ?? 0}%`}
            sub={`${dashboard.by_status?.Done ?? 0} tasks done`}
            icon={CheckCircle}
            color={dashboard.completion_rate >= 70 ? "text-green-600" : "text-yellow-600"}
          />
          <MetricsCard
            title="Overdue Tasks"
            value={dashboard.overdue_count ?? 0}
            sub={`${dashboard.due_soon_count ?? 0} due soon`}
            icon={AlertTriangle}
            color={(dashboard.overdue_count ?? 0) > 0 ? "text-destructive" : "text-foreground"}
          />
          <MetricsCard
            title="Hours Tracked"
            value={`${Number(dashboard.total_hours_tracked ?? 0).toFixed(1)}h`}
            sub={dashboard.total_estimated_hours ? `of ${Number(dashboard.total_estimated_hours).toFixed(1)}h estimated` : undefined}
            icon={Clock}
          />
        </div>
      ) : null}

      {/* Charts row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* By Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tasks by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={byStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                    {byStatusData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* By Priority */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tasks by Priority</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={byPriorityData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Tasks">
                    {byPriorityData.map((entry) => (
                      <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name] ?? "#94a3b8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Completion history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Completion Trend (Weekly)</CardTitle>
          <CardDescription>Tasks completed per week</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={historyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="Completed" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Team performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Team Performance</CardTitle>
          <CardDescription>Task completion by team member in the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32" />
          ) : !teamPerf?.team?.length ? (
            <p className="text-sm text-muted-foreground">No data for this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="pb-2 text-left font-medium">Member</th>
                    <th className="pb-2 text-right font-medium">Assigned</th>
                    <th className="pb-2 text-right font-medium">Completed</th>
                    <th className="pb-2 text-right font-medium">Rate</th>
                    <th className="pb-2 text-right font-medium">Hours Logged</th>
                    <th className="pb-2 text-right font-medium">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {teamPerf.team.map((m) => (
                    <tr key={m.user_id} className="border-b last:border-b-0">
                      <td className="py-2">
                        {m.first_name} {m.last_name}
                      </td>
                      <td className="py-2 text-right">{m.tasks_assigned}</td>
                      <td className="py-2 text-right">{m.tasks_completed}</td>
                      <td className="py-2 text-right">
                        <Badge variant={m.completion_rate >= 70 ? "outline" : "secondary"}>
                          {m.completion_rate?.toFixed(0) ?? 0}%
                        </Badge>
                      </td>
                      <td className="py-2 text-right">{Number(m.hours_logged ?? 0).toFixed(1)}h</td>
                      <td className="py-2 text-right">
                        {m.overdue_tasks > 0 ? (
                          <Badge variant="destructive">{m.overdue_tasks}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Overdue tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Overdue Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24" />
          ) : !overdue?.tasks?.length ? (
            <p className="text-sm text-muted-foreground">No overdue tasks.</p>
          ) : (
            <div className="space-y-2">
              {overdue.tasks.slice(0, 10).map((t) => (
                <div key={t.id} className="flex items-center justify-between py-1.5 border-b last:border-b-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    {t.assignee && (
                      <p className="text-xs text-muted-foreground">
                        {t.assignee.first_name} {t.assignee.last_name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <Badge variant={t.priority === "High" ? "destructive" : "secondary"}>{t.priority}</Badge>
                    <span className="text-xs text-destructive whitespace-nowrap">{t.days_overdue}d overdue</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cycle time */}
      {cycleTime && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Cycle Time Analysis</CardTitle>
            <CardDescription>Average time from task creation to completion</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{cycleTime.avg_cycle_days?.toFixed(1) ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Avg days</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{cycleTime.median_cycle_days?.toFixed(1) ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Median days</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{cycleTime.sample_size ?? 0}</p>
                <p className="text-xs text-muted-foreground">Tasks analyzed</p>
              </div>
            </div>
            {cycleTime.by_priority && (
              <div className="space-y-1">
                {Object.entries(cycleTime.by_priority).map(([priority, data]) => (
                  <div key={priority} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: PRIORITY_COLORS[priority] ?? "#94a3b8" }}
                      />
                      {priority}
                    </span>
                    <span>
                      {data.avg_days?.toFixed(1)} days avg
                      <span className="text-muted-foreground ml-2">({data.count} tasks)</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
