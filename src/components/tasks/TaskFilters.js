// TaskFilters — filter bar for the tasks list
import React from "react";
import { Input } from "@/components/ui/input";
import FilterableSelectInput from "@/components/ui/FilterableSelectInput.jsx";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "all", label: "All Statuses" },
  { value: "To Do", label: "To Do" },
  { value: "In Progress", label: "In Progress" },
  { value: "Done", label: "Done" },
  { value: "Backlog", label: "Backlog" },
];

const priorityOptions = [
  { value: "all", label: "All Priorities" },
  { value: "High", label: "High" },
  { value: "Medium", label: "Medium" },
  { value: "Low", label: "Low" },
];

const TaskFilters = ({ onFilterChange, assignableUsers = [], clients = [], currentFilters, showClientFilter = false }) => {
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const newFilters = { ...currentFilters, [name]: value };
    onFilterChange(newFilters);
  };

  const handleSelectChange = (e) => {
    const { name, value } = e.target;
    const selectedValue = value === "all" || value === "" ? "" : value;
    const newFilters = { ...currentFilters, [name]: selectedValue };
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    onFilterChange({
      search: "",
      status: "",
      priority: "",
      assignee_id: "",
      client_id: "",
    });
  };

  const hasActiveFilters =
    currentFilters.search ||
    (currentFilters.status && currentFilters.status !== "active") ||
    currentFilters.priority ||
    currentFilters.assignee_id ||
    currentFilters.client_id;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {/* Search */}
        <div className="lg:col-span-1">
          <label htmlFor="search" className="block text-xs font-medium text-muted-foreground mb-1.5">
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              id="search"
              name="search"
              placeholder="Search by title..."
              value={currentFilters.search}
              onChange={handleInputChange}
              className="pl-9"
            />
          </div>
        </div>

        {/* Status */}
        <div>
          <label htmlFor="status" className="block text-xs font-medium text-muted-foreground mb-1.5">
            Status
          </label>
          <FilterableSelectInput
            id="status"
            name="status"
            options={statusOptions}
            value={currentFilters.status || "all"}
            onChange={handleSelectChange}
          />
        </div>

        {/* Priority */}
        <div>
          <label htmlFor="priority" className="block text-xs font-medium text-muted-foreground mb-1.5">
            Priority
          </label>
          <FilterableSelectInput
            id="priority"
            name="priority"
            options={priorityOptions}
            value={currentFilters.priority || "all"}
            onChange={handleSelectChange}
          />
        </div>

        {/* Client (admin/employee only) */}
        {showClientFilter && (
          <div>
            <label htmlFor="client_id" className="block text-xs font-medium text-muted-foreground mb-1.5">
              Client
            </label>
            <FilterableSelectInput
              id="client_id"
              name="client_id"
              options={[
                { value: "", label: "All Clients" },
                ...clients.map((c) => ({ value: c.id, label: c.company_name || c.name || "Unknown" })),
              ]}
              value={currentFilters.client_id || ""}
              onChange={handleSelectChange}
            />
          </div>
        )}

        {/* Assignee */}
        <div>
          <label htmlFor="assignee_id" className="block text-xs font-medium text-muted-foreground mb-1.5">
            Assignee
          </label>
          <FilterableSelectInput
            id="assignee_id"
            name="assignee_id"
            options={[
              { value: "", label: "All Assignees" },
              ...assignableUsers.map(user => ({ value: user.id, label: `${user.first_name} ${user.last_name}` }))
            ]}
            value={currentFilters.assignee_id || ""}
            onChange={handleSelectChange}
          />
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5 mr-1" />
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  );
};

export default TaskFilters;
