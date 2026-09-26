"use client";

import { useState } from 'react';
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  isSameDay,
  parseISO,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isToday,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';

const DEFAULT_AVAILABILITY = {
  monday: { enabled: true, start: "09:00", end: "17:00" },
  tuesday: { enabled: true, start: "09:00", end: "17:00" },
  wednesday: { enabled: true, start: "09:00", end: "17:00" },
  thursday: { enabled: true, start: "09:00", end: "17:00" },
  friday: { enabled: true, start: "09:00", end: "17:00" },
  saturday: { enabled: false, start: "10:00", end: "15:00" },
  sunday: { enabled: false, start: "10:00", end: "15:00" },
};

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const SLOT_STEP_MINUTES = 30;

function parseTimeMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + (m || 0);
}

function formatTimeLabel(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + (m || 0);
}

function getAvailabilityForDay(date, settings) {
  if (!date || typeof date.getDay !== "function") {
    return { enabled: false, startMin: 0, endMin: 0 };
  }
  const dayKey = DAY_KEYS[date.getDay()] || "monday";
  const cfg = settings?.[dayKey] || DEFAULT_AVAILABILITY[dayKey];
  if (!cfg?.enabled) return { enabled: false, startMin: 0, endMin: 0 };
  return {
    enabled: true,
    startMin: parseTimeMinutes(cfg.start),
    endMin: parseTimeMinutes(cfg.end),
  };
}

function generateTimeSlots(date, settings) {
  const { enabled, startMin, endMin } = getAvailabilityForDay(date, settings);
  if (!enabled || endMin <= startMin) return [];
  const slots = [];
  for (let t = startMin; t < endMin; t += SLOT_STEP_MINUTES) {
    slots.push(formatTimeLabel(t));
  }
  return slots;
}

function getGlobalTimeRange(days, settings) {
  let minStart = 24 * 60;
  let maxEnd = 0;
  for (const day of days) {
    const { enabled, startMin, endMin } = getAvailabilityForDay(day, settings);
    if (enabled) {
      minStart = Math.min(minStart, startMin);
      maxEnd = Math.max(maxEnd, endMin);
    }
  }
  if (maxEnd <= minStart) { minStart = 9 * 60; maxEnd = 17 * 60; }
  const slots = [];
  for (let t = minStart; t < maxEnd; t += SLOT_STEP_MINUTES) {
    slots.push(formatTimeLabel(t));
  }
  return slots;
}

