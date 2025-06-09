"use client";

import { useState } from 'react';
import { Calendar, Clock, LayoutGrid, Settings } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppointmentCalendarView } from '@/components/appointments/calendar-view';
import { UpcomingAppointments } from '@/components/appointments/upcoming-appointments';
import { AppointmentTypes } from '@/components/appointments/appointment-types';
import { AppointmentSettings } from '@/components/appointments/appointment-settings';

// Mock data for sample appointments
const sampleAppointments = [
  {
    id: '1',
    name: 'John Smith',
    email: 'john.smith@example.com',
    type: '15-Minute Meeting',
    date: '2025-04-27T10:00:00',
    status: 'confirmed',
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    email: 'sarah.j@example.com',
    type: '30-Minute Consultation',
    date: '2025-04-27T14:30:00',
    status: 'pending',
  },
  {
    id: '3',
    name: 'Michael Brown',
    email: 'michael.b@example.com',
    type: '1-Hour Strategy Session',
    date: '2025-04-28T11:00:00',
    status: 'confirmed',
  },
];

export default function AppointmentsPage() {
  const [activeTab, setActiveTab] = useState("calendar");
  
  const handleSlotSelect = (dateTime) => {
    console.log('Selected slot:', dateTime);
    // In a real app, this would open a "create appointment" dialog
    alert(`Selected time slot: ${dateTime.toString()}`);
  };

  return (
    <div className="container px-4 py-6 max-w-7xl mx-auto">
      <div className="flex flex-col space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Appointments</h1>
          <p className="text-gray-500 mt-1">Manage your calendar, appointment types, and scheduling settings</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="calendar" className="flex items-center">
              <Calendar className="h-4 w-4 mr-2" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="flex items-center">
              <Clock className="h-4 w-4 mr-2" />
              Upcoming
            </TabsTrigger>
            <TabsTrigger value="types" className="flex items-center">
              <LayoutGrid className="h-4 w-4 mr-2" />
              Appointment Types
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="calendar" className="mt-0">
            <AppointmentCalendarView 
              appointments={sampleAppointments}
              onSlotSelect={handleSlotSelect}
            />
          </TabsContent>
          
          <TabsContent value="upcoming" className="mt-0">
            <UpcomingAppointments />
          </TabsContent>
          
          <TabsContent value="types" className="mt-0">
            <AppointmentTypes />
          </TabsContent>
          
          <TabsContent value="settings" className="mt-0">
            <AppointmentSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}