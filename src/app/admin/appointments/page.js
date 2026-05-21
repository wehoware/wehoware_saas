"use client";

import { useState, useEffect } from 'react';
import { Calendar, Clock, LayoutGrid, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppointmentCalendarView } from '@/components/appointments/calendar-view';
import { UpcomingAppointments } from '@/components/appointments/upcoming-appointments';
import { AppointmentTypes } from '@/components/appointments/appointment-types';
import { AppointmentSettings } from '@/components/appointments/appointment-settings';
import toast from 'react-hot-toast';

export default function AppointmentsPage() {
  const { activeClient } = useAuth();
  const [activeTab, setActiveTab] = useState("calendar");
  const [appointments, setAppointments] = useState([]);
  const [appointmentSettings, setAppointmentSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [apptRes, settingsRes] = await Promise.all([
          fetch('/api/v1/appointments'),
          fetch('/api/v1/settings/group/appointments?format=keyValue'),
        ]);

        if (apptRes.ok) {
          const apptJson = await apptRes.json();
          const mapped = (apptJson.data || []).map((a) => ({
            id: a.id,
            name: a.guest_name,
            email: a.guest_email,
            type: a.appointment_type?.name ?? null,
            date: a.scheduled_at,
            status: a.status,
          }));
          setAppointments(mapped);
        } else {
          toast.error('Could not load appointments');
        }

        if (settingsRes.ok) {
          const settingsJson = await settingsRes.json();
          const raw = settingsJson.data?.appointment_settings;
          if (raw) {
            try {
              setAppointmentSettings(JSON.parse(raw));
            } catch {
              // ignore parse errors
            }
          }
        }
      } catch (err) {
        console.error(err);
        toast.error('Could not load appointments');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [activeClient?.id]);

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
              availabilitySettings={appointmentSettings?.defaultAvailability}
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
