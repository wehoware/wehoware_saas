'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import SelectInput from "@/components/ui/select"; // Assuming this is the correct path for your SelectInput

const TaskForm = ({ initialData = null, onSubmit, users = [], isLoading = false, submitButtonText = 'Submit Task' }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [status, setStatus] = useState('To Do');
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setDescription(initialData.description || '');
      // Handle assignee: initialData.assignees might be an array
      const currentAssignee = initialData.assignees && initialData.assignees.length > 0 
                              ? initialData.assignees[0] // Assuming single assignee for simplicity in form
                              : null;
      setAssigneeId(currentAssignee ? currentAssignee.id : (initialData.assigneeId || ''));
      setDueDate(initialData.dueDate ? initialData.dueDate.split('T')[0] : ''); // Format for date input
      setPriority(initialData.priority || 'Medium');
      setStatus(initialData.status || 'To Do');
    }
  }, [initialData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title || !assigneeId || !priority || !status) {
      setError('Title, Assignee, Priority, and Status are required.');
      return;
    }

    const taskData = {
      title,
      description,
      assigneeId, // In edit mode, this would be the ID of the selected user
      dueDate,
      priority,
      status,
    };
    
    // If editing, include the task ID
    if (initialData && initialData.id) {
      taskData.id = initialData.id;
    }

    onSubmit(taskData);
  };

  const assigneeOptions = users.map(user => ({ value: user.id, label: user.name }));
  const priorityOptions = [
    { value: 'Low', label: 'Low' },
    { value: 'Medium', label: 'Medium' },
    { value: 'High', label: 'High' }
  ];
  const statusOptions = [
    { value: 'To Do', label: 'To Do' },
    { value: 'In Progress', label: 'In Progress' },
    { value: 'Done', label: 'Done' }
  ];

  const handleSelectChange = (e) => {
    const { name, value } = e.target;
    if (name === 'assignee') setAssigneeId(value);
    if (name === 'priority') setPriority(value);
    if (name === 'status') setStatus(value);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-center sm:gap-x-4">
        <Label htmlFor="title" className="sm:text-right sm:col-span-1">Title *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="sm:col-span-3"
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-start sm:gap-x-4">
        <Label htmlFor="description" className="sm:text-right sm:col-span-1 sm:pt-2">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="sm:col-span-3"
          placeholder="Provide task details..."
          rows={4}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-center sm:gap-x-4">
        <Label htmlFor="assignee" className="sm:text-right sm:col-span-1">Assignee *</Label>
        <SelectInput
          id="assignee"
          name="assignee"
          options={assigneeOptions} // Use users prop
          value={assigneeId}
          onChange={handleSelectChange}
          className="sm:col-span-3"
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-center sm:gap-x-4">
        <Label htmlFor="dueDate" className="sm:text-right sm:col-span-1">Due Date</Label>
        <Input
          id="dueDate"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="sm:col-span-3"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-center sm:gap-x-4">
        <Label htmlFor="priority" className="sm:text-right sm:col-span-1">Priority *</Label>
        <SelectInput
          id="priority"
          name="priority"
          options={priorityOptions}
          value={priority}
          onChange={handleSelectChange}
          className="sm:col-span-3"
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-center sm:gap-x-4">
        <Label htmlFor="status" className="sm:text-right sm:col-span-1">Status *</Label>
        <SelectInput
          id="status"
          name="status"
          options={statusOptions}
          value={status}
          onChange={handleSelectChange}
          className="sm:col-span-3"
          required
        />
      </div>

      {error && <p className="text-red-500 text-sm text-center sm:col-span-4">{error}</p>}

      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : submitButtonText}
        </Button>
      </div>
    </form>
  );
};

export default TaskForm;
