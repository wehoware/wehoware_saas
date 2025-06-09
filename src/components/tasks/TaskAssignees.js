import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { UserPlus, X } from 'lucide-react';
// import SelectInput from '@/components/ui/select'; // Needed for adding/reassigning

const TaskAssignees = ({ assignees = [], onAssigneesChange, taskId, potentialAssignees = [] }) => {
  const [isEditing, setIsEditing] = useState(false); // State to manage add/remove UI

  // Placeholder handlers - Implement logic later
  const handleAddAssignee = (userId) => {
    console.log(`Add assignee ${userId} to task ${taskId}`);
    // In real app: call API, then call onAssigneesChange with updated list
    const newUser = potentialAssignees.find(u => u.id === userId);
    if(newUser && !assignees.some(a => a.id === userId)) {
        onAssigneesChange([...assignees, newUser]);
    }
     setIsEditing(false); // Close edit mode after adding
  };

  const handleRemoveAssignee = (userId) => {
    console.log(`Remove assignee ${userId} from task ${taskId}`);
    // In real app: call API, then call onAssigneesChange
    onAssigneesChange(assignees.filter(a => a.id !== userId));
  };

  // Prepare options for potential assignees select (if implementing add/reassign)
  const assigneeOptions = potentialAssignees
    .filter(p => !assignees.some(a => a.id === p.id)) // Filter out already assigned
    .map(user => ({ value: user.id, label: user.name }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">Assignees</CardTitle>
        {/* Toggle Add/Reassign UI - Simple version */} 
        <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)}>
           {isEditing ? 'Cancel' : <UserPlus className="w-4 h-4 mr-1" />} {isEditing ? '' : 'Modify'}
        </Button>
      </CardHeader>
      <CardContent>
        {isEditing && (
          <div className="mb-4">
            <p className='text-sm mb-2'>Select user to add:</p>
            <p className='text-xs text-muted-foreground'>Add Assignee Dropdown UI goes here.</p>
          </div>
        )}
        <div className="space-y-3">
          {assignees.length > 0 ? (
            assignees.map((assignee) => (
              <div key={assignee.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={assignee.avatarUrl || ''} alt={assignee.name} />
                    <AvatarFallback>{assignee.name?.charAt(0)?.toUpperCase() || '?'}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{assignee.name}</span>
                </div>
                {isEditing && (
                   <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveAssignee(assignee.id)}>
                      <X className="w-4 h-4" />
                   </Button>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No one assigned yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TaskAssignees;
