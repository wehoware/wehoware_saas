"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Calendar, Clock, MapPin, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import toast from "react-hot-toast";

function AppointmentPageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!token) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const r = await fetch(`/api/public/appointments/${encodeURIComponent(token)}`);
        if (!r.ok) throw new Error("Not found");
        const data = await r.json();
        if (!cancelled) setAppointment(data.appointment || null);
      } catch {
        if (!cancelled) toast.error("Invalid or expired booking link.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [token]);

  const handleCancel = async () => {
    if (!appointment || !token) return;
    if (!globalThis.confirm("Are you sure you want to cancel this appointment?")) return;

    setCancelling(true);
    try {
      const res = await fetch(`/api/public/appointments/${encodeURIComponent(token)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Cancel failed");
      toast.success("Appointment cancelled.");
      setAppointment({ ...appointment, status: "Cancelled" });
    } catch (err) {
      toast.error(err.message || "Failed to cancel.");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!token || !appointment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="max-w-md w-full p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">Appointment Not Found</h1>
          <p className="text-gray-500">The booking link is invalid or has expired.</p>
        </Card>
      </div>
    );
  }

  const scheduledDate = parseISO(appointment.scheduled_at);
  const isCancelled = appointment.status === "Cancelled";
  const isPast = scheduledDate < new Date();

  let statusBadgeClass = "bg-yellow-100 text-yellow-800";
  if (isCancelled) {
    statusBadgeClass = "bg-red-100 text-red-800";
  } else if (appointment.status === "Confirmed") {
    statusBadgeClass = "bg-green-100 text-green-800";
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Your Appointment</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass}`}>
              {appointment.status}
            </span>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <div className="font-medium">{format(scheduledDate, "EEEE, MMMM do, yyyy")}</div>
                <div className="text-sm text-gray-500">{format(scheduledDate, "h:mm a")}</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <div className="font-medium">{appointment.type}</div>
                <div className="text-sm text-gray-500">{appointment.duration} minutes</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <div className="font-medium">{appointment.client?.companyName || appointment.client?.name || "Online"}</div>
                <div className="text-sm text-gray-500">{appointment.timezone || "UTC"}</div>
              </div>
            </div>
          </div>

          {!isCancelled && !isPast && (
            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  const url = `/book/${appointment.client?.publicSlug || appointment.client?.slug}?reschedule=${token}`;
                  globalThis.location.href = url;
                }}
              >
                Reschedule
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                Cancel
              </Button>
            </div>
          )}

          {isCancelled && (
            <div className="mt-6 p-4 bg-red-50 rounded-lg flex items-center gap-3">
              <XCircle className="h-5 w-5 text-red-600" />
              <p className="text-sm text-red-700">This appointment has been cancelled.</p>
            </div>
          )}

          {isPast && !isCancelled && (
            <div className="mt-6 p-4 bg-gray-100 rounded-lg flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-gray-600" />
              <p className="text-sm text-gray-700">This appointment has passed.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function AppointmentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <AppointmentPageContent />
    </Suspense>
  );
}
