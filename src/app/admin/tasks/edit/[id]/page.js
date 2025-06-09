'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminPageHeader from '@/components/AdminPageHeader';
import TaskForm from '@/components/tasks/TaskForm.js'; // Ensure .js extension if that's what you use
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

// Mock data - In a real app, this would come from an API or state management
const MOCK_TASKS = [
  {
    id: 'task-001', 
    title: 'Review Website Content',
    description: 'Detailed review of all public-facing website content for accuracy and tone.',
    clientName: 'Acme Corp', 
    assignees: [{ id: 'user-1', name: 'Alice' }], 
    dueDate: '2025-05-10',
    status: 'In Progress',
    priority: 'High',
  },
  {
    id: 'task-002',
    title: 'Prepare Marketing Report',
    description: 'Compile Q2 marketing report including campaign performance and budget analysis.',
    clientName: 'Beta Solutions',
    assignees: [{ id: 'user-2', name: 'Bob' }],
    dueDate: '2025-05-15',
    status: 'To Do',
    priority: 'Medium',
  },
  {
    id: 'task-003',
    title: 'Update SEO Keywords',
    description: 'Research and update SEO keywords based on latest trends for Gamma Inc. blog.',
    clientName: 'Gamma Inc.',
    assignees: [{ id: 'user-1', name: 'Alice' }, { id: 'user-3', name: 'Charlie (Admin)' }], 
    dueDate: '2025-05-20',
    status: 'Done',
    priority: 'Low',
  },
];

const MOCK_USERS = [
  { id: 'user-1', name: 'Alice' },
  { id: 'user-2', name: 'Bob' },
  { id: 'user-3', name: 'Charlie (Admin)' },
  { id: 'user-4', name: 'David' },
  { id: 'unassigned', name: 'Unassigned' }
];

export default function EditTaskPage() {
  const router = useRouter();
  const params = useParams();
  const taskId = params.id;

  const [task, setTask] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    if (taskId) {
      setIsFetching(true);
      // Simulate API call
      setTimeout(() => {
        const foundTask = MOCK_TASKS.find(t => t.id === taskId);
        if (foundTask) {
          setTask(foundTask);
        } else {
          // Handle task not found, e.g., redirect or show error
          console.error('Task not found');
        }
        setIsFetching(false);
      }, 500);
    }
  }, [taskId]);

  const handleFormSubmit = async (formData) => {
    setIsLoading(true);
    console.log('Updating task:', taskId, formData);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    // In a real app, you would update the task in your backend/state
    // For now, we'll just log and navigate
    // TODO: Update the MOCK_TASKS array or use a state management solution for persistence across pages
    setIsLoading(false);
    router.push('/admin/tasks'); // Navigate back to tasks list
  };

  if (isFetching) {
    return <div className="container mx-auto p-6">Loading task details...</div>;
  }

  if (!task) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-red-500">Task not found.</p>
        <Link href="/admin/tasks" className="text-primary hover:underline mt-4 inline-block">
          &larr; Back to Tasks
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 space-y-6">
      <AdminPageHeader
        title={`Edit Task: ${task.title}`}
        description={`Update details for task ID: ${task.id}`}
        showBackButton={true}
        backButtonHref="/admin/tasks"
      />
      
      <Card>
        <CardHeader>
          <CardTitle>Task Details</CardTitle>
          <CardDescription>Modify the task information below.</CardDescription>
        </CardHeader>
        <CardContent>
          <TaskForm 
            initialData={task}
            onSubmit={handleFormSubmit}
            users={MOCK_USERS} // Pass the list of users for assignee dropdown
            isLoading={isLoading}
            submitButtonText="Save Changes"
          />
        </CardContent>
      </Card>
    </div>
  );
}
