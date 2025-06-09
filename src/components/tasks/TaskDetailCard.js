import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

// Helper function for status badge variant (copied from TaskList for consistency)
const getStatusVariant = (status) => {
  switch (status?.toLowerCase()) {
    case 'in progress': return 'blue';
    case 'done': return 'green';
    case 'to do': default: return 'secondary';
  }
};

// Helper function for priority badge variant (copied from TaskList for consistency)
const getPriorityVariant = (priority) => {
  switch (priority?.toLowerCase()) {
    case 'high': return 'destructive';
    case 'medium': return 'yellow';
    case 'low': default: return 'outline';
  }
};

const TaskDetailCard = ({ task }) => {
  if (!task) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-2xl mb-1">{task.title}</CardTitle>
            <CardDescription>Task ID: {task.id} | Client: {task.clientName || 'N/A'}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant={getStatusVariant(task.status)}>{task.status || 'N/A'}</Badge>
            <Badge variant={getPriorityVariant(task.priority)}>{task.priority || 'N/A'}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-semibold mb-1">Description</h4>
          <p className="text-sm text-muted-foreground">{task.description || 'No description provided.'}</p>
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-semibold">Created By</p>
            <p className="text-muted-foreground">{task.creator?.name || 'N/A'}</p>
          </div>
          <div>
            <p className="font-semibold">Created At</p>
            <p className="text-muted-foreground">{task.createdAt ? new Date(task.createdAt).toLocaleString() : 'N/A'}</p>
          </div>
          <div>
            <p className="font-semibold">Due Date</p>
            <p className="text-muted-foreground">{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}</p>
          </div>
           <div>
            <p className="font-semibold">Last Updated</p>
            <p className="text-muted-foreground">{task.updatedAt ? new Date(task.updatedAt).toLocaleString() : 'N/A'}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TaskDetailCard;
