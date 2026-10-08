"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import SearchableSelect from "@/components/ui/searchable-select";
import DatePicker from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CircleDot,
  Flag,
  Loader2,
  PencilLine,
  Type,
  UserRound,
} from "lucide-react";

const PRIORITY_OPTIONS = [
  {
    value: "Low",
    label: "Low",
    dot: "bg-green-500",
    active:
      "border-green-500/60 bg-green-500/10 text-green-700 dark:text-green-400",
  },
  {
    value: "Medium",
    label: "Medium",
    dot: "bg-amber-500",
    active:
      "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  {
    value: "High",
    label: "High",
    dot: "bg-red-500",
    active: "border-red-500/60 bg-red-500/10 text-red-700 dark:text-red-400",
  },
];

const STATUS_OPTIONS = [
  { value: "Backlog", label: "Backlog", dot: "bg-muted-foreground/60" },
  { value: "To Do", label: "To Do", dot: "bg-orange-500" },
  { value: "In Progress", label: "In Progress", dot: "bg-yellow-500" },
  { value: "On Hold", label: "On Hold", dot: "bg-purple-500" },
  { value: "Done", label: "Done", dot: "bg-green-500" },
];

const FieldLabel = ({ htmlFor, icon: Icon, required, children }) => (
  <Label
    htmlFor={htmlFor}
    className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground"
  >
    {Icon && <Icon className="h-3.5 w-3.5" />}
    {children}
    {required && <span className="text-destructive">*</span>}
  </Label>
);

const SectionTitle = ({ children }) => (
  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
    {children}
  </h3>
);

