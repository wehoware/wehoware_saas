// Placeholder for Task Details Sheet Component
import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator'; // Assuming you have this

const TaskDetailsSheet = ({ task, isOpen, onOpenChange /*, onUpdate, onDelete */ }) => {
  if (!task) return null;

  const getStatusVariant = (status) => {
      switch (status) {
          case 'To Do': return 'secondary';
          case 'In Progress': return 'default';
          case 'Done': return 'outline';
          default: return 'secondary';
      }
  };

  const getPriorityVariant = (priority) => {
      switch (priority) {
          case 'High': return 'destructive';
          case 'Medium': return 'warning'; // Or 'default'
          case 'Low': return 'secondary';
          default: return 'secondary';
      }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Task Details</SheetTitle>
          <SheetDescription>Viewing details for task ID: {task.id}</SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-4">
          <h3 className="text-lg font-semibold mb-2">{task.title}</h3>
          
          {task.description && (
            <p className="text-sm text-muted-foreground">{task.description}</p>
          )}
          {!task.description && (
            <p className="text-sm text-muted-foreground italic">No description provided.</p>
          )}

          <Separator />

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div className="font-medium">Status:</div>
            <div><Badge variant={getStatusVariant(task.status)}>{task.status}</Badge></div>

            <div className="font-medium">Priority:</div>
            <div><Badge variant={getPriorityVariant(task.priority)}>{task.priority}</Badge></div>
            
            <div className="font-medium">Assignee:</div>
            <div>{task.assignee?.name || 'Unassigned'}</div>

            <div className="font-medium">Due Date:</div>
            <div>{task.dueDate || 'Not set'}</div>
            
            {/* Add Reporter, Client, Created/Updated if available in task data */}
            {/* <div className="font-medium">Reporter:</div>
            <div>{task.reporter?.name || 'N/A'}</div> */} 

            {/* <div className="font-medium">Client:</div>
            <div>{task.client?.name || 'N/A'}</div> */} 

             {/* <div className="font-medium">Created:</div>
            <div>{task.createdAt ? new Date(task.createdAt).toLocaleString() : 'N/A'}</div>

            <div className="font-medium">Updated:</div>
            <div>{task.updatedAt ? new Date(task.updatedAt).toLocaleString() : 'N/A'}</div>  */}
          </div>

          {/* TODO: Add Comments section */}
          {/* <Separator />
          <h4 className="font-medium">Comments</h4>
          <div className="text-sm text-muted-foreground italic">Comments feature coming soon...</div> */}
        
        </div>

        <SheetFooter>
          <SheetClose asChild>
            <Button type="button" variant="outline">Close</Button>
          </SheetClose>
          {/* TODO: Add Edit/Delete buttons based on permissions */}
          {/* <Button variant="secondary">Edit</Button> */}
          {/* <Button variant="destructive">Delete</Button> */}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default TaskDetailsSheet;