export function AppointmentCalendarView({ appointments = [], onSlotSelect, onAppointmentClick, availabilitySettings }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('week');
  const [selectedDay, setSelectedDay] = useState(null);

  const navigatePrevious = () => {
    if (view === 'week') setCurrentDate(prev => subWeeks(prev, 1));
    else setCurrentDate(prev => subMonths(prev, 1));
  };

  const navigateNext = () => {
    if (view === 'week') setCurrentDate(prev => addWeeks(prev, 1));
    else setCurrentDate(prev => addMonths(prev, 1));
  };

  const navigateToday = () => setCurrentDate(new Date());

  // ---- Week view data ----
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const weekTimeSlots = getGlobalTimeRange(weekDays, availabilitySettings);

  // ---- Month view data ----
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  eachDayOfInterval({ start: monthStart, end: monthEnd });

  const isAppointmentAtSlot = (day, time) => {
    const slotMin = timeToMinutes(time);
    return appointments.some(appointment => {
      const appointmentDate = parseISO(appointment.date);
      const appointmentMin = appointmentDate.getHours() * 60 + appointmentDate.getMinutes();
      return isSameDay(appointmentDate, day) && appointmentMin === slotMin;
    });
  };

  const getAppointmentAtSlot = (day, time) => {
    const slotMin = timeToMinutes(time);
    return appointments.find(appointment => {
      const appointmentDate = parseISO(appointment.date);
      const appointmentMin = appointmentDate.getHours() * 60 + appointmentDate.getMinutes();
      return isSameDay(appointmentDate, day) && appointmentMin === slotMin;
    });
  };

  const isSlotAvailable = (day, time) => {
    const { enabled, startMin, endMin } = getAvailabilityForDay(day, availabilitySettings);
    if (!enabled) return false;
    const t = timeToMinutes(time);
    return t >= startMin && t < endMin;
  };

  const handleSlotClick = (day, time) => {
    const [hour, minute] = time.split(":").map(Number);
    const selectedDateTime = new Date(day);
    selectedDateTime.setHours(hour, minute || 0, 0, 0);
    if (onSlotSelect && isSlotAvailable(day, time)) {
      onSlotSelect(selectedDateTime);
    }
  };

  const appointmentsForDay = (day) =>
    appointments.filter((a) => isSameDay(parseISO(a.date), day));

  const headerRange = view === 'week'
    ? `${format(weekStart, 'MMMM d')} - ${format(weekEnd, 'MMMM d, yyyy')}`
    : format(currentDate, 'MMMM yyyy');

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
        <h3 className="text-lg font-semibold">{headerRange}</h3>
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

      {view === 'week' ? (
        <div className="grid grid-cols-8 gap-1 border rounded-lg">
          {/* Time column */}
          <div className="border-r">
            <div className="h-12 flex items-center justify-center font-semibold">Time</div>
            {weekTimeSlots.map((time) => (
              <div key={time} className="h-10 flex items-center justify-center text-sm border-t">
                <div className="flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  {time}
                </div>
              </div>
            ))}
          </div>

          {/* Days columns */}
          {weekDays.map((day) => {
            return (
              <div key={day.toString()} className="border-r last:border-r-0">
                <div className="h-12 flex flex-col items-center justify-center font-semibold border-b">
                  <div>{format(day, 'EEE')}</div>
                  <div className={`text-sm rounded-full w-7 h-7 flex items-center justify-center ${isToday(day) ? 'bg-primary text-primary-foreground' : ''}`}>
                    {format(day, 'd')}
                  </div>
                </div>

                {weekTimeSlots.map((time) => {
                  const available = isSlotAvailable(day, time);
                  const hasAppointment = isAppointmentAtSlot(day, time);
                  const appointment = hasAppointment ? getAppointmentAtSlot(day, time) : null;
                  return (
                    <div
                      key={`${day}-${time}`}
                      className={`h-10 border-t p-1 ${hasAppointment ? 'cursor-pointer hover:bg-blue-50' : available ? 'cursor-pointer hover:bg-gray-50' : 'bg-gray-100 opacity-50'}`}
                      onClick={() => {
                        if (hasAppointment && appointment && onAppointmentClick) {
                          onAppointmentClick(appointment);
                        } else if (available) {
                          handleSlotClick(day, time);
                        }
                      }}
                    >
                      {hasAppointment && appointment && (
                        <div className="bg-blue-100 text-blue-800 p-1 rounded h-full flex flex-col text-xs overflow-hidden">
                          <div className="font-semibold truncate">{appointment.name}</div>
                          <div className="truncate">{appointment.type}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="border rounded-lg p-4">
          {selectedDay ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-lg">
                  {format(selectedDay, 'EEEE, MMMM d, yyyy')}
                </h4>
                <Button variant="outline" size="sm" onClick={() => setSelectedDay(null)}>
                  Back to Month
                </Button>
              </div>
              <div className="space-y-2">
                {generateTimeSlots(selectedDay, availabilitySettings).length === 0 ? (
                  <p className="text-sm text-gray-500">No available slots on this day.</p>
                ) : (
                  generateTimeSlots(selectedDay, availabilitySettings).map((time) => {
                    const available = isSlotAvailable(selectedDay, time);
                    const appts = appointmentsForDay(selectedDay).filter((a) => {
                      const d = parseISO(a.date);
                      const apptMin = d.getHours() * 60 + d.getMinutes();
                      return apptMin === timeToMinutes(time);
                    });
                    const hasAppts = appts.length > 0;
                    return (
                      <div
                        key={time}
                        className={`flex items-center justify-between p-3 border rounded ${hasAppts ? 'cursor-pointer hover:bg-blue-50' : available ? 'cursor-pointer hover:bg-gray-50' : 'bg-gray-100 opacity-50'}`}
                        onClick={() => {
                          if (hasAppts && onAppointmentClick) {
                            onAppointmentClick(appts[0]);
                          } else if (available) {
                            handleSlotClick(selectedDay, time);
                          }
                        }}
                      >
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">{time}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {hasAppts ? (
                            <div className="flex items-center space-x-1 text-sm text-blue-700 bg-blue-50 px-2 py-1 rounded">
                              <Users className="h-3 w-3" />
                              <span>{appts[0].name}{appts.length > 1 ? ` +${appts.length - 1} more` : ''}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">Available</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div>
              <Calendar
                mode="single"
                month={currentDate}
                onMonthChange={setCurrentDate}
                className="mx-auto"
                components={{
                  Day: ({ date: dateProp, day, ...props }) => {
                    const date = dateProp ?? day?.date;
                    if (!date) return <td {...props} />;
                    const appts = appointmentsForDay(date);
                    const dayAvail = getAvailabilityForDay(date, availabilitySettings);
                    return (
                      <td
                        {...props}
                        className={`relative p-0 text-center ${
                          !dayAvail.enabled ? 'opacity-40' : ''
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedDay(date)}
                          className={`relative w-full h-full p-2 rounded-md transition-colors hover:bg-gray-100 ${
                            isToday(date) ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''
                          }`}
                        >
                          <span>{format(date, 'd')}</span>
                          {appts.length > 0 && (
                            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex space-x-0.5">
                              {appts.slice(0, 3).map((_, i) => (
                                <div key={i} className="w-1 h-1 rounded-full bg-blue-500" />
                              ))}
                              {appts.length > 3 && (
                                <div className="w-1 h-1 rounded-full bg-blue-300" />
                              )}
                            </div>
                          )}
                        </button>
                      </td>
                    );
                  },
                }}
              />
              <div className="mt-4 flex items-center space-x-4 text-sm text-gray-500 justify-center">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>Appointments</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span>Today</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 rounded-full bg-gray-300" />
                  <span>Unavailable</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
