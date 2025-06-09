// Placeholder for Assign Task Sheet Component
import React, { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import SelectInput from "@/components/ui/select";

// Mock Assignees - replace with actual data fetched based on active client/roles
const MOCK_ASSIGNEES = [
  { id: 'emp1', name: 'Alice' },
  { id: 'emp2', name: 'Bob' },
  { id: 'admin1', name: 'Charlie (Admin)' },
];

const AssignTaskSheet = ({ isOpen, onOpenChange, onTaskAssigned }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState(''); // Using native date input for now
  const [priority, setPriority] = useState('Medium');
  const [status, setStatus] = useState('To Do');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title || !assigneeId || !priority || !status) {
      setError('Title, Assignee, Priority, and Status are required.');
      return;
    }

    const newTaskData = {
      title,
      description,
      assigneeId, // Send ID to backend
      dueDate, // Ensure format is acceptable by backend
      priority,
      status,
      // TODO: Add activeClientId when submitting
      // clientId: activeClientId
    };

    console.log('Submitting new task:', newTaskData);

    // TODO: Replace with actual API call
    // try {
    //   const response = await fetch('/api/v1/tasks', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify(newTaskData),
    //   });
    //   if (!response.ok) {
    //     const errData = await response.json();
    //     throw new Error(errData.error || 'Failed to assign task');
    //   }
    //   const result = await response.json();
       // Mock result for frontend update
       const result = { task: { ...newTaskData, assignee: MOCK_ASSIGNEES.find(a => a.id === assigneeId) } }; 
       onTaskAssigned(result.task); // Pass the newly created task back
       // Clear form on success
       setTitle('');
       setDescription('');
       setAssigneeId('');
       setDueDate('');
       setPriority('Medium');
       setStatus('To Do');
       onOpenChange(false); // Close the sheet
    // } catch (err) {
    //   console.error('Error assigning task:', err);
    //   setError(err.message);
    // }
  };

  // Prepare options for SelectInput
  const assigneeOptions = MOCK_ASSIGNEES.map(emp => ({ value: emp.id, label: emp.name }));
  const priorityOptions = [
    { value: 'Low', label: 'Low' },
    { value: 'Medium', label: 'Medium' },
    { value: 'High', label: 'High' }
  ];
  const statusOptions = [
    { value: 'To Do', label: 'To Do' },
    { value: 'In Progress', label: 'In Progress' }
    // { value: 'Done', label: 'Done' } // Usually start as To Do
  ];

  // Handler for SelectInput (it provides the { target: { name, value } } structure)
  const handleSelectChange = (e) => {
    const { name, value } = e.target;
    if (name === 'assignee') setAssigneeId(value);
    if (name === 'priority') setPriority(value);
    if (name === 'status') setStatus(value);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <SheetHeader>
            <SheetTitle>Assign New Task</SheetTitle>
            <SheetDescription>
              Fill in the details below to assign a new task.
              Tasks are associated with the currently active client.
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-4 py-6">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">
                Title *
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="description" className="text-right pt-2">
                Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="col-span-3"
                placeholder="Provide task details..."
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="assignee" className="text-right">
                Assignee *
              </Label>
              <SelectInput
                id="assignee"
                name="assignee"
                options={assigneeOptions}
                value={assigneeId}
                onChange={handleSelectChange}
                required
                // Add placeholder functionality if needed in SelectInput component or handle default value
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="dueDate" className="text-right">
                Due Date
              </Label>
              {/* Using native date input for now */}
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="priority" className="text-right">
                Priority *
              </Label>
              <SelectInput
                id="priority"
                name="priority"
                options={priorityOptions}
                value={priority}
                onChange={handleSelectChange}
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">
                Status *
              </Label>
              <SelectInput
                id="status"
                name="status"
                options={statusOptions}
                value={status}
                onChange={handleSelectChange}
                required
              />
            </div>

            {error && <p className="text-red-500 text-sm col-span-4 text-center">{error}</p>}

          </div>

          <SheetFooter>
            <SheetClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </SheetClose>
            <Button type="submit">Assign Task</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default AssignTaskSheet;
