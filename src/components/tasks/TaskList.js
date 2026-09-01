import React, { useState, useEffect, useRef } from "react";
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
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  MoreHorizontal,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  ListTodo,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Helper function for date formatting
const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  try {
    let dateStr = dateString;
    if (dateString.includes('T') && dateString.includes('Z')) {
      dateStr = dateString;
    } else if (dateString.includes('T')) {
      dateStr = dateString;
    } else {
      dateStr = dateString + 'T00:00:00';
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Invalid Date";
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

const getInitials = (firstName, lastName) => {
  if (!firstName && !lastName) return "?";
  const first = firstName?.charAt(0) || "";
  const last = lastName?.charAt(0) || "";
  return (first + last).toUpperCase();
};

// Status badge styles
const STATUS_STYLES = {
  "To Do": { className: "bg-orange-500/10 text-orange-600", icon: Clock },
  "In Progress": { className: "bg-yellow-500/10 text-yellow-600", icon: Loader2 },
  "Done": { className: "bg-green-500/10 text-green-600", icon: CheckCircle2 },
  "Backlog": { className: "bg-muted text-muted-foreground", icon: ListTodo },
};

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES["Backlog"];
  const Icon = style.icon;
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
      style.className
    )}>
      <Icon className="h-3 w-3" />
      {status || "N/A"}
    </span>
  );
}

// Priority badge styles
const PRIORITY_STYLES = {
  High: { className: "bg-red-500/10 text-red-600", dot: "bg-red-500" },
  Medium: { className: "bg-orange-500/10 text-orange-600", dot: "bg-orange-500" },
  Low: { className: "bg-blue-500/10 text-blue-600", dot: "bg-blue-500" },
};

function PriorityBadge({ priority }) {
  const style = PRIORITY_STYLES[priority] || PRIORITY_STYLES.Low;
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
      style.className
    )}>
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
      {priority || "N/A"}
    </span>
  );
}

// Sort indicator
function SortIndicator({ active, order }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 ml-1 text-muted-foreground/50" />;
  return order === "asc"
    ? <ArrowUp className="h-3 w-3 ml-1" />
    : <ArrowDown className="h-3 w-3 ml-1" />;
}

const TaskList = ({
  tasks = [],
  isLoading,
  isLoadingMore = false,
  error,
  hasMore = false,
  onLoadMore,
  onUpdateTask,
  onTaskDelete,
  userRole,
  sort,
  handleSort,
  currentUser = null,
}) => {
  const router = useRouter();

  const [errorAlertOpen, setErrorAlertOpen] = useState(false);
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (error) {
      setErrorAlertOpen(true);
    }
  }, [error]);

  // Infinite scroll — observe sentinel element
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !onLoadMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          onLoadMore();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore, isLoadingMore, isLoading]);

  if (isLoading) {
    return (
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              {[...Array(7)].map((_, i) => (
                <TableHead key={i}>
                  <Skeleton className="h-5 w-full" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(10)].map((_, i) => (
              <TableRow key={i}>
                {[...Array(7)].map((_, j) => (
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
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive/50 mb-3" />
        <p className="text-sm font-medium text-destructive">Could not load tasks</p>
        <p className="text-xs text-muted-foreground mt-1">An error occurred while fetching tasks.</p>
      </div>
    );
  }

  if (!tasks.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg border-dashed">
        <ListTodo className="h-12 w-12 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium">No tasks found</p>
        <p className="text-xs text-muted-foreground mt-1">
          Try adjusting your filters or creating a new task.
        </p>
      </div>
    );
  }

  const stopPropagation = (e) => e.stopPropagation();

  return (
    <TooltipProvider delayDuration={100}>
      <>
        <div className="border rounded-lg overflow-x-auto scrollbar-thin">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-[28%]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("title")}
                    className="px-1 h-auto py-0 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Title
                    <SortIndicator active={sort.field === "title"} order={sort.order} />
                  </Button>
                </TableHead>
                <TableHead className="w-[15%]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("assignee_id")}
                    className="px-1 h-auto py-0 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Client
                    <SortIndicator active={sort.field === "client_id"} order={sort.order} />
                  </Button>
                </TableHead>
                <TableHead className="w-[15%]">Assignee</TableHead>
                <TableHead className="w-[12%]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("due_date")}
                    className="px-1 h-auto py-0 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Due Date
                    <SortIndicator active={sort.field === "due_date"} order={sort.order} />
                  </Button>
                </TableHead>
                <TableHead className="w-[12%]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("status")}
                    className="px-1 h-auto py-0 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Status
                    <SortIndicator active={sort.field === "status"} order={sort.order} />
                  </Button>
                </TableHead>
                <TableHead className="w-[10%]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("priority")}
                    className="px-1 h-auto py-0 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Priority
                    <SortIndicator active={sort.field === "priority"} order={sort.order} />
                  </Button>
                </TableHead>
                <TableHead className="w-[8%] text-right">Actions</TableHead>
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
                const todayUTC = new Date();
                todayUTC.setUTCHours(0, 0, 0, 0);
                const isOverdue = dueDate && dueDate < todayUTC && task.status !== "Done";
                const assignee = task.assignee;

                return (
                  <TableRow
                    key={task.id}
                    onClick={() => router.push(`/admin/tasks/edit/${task.id}`)}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                  >
                    <TableCell className="font-medium min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        {isOverdue && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>This task is overdue</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <span className="truncate" title={task.title}>{task.title}</span>
                      </div>
                    </TableCell>
                    <TableCell className="min-w-0">
                      <span className="text-sm text-muted-foreground truncate block" title={task.client?.company_name || ""}>
                        {task.client?.company_name || "N/A"}
                      </span>
                    </TableCell>
                    <TableCell className="min-w-0">
                      {assignee ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2 min-w-0">
                              <Avatar className="h-7 w-7 shrink-0">
                                <AvatarImage
                                  src={assignee.avatar_url}
                                  alt={assignee.first_name}
                                />
                                <AvatarFallback className="text-[10px]">
                                  {getInitials(
                                    assignee.first_name,
                                    assignee.last_name
                                  )}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm truncate" title={`${assignee.first_name || ""} ${assignee.last_name || ""}`.trim()}>
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
                        <span className="text-sm text-muted-foreground italic">
                          Unassigned
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className={cn(
                        "text-sm",
                        isOverdue && "text-destructive font-medium"
                      )}>
                        {formatDate(task.dueDate)}
                      </span>
                    </TableCell>
                    <TableCell onClick={stopPropagation} className="whitespace-nowrap">
                      {task._permissions?.allowed ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-80">
                              <StatusBadge status={task.status} />
                            </button>
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
                        <StatusBadge status={task.status} />
                      )}
                    </TableCell>
                    <TableCell onClick={stopPropagation} className="whitespace-nowrap">
                      {task._permissions?.allowed ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-80">
                              <PriorityBadge priority={task.priority} />
                            </button>
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
                        <PriorityBadge priority={task.priority} />
                      )}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={stopPropagation}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
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

        {/* Infinite scroll sentinel + loading indicator */}
        <div ref={sentinelRef} className="h-1" />
        {isLoadingMore && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading more tasks...</span>
          </div>
        )}
        {!hasMore && tasks.length > 0 && !isLoadingMore && (
          <div className="text-center py-4 text-xs text-muted-foreground">
            You&apos;ve reached the end — {tasks.length} tasks loaded.
          </div>
        )}

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
