"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "react-hot-toast";
import { useAuth } from "@/contexts/auth-context";
import { format, subDays } from "date-fns";
import {
  Download,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle,
  ArrowLeft,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Users,
  Timer,
} from "lucide-react";
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
const STATUS_BADGE_VARIANT = { "To Do": "secondary", "In Progress": "default", Done: "outline", Backlog: "secondary" };

function SortIcon({ sortKey, currentSort, currentDir }) {
  if (sortKey !== currentSort) return <ArrowUpDown className="h-3 w-3 opacity-50" />;
  return currentDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

const INITIAL_FILTERS = {
  date_from: format(subDays(new Date(), 30), "yyyy-MM-dd"),
  date_to: format(new Date(), "yyyy-MM-dd"),
  user_id: "",
  status: "",
  priority: "",
  granularity: "weekly",
};

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
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [employees, setEmployees] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [teamPerf, setTeamPerf] = useState(null);
  const [overdue, setOverdue] = useState(null);
  const [history, setHistory] = useState(null);
  const [cycleTime, setCycleTime] = useState(null);
  const [taskList, setTaskList] = useState(null);
  const [timeSummary, setTimeSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Task list pagination/sorting state
  const [taskPage, setTaskPage] = useState(1);
  const [taskSortBy, setTaskSortBy] = useState("created_at");
  const [taskSortDir, setTaskSortDir] = useState("desc");
  const [taskSearch, setTaskSearch] = useState("");

  const buildParams = useCallback(
    (extra = {}) => {
      const params = new URLSearchParams();
      if (filters.date_from) params.set("date_from", filters.date_from);
      if (filters.date_to) params.set("date_to", filters.date_to);
      if (filters.user_id) params.set("user_id", filters.user_id);
      if (filters.status) params.set("status", filters.status);
      if (filters.priority) params.set("priority", filters.priority);
      Object.entries(extra).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });
      return params;
    },
    [filters]
  );

  // Load employees list
  useEffect(() => {
    async function loadEmployees() {
      try {
        const res = await fetch("/api/v1/reports/employees");
        const json = await res.json();
        if (res.ok) setEmployees(json.employees || []);
      } catch {
        // ignore
      }
    }
    loadEmployees();
  }, []);

  // Fetch all summary data
  const fetchSummary = useCallback(async () => {
    setIsLoading(true);
    const params = buildParams({ granularity: filters.granularity });

    try {
      const [dashRes, teamRes, overdueRes, histRes, cycleRes, timeRes] =
        await Promise.all([
          fetch(`/api/v1/reports/dashboard?${params}`),
          fetch(`/api/v1/reports/team-performance?${params}`),
          fetch(`/api/v1/reports/overdue-tasks?${params}`),
          fetch(`/api/v1/reports/completion-history?${params}`),
          fetch(`/api/v1/reports/cycle-time?${params}`),
          fetch(`/api/v1/reports/time-summary?${params}`),
        ]);

      if (dashRes.ok) setDashboard(await dashRes.json());
      if (teamRes.ok) setTeamPerf(await teamRes.json());
      if (overdueRes.ok) setOverdue(await overdueRes.json());
      if (histRes.ok) setHistory(await histRes.json());
      if (cycleRes.ok) setCycleTime(await cycleRes.json());
      if (timeRes.ok) setTimeSummary(await timeRes.json());
    } catch {
      toast.error("Failed to load reports");
    } finally {
      setIsLoading(false);
    }
  }, [buildParams, filters.granularity]);

  // Fetch task list (separate due to pagination/sorting)
  const fetchTaskList = useCallback(async () => {
    const params = buildParams({
      sort_by: taskSortBy,
      sort_dir: taskSortDir,
      page: String(taskPage),
      page_size: "15",
      search: taskSearch,
    });

    try {
      const res = await fetch(`/api/v1/reports/task-list?${params}`);
      if (res.ok) setTaskList(await res.json());
    } catch {
      // ignore
    }
  }, [buildParams, taskSortBy, taskSortDir, taskPage, taskSearch]);

  useEffect(() => {
    if (activeClient?.id) fetchSummary();
  }, [activeClient?.id, fetchSummary]);

  useEffect(() => {
    if (activeClient?.id) fetchTaskList();
  }, [activeClient?.id, fetchTaskList]);

  const handleApply = () => {
    setTaskPage(1);
    fetchSummary();
    fetchTaskList();
  };

  const handleClear = () => {
    setFilters(INITIAL_FILTERS);
    setTaskPage(1);
    setTaskSearch("");
  };

  const handleTaskSort = (column) => {
    if (taskSortBy === column) {
      setTaskSortDir(taskSortDir === "asc" ? "desc" : "asc");
    } else {
      setTaskSortBy(column);
      setTaskSortDir("desc");
    }
    setTaskPage(1);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = buildParams({ format: "csv" });
      const res = await fetch(`/api/v1/reports/export?${params}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tasks-export-${filters.date_from}-to-${filters.date_to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleTeamExport = () => {
    if (!teamPerf?.team?.length) return;
    const headers = ["Member", "Assigned", "Completed", "Rate", "Hours Logged", "Overdue"];
    const rows = teamPerf.team.map((m) => [
      `${m.first_name || ""} ${m.last_name || ""}`.trim(),
      m.tasks_assigned,
      m.tasks_completed,
      `${m.completion_rate?.toFixed(0) ?? 0}%`,
      Number(m.hours_logged ?? 0).toFixed(1),
      m.overdue_tasks,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `team-performance-${filters.date_from}-to-${filters.date_to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Team performance exported");
  };

  const byStatusData = useMemo(
    () =>
      dashboard
        ? Object.entries(dashboard.by_status).map(([name, value]) => ({ name, value }))
        : [],
    [dashboard]
  );

  const byPriorityData = useMemo(
    () =>
      dashboard
        ? Object.entries(dashboard.by_priority).map(([name, value]) => ({ name, value }))
        : [],
    [dashboard]
  );

  const historyData = useMemo(
    () =>
      history?.history?.map((h) => ({
        period: h.period,
        Completed: h.completed_count,
      })) ?? [],
    [history]
  );

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <AdminPageHeader
        backLink="/admin/tasks"
        backIcon={<ArrowLeft className="h-4 w-4" />}
        title="Task Reports"
        description="Comprehensive analytics and team performance metrics."
      />

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                value={filters.date_from}
                onChange={(e) =>
                  setFilters({ ...filters, date_from: e.target.value })
                }
                className="w-36"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                value={filters.date_to}
                onChange={(e) =>
                  setFilters({ ...filters, date_to: e.target.value })
                }
                className="w-36"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Employee</Label>
              <Select
                value={filters.user_id || "all"}
                onValueChange={(v) =>
                  setFilters({ ...filters, user_id: v === "all" ? "" : v })
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {(employees || []).map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Status</Label>
              <Select
                value={filters.status || "all"}
                onValueChange={(v) =>
                  setFilters({ ...filters, status: v === "all" ? "" : v })
                }
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="To_Do">To Do</SelectItem>
                  <SelectItem value="In_Progress">In Progress</SelectItem>
                  <SelectItem value="Done">Done</SelectItem>
                  <SelectItem value="Backlog">Backlog</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Priority</Label>
              <Select
                value={filters.priority || "all"}
                onValueChange={(v) =>
                  setFilters({ ...filters, priority: v === "all" ? "" : v })
                }
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Granularity</Label>
              <Select
                value={filters.granularity}
                onValueChange={(v) =>
                  setFilters({ ...filters, granularity: v })
                }
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleApply} variant="outline" size="sm">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Apply
            </Button>
            <Button onClick={handleClear} variant="ghost" size="sm">
              Clear
            </Button>
            <Button
              onClick={handleExport}
              variant="outline"
              size="sm"
              disabled={exporting}
            >
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
          <CardTitle className="text-sm">Completion Trend ({filters.granularity})</CardTitle>
          <CardDescription>Tasks completed per period</CardDescription>
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
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team Performance
            </CardTitle>
            <CardDescription>Task completion by team member in the selected period</CardDescription>
          </div>
          {teamPerf?.team?.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleTeamExport}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32" />
          ) : !teamPerf?.team?.length ? (
            <p className="text-sm text-muted-foreground">No data for this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-left">Member</TableHead>
                    <TableHead className="text-right">Assigned</TableHead>
                    <TableHead className="text-right">Completed</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Hours Logged</TableHead>
                    <TableHead className="text-right">Overdue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamPerf.team.map((m) => (
                    <TableRow key={m.user_id}>
                      <TableCell className="font-medium">
                        {m.first_name} {m.last_name}
                      </TableCell>
                      <TableCell className="text-right">{m.tasks_assigned}</TableCell>
                      <TableCell className="text-right">{m.tasks_completed}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={m.completion_rate >= 70 ? "outline" : "secondary"}>
                          {m.completion_rate?.toFixed(0) ?? 0}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{Number(m.hours_logged ?? 0).toFixed(1)}h</TableCell>
                      <TableCell className="text-right">
                        {m.overdue_tasks > 0 ? (
                          <Badge variant="destructive">{m.overdue_tasks}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Overdue tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Overdue Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24" />
          ) : !overdue?.tasks?.length ? (
            <p className="text-sm text-muted-foreground">No overdue tasks.</p>
          ) : (
            <div className="space-y-2">
              {overdue.tasks.slice(0, 15).map((t) => (
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

      {/* Time Summary */}
      {timeSummary && timeSummary.summary?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Timer className="h-4 w-4" />
              Time Entry Summary
            </CardTitle>
            <CardDescription>
              Total: {timeSummary.grand_total_hours}h across {timeSummary.total_entries} entries
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-left">Member</TableHead>
                    <TableHead className="text-right">Total Hours</TableHead>
                    <TableHead className="text-right">Entries</TableHead>
                    <TableHead className="text-right">Tasks Tracked</TableHead>
                    <TableHead className="text-right">Avg / Entry</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeSummary.summary.map((emp) => (
                    <TableRow key={emp.user_id}>
                      <TableCell className="font-medium">{emp.label}</TableCell>
                      <TableCell className="text-right">{emp.total_hours}h</TableCell>
                      <TableCell className="text-right">{emp.entry_count}</TableCell>
                      <TableCell className="text-right">{emp.task_count}</TableCell>
                      <TableCell className="text-right">{emp.avg_hours_per_entry}h</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Task List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Task List</CardTitle>
          <CardDescription>Detailed task listing with filtering and sorting</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-2">
            <Input
              placeholder="Search tasks by title..."
              value={taskSearch}
              onChange={(e) => {
                setTaskSearch(e.target.value);
                setTaskPage(1);
              }}
              className="max-w-xs"
            />
          </div>

          {!taskList ? (
            <Skeleton className="h-48" />
          ) : !taskList.tasks?.length ? (
            <p className="text-sm text-muted-foreground">No tasks found matching the filters.</p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleTaskSort("title")}>
                        <span className="flex items-center gap-1">
                          Title
                          <SortIcon sortKey="title" currentSort={taskSortBy} currentDir={taskSortDir} />
                        </span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleTaskSort("status")}>
                        <span className="flex items-center gap-1">
                          Status
                          <SortIcon sortKey="status" currentSort={taskSortBy} currentDir={taskSortDir} />
                        </span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleTaskSort("priority")}>
                        <span className="flex items-center gap-1">
                          Priority
                          <SortIcon sortKey="priority" currentSort={taskSortBy} currentDir={taskSortDir} />
                        </span>
                      </TableHead>
                      <TableHead>Assignee</TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleTaskSort("due_date")}>
                        <span className="flex items-center gap-1">
                          Due Date
                          <SortIcon sortKey="due_date" currentSort={taskSortBy} currentDir={taskSortDir} />
                        </span>
                      </TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">Subtasks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {taskList.tasks.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium max-w-xs truncate">{t.title}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_BADGE_VARIANT[t.status] ?? "secondary"}>
                            {t.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {t.priority && (
                            <span className="flex items-center gap-1.5 text-sm">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: PRIORITY_COLORS[t.priority] ?? "#94a3b8" }}
                              />
                              {t.priority}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {t.assignee?.label ?? "Unassigned"}
                        </TableCell>
                        <TableCell className="text-sm">{t.due_date ?? "—"}</TableCell>
                        <TableCell className="text-right text-sm">
                          {Number(t.actual_hours ?? 0).toFixed(1)}
                          {t.estimated_hours !== null && (
                            <span className="text-muted-foreground">
                              {" "}/ {Number(t.estimated_hours).toFixed(1)}h
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {t.subtask_count > 0
                            ? `${t.subtask_completed}/${t.subtask_count}`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-muted-foreground">
                  {taskList.total} task{taskList.total !== 1 ? "s" : ""} • Page {taskList.page} of {taskList.total_pages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={taskPage <= 1}
                    onClick={() => setTaskPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={taskPage >= taskList.total_pages}
                    onClick={() => setTaskPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
