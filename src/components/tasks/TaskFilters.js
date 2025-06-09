// Placeholder for Task Filters Component
import React from "react";
import { Input } from "@/components/ui/input";
// Ensure only SelectInput is imported
import SelectInput from "@/components/ui/select";
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

// Mock Assignees for filters - replace with actual data later
const MOCK_ASSIGNEES_FILTER = [
  { value: "all", label: "All Assignees" },
  { value: "emp1", label: "Alice" },
  { value: "emp2", label: "Bob" },
  { value: "admin1", label: "Charlie (Admin)" },
];

const TaskFilters = ({ onFilterChange }) => {
  const [filters, setFilters] = React.useState({
    search: "",
    status: "",
    priority: "",
    assignee: "", // Add assignee filter later
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const newFilters = { ...filters, [name]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  // Updated handler: SelectInput provides { target: { name, value } }
  const handleSelectChange = (e) => {
    const { name, value } = e.target;
    const selectedValue = value === "all" ? "" : value;
    const newFilters = { ...filters, [name]: selectedValue };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  // Old handler - Keep for reference if needed, but use the one above
  // const handleSelectChangeDirect = (name, value) => {
  //   const newFilters = { ...filters, [name]: value === "all" ? "" : value }; // Reset if 'all' selected
  //   setFilters(newFilters);
  //   onFilterChange(newFilters);
  // };

  const clearFilters = () => {
    const clearedFilters = {
      search: "",
      status: "",
      priority: "",
      assignee: "",
    };
    setFilters(clearedFilters);
    onFilterChange(clearedFilters);
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
          placeholder="Search by title..."
          value={filters.search}
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

        <SelectInput
          id="status"
          name="status"
          options={statusOptions}
          value={filters.status || "all"} // Ensure 'all' is selected if filter is empty
          onChange={handleSelectChange} // Pass the handler directly
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
        <SelectInput
          id="priority"
          name="priority"
          options={priorityOptions}
          value={filters.priority || "all"}
          onChange={handleSelectChange} // Pass the handler directly
        />

        {/* TODO: Add Assignee Select - needs dynamic population */}
        {/* Replace the temporary one below with logic to fetch actual assignees */}
      </div>
      <SelectInput
        id="assignee"
        name="assignee"
        options={MOCK_ASSIGNEES_FILTER} // Use mock filter options for now
        value={filters.assignee || "all"}
        onChange={handleSelectChange} // Pass the handler directly
      />
      <Button variant="outline" onClick={clearFilters}>
        Clear Filters
      </Button>
    </div>
  );
};

export default TaskFilters;
