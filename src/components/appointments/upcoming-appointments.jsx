"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { format, parseISO, isToday, isTomorrow, isFuture } from "date-fns";
import { toast } from "react-hot-toast";
import {
  CalendarClock, Clock, User, Video, MapPin, MoreHorizontal,
  Calendar, Check, X, Phone, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Map API appointment shape → component display shape */
function mapAppointment(a) {
  return {
    id: a.id,
    name: a.guest_name,
    email: a.guest_email,
    type: a.appointment_type?.name ?? "Appointment",
    date: a.scheduled_at,
    status: a.status?.toLowerCase() ?? "pending",
    location: a.location ?? "Online",
    link: a.meeting_link ?? null,
    address: a.address ?? null,
    phone: a.guest_phone ?? null,
    notes: a.notes ?? "",
  };
}

export function UpcomingAppointments() {
  const { activeClient } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/v1/appointments?limit=100");
        if (!res.ok) throw new Error("Failed to load appointments");
        const json = await res.json();
        if (!cancelled) {
          setAppointments((json.appointments || json.data || []).map(mapAppointment));
        }
      } catch (err) {
        console.error("Error fetching appointments:", err);
        if (!cancelled) {
          toast.error("Failed to load appointments");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClient?.id]);

  const handleConfirm = async (id) => {
    try {
      const res = await fetch(`/api/v1/appointments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Confirmed" }),
      });
      if (!res.ok) throw new Error("Failed to confirm appointment");
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "confirmed" } : a))
      );
      toast.success("Appointment confirmed");
    } catch (err) {
      toast.error(err.message || "Failed to confirm appointment");
    }
  };

  const handleCancel = (id) => {
    setAppointmentToCancel(id);
    setCancelDialogOpen(true);
  };

  const confirmCancel = async () => {
    if (!appointmentToCancel) return;
    try {
      setCancelLoading(true);
      const res = await fetch(`/api/v1/appointments/${appointmentToCancel}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Cancelled" }),
      });
      if (!res.ok) throw new Error("Failed to cancel appointment");
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === appointmentToCancel ? { ...a, status: "cancelled" } : a
        )
      );
      toast.success("Appointment cancelled");
      if (selectedAppointment?.id === appointmentToCancel) {
        setSelectedAppointment(null);
      }
    } catch (err) {
      toast.error(err.message || "Failed to cancel appointment");
    } finally {
      setCancelLoading(false);
      setCancelDialogOpen(false);
      setAppointmentToCancel(null);
    }
  };

  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  const handleReschedule = () => {
    if (!selectedAppointment) return;
    setRescheduleDate(
      format(parseISO(selectedAppointment.date), "yyyy-MM-dd'T'HH:mm")
    );
    setRescheduleDialogOpen(true);
  };

  const confirmReschedule = async () => {
    if (!selectedAppointment || !rescheduleDate) return;
    try {
      setRescheduleLoading(true);
      const res = await fetch(`/api/v1/appointments/${selectedAppointment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduled_at: rescheduleDate }),
      });
      if (!res.ok) throw new Error("Failed to reschedule");
      const updated = await res.json();
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === selectedAppointment.id
            ? { ...a, date: updated.data?.scheduled_at || rescheduleDate }
            : a
        )
      );
      setSelectedAppointment(null);
      setRescheduleDialogOpen(false);
      toast.success("Appointment rescheduled");
    } catch (err) {
      toast.error(err.message || "Failed to reschedule");
    } finally {
      setRescheduleLoading(false);
    }
  };

  const filteredAppointments = appointments.filter((appointment) => {
    if (appointment.status === "cancelled") return false;
    try {
      const date = parseISO(appointment.date);
      switch (filter) {
        case "today": return isToday(date);
        case "tomorrow": return isTomorrow(date);
        case "pending": return appointment.status === "pending";
        default: return isFuture(date) || isToday(date);
      }
    } catch {
      return true;
    }
  });

  const getLocationIcon = (location = "") => {
    const l = location.toLowerCase();
    if (["zoom", "google meet", "microsoft teams"].includes(l)) return <Video className="h-4 w-4" />;
    if (l === "phone call") return <Phone className="h-4 w-4" />;
    if (l === "in-person") return <MapPin className="h-4 w-4" />;
    return <Calendar className="h-4 w-4" />;
  };

  const getDateLabel = (dateString) => {
    try {
      const date = parseISO(dateString);
      if (isToday(date)) return "Today";
      if (isTomorrow(date)) return "Tomorrow";
      return format(date, "EEE, MMM d");
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Upcoming Appointments</h2>
        <div className="flex space-x-2">
          {["all", "today", "tomorrow", "pending"].map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {filteredAppointments.length === 0 ? (
        <Card className="p-8 flex flex-col items-center justify-center text-center">
          <CalendarClock className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold mb-2">No appointments</h3>
          <p className="text-gray-500 max-w-md">
            {filter === "all"
              ? "You don't have any upcoming appointments."
              : (() => {
                  let label = filter;
                  if (filter === "pending") label = "pending";
                  return `No appointments ${label}.`;
                })()}
          </p>
        </Card>
      ) : (
        <ScrollArea className="max-h-[550px]">
          <div className="space-y-3">
            {filteredAppointments.map((appointment) => {
              let date;
              try { date = parseISO(appointment.date); } catch { date = new Date(); }

              return (
                <Card
                  key={appointment.id}
                  className={`p-4 ${appointment.status === "pending" ? "border-amber-300 border-2" : ""}`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h3 className="font-semibold text-lg">{appointment.name}</h3>
                        {appointment.status === "pending" && (
                          <Badge variant="outline" className="ml-2 text-amber-600 border-amber-300 bg-amber-50">
                            Awaiting Confirmation
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{appointment.email}</p>
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
                          <DropdownMenuItem onClick={() => handleConfirm(appointment.id)}>
                            <Check className="h-4 w-4 mr-2" /> Confirm
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setSelectedAppointment(appointment)}>
                          <User className="h-4 w-4 mr-2" /> View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleReschedule}>
                          <Calendar className="h-4 w-4 mr-2" /> Reschedule
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleCancel(appointment.id)} className="text-red-600">
                          <X className="h-4 w-4 mr-2" /> Cancel
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-y-2 gap-x-4">
                    <div className="flex items-center text-sm">
                      <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                      <span>{getDateLabel(appointment.date)}, {format(date, "h:mm a")}</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Clock className="h-4 w-4 mr-2 text-gray-500" />
                      <span>{appointment.type}</span>
                    </div>
                    <div className="flex items-center text-sm col-span-2">
                      {getLocationIcon(appointment.location)}
                      <span className="ml-2">{appointment.location}</span>
                      {appointment.link && (
                        <a href={appointment.link} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-600 hover:underline">
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

      {/* Detail Modal */}
      {selectedAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="p-6 max-w-md w-full">
            <div className="flex justify-between items-start">
              <h2 className="text-xl font-bold">Appointment Details</h2>
              <Button variant="ghost" size="sm" onClick={() => setSelectedAppointment(null)}>
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
                <h3 className="text-sm text-gray-500">Date &amp; Time</h3>
                {(() => {
                  try {
                    const d = parseISO(selectedAppointment.date);
                    return <>
                      <p className="font-medium">{format(d, "EEEE, MMMM d, yyyy")}</p>
                      <p className="text-sm">{format(d, "h:mm a")}</p>
                    </>;
                  } catch { return <p className="font-medium">{selectedAppointment.date}</p>; }
                })()}
              </div>
              <div>
                <h3 className="text-sm text-gray-500">Location</h3>
                <p className="font-medium">{selectedAppointment.location}</p>
                {selectedAppointment.link && (
                  <a href={selectedAppointment.link} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                    {selectedAppointment.link}
                  </a>
                )}
                {selectedAppointment.address && <p className="text-sm">{selectedAppointment.address}</p>}
                {selectedAppointment.phone && <p className="text-sm">{selectedAppointment.phone}</p>}
              </div>
              {selectedAppointment.notes && (
                <div>
                  <h3 className="text-sm text-gray-500">Notes</h3>
                  <p className="text-sm bg-gray-50 p-2 rounded">{selectedAppointment.notes}</p>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end space-x-2">
              <Button variant="outline" onClick={handleReschedule}>Reschedule</Button>
              <Button variant="destructive" onClick={() => { setSelectedAppointment(null); handleCancel(selectedAppointment.id); }}>
                Cancel Appointment
              </Button>
            </div>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="Cancel Appointment?"
        message="Are you sure you want to cancel this appointment? The record will be marked as Cancelled."
        confirmLabel="Yes, Cancel"
        cancelLabel="Keep"
        onConfirm={confirmCancel}
        isLoading={cancelLoading}
        loadingLabel="Cancelling..."
        variant="destructive"
      />

      <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule Appointment</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="reschedule-date">New Date &amp; Time</Label>
            <Input
              id="reschedule-date"
              type="datetime-local"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRescheduleDialogOpen(false)}
              disabled={rescheduleLoading}
            >
              Cancel
            </Button>
            <Button onClick={confirmReschedule} disabled={rescheduleLoading}>
              {rescheduleLoading ? "Saving..." : "Confirm Reschedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
