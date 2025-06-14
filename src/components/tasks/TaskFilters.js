// Placeholder for Task Filters Component
import React from "react";
import { Input } from "@/components/ui/input";
// Ensure only SelectInput is imported
import FilterableSelectInput from "@/components/ui/FilterableSelectInput.jsx"; // Changed import
import { Button } from "@/components/ui/button";

// Define options arrays within the component
const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "To Do", label: "To Do" },
  { value: "In Progress", label: "In Progress" },
  { value: "Done", label: "Done" },
];

const priorityOptions = [
  { value: "all", label: "All Priorities" },
  { value: "High", label: "High" },
  { value: "Medium", label: "Medium" },
  { value: "Low", label: "Low" },
];

// TaskFilters now receives currentFilters and assignableUsers as props
const TaskFilters = ({ onFilterChange, assignableUsers = [], currentFilters }) => {
  // Internal state is removed. We use currentFilters prop directly.

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    // Construct new filters based on currentFilters prop and the changed value
    const newFilters = { ...currentFilters, [name]: value };
    onFilterChange(newFilters);
  };

  // Updated handler: SelectInput provides { target: { name, value } }
  const handleSelectChange = (e) => {
    const { name, value } = e.target;
    // If 'all' or an empty string is selected for a dropdown, represent it as an empty string for the filter value.
    const selectedValue = value === "all" || value === "" ? "" : value;
    const newFilters = { ...currentFilters, [name]: selectedValue };
    onFilterChange(newFilters);
  };

  // Old handler - Keep for reference if needed, but use the one above
  // const handleSelectChangeDirect = (name, value) => {
  //   const newFilters = { ...filters, [name]: value === "all" ? "" : value }; // Reset if 'all' selected
  //   setFilters(newFilters);
  //   onFilterChange(newFilters);
  // };

  const clearFilters = () => {
    // Call onFilterChange with all filter values reset to empty strings
    onFilterChange({
      search: "",
      status: "",
      priority: "",
      assignee_id: "", // Ensure this matches the key in TasksPage state
    });
  };

  return (
    <div className="flex flex-wrap gap-4 items-end mb-6">
      <div className="flex-grow" style={{ minWidth: "150px" }}>
        <label
          htmlFor="search"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Search Tasks
        </label>
        <Input
          id="search"
          name="search"
          placeholder="Search by title/description..."
          value={currentFilters.search}
          onChange={handleInputChange}
        />
      </div>

      <div>
        <label
          htmlFor="status"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
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

      <div>
        <label
          htmlFor="priority"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Priority
        </label>
        {/* Use SelectInput for Priority */}
        <FilterableSelectInput
          id="priority"
          name="priority"
          options={priorityOptions}
          value={currentFilters.priority || "all"}
          onChange={handleSelectChange}
        />

        {/* TODO: Add Assignee Select - needs dynamic population */}
        {/* Replace the temporary one below with logic to fetch actual assignees */}
      </div>
      <div>
        <label 
          htmlFor="assignee_id" 
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Assignee
        </label>
        <FilterableSelectInput
          id="assignee_id" // Changed id
          name="assignee_id" // Changed name
          options={[
            { value: "", label: "All Assignees" }, // Default 'All' option
            ...assignableUsers.map(user => ({ value: user.id, label: `${user.first_name} ${user.last_name}` }))
          ]}
          value={currentFilters.assignee_id || ""} // Use empty string for 'all'
          onChange={handleSelectChange}
        />
      </div>
      <Button variant="outline" onClick={clearFilters}>
        Clear Filters
      </Button>
    </div>
  );
};

export default TaskFilters;
