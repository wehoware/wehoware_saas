'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminPageHeader from '@/components/AdminPageHeader';
import TaskForm from '@/components/tasks/TaskForm';
import CommentForm from '@/components/tasks/CommentForm';
import ActivityFeed from '@/components/tasks/ActivityFeed';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'react-hot-toast';

export default function EditTaskPage() {
  const router = useRouter();
  const params = useParams();
  const taskId = params.id;

  const [task, setTask] = useState(null);
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState(null);
  const [feed, setFeed] = useState([]);

  useEffect(() => {
    if (!taskId) return;

    const fetchData = async () => {
      setIsFetching(true);
      setError(null);
      try {
        const [taskResponse, usersResponse, feedResponse, clientsResponse] = await Promise.all([
          fetch(`/api/v1/tasks/${taskId}`),
          fetch('/api/v1/users'),
          fetch(`/api/v1/tasks/${taskId}/activities`),
          fetch('/api/v1/clients') // Fetch clients
        ]);

        if (!taskResponse.ok) {
          throw new Error(`Failed to fetch task: ${taskResponse.statusText}`);
        }
        const taskData = await taskResponse.json();
        setTask(taskData);

        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          setUsers(usersData.users || []); // Correctly extract the array
        } else {
          console.warn('Could not fetch users.');
        }

        if (feedResponse.ok) {
          const feedData = await feedResponse.json();
          setFeed(feedData);
        } else {
          console.warn('Could not fetch activity feed.');
        }

        if (clientsResponse.ok) {
          const clientsData = await clientsResponse.json();
          setClients(clientsData.clients); // Assuming API returns { clients: [...] }
        } else {
          console.warn('Could not fetch clients.');
        }

      } catch (err) {
        setError(err.message);
        toast.error(`Error: ${err.message}`);
      } finally {
        setIsFetching(false);
      }
    };

    fetchData();
  }, [taskId]);

  const handleUpdateTask = async (formData) => {
    setIsLoading(true);
    const promise = fetch(`/api/v1/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    }).then(async (res) => {
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Update failed and error response was not valid JSON.'}));
        throw new Error(errorData.error || `Request failed with status ${res.status}`);
      }
      return res.json();
    });

    toast.promise(promise, {
      loading: 'Updating task...',
      success: () => {
        router.push('/admin/tasks');
        return 'Task updated successfully!';
      },
      error: (err) => err.message || 'Failed to update task.',
    });

    try {
      await promise;
    } catch (e) {
      // Error is handled by toast.promise, this catch prevents unhandled promise rejection
    } finally {
      setIsLoading(false);
    }
  };

  const handleCommentAdded = () => {
    // Refetch the feed to show the new comment and activity
    fetch(`/api/v1/tasks/${taskId}/activities`)
      .then(res => res.json())
      .then(setFeed)
      .catch(err => console.warn('Could not refetch activity feed.', err));
  };

  if (isFetching) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6 space-y-6">
        <Skeleton className="h-10 w-1/2" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-4 w-1/3 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 text-center">
        <p className="text-red-500">{error}</p>
        <Link href="/admin/tasks" className="text-primary hover:underline mt-4 inline-block">
          &larr; Back to Tasks
        </Link>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="container mx-auto p-6 text-center">
        <p>Task not found.</p>
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
            onSubmit={handleUpdateTask}
            users={users}
            clients={clients} // Pass clients to TaskForm
            isLoading={isLoading}
            submitButtonText="Save Changes"
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
            <CardTitle>Comments</CardTitle>
        </CardHeader>
        <CardContent>
            <CommentForm taskId={taskId} onCommentAdded={handleCommentAdded} />
        </CardContent>
      </Card>
      <ActivityFeed feed={feed} />
    </div>
  );
}
