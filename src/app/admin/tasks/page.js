"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import TaskFilters from "@/components/tasks/TaskFilters.js";
import TaskList from "@/components/tasks/TaskList.js";
import AssignTaskSheet from "@/components/tasks/AssignTaskSheet.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Plus,
  ListChecks,
  ClipboardList,
  Activity,
  CheckCircle2,
  ArrowUpDown,
} from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";

const MOCK_TASKS = [
  {
    id: "task-001",
    title: "Review Website Content",
    clientName: "Acme Corp",
    assignees: [{ name: "Alice" }],
    dueDate: "2025-05-10",
    status: "In Progress",
    priority: "High",
  },
  {
    id: "task-002",
    title: "Prepare Marketing Report",
    clientName: "Beta Solutions",
    assignees: [{ name: "Bob" }],
    dueDate: "2025-05-15",
    status: "To Do",
    priority: "Medium",
  },
  {
    id: "task-003",
    title: "Update SEO Keywords",
    clientName: "Gamma Inc.",
    assignees: [{ name: "Alice" }, { name: "Charlie (Admin)" }],
    dueDate: "2025-05-20",
    status: "Done",
    priority: "Low",
  },
  {
    id: "task-004",
    title: "Client Onboarding Call",
    clientName: "Delta LLC",
    assignees: [],
    dueDate: null,
    status: "To Do",
    priority: "Medium",
  },
];

// Mock list of potential assignees (replace with actual user fetch)
const MOCK_USERS = [
  { id: "user-1", name: "Alice" },
  { id: "user-2", name: "Bob" },
  { id: "user-3", name: "Charlie (Admin)" },
  { id: "user-4", name: "David" },
  { id: "unassigned", name: "Unassigned" }, // Option for unassigning
];

