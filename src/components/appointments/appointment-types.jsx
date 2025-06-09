"use client";

import { useState } from 'react';
import { Plus, Edit, Trash, Clock, Globe, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog.jsx';

// Temporary data for appointment types
const initialAppointmentTypes = [
  {
    id: '1',
    name: '15-Minute Meeting',
    description: 'Quick chat to discuss basic questions and inquiries',
    duration: 15,
    color: '#4f46e5',
    link: 'acme-co/15-min',
    active: true,
    requiresConfirmation: false,
    price: null
  },
  {
    id: '2',
    name: '30-Minute Consultation',
    description: 'In-depth discussion about your project needs',
    duration: 30,
    color: '#0891b2',
    link: 'acme-co/consultation',
    active: true,
    requiresConfirmation: true,
    price: 25
  },
  {
    id: '3',
    name: '1-Hour Strategy Session',
    description: 'Comprehensive review of your business strategy',
    duration: 60,
    color: '#ca8a04',
    link: 'acme-co/strategy',
    active: true,
    requiresConfirmation: true,
    price: 75
  }
];

export function AppointmentTypes() {
  const [appointmentTypes, setAppointmentTypes] = useState(initialAppointmentTypes);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentType, setCurrentType] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState(null);

  const handleCreateNew = () => {
    setCurrentType({
      id: Date.now().toString(),
      name: '',
      description: '',
      duration: 30,
      color: '#4f46e5',
      link: '',
      active: true,
      requiresConfirmation: false,
      price: null
    });
    setIsCreating(true);
  };

  const handleEdit = (type) => {
    setCurrentType({...type});
    setIsEditing(true);
  };

  const handleDelete = (type) => {
    setTypeToDelete(type);
    setDeleteDialog(true);
  };

  const confirmDelete = () => {
    setAppointmentTypes(appointmentTypes.filter(t => t.id !== typeToDelete.id));
    setDeleteDialog(false);
    setTypeToDelete(null);
  };

  const handleSave = () => {
    if (isCreating) {
      setAppointmentTypes([...appointmentTypes, currentType]);
      setIsCreating(false);
    } else if (isEditing) {
      setAppointmentTypes(appointmentTypes.map(t => 
        t.id === currentType.id ? currentType : t
      ));
      setIsEditing(false);
    }
    setCurrentType(null);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setIsEditing(false);
    setCurrentType(null);
  };

  const handleCopyLink = (link) => {
    navigator.clipboard.writeText(`https://example.com/${link}`);
    // You would typically add a toast notification here
    alert('Link copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Appointment Types</h2>
        <Button onClick={handleCreateNew}>
          <Plus className="mr-2 h-4 w-4" /> New Appointment Type
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {appointmentTypes.map((type) => (
          <Card key={type.id} className="p-4 flex flex-col h-full">
            <div className="flex items-start justify-between">
              <div 
                className="w-4 h-4 rounded-full mt-1" 
                style={{ backgroundColor: type.color }}
              />
              <div className="ml-2 flex-1">
                <h3 className="font-semibold text-lg">{type.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{type.description}</p>
              </div>
              <div className="flex space-x-2">
                <Button variant="ghost" size="icon" onClick={() => handleEdit(type)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(type)}>
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="mt-4 space-y-2 flex-1">
              <div className="flex items-center text-sm">
                <Clock className="h-4 w-4 mr-2" />
                <span>{type.duration} minutes</span>
              </div>

              <div className="flex items-center text-sm">
                <Globe className="h-4 w-4 mr-2" />
                <span className="truncate">{type.link}</span>
                <Button variant="ghost" size="icon" className="ml-1" onClick={() => handleCopyLink(type.link)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t flex justify-between items-center">
              <div className="text-sm">
                {type.price ? `$${type.price}` : 'Free'}
              </div>
              <div className="flex items-center">
                <span className="text-sm mr-2">Active</span>
                <Switch checked={type.active} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Form Dialog for Creating/Editing */}
      {(isCreating || isEditing) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {isCreating ? 'Create New Appointment Type' : 'Edit Appointment Type'}
            </h2>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input 
                  id="name"
                  value={currentType?.name} 
                  onChange={(e) => setCurrentType({...currentType, name: e.target.value})} 
                />
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea 
                  id="description"
                  value={currentType?.description} 
                  onChange={(e) => setCurrentType({...currentType, description: e.target.value})} 
                />
              </div>
              
              <div>
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input 
                  id="duration"
                  type="number" 
                  value={currentType?.duration} 
                  onChange={(e) => setCurrentType({...currentType, duration: parseInt(e.target.value)})} 
                />
              </div>
              
              <div>
                <Label htmlFor="color">Color</Label>
                <div className="flex items-center space-x-2">
                  <Input 
                    id="color"
                    type="color"
                    value={currentType?.color} 
                    onChange={(e) => setCurrentType({...currentType, color: e.target.value})} 
                    className="w-12 h-12 p-1"
                  />
                  <span>{currentType?.color}</span>
                </div>
              </div>
              
              <div>
                <Label htmlFor="link">Custom Link</Label>
                <div className="flex items-center">
                  <span className="text-sm text-gray-500 mr-1">example.com/</span>
                  <Input 
                    id="link"
                    value={currentType?.link} 
                    onChange={(e) => setCurrentType({...currentType, link: e.target.value})} 
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="price">Price (leave empty for free)</Label>
                <Input 
                  id="price"
                  type="number" 
                  value={currentType?.price || ''} 
                  onChange={(e) => setCurrentType({...currentType, price: e.target.value ? parseInt(e.target.value) : null})} 
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="requiresConfirmation" className="cursor-pointer">
                  Requires confirmation
                </Label>
                <Switch 
                  id="requiresConfirmation"
                  checked={currentType?.requiresConfirmation} 
                  onCheckedChange={(checked) => setCurrentType({...currentType, requiresConfirmation: checked})} 
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="active" className="cursor-pointer">
                  Active
                </Label>
                <Switch 
                  id="active"
                  checked={currentType?.active} 
                  onCheckedChange={(checked) => setCurrentType({...currentType, active: checked})} 
                />
              </div>
            </div>
            
            <div className="mt-6 flex justify-end space-x-2">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                {isCreating ? 'Create' : 'Save Changes'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the appointment type "{typeToDelete?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
