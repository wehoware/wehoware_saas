// Placeholder for Task List Component
// Displays tasks in a table or card list
// Uses Shadcn Table component: https://ui.shadcn.com/docs/components/table

import React from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Edit,
  UserPlus,
  Circle,
  ArrowUpDown,
  MoreHorizontal,
} from "lucide-react"; // Added icons for sorting and actions

// Helper function for date formatting (can be replaced with date-fns if available)
const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString + "T00:00:00"); // Ensure parsing as local date
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (e) {
    return dateString; // Fallback to original string if formatting fails
  }
};

// Helper to get initials
const getInitials = (name) => {
  if (!name) return "?";
  const names = name.split(" ");
  const initials = names.map((n) => n[0]).join("");
  return initials.toUpperCase().slice(0, 2);
};

// Receive users, onTaskUpdate, and sorting props
const TaskList = ({
  tasks = [],
  users = [],
  onTaskUpdate,
  sortField,
  sortOrder,
  handleSort,
}) => {
  const router = useRouter();
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set time to start of day for comparison

  if (!tasks.length) {
    return <p className="text-center text-gray-500 mt-10">No tasks found.</p>;
  }

  // Keep variant functions for potential future use or styling SelectTrigger
  const getStatusVariant = (status) => {
    switch (status) {
      case "To Do":
        return "secondary";
      case "In Progress":
        return "default";
      case "Done":
        return "outline";
      default:
        return "secondary";
    }
  };

  const getPriorityProps = (priority) => {
    switch (priority) {
      case "High":
        return { variant: "destructive", color: "text-red-500", label: "High" };
      case "Medium":
        return {
          variant: "warning",
          color: "text-orange-500",
          label: "Medium",
        }; // Use warning variant if defined, else maybe default
      case "Low":
        return { variant: "secondary", color: "text-gray-500", label: "Low" };
      default:
        return {
          variant: "secondary",
          color: "text-gray-500",
          label: priority || "None",
        };
    }
  };

  // Helper to prevent navigation when clicking dropdown
  const stopPropagation = (e) => e.stopPropagation();

  return (
    <TooltipProvider delayDuration={100}>
      <Table>
        <TableCaption>A list of tasks. Click row to view details.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[25%]">
              <Button
                variant="ghost"
                onClick={() => handleSort("title")}
                className="px-1"
              >
                Title
                {sortField === "title" && (
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                )}
              </Button>
            </TableHead>
            <TableHead className="w-[15%]">
              <Button
                variant="ghost"
                onClick={() => handleSort("clientName")}
                className="px-1"
              >
                Client Name
                {sortField === "clientName" && (
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                )}
              </Button>
            </TableHead>
            <TableHead className="w-[10%]">Task Id</TableHead>
            {/* Task ID usually not sortable by click, but can be if needed */}
            <TableHead className="w-[15%]">Assignee</TableHead>
            {/* Assignee sorting might be complex if based on name vs ID */}
            <TableHead className="w-[10%]">
              <Button
                variant="ghost"
                onClick={() => handleSort("dueDate")}
                className="px-1"
              >
                Due Date
                {sortField === "dueDate" && (
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                )}
              </Button>
            </TableHead>
            <TableHead className="w-[10%]">
              <Button
                variant="ghost"
                onClick={() => handleSort("status")}
                className="px-1"
              >
                Status
                {sortField === "status" && (
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                )}
              </Button>
            </TableHead>
            <TableHead className="w-[10%]">
              <Button
                variant="ghost"
                onClick={() => handleSort("priority")}
                className="px-1"
              >
                Priority
                {sortField === "priority" && (
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                )}
              </Button>
            </TableHead>
            <TableHead className="w-[5%] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            // Check if task is overdue
            const dueDate = task.dueDate
              ? new Date(task.dueDate + "T00:00:00")
              : null;
            const isOverdue =
              dueDate && dueDate < today && task.status !== "Done";

            return (
              <TableRow
                key={task.id}
                className="hover:bg-muted/50 cursor-pointer"
                onClick={() => router.push(`/admin/tasks/${task.id}`)}
              >
                <TableCell className="font-medium">{task.title}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {task.clientName || "N/A"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {task.id}
                </TableCell>
                {/* Assignee Select Dropdown */}
                <TableCell onClick={stopPropagation}>
                  {" "}
                  {/* Stop propagation */}
                  <div className="flex items-center space-x-1">
                    {task.assignees?.slice(0, 3).map((assignee) => (
                      <Tooltip key={assignee.id || assignee.name}>
                        {" "}
                        {/* Use id if available */}
                        <TooltipTrigger asChild>
                          <Avatar className="h-6 w-6 text-xs border">
                            {/* <AvatarImage src={assignee.avatarUrl} alt={assignee.name} /> Optional Image */}
                            <AvatarFallback className="bg-muted">
                              {getInitials(assignee.name)}
                            </AvatarFallback>
                          </Avatar>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{assignee.name}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                    {task.assignees?.length > 3 && (
                      <span className="text-xs text-muted-foreground pl-1">
                        +{task.assignees.length - 3}
                      </span>
                    )}
                    {task.assignees?.length === 0 && (
                      <span className="text-xs text-muted-foreground italic">
                        Unassigned
                      </span>
                    )}

                    {/* Assignee Edit Dropdown Trigger */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" className="ml-1">
                          <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuLabel>Assign To</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioGroup
                          value={task.assignees?.[0]?.id || "unassigned"} // Simple single select value
                          onValueChange={(newAssigneeId) => {
                            onTaskUpdate(task.id, {
                              assigneeId: newAssigneeId,
                            });
                          }}
                        >
                          {users.map((user) => (
                            <DropdownMenuRadioItem
                              key={user.id}
                              value={user.id}
                            >
                              {user.name}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
                {/* Format Due Date and highlight if overdue */}
                <TableCell
                  className={`${
                    isOverdue ? "text-red-600 font-medium" : ""
                  } whitespace-nowrap`}
                >
                  {formatDate(task.dueDate)}
                </TableCell>
                {/* Status Select Dropdown */}
                <TableCell onClick={stopPropagation}>
                  {" "}
                  {/* Stop propagation */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="xs"
                        className="w-[100px] justify-start"
                      >
                        {task.status || "Select..."}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuRadioGroup
                        value={task.status}
                        onValueChange={(newStatus) => {
                          onTaskUpdate(task.id, { status: newStatus });
                        }}
                      >
                        <DropdownMenuRadioItem value="To Do">
                          To Do
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="In Progress">
                          In Progress
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="Done">
                          Done
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
                {/* Priority Select Dropdown */}
                <TableCell onClick={stopPropagation} className="text-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="xs"
                        className="flex items-center gap-1 px-1"
                      >
                        <Circle
                          className={`h-3 w-3 ${
                            getPriorityProps(task.priority).color
                          } fill-current`}
                        />
                        <span className="text-xs">
                          {getPriorityProps(task.priority).label}
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Set Priority</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup
                        value={task.priority}
                        onValueChange={(newPriority) => {
                          onTaskUpdate(task.id, { priority: newPriority });
                        }}
                      >
                        <DropdownMenuRadioItem value="Low">
                          Low
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="Medium">
                          Medium
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="High">
                          High
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>

                {/* Actions Dropdown */}
                <TableCell onClick={stopPropagation} className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      router.push(`/admin/tasks/edit?taskId=${task.id}`)
                    }
                  >
                    <Edit className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
};

export default TaskList;
