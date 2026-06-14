import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import AlertComponent from "@/components/ui/alert-component";
import {
  Edit,
  Trash2,
  ArrowUpDown,
  MoreHorizontal,
  AlertCircle,
} from "lucide-react";

// Helper function for date formatting
const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  try {
    // Handle different date formats
    let dateStr = dateString;
    
    // If it's already a full ISO string, use as-is
    if (dateString.includes('T') && dateString.includes('Z')) {
      dateStr = dateString;
    } else if (dateString.includes('T')) {
      // Already has time component
      dateStr = dateString;
    } else {
      // Add time component to avoid timezone issues
      dateStr = dateString + 'T00:00:00';
    }
    
    const date = new Date(dateStr);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return "Invalid Date";
    }
    
    // Use UTC methods to avoid timezone shifts
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[date.getUTCMonth()];
    const day = date.getUTCDate();
    const year = date.getUTCFullYear();
    
    return `${month} ${day}, ${year}`;
  } catch (e) {
    console.error('Date formatting error:', e, 'for dateString:', dateString);
    return "Invalid Date";
  }
};

// Helper to get initials
const getInitials = (firstName, lastName) => {
  if (!firstName && !lastName) return "?";
  const first = firstName?.charAt(0) || "";
  const last = lastName?.charAt(0) || "";
  return (first + last).toUpperCase();
};

