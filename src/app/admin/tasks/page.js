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
import { Plus, ListChecks } from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import { toast } from "react-hot-toast";
import { CheckCircle, Clock, Loader, List } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

// Stats Card Component for Task Metrics
function StatsCard({ title, value, icon }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
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
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
  });
  const [filters, setFilters] = useState({
    status: "active",
    priority: "",
    search: "",
    assignee_id: "", // Added assignee_id to filters
    client_id: "", // Optional client filter for admin/employee
  });
  const [sort, setSort] = useState({ field: "created_at", order: "desc" });
  const [isAssignSheetOpen, setIsAssignSheetOpen] = useState(false);

  const clients = useMemo(() => {
    if (!user?.accessibleClients) return [];
    return user.accessibleClients.map((c) => ({ id: c.id, company_name: c.name }));
  }, [user]);

  const lockedClientId = isClient ? activeClient?.id ?? null : null;

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        sortField: sort.field,
        sortOrder: sort.order,
        ...filters,
      });
      const response = await fetch(`/api/v1/tasks?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch tasks");
      const data = await response.json();
      setTasks(data.tasks || []);
      setPagination((prev) => ({ ...prev, total: data.total || 0 }));
    } catch (err) {
      setError(err.message);
      toast.error("Could not fetch tasks.");
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, sort.field, sort.order, filters]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Admins/employees see staff for assignment; client roles see their client's users
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
    setPagination((prev) => ({ ...prev, page: 1 }));
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
    } catch (err) {
      toast.error(err.message);
    }
  };

  const summaryCards = useMemo(() => {
    const totalTasks = pagination.total;
    return [{ title: "Total Tasks", value: totalTasks, icon: ListChecks }];
  }, [pagination.total]);

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <AdminPageHeader
        title="Tasks Management"
        description="Manage all your company tasks and track payments."
        {...(canCreate && {
          actionLabel: "Create New Task",
          actionIcon: <Plus className="mr-2 h-4 w-4" />,
          onAction: () => setIsAssignSheetOpen(true),
        })}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Tasks"
          value={stats.total}
          icon={<List className="h-4 w-4 text-muted-foreground" />}
        />
        <StatsCard
          title="To Do"
          value={stats.todo}
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
        />
        <StatsCard
          title="In Progress"
          value={stats.inProgress}
          icon={<Loader className="h-4 w-4 text-muted-foreground" />}
        />
        <StatsCard
          title="Completed"
          value={stats.done}
          icon={<CheckCircle className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      <Card>
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
            currentFilters={filters} // Pass all current filters
          />
          <TaskList
            tasks={tasks}
            users={assignableUsers}
            isLoading={isLoading}
            error={error}
            pagination={pagination}
            setPagination={setPagination}
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
