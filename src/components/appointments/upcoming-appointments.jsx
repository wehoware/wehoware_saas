"use client";

import { useState } from "react";
import { format, parseISO, isToday, isTomorrow, isFuture } from "date-fns";
import {
  CalendarClock,
  Clock,
  User,
  Video,
  MapPin,
  MoreHorizontal,
  Calendar,
  Check,
  X,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Temporary data for upcoming appointments
const initialAppointments = [
  {
    id: "1",
    name: "John Smith",
    email: "john.smith@example.com",
    type: "15-Minute Meeting",
    date: "2025-04-27T10:00:00",
    status: "confirmed",
    location: "Zoom",
    link: "https://zoom.us/j/123456789",
    notes: "Wants to discuss potential partnership",
  },
  {
    id: "2",
    name: "Sarah Johnson",
    email: "sarah.j@example.com",
    type: "30-Minute Consultation",
    date: "2025-04-27T14:30:00",
    status: "pending",
    location: "Google Meet",
    link: "https://meet.google.com/abc-defg-hij",
    notes: "First-time client looking for web design services",
  },
  {
    id: "3",
    name: "Michael Brown",
    email: "michael.b@example.com",
    type: "1-Hour Strategy Session",
    date: "2025-04-28T11:00:00",
    status: "confirmed",
    location: "In-person",
    address: "123 Business St, Suite 101",
    notes: "Bringing marketing team of 3 people",
  },
  {
    id: "4",
    name: "Emma Wilson",
    email: "emma.w@example.com",
    type: "15-Minute Meeting",
    date: "2025-04-29T09:15:00",
    status: "confirmed",
    location: "Phone Call",
    phone: "+1 (555) 123-4567",
    notes: "",
  },
  {
    id: "5",
    name: "David Lee",
    email: "david.lee@example.com",
    type: "30-Minute Consultation",
    date: "2025-04-30T15:00:00",
    status: "confirmed",
    location: "Zoom",
    link: "https://zoom.us/j/987654321",
    notes: "Follow-up from previous session",
  },
];

export function UpcomingAppointments() {
  const [appointments, setAppointments] = useState(initialAppointments);
  const [filter, setFilter] = useState("all"); // all, today, tomorrow, pending
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  const handleConfirm = (id) => {
    setAppointments(
      appointments.map((appointment) =>
        appointment.id === id
          ? { ...appointment, status: "confirmed" }
          : appointment
      )
    );
  };

  const handleCancel = (id) => {
    if (window.confirm("Are you sure you want to cancel this appointment?")) {
      // In a real app, you might not delete but mark as canceled
      setAppointments(
        appointments.filter((appointment) => appointment.id !== id)
      );
    }
  };

  const handleReschedule = (id) => {
    // In a real app, this would open a rescheduling interface
    alert(`Reschedule functionality would open for appointment ${id}`);
  };

  const filteredAppointments = appointments.filter((appointment) => {
    const date = parseISO(appointment.date);
    switch (filter) {
      case "today":
        return isToday(date);
      case "tomorrow":
        return isTomorrow(date);
      case "pending":
        return appointment.status === "pending";
      default:
        return isFuture(date);
    }
  });

  const getLocationIcon = (location) => {
    switch (location.toLowerCase()) {
      case "zoom":
      case "google meet":
      case "microsoft teams":
        return <Video className="h-4 w-4" />;
      case "phone call":
        return <Phone className="h-4 w-4" />;
      case "in-person":
        return <MapPin className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  const getDateLabel = (dateString) => {
    const date = parseISO(dateString);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "EEE, MMM d");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Upcoming Appointments</h2>
        <div className="flex space-x-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            variant={filter === "today" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("today")}
          >
            Today
          </Button>
          <Button
            variant={filter === "tomorrow" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("tomorrow")}
          >
            Tomorrow
          </Button>
          <Button
            variant={filter === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("pending")}
          >
            Pending
          </Button>
        </div>
      </div>

      {filteredAppointments.length === 0 ? (
        <Card className="p-8 flex flex-col items-center justify-center text-center">
          <CalendarClock className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold mb-2">No appointments</h3>
          <p className="text-gray-500 max-w-md">
            {filter === "all"
              ? "You don't have any upcoming appointments."
              : `You don't have any appointments ${
                  filter === "pending" ? "pending" : filter
                }.`}
          </p>
        </Card>
      ) : (
        <ScrollArea className="max-h-[550px]">
          <div className="space-y-3">
            {filteredAppointments.map((appointment) => {
              const date = parseISO(appointment.date);

              return (
                <Card
                  key={appointment.id}
                  className={`p-4 ${
                    appointment.status === "pending"
                      ? "border-amber-300 border-2"
                      : ""
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h3 className="font-semibold text-lg">
                          {appointment.name}
                        </h3>
                        {appointment.status === "pending" && (
                          <Badge
                            variant="outline"
                            className="ml-2 text-amber-600 border-amber-300 bg-amber-50"
                          >
                            Awaiting Confirmation
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {appointment.email}
                      </p>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {appointment.status === "pending" && (
                          <DropdownMenuItem
                            onClick={() => handleConfirm(appointment.id)}
                          >
                            <Check className="h-4 w-4 mr-2" />
                            Confirm
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => setSelectedAppointment(appointment)}
                        >
                          <User className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleReschedule(appointment.id)}
                        >
                          <Calendar className="h-4 w-4 mr-2" />
                          Reschedule
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleCancel(appointment.id)}
                          className="text-red-600"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-y-2 gap-x-4">
                    <div className="flex items-center text-sm">
                      <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                      <span>
                        {getDateLabel(appointment.date)},{" "}
                        {format(date, "h:mm a")}
                      </span>
                    </div>

                    <div className="flex items-center text-sm">
                      <Clock className="h-4 w-4 mr-2 text-gray-500" />
                      <span>{appointment.type}</span>
                    </div>

                    <div className="flex items-center text-sm col-span-2">
                      {getLocationIcon(appointment.location)}
                      <span className="ml-2">{appointment.location}</span>
                      {appointment.link && (
                        <a
                          href={appointment.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-blue-600 hover:underline"
                        >
                          Join Link
                        </a>
                      )}
                    </div>

                    {appointment.notes && (
                      <div className="col-span-2 mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        <strong>Notes:</strong> {appointment.notes}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Appointment details modal - would be implemented with a proper modal component */}
      {selectedAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="p-6 max-w-md w-full">
            <div className="flex justify-between items-start">
              <h2 className="text-xl font-bold">Appointment Details</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedAppointment(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <h3 className="text-sm text-gray-500">Client</h3>
                <p className="font-medium">{selectedAppointment.name}</p>
                <p className="text-sm">{selectedAppointment.email}</p>
              </div>

              <div>
                <h3 className="text-sm text-gray-500">Appointment Type</h3>
                <p className="font-medium">{selectedAppointment.type}</p>
              </div>

              <div>
                <h3 className="text-sm text-gray-500">Date & Time</h3>
                <p className="font-medium">
                  {format(
                    parseISO(selectedAppointment.date),
                    "EEEE, MMMM d, yyyy"
                  )}
                </p>
                <p className="text-sm">
                  {format(parseISO(selectedAppointment.date), "h:mm a")}
                </p>
              </div>

              <div>
                <h3 className="text-sm text-gray-500">Location</h3>
                <p className="font-medium">{selectedAppointment.location}</p>
                {selectedAppointment.link && (
                  <a
                    href={selectedAppointment.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {selectedAppointment.link}
                  </a>
                )}
                {selectedAppointment.address && (
                  <p className="text-sm">{selectedAppointment.address}</p>
                )}
                {selectedAppointment.phone && (
                  <p className="text-sm">{selectedAppointment.phone}</p>
                )}
              </div>

              {selectedAppointment.notes && (
                <div>
                  <h3 className="text-sm text-gray-500">Notes</h3>
                  <p className="text-sm bg-gray-50 p-2 rounded">
                    {selectedAppointment.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => handleReschedule(selectedAppointment.id)}
              >
                Reschedule
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  handleCancel(selectedAppointment.id);
                  setSelectedAppointment(null);
                }}
              >
                Cancel Appointment
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
