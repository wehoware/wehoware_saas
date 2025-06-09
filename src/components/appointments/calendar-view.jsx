"use client";

import { useState } from 'react';
import { format, addDays, startOfWeek, endOfWeek, addWeeks, isSameDay, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';


export function AppointmentCalendarView({ appointments = [], onSlotSelect }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('week'); // week or month

  const navigatePrevious = () => {
    if (view === 'week') {
      setCurrentDate(prevDate => subWeeks(prevDate, 1));
    } else {
      // Handle month navigation
    }
  };

  const navigateNext = () => {
    if (view === 'week') {
      setCurrentDate(prevDate => addWeeks(prevDate, 1));
    } else {
      // Handle month navigation
    }
  };

  const navigateToday = () => {
    setCurrentDate(new Date());
  };

  // Generate days for the current week view
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Start on Monday
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  
  const weekDays = [];
  let day = weekStart;
  while (day <= weekEnd) {
    weekDays.push(day);
    day = addDays(day, 1);
  }

  // Mock time slots (8 AM to 6 PM)
  const timeSlots = Array.from({ length: 11 }, (_, i) => {
    const hour = i + 8; // Starting from 8 AM
    return `${hour}:00`;
  });

  // Helper to check if a slot is available
  const isSlotAvailable = (day, time) => {
    // This would be replaced with actual availability logic
    const hour = parseInt(time.split(':')[0]);
    // For demo, make some slots unavailable
    const randomUnavailable = (day.getDate() + hour) % 5 === 0;
    return !randomUnavailable;
  };

  const isAppointmentAtSlot = (day, time) => {
    return appointments.some(appointment => {
      const appointmentDate = parseISO(appointment.date);
      const appointmentHour = appointmentDate.getHours();
      const slotHour = parseInt(time.split(':')[0]);
      return isSameDay(appointmentDate, day) && appointmentHour === slotHour;
    });
  };

  const getAppointmentAtSlot = (day, time) => {
    return appointments.find(appointment => {
      const appointmentDate = parseISO(appointment.date);
      const appointmentHour = appointmentDate.getHours();
      const slotHour = parseInt(time.split(':')[0]);
      return isSameDay(appointmentDate, day) && appointmentHour === slotHour;
    });
  };

  const handleSlotClick = (day, time) => {
    const hour = parseInt(time.split(':')[0]);
    const selectedDateTime = new Date(day);
    selectedDateTime.setHours(hour, 0, 0, 0);
    
    if (onSlotSelect && isSlotAvailable(day, time)) {
      onSlotSelect(selectedDateTime);
    }
  };

  return (
    <div className="appointment-calendar">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={navigatePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={navigateToday}>
            Today
          </Button>
        </div>
        <h3 className="text-lg font-semibold">
          {format(weekStart, 'MMMM d')} - {format(weekEnd, 'MMMM d, yyyy')}
        </h3>
        <div className="flex items-center space-x-2">
          <Button 
            variant={view === 'week' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setView('week')}
          >
            Week
          </Button>
          <Button 
            variant={view === 'month' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setView('month')}
          >
            Month
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-8 gap-1 border rounded-lg">
        {/* Time column */}
        <div className="border-r">
          <div className="h-12 flex items-center justify-center font-semibold">
            Time
          </div>
          {timeSlots.map((time) => (
            <div key={time} className="h-16 flex items-center justify-center text-sm border-t">
              <div className="flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                {time}
              </div>
            </div>
          ))}
        </div>

        {/* Days columns */}
        {weekDays.map((day) => (
          <div key={day.toString()} className="border-r last:border-r-0">
            <div className="h-12 flex flex-col items-center justify-center font-semibold border-b">
              <div>{format(day, 'EEE')}</div>
              <div className={`text-sm rounded-full w-7 h-7 flex items-center justify-center
                ${isSameDay(day, new Date()) ? 'bg-primary text-primary-foreground' : ''}`}>
                {format(day, 'd')}
              </div>
            </div>

            {/* Time slots for this day */}
            {timeSlots.map((time) => {
              const available = isSlotAvailable(day, time);
              const hasAppointment = isAppointmentAtSlot(day, time);
              const appointment = hasAppointment ? getAppointmentAtSlot(day, time) : null;
              
              return (
                <div 
                  key={`${day}-${time}`}
                  className={`h-16 border-t p-1 ${available ? 'cursor-pointer' : 'bg-gray-50'}`}
                  onClick={() => available && handleSlotClick(day, time)}
                >
                  {hasAppointment && appointment && (
                    <div className="bg-blue-100 text-blue-800 p-1 rounded h-full flex flex-col text-xs">
                      <div className="font-semibold">{appointment.name}</div>
                      <div>{appointment.type}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