const TaskForm = ({
  initialData = null,
  onSubmit,
  onCancel,
  users = [],
  clients = [],
  isLoading = false,
  submitButtonText = "Submit Task",
  currentUser = null,
  lockedClientId = null,
}) => {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    client_id: "", // Initialize client_id
    assignee_id: "",
    due_date: "",
    priority: "High",
    status: "To Do",
  });
  const [error, setError] = useState("");

  const clientOptions = useMemo(() => {
    if (!Array.isArray(clients)) return [];
    const options = clients.map((client) => ({
      value: String(client.id),
      label: client.company_name || client.name || `Client ID: ${client.id}`,
    }));
    // Keep the task's current client selectable even when it's outside the
    // assignable set (e.g. the task was created by another user/role) —
    // otherwise the select renders empty and saving would null it out.
    const currentClientId = initialData?.clientId ? String(initialData.clientId) : null;
    if (currentClientId && !options.some((o) => o.value === currentClientId)) {
      options.push({
        value: currentClientId,
        label:
          initialData?.client?.company_name ||
          `Client ID: ${currentClientId}`,
      });
    }
    return options;
  }, [clients, initialData]);

  const userOptions = useMemo(() => {
    if (!Array.isArray(users)) return [];

    let filtered = users;
    if (currentUser) {
      const isInternal = currentUser.role === "admin" || currentUser.role === "employee";
      filtered = users.filter((u) => {
        if (isInternal) {
          return u.role === "admin" || u.role === "employee";
        }
        return u.role === "client";
      });
    }

    const options = [
      { value: "", label: "Unassigned" },
      ...filtered.map((user) => ({
        value: String(user.id),
        label:
          (`${user.first_name || ""} ${user.last_name || ""}`.trim()) ||
          user.email ||
          `User ID: ${user.id}`,
      })),
    ];

    // Keep the current assignee selectable even when outside the pickable
    // set (e.g. task created/assigned by another role) — otherwise the
    // select renders empty and saving would clear the assignment.
    const currentAssigneeId = initialData?.assigneeId ? String(initialData.assigneeId) : null;
    if (currentAssigneeId && !options.some((o) => o.value === currentAssigneeId)) {
      const name =
        (`${initialData?.assignee?.first_name || ""} ${initialData?.assignee?.last_name || ""}`.trim()) ||
        `User ID: ${currentAssigneeId}`;
      options.push({ value: currentAssigneeId, label: name });
    }

    return options;
  }, [users, currentUser, initialData]);

  // Assignment/client moves are creator/admin/client-owner only — matches
  // the API rule; disable the selects for other editors (e.g. assignees).
  const canChangeAssignment =
    !initialData ||
    !currentUser ||
    initialData.createdBy === currentUser.id ||
    currentUser.role === "admin" ||
    (currentUser.role === "client" && currentUser.activeClientRole === "client");

  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || "",
        description: initialData.description || "",
        client_id: initialData.clientId ? String(initialData.clientId) : lockedClientId ? String(lockedClientId) : "",
        assignee_id: initialData.assigneeId ? String(initialData.assigneeId) : "",
        due_date: initialData.dueDate
          ? new Date(initialData.dueDate).toISOString().split("T")[0]
          : "",
        priority: initialData.priority || "High",
        status: initialData.status || "To Do",
      });
    } else if (lockedClientId) {
      setFormData((prev) => ({ ...prev, client_id: String(lockedClientId) }));
    }
  }, [initialData, lockedClientId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let processedValue = value;

    // Handle date field specifically
    if (name === "due_date") {
      processedValue = value || "";
    } else if (name === "client_id" || name === "assignee_id") {
      // Handle select fields - ensure they're strings
      processedValue = value ? String(value) : "";
    }

    setFormData(prev => ({ ...prev, [name]: processedValue }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.title || !formData.client_id || !formData.priority || !formData.status) {
      setError("Title, Client, Priority, and Status are required.");
      return;
    }

    // Pass only the fields that are meant to be updated
    const { title, description, client_id, assignee_id, due_date, priority, status } =
      formData;
    const payload = {
      title,
      description,
      client_id: client_id || null,
      assignee_id: assignee_id || null,
      due_date: due_date || null,
      priority,
      status,
    };

    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Task details */}
      <section className="space-y-4">
        <SectionTitle>Task details</SectionTitle>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="title" icon={Type} required>
            Title
          </FieldLabel>
          <Input
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="e.g. Redesign the landing page hero"
            required
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="description" icon={PencilLine}>
            Description
          </FieldLabel>
          <Textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Add context, links, or acceptance criteria..."
            rows={4}
            className="resize-y"
          />
        </div>
      </section>

      <Separator />

      {/* Assignment */}
      <section className="space-y-4">
        <SectionTitle>Assignment</SectionTitle>
        <div
          className={cn(
            "grid grid-cols-1 gap-4",
            !lockedClientId && "sm:grid-cols-2"
          )}
        >
          {!lockedClientId && (
            <div className="space-y-1.5">
              <FieldLabel htmlFor="client_id" icon={Building2} required>
                Client
              </FieldLabel>
              <SearchableSelect
                value={formData.client_id || ""}
                onChange={(v) =>
                  handleChange({ target: { name: "client_id", value: v } })
                }
                options={clientOptions}
                placeholder="Select a client"
                searchPlaceholder="Search clients..."
                emptyText="No clients found."
                disabled={!canChangeAssignment}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <FieldLabel htmlFor="assignee_id" icon={UserRound}>
              Assignee
            </FieldLabel>
            <SearchableSelect
              value={formData.assignee_id || ""}
              onChange={(v) =>
                handleChange({ target: { name: "assignee_id", value: v } })
              }
              options={userOptions}
              placeholder="Select an assignee"
              searchPlaceholder="Search people..."
              emptyText="No people found."
              disabled={!canChangeAssignment}
            />
          </div>
        </div>
      </section>

      <Separator />

      {/* Planning */}
      <section className="space-y-4">
        <SectionTitle>Planning</SectionTitle>
        <div className="space-y-1.5">
          <FieldLabel icon={Flag} required>
            Priority
          </FieldLabel>
          <div className="grid grid-cols-3 gap-2">
            {PRIORITY_OPTIONS.map((opt) => {
              const isActive = formData.priority === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    handleChange({
                      target: { name: "priority", value: opt.value },
                    })
                  }
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? opt.active
                      : "border-input bg-transparent text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                  )}
                  aria-pressed={isActive}
                >
                  <span className={cn("h-2 w-2 rounded-full", opt.dot)} />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="due_date" icon={CalendarDays}>
              Due date
            </FieldLabel>
            <DatePicker
              id="due_date"
              name="due_date"
              value={formData.due_date}
              onChange={handleChange}
              placeholder="Select a due date"
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="status" icon={CircleDot} required>
              Status
            </FieldLabel>
            <SearchableSelect
              value={formData.status || ""}
              onChange={(v) =>
                handleChange({ target: { name: "status", value: v } })
              }
              options={STATUS_OPTIONS}
              placeholder="Select a status"
              searchable={false}
            />
          </div>
        </div>
      </section>

      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isLoading} className="min-w-[120px]">
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isLoading ? "Saving..." : submitButtonText}
        </Button>
      </div>
    </form>
  );
};

export default TaskForm;
