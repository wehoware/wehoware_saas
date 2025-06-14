'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminPageHeader from '@/components/AdminPageHeader';
import TaskForm from '@/components/tasks/TaskForm';
import TaskComments from '@/components/tasks/TaskComments'; // Use TaskComments
import TaskActivityLog from '@/components/tasks/TaskActivityLog'; // Use TaskActivityLog
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'react-hot-toast';

const formatActivity = (activity, usersList) => {
  const { activity_type, details, user } = activity;
  const userName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'System' : 'System';

  const findUserNameById = (userId) => {
    const foundUser = usersList.find(u => u.id === userId);
    return foundUser ? `${foundUser.first_name || ''} ${foundUser.last_name || ''}`.trim() : 'Unknown User';
  };

  switch (activity_type) {
    case 'created':
      return `${userName} created task: "${details.title}"`;
    case 'title_change':
      return `${userName} changed title from "${details.from}" to "${details.to}"`;
    case 'description_change':
      return `${userName} updated the description.`; // Details can be long
    case 'status_change':
      return `${userName} changed status from "${details.from}" to "${details.to}"`;
    case 'priority_change':
      return `${userName} changed priority from "${details.from}" to "${details.to}"`;
    case 'due_date_change':
      const fromDate = details.from ? new Date(details.from).toLocaleDateString() : 'none';
      const toDate = details.to ? new Date(details.to).toLocaleDateString() : 'none';
      return `${userName} changed due date from ${fromDate} to ${toDate}`;
    case 'assignee_id_change':
      const fromAssignee = details.from ? findUserNameById(details.from) : 'Unassigned';
      const toAssignee = details.to ? findUserNameById(details.to) : 'Unassigned';
      return `${userName} changed assignee from ${fromAssignee} to ${toAssignee}`;
    case 'commented': // Should be filtered out, but as a fallback
      return `${userName} commented on the task.`;
    default:
      return `${userName} performed an action: ${activity_type} - ${JSON.stringify(details)}`;
  }
};

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
  const [allActivities, setAllActivities] = useState([]); // Renamed from feed
  const [comments, setComments] = useState([]);
  const [otherActivities, setOtherActivities] = useState([]);

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
          setAllActivities(feedData); // Store all fetched activities

          // Filter for comments and other activities from the combined feed
          const commentsData = [];
          const otherActivitiesData = [];
          // Sort feedData to ensure oldest is first for chat-style display if TaskComments doesn't reverse
          // However, API already sends newest first, and TaskComments reverses, so newest will be at bottom.
          // We will keep newest first from API for activities log.

          (feedData || []).forEach(item => {
            if (item.feed_type === 'comment') {
              commentsData.push({
                id: item.id,
                text: item.content,
                user: item.user,
                timestamp: item.created_at
              });
            } else if (item.feed_type === 'activity') {
              // Exclude 'commented' activity_type from the general activity log if they are also feed_type: 'activity'
              if (item.activity_type === 'commented') return;

              let activityText = formatActivity(item, users);
              otherActivitiesData.push({
                ...item,
                text: activityText 
              });
            }
          });
          setComments(commentsData);
          setOtherActivities(otherActivitiesData);

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

  const handleAddComment = async (commentText) => {
    if (!commentText.trim()) return;
    try {
      const response = await fetch(`/api/v1/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to post comment');
      }
      // Refetch all activities to update both comments and activity log
      const feedResponse = await fetch(`/api/v1/tasks/${taskId}/activities`);
      if (feedResponse.ok) {
        const feedData = await feedResponse.json();
        setAllActivities(feedData);
        // Re-filter comments and activities from the combined feed
        const commentsData = [];
        const otherActivitiesData = [];
        (feedData || []).forEach(item => {
          if (item.feed_type === 'comment') {
            commentsData.push({
              id: item.id,
              text: item.content,
              user: item.user,
              timestamp: item.created_at
            });
          } else if (item.feed_type === 'activity') {
            if (item.activity_type === 'commented') return;

            let activityText = formatActivity(item, users);
            otherActivitiesData.push({
              ...item,
              text: activityText
            });
          }
        });
        setComments(commentsData);
        setOtherActivities(otherActivitiesData);
      }
      toast.success('Comment added!');
    } catch (err) {
      toast.error(err.message || 'Could not add comment.');
      console.error('Failed to add comment:', err);
    }
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
      {/* Comments Section */}
      <TaskComments comments={comments} onAddComment={handleAddComment} />

      {/* Activity Log Section */}
      <TaskActivityLog activities={otherActivities} />
    </div>
  );
}