const TaskList = ({
  tasks = [],
  isLoading,
  error,
  onUpdateTask,
  onTaskDelete,
  userRole,
  sort,
  handleSort,
  pagination,
  setPagination,
  currentUser = null,
}) => {
  const router = useRouter();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [errorAlertOpen, setErrorAlertOpen] = useState(false);

  useEffect(() => {
    if (error) {
      setErrorAlertOpen(true);
    }
  }, [error]);

  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= Math.ceil(pagination.total / pagination.limit)) {
      setPagination((prev) => ({ ...prev, page: newPage }));
    }
  };

  if (isLoading) {
    return (
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              {[...Array(8)].map((_, i) => (
                <TableHead key={i}>
                  <Skeleton className="h-5 w-full" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(pagination.limit)].map((_, i) => (
              <TableRow key={i}>
                {[...Array(8)].map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (!isLoading && error) {
    return (
      <div className="text-center py-10">
        <p className="text-red-500">Could not load tasks. An error occurred.</p>
      </div>
    );
  }

  if (!tasks.length) {
    return (
      <div className="text-center text-gray-500 mt-10 p-4 border rounded-md">
        <p>No tasks found.</p>
        <p className="text-sm text-muted-foreground">
          Try adjusting your filters or creating a new task.
        </p>
      </div>
    );
  }

  const getPriorityProps = (priority) => {
    switch (priority) {
      case "High":
        return { color: "text-red-500" };
      case "Medium":
        return { color: "text-orange-500" };
      case "Low":
        return { color: "text-gray-500" };
      default:
        return { color: "text-gray-500" };
    }
  };



  const stopPropagation = (e) => e.stopPropagation();

  return (
    <TooltipProvider delayDuration={100}>
      <>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[25%]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("title")}
                    className="px-1"
                  >
                    Title
                    {sort.field === "title" && (sort.order === "asc" ? "🔼" : "🔽")}
                  </Button>
                </TableHead>
                <TableHead className="w-[15%]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("assignee_id")}
                    className="px-1"
                  >
                    Client Name
                    {sort.field === "client_id" && (sort.order === "asc" ? "🔼" : "🔽")}
                  </Button>
                </TableHead>
                <TableHead className="w-[15%]">Assignee</TableHead>
                <TableHead className="w-[10%]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("due_date")}
                    className="px-1"
                  >
                    Due Date
                    {sort.field === "due_date" && (sort.order === "asc" ? "🔼" : "🔽")}
                  </Button>
                </TableHead>
                <TableHead className="w-[10%]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("status")}
                    className="px-1"
                  >
                    Status
                    {sort.field === "status" && (sort.order === "asc" ? "🔼" : "🔽")}
                  </Button>
                </TableHead>
                <TableHead className="w-[10%]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("priority")}
                    className="px-1"
                  >
                    Priority
                    {sort.field === "priority" && (sort.order === "asc" ? "🔼" : "🔽")}
                  </Button>
                </TableHead>
                <TableHead className="w-[5%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => {
                let dueDate = null;
                if (task.dueDate) {
                  try {
                    let dateStr = task.dueDate;
                    if (!task.dueDate.includes('T')) {
                      dateStr = task.dueDate + 'T00:00:00';
                    }
                    dueDate = new Date(dateStr);
                    if (isNaN(dueDate.getTime())) {
                      dueDate = null;
                    }
                  } catch (e) {
                    dueDate = null;
                  }
                }
                // Use UTC date for comparison to avoid timezone issues
                const todayUTC = new Date();
                todayUTC.setUTCHours(0, 0, 0, 0);
                const isOverdue = dueDate && dueDate < todayUTC && task.status !== "Done";
                const assignee = task.assignee;

                return (
                  <TableRow
                    key={task.id}
                    onClick={() => router.push(`/admin/tasks/edit/${task.id}`)}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell className="font-medium">{task.title}</TableCell>
                    <TableCell>
                      {task.client?.company_name || "N/A"}
                    </TableCell>
                    <TableCell>
                      {assignee ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage
                                  src={assignee.avatar_url}
                                  alt={assignee.first_name}
                                />
                                <AvatarFallback>
                                  {getInitials(
                                    assignee.first_name,
                                    assignee.last_name
                                  )}
                                </AvatarFallback>
                              </Avatar>
                              <span>
                                {`${assignee.first_name || ""} ${
                                  assignee.last_name || ""
                                }`.trim()}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{assignee.email || "No email"}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-muted-foreground">
                          Unassigned
                        </span>
                      )}
                    </TableCell>
                    <TableCell className={isOverdue ? "text-destructive" : ""}>
                      {formatDate(task.dueDate)}
                    </TableCell>
                    <TableCell onClick={stopPropagation}>
                      {task._permissions?.allowed ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full justify-start text-left"
                            >
                              {task.status || "Select"}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuRadioGroup
                              value={task.status}
                              onValueChange={(status) =>
                                onUpdateTask(task.id, { status })
                              }
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
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {task.status || "N/A"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell onClick={stopPropagation}>
                      {task._permissions?.allowed ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`w-full justify-start text-left font-semibold ${getPriorityProps(
                                task.priority
                              ).color}`}
                            >
                              {task.priority || "Select"}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuRadioGroup
                              value={task.priority}
                              onValueChange={(priority) =>
                                onUpdateTask(task.id, { priority })
                              }
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
                      ) : (
                        <span className={`text-sm font-semibold ${getPriorityProps(task.priority).color}`}>
                          {task.priority || "N/A"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={stopPropagation}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              router.push(`/admin/tasks/edit/${task.id}`)
                            }
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {task._permissions?.allowed && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => onTaskDelete(task.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between py-4">
          <div className="text-sm text-muted-foreground">
            Showing{" "}
            {pagination.page * pagination.limit - pagination.limit + 1}-
            {(pagination.page * pagination.limit) > pagination.total
              ? pagination.total
              : pagination.page * pagination.limit}{" "}
            of {pagination.total} tasks.
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {pagination.page} of{" "}
              {Math.ceil(pagination.total / pagination.limit) || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
            >
              Next
            </Button>
          </div>
        </div>
        <AlertComponent
          open={errorAlertOpen}
          onOpenChange={setErrorAlertOpen}
          title="Error Fetching Tasks"
          message={error || "An unexpected error occurred."}
          actionLabel="Close"
          onAction={() => setErrorAlertOpen(false)}
        />
      </>
    </TooltipProvider>
  );
};

export default TaskList;