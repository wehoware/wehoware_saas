"use client";

import { useState, useEffect } from 'react';
import { Calendar, Clock, LayoutGrid, Settings } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppointmentCalendarView } from '@/components/appointments/calendar-view';
import { UpcomingAppointments } from '@/components/appointments/upcoming-appointments';
import { AppointmentTypes } from '@/components/appointments/appointment-types';
import { AppointmentSettings } from '@/components/appointments/appointment-settings';
import toast from 'react-hot-toast';

export default function AppointmentsPage() {
  const [activeTab, setActiveTab] = useState("calendar");
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAppointments() {
      try {
        const res = await fetch('/api/v1/appointments');
        if (!res.ok) throw new Error('Failed to fetch appointments');
        const json = await res.json();
        const mapped = (json.data || []).map((a) => ({
          id: a.id,
          name: a.guest_name,
          email: a.guest_email,
          type: a.appointment_type?.name ?? null,
          date: a.scheduled_at,
          status: a.status,
        }));
        setAppointments(mapped);
      } catch (err) {
        console.error(err);
        toast.error('Could not load appointments');
      } finally {
        setLoading(false);
      }
    }

    fetchAppointments();
  }, []);

  const handleSlotSelect = (dateTime) => {
    console.log('Selected slot:', dateTime);
    toast('Selected time slot: ' + dateTime.toString());
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
              appointments={appointments}
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