export default function TasksPage() {
  const [tasks, setTasks] = useState(MOCK_TASKS);
  const [filteredTasks, setFilteredTasks] = useState(MOCK_TASKS);
  const [isAssignSheetOpen, setIsAssignSheetOpen] = useState(false);
  const [sortField, setSortField] = useState("dueDate"); // Default sort: 'title', 'clientName', 'dueDate', 'status', 'priority'
  const [sortOrder, setSortOrder] = useState("asc"); // 'asc', 'desc'

  // Apply filters and sorting
  useEffect(() => {
    let processedTasks = [...tasks];
    // Sorting logic (will be applied after filtering)
    if (sortField) {
      processedTasks.sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];

        let comparison = 0;
        if (valA > valB) {
          comparison = 1;
        } else if (valA < valB) {
          comparison = -1;
        }
        return sortOrder === "desc" ? comparison * -1 : comparison;
      });
    }
    // The filtering logic is now part of handleFilterChange, which updates filteredTasks directly.
    // For this initial redesign, we'll let handleFilterChange manage filteredTasks based on its internal logic.
    // If we lift search/filter state to this page, this useEffect would combine filtering and sorting.
    // For now, we assume filteredTasks is updated by handleFilterChange and then we sort it here if needed.
    // This might need refinement if handleFilterChange doesn't re-trigger this effect appropriately.
    setFilteredTasks((prevFilteredTasks) => {
      // Re-sort the currently filtered tasks
      const tasksToSort = [...prevFilteredTasks];
      if (sortField) {
        tasksToSort.sort((a, b) => {
          const valA = a[sortField];
          const valB = b[sortField];
          let comparison = 0;
          if (valA === null || valA === undefined)
            comparison = 1; // nulls/undefined last
          else if (valB === null || valB === undefined) comparison = -1;
          else if (valA > valB) comparison = 1;
          else if (valA < valB) comparison = -1;
          return sortOrder === "desc" ? comparison * -1 : comparison;
        });
      }
      return tasksToSort;
    });
  }, [tasks, sortField, sortOrder]); // Removed filteredTasks from dependency to avoid loop, will rely on handleFilterChange to set it first

  const handleFilterChange = (filters) => {
    console.log("Applying filters:", filters);
    let tempTasks = [...tasks];

    if (filters.search) {
      tempTasks = tempTasks.filter(
        (task) =>
          task.title.toLowerCase().includes(filters.search.toLowerCase()) ||
          task.id.toLowerCase().includes(filters.search.toLowerCase())
        // Add description search if available: || task.description?.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    if (filters.status) {
      tempTasks = tempTasks.filter((task) => task.status === filters.status);
    }

    if (filters.priority) {
      tempTasks = tempTasks.filter(
        (task) => task.priority === filters.priority
      );
    }

    // Apply sorting to the newly filtered tasks
    if (sortField) {
      tempTasks.sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];
        let comparison = 0;
        if (valA === null || valA === undefined) comparison = 1;
        else if (valB === null || valB === undefined) comparison = -1;
        else if (valA > valB) comparison = 1;
        else if (valA < valB) comparison = -1;
        return sortOrder === "desc" ? comparison * -1 : comparison;
      });
    }
    setFilteredTasks(tempTasks);
  };

  const handleTaskAssigned = (newTask) => {
    console.log("New task assigned (UI only):", newTask);
    const newTaskWithId = { ...newTask, id: `task-${Date.now()}` };
    setTasks([newTaskWithId, ...tasks]);
    setIsAssignSheetOpen(false);
  };

  // Handle inline updates from TaskList dropdowns
  const handleTaskUpdate = (taskId, updatedFields) => {
    console.log(`Updating task ${taskId} with:`, updatedFields);
    setTasks((currentTasks) =>
      currentTasks.map((task) => {
        if (task.id === taskId) {
          // Special handling for assignee update if needed (e.g., assigning single)
          if (updatedFields.assigneeId) {
            const assignee = MOCK_USERS.find(
              (u) => u.id === updatedFields.assigneeId
            );
            // Replace assignees array with the selected one (simplified)
            // In a real app, handle multi-assignee logic if required
            return {
              ...task,
              assignees:
                assignee && assignee.id !== "unassigned" ? [assignee] : [],
            };
          }
          // Merge other updates directly
          return { ...task, ...updatedFields };
        }
        return task;
      })
    );
    // Note: In a real app, you'd call an API endpoint here to save the changes
    // and likely update the state based on the API response or refetch.
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Calculate summary data
  const summaryData = useMemo(() => {
    const totalTasks = tasks.length;
    const toDo = tasks.filter((task) => task.status === "To Do").length;
    const inProgress = tasks.filter(
      (task) => task.status === "In Progress"
    ).length;
    const done = tasks.filter((task) => task.status === "Done").length;
    return { totalTasks, toDo, inProgress, done };
  }, [tasks]);

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 space-y-6">
      <AdminPageHeader
        title="Task Management"
        description="Oversee, assign, and track all team tasks."
        actionLabel="Assign New Task"
        actionIcon={<Plus className="mr-2 h-4 w-4" />}
        onAction={() => setIsAssignSheetOpen(true)}
      />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <ListChecks className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryData.totalTasks}</div>
            {/* <p className="text-xs text-muted-foreground">+2 from last month</p> */}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">To Do</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryData.toDo}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryData.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryData.done}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Card for Filters and Task List */}
      <Card>
        <CardHeader>
          <CardTitle>Tasks List</CardTitle>
          <CardDescription>
            Filter, sort, and manage all assigned tasks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <TaskFilters onFilterChange={handleFilterChange} />
          <TaskList
            tasks={filteredTasks}
            users={MOCK_USERS}
            onTaskUpdate={handleTaskUpdate}
            sortField={sortField}
            sortOrder={sortOrder}
            handleSort={handleSort} // Pass handleSort for clickable headers in TaskList
          />
        </CardContent>
      </Card>

      <AssignTaskSheet
        isOpen={isAssignSheetOpen}
        onOpenChange={setIsAssignSheetOpen}
        onTaskAssigned={handleTaskAssigned}
      />
    </div>
  );
}
