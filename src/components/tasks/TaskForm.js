"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import SelectInput from "@/components/ui/select";

const TaskForm = ({
  initialData = null,
  onSubmit,
  users = [],
  clients = [],
  isLoading = false,
  submitButtonText = "Submit Task",
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
    return clients.map((client) => ({
      value: String(client.id),
      label: client.company_name || `Client ID: ${client.id}`, // Fallback label
    }));
  }, [clients]); 

  const userOptions = useMemo(() => {
    if (!Array.isArray(users)) return [];
    return users.map((user) => ({
      value: String(user.id),
      label: (`${user.first_name || ""} ${user.last_name || ""}`.trim()) || user.email || `User ID: ${user.id}`, // Fallback label
    }));
  }, [users]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || "",
        description: initialData.description || "",
        client_id: initialData.client_id ? String(initialData.client_id) : "", // Ensure string from initialData
        assignee_id:
          initialData.assignee_id ? String(initialData.assignee_id) :
          (initialData.assignee && initialData.assignee.id ? String(initialData.assignee.id) : ""), // Ensure string from initialData
        due_date: initialData.due_date
          ? new Date(initialData.due_date).toISOString().split("T")[0]
          : "",
        priority: initialData.priority || "High", // Already string or default
        status: initialData.status || "To Do", // Already string or default
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Identify fields that come from SelectInput and need string conversion for their values
    const selectFieldNames = ["client_id", "assignee_id", "priority", "status"];
    let processedValue = value;

    if (selectFieldNames.includes(name)) {
      processedValue = String(value);
    } else if (name === "due_date" && value === "") {
      // Allow clearing the date field, ensure it's an empty string not null
      processedValue = "";
    }
    // For other standard inputs, 'value' is used as is.

    setFormData(prev => ({ ...prev, [name]: processedValue }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.title || !formData.priority || !formData.status) {
      setError("Title, Priority, and Status are required.");
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-center sm:gap-x-4">
        <Label htmlFor="title" className="sm:text-right sm:col-span-1">
          Title *
        </Label>
        <Input
          id="title"
          name="title"
          value={formData.title}
          onChange={handleChange}
          className="sm:col-span-3"
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-center sm:gap-x-4">
        <Label htmlFor="client_id" className="sm:text-right sm:col-span-1">
          Client *
        </Label>
        <SelectInput
          id="client_id"
          name="client_id"
          value={formData.client_id || ''}
          onChange={handleChange} // Use unified handleChange
          options={clientOptions}
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-start sm:gap-x-4">
        <Label
          htmlFor="description"
          className="sm:text-right sm:col-span-1 sm:pt-2"
        >
          Description
        </Label>
        <Textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          className="sm:col-span-3"
          placeholder="Provide task details..."
          rows={4}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-center sm:gap-x-4">
        <Label htmlFor="assignee_id" className="sm:text-right sm:col-span-1">
          Assignee
        </Label>
        <SelectInput
          id="assignee_id"
          name="assignee_id"
          value={formData.assignee_id || ''}
          onChange={handleChange} // Use unified handleChange
          options={userOptions}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-center sm:gap-x-4">
        <Label htmlFor="due_date" className="sm:text-right sm:col-span-1">
          Due Date
        </Label>
        <Input
          id="due_date"
          name="due_date"
          type="date"
          value={formData.due_date || ''} // Ensure value is always a string for consistency, though type date handles it
          onChange={handleChange}
          className="sm:col-span-3"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-center sm:gap-x-4">
        <Label htmlFor="priority" className="sm:text-right sm:col-span-1">
          Priority *
        </Label>
        <SelectInput
          id="priority"
          name="priority"
          value={formData.priority || ''}
          onChange={handleChange} // Use unified handleChange
          options={[
            { value: "Low", label: "Low" },
            { value: "Medium", label: "Medium" },
            { value: "High", label: "High" },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-center sm:gap-x-4">
        <Label htmlFor="status" className="sm:text-right sm:col-span-1">
          Status *
        </Label>
        <SelectInput
          id="status"
          name="status"
          value={formData.status || ''}
          onChange={handleChange} // Use unified handleChange
          options={[
            { value: "To Do", label: "To Do" },
            { value: "In Progress", label: "In Progress" },
            { value: "Done", label: "Done" },
          ]}
        />
      </div>

      {error && (
        <p className="text-red-500 text-sm text-center sm:col-span-4">
          {error}
        </p>
      )}

      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : submitButtonText}
        </Button>
      </div>
    </form>
  );
};

export default TaskForm;