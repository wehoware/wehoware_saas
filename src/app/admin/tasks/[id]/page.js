"use client"; // Needed for hooks like useParams and useState

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

// Import the detail components (assuming they exist)
import TaskDetailCard from "@/components/tasks/TaskDetailCard";
import TaskAssignees from "@/components/tasks/TaskAssignees";
import TaskComments from "@/components/tasks/TaskComments";
import TaskActivityLog from "@/components/tasks/TaskActivityLog";

// --- Mock Data (Replace with actual data fetching) ---
const MOCK_TASK_DETAILS = {
  id: "task-001",
  title: "Setup Initial Project Structure",
  description:
    "Create the basic folder structure, install dependencies, and set up initial configuration files for the new client project.",
  clientName: "Acme Corp",
  creator: { id: "admin1", name: "Charlie (Admin)" },
  assignees: [
    { id: "emp1", name: "Alice", avatarUrl: "/avatars/alice.png" },
    { id: "emp2", name: "Bob", avatarUrl: "/avatars/bob.png" },
  ],
  dueDate: "2025-05-10",
  status: "In Progress",
  priority: "High",
  createdAt: "2025-04-25T10:00:00Z",
  updatedAt: "2025-04-26T09:30:00Z",
  comments: [
    {
      id: "c1",
      user: { name: "Alice", avatarUrl: "/avatars/alice.png" },
      timestamp: "2025-04-26T11:00:00Z",
      text: "Started working on the folder structure.",
    },
    {
      id: "c2",
      user: { name: "Bob", avatarUrl: "/avatars/bob.png" },
      timestamp: "2025-04-26T14:15:00Z",
      text: "Dependencies installed. Need clarification on the config file.",
    },
  ],
  activityLog: [
    {
      id: "a1",
      timestamp: "2025-04-25T10:00:00Z",
      text: "Task created by Charlie (Admin)",
    },
    { id: "a2", timestamp: "2025-04-25T10:05:00Z", text: "Assigned to Alice" },
    { id: "a3", timestamp: "2025-04-25T10:05:00Z", text: "Assigned to Bob" },
    {
      id: "a4",
      timestamp: "2025-04-26T09:30:00Z",
      text: "Status changed to In Progress by Alice",
    },
  ],
};
// --- End Mock Data ---

const TaskDetailPage = () => {
  const params = useParams();
  const taskId = params.id; // Get task ID from route
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);

  // Simulate fetching task data
  useEffect(() => {
    setLoading(true);
    // In a real app, fetch data based on taskId
    // fetch(`/api/tasks/${taskId}`).then(res => res.json()).then(data => setTask(data));
    console.log(`Fetching task details for ID: ${taskId}`);
    // Use mock data for now
    setTimeout(() => {
      setTask(MOCK_TASK_DETAILS); // Use the mock data matching the ID structure if needed
      setLoading(false);
    }, 500); // Simulate network delay
  }, [taskId]);

  // Handlers for component interactions (UI only for now)
  const handleAddComment = (commentText) => {
    console.log("Adding comment:", commentText);
    // Update mock data (in real app, send to API)
    const newComment = {
      id: `c${Date.now()}`,
      user: { name: "Current User", avatarUrl: "/avatars/user.png" }, // Replace with actual user
      timestamp: new Date().toISOString(),
      text: commentText,
    };
    setTask((prevTask) => ({
      ...prevTask,
      comments: [...prevTask.comments, newComment],
    }));
  };

  const handleAssigneeChange = (newAssignees) => {
    console.log("Updating assignees:", newAssignees);
    // Update mock data
    setTask((prevTask) => ({
      ...prevTask,
      assignees: newAssignees,
    }));
  };

  if (loading) {
    return <div className="p-6">Loading task details...</div>;
  }

  if (!task) {
    return <div className="p-6 text-red-600">Task not found.</div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Back Button */}
      <Link
        href="/admin/tasks"
        className="inline-flex items-center text-sm text-primary hover:underline mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to Tasks
      </Link>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details & Assignees */}
        <div className="lg:col-span-2 space-y-6">
          <TaskDetailCard task={task} />
          <TaskAssignees
            assignees={task.assignees}
            onAssigneesChange={handleAssigneeChange}
            taskId={task.id}
            // Pass potential assignees list if needed for reassignment dropdown
            // potentialAssignees={MOCK_POTENTIAL_ASSIGNEES}
          />
        </div>

        {/* Right Column: Activity & Comments */}
        <div className="lg:col-span-1 space-y-6">
          <TaskActivityLog activities={task.activityLog} />
          <TaskComments
            comments={task.comments}
            onAddComment={handleAddComment}
          />
        </div>
      </div>
    </div>
  );
};

export default TaskDetailPage;
