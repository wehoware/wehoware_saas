'use client';

import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ClipboardList } from 'lucide-react';
import TaskForm from './TaskForm';

const AssignTaskSheet = ({ isOpen, onOpenChange, onTaskCreated, users = [], clients = [], currentUser = null, lockedClientId = null }) => {

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
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <SheetTitle>Create New Task</SheetTitle>
            <SheetDescription>
              Fill in the details below to create a new task.
            </SheetDescription>
          </div>
        </SheetHeader>
        <div className="py-6">
          <TaskForm
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            users={users}
            clients={clients}
            isLoading={isSubmitting}
            submitButtonText="Create Task"
            currentUser={currentUser}
            lockedClientId={lockedClientId}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AssignTaskSheet;
