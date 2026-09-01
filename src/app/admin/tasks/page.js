"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import TaskFilters from "@/components/tasks/TaskFilters.js";
import TaskList from "@/components/tasks/TaskList";
import AssignTaskSheet from "@/components/tasks/AssignTaskSheet.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Plus, ListChecks, CheckCircle2, Clock, Loader2, List, TrendingUp } from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import { toast } from "react-hot-toast";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

// Stats Card Component for Task Metrics
function StatsCard({ title, value, subtitle, icon: Icon, accent }) {
  return (
    <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", accent)}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function TasksPage() {
  const { isAdmin, isEmployee, isClientOwner, isManager, isEditor, isViewer, user, activeClient, isClient } = useAuth();
  const canCreate = isAdmin || isEmployee || isClientOwner || isManager || isEditor;
  const isReadOnly = isViewer;
  const [tasks, setTasks] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    todo: 0,
    inProgress: 0,
    done: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const limit = 10;
  const [filters, setFilters] = useState({
    status: "active",
    priority: "",
    search: "",
    assignee_id: "",
    client_id: "",
  });
  const [sort, setSort] = useState({ field: "created_at", order: "desc" });
  const [isAssignSheetOpen, setIsAssignSheetOpen] = useState(false);

  const clients = useMemo(() => {
    if (!user?.accessibleClients) return [];
    return user.accessibleClients.map((c) => ({ id: c.id, company_name: c.name }));
  }, [user]);

  const lockedClientId = isClient ? activeClient?.id ?? null : null;

  // Fetch first page (replaces tasks) — used on initial load, filter/sort change
  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setPage(1);
    setHasMore(true);
    try {
      const params = new URLSearchParams({
        page: 1,
        limit,
        sortField: sort.field,
        sortOrder: sort.order,
        ...filters,
      });
      const response = await fetch(`/api/v1/tasks?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch tasks");
      const data = await response.json();
      const newTasks = data.tasks || [];
      setTasks(newTasks);
      setHasMore(newTasks.length < (data.total || 0));
    } catch (err) {
      setError(err.message);
      toast.error("Could not fetch tasks.");
    } finally {
      setIsLoading(false);
    }
  }, [sort.field, sort.order, filters]);

  // Fetch next page (appends tasks) — used by infinite scroll
  const loadMore = useCallback(async () => {
    if (isLoadingMore || isLoading || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const params = new URLSearchParams({
        page: nextPage,
        limit,
        sortField: sort.field,
        sortOrder: sort.order,
        ...filters,
      });
      const response = await fetch(`/api/v1/tasks?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch tasks");
      const data = await response.json();
      const newTasks = data.tasks || [];
      setTasks((prev) => [...prev, ...newTasks]);
      setPage(nextPage);
      setHasMore(newTasks.length > 0 && nextPage * limit < (data.total || 0));
    } catch (err) {
      toast.error("Could not load more tasks.");
    } finally {
      setIsLoadingMore(false);
    }
  }, [page, isLoadingMore, isLoading, hasMore, sort.field, sort.order, filters]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const usersUrl =
          isAdmin || isEmployee
            ? "/api/v1/users?role=employee&role=admin"
            : "/api/v1/users";
        const usersResponse = await fetch(usersUrl);
        const usersData = await usersResponse.json();
        if (usersData.users) setAssignableUsers(usersData.users);
        const statsResponse = await fetch("/api/v1/tasks/stats");
        const statsData = await statsResponse.json();
        if (statsData && typeof statsData.total !== 'undefined') {
          setStats(statsData);
        }
      } catch (err) {
        console.error("Failed to fetch initial data for form dropdowns", err);
        toast.error("Could not load data for creating tasks.");
      }
    };
    fetchInitialData();
  }, [isAdmin, isEmployee]);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  const handleSort = (field) => {
    const newOrder =
      sort.field === field && sort.order === "asc" ? "desc" : "asc";
    setSort({ field, order: newOrder });
  };

  const handleTaskCreated = async (newTaskData) => {
    try {
      const response = await fetch("/api/v1/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTaskData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create task");
      }
      toast.success("Task created successfully.");
      setIsAssignSheetOpen(false);
      fetchTasks();
      // Refresh stats
      const statsResponse = await fetch("/api/v1/tasks/stats");
      const statsData = await statsResponse.json();
      if (statsData && typeof statsData.total !== 'undefined') {
        setStats(statsData);
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleTaskUpdate = async (taskId, updatedFields) => {
    try {
      const response = await fetch(`/api/v1/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedFields),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update task");
      }
      toast.success("Task updated successfully.");
      fetchTasks();
      // Refresh stats
      const statsResponse = await fetch("/api/v1/tasks/stats");
      const statsData = await statsResponse.json();
      if (statsData && typeof statsData.total !== 'undefined') {
        setStats(statsData);
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleTaskDelete = async (taskId) => {
    try {
      const response = await fetch(`/api/v1/tasks/${taskId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete task");
      }
      toast.success("Task deleted successfully.");
      fetchTasks();
      // Refresh stats
      const statsResponse = await fetch("/api/v1/tasks/stats");
      const statsData = await statsResponse.json();
      if (statsData && typeof statsData.total !== 'undefined') {
        setStats(statsData);
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const completionRate = stats.total > 0
    ? Math.round((stats.done / stats.total) * 100)
    : 0;

  return (
    <div className="flex-1 space-y-4">
      <AdminPageHeader
        title="Tasks Management"
        description="Manage all your company tasks and track progress."
        {...(canCreate && {
          actionLabel: "Create New Task",
          actionIcon: <Plus className="mr-2 h-4 w-4" />,
          onAction: () => setIsAssignSheetOpen(true),
        })}
      />

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Tasks"
          value={stats.total}
          subtitle="All tasks"
          icon={List}
          accent="text-blue-500 bg-blue-500/10"
        />
        <StatsCard
          title="To Do"
          value={stats.todo}
          subtitle="Not started yet"
          icon={Clock}
          accent="text-orange-500 bg-orange-500/10"
        />
        <StatsCard
          title="In Progress"
          value={stats.inProgress}
          subtitle="Currently being worked on"
          icon={Loader2}
          accent="text-yellow-500 bg-yellow-500/10"
        />
        <StatsCard
          title="Completed"
          value={stats.done}
          subtitle={`${completionRate}% completion rate`}
          icon={CheckCircle2}
          accent="text-green-500 bg-green-500/10"
        />
      </div>

      {/* Completion Progress Bar */}
      {stats.total > 0 && (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Task Completion Rate</span>
              </div>
              <span className="text-2xl font-bold tabular-nums">{completionRate}%</span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: `${completionRate}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{stats.done} completed</span>
              <span>{stats.total - stats.done} remaining</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle>Tasks List</CardTitle>
          <CardDescription>
            Filter, sort, and manage all assigned tasks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <TaskFilters
            onFilterChange={handleFilterChange}
            assignableUsers={assignableUsers}
            clients={clients}
            showClientFilter={isAdmin || isEmployee}
            currentFilters={filters}
          />
          <TaskList
            tasks={tasks}
            users={assignableUsers}
            isLoading={isLoading}
            isLoadingMore={isLoadingMore}
            error={error}
            hasMore={hasMore}
            onLoadMore={loadMore}
            onUpdateTask={handleTaskUpdate}
            onTaskDelete={handleTaskDelete}
            sort={sort}
            handleSort={handleSort}
            userRole={user?.role}
            isReadOnly={isReadOnly}
            currentUser={user}
          />
        </CardContent>
      </Card>

      <AssignTaskSheet
        isOpen={isAssignSheetOpen}
        onOpenChange={setIsAssignSheetOpen}
        onTaskCreated={handleTaskCreated}
        users={assignableUsers}
        clients={clients}
        currentUser={user}
        lockedClientId={lockedClientId}
      />
    </div>
  );
}
