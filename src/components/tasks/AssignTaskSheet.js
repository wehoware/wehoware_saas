'use client';

import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import TaskForm from './TaskForm';

const AssignTaskSheet = ({ isOpen, onOpenChange, onTaskCreated, users = [], clients = [] }) => {

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (taskData) => {
    setIsSubmitting(true);
    // The onTaskCreated function from TasksPage handles the API call,
    // toasts, and closing the sheet.
    onTaskCreated(taskData).finally(() => {
      setIsSubmitting(false);
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create New Task</SheetTitle>
          <SheetDescription>
            Fill in the details below to create a new task.
          </SheetDescription>
        </SheetHeader>
        <div className="py-6">
          <TaskForm
            onSubmit={handleSubmit}
            users={users}
            clients={clients} // Pass clients to TaskForm
            isLoading={isSubmitting}
            submitButtonText="Create Task"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AssignTaskSheet;
