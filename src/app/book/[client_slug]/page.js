"use client";

import React, { useState, useEffect } from "react";
import { format, addDays, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import toast from "react-hot-toast";
import PropTypes from "prop-types";

export default function BookingPage({ params }) {
  const { client_slug } = React.use(params);
  const clientSlug = client_slug ?? null;
  const [clientData, setClientData] = useState(null);
  const [types, setTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  // Client-side navigation may pass params as an object; if undefined we fall back to state above.

  useEffect(() => {
    if (!clientSlug) return;
    fetch(`/api/public/appointment-types?client_slug=${clientSlug}`)
      .then(r => r.json())
      .then(d => { setClientData(d.client); setTypes(d.appointment_types || []); })
      .catch(() => toast.error("Failed to load appointment types"));

    fetch(`/api/v1/settings/group/appointments?format=keyValue`)
      .then(r => r.json())
      .then(d => {
        const raw = d.data?.appointment_settings;
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            setClientData((prev) => ({
              ...prev,
              logoUrl: parsed?.bookingPage?.logo || null,
              brandColor: parsed?.bookingPage?.brandColor || null,
            }));
          } catch {
            // ignore parse errors
          }
        }
      })
      .catch(() => {
        // ignore settings errors, booking page will still work without logo
      });
  }, [clientSlug]);

  useEffect(() => {
    if (!selectedType || !clientSlug) return;

    let cancelled = false;
    const from = format(currentDate, "yyyy-MM-dd");
    const to = format(addDays(currentDate, 6), "yyyy-MM-dd");

    fetch(`/api/public/availability?client_slug=${clientSlug}&appointment_type_slug=${selectedType.slug}&from=${from}&to=${to}`)
      .then(r => r.json())
      .then(d => {
        if (!cancelled) setSlots(d.slots || []);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load availability");
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedType, currentDate, clientSlug]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedType || !selectedSlot) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/appointments?client_slug=${clientSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guest_name: form.name,
          guest_email: form.email,
          guest_phone: form.phone || null,
          appointment_type_id: selectedType.id,
          scheduled_at: selectedSlot.start,
          notes: form.notes || null,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Booking failed");
      setResult(data);
      setStep(4);
      toast.success("Booked successfully!");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const weekStart = currentDate;
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const slotsByDay = {};
  for (const s of slots) {
    const d = parseISO(s.start);
    const k = format(d, "yyyy-MM-dd");
    if (!slotsByDay[k]) slotsByDay[k] = [];
    slotsByDay[k].push(s);
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          {clientData?.logoUrl && (
            <img
              src={clientData.logoUrl}
              alt={`${clientData.name} logo`}
              className="h-16 mx-auto mb-4 object-contain"
            />
          )}
          <h1 className="text-2xl font-bold" style={{ color: clientData?.brandColor || undefined }}>
            {clientData?.name ? `Book with ${clientData.name}` : "Book Appointment"}
          </h1>
        </div>

        {step === 1 && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Select Service</h2>
            <div className="space-y-2">
              {types.map(t => (
                <button key={t.id} onClick={() => { setSelectedType(t); setStep(2); }} className="w-full text-left p-3 rounded-lg border hover:border-primary transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color || "#4f46e5" }} />
                    <div className="flex-1">
                      <div className="font-medium">{t.name}</div>
                      <div className="text-sm text-gray-500">{t.duration} min</div>
                    </div>
                    {t.price && <div className="text-sm font-medium">${Number(t.price).toFixed(2)}</div>}
                  </div>
                </button>
              ))}
            </div>
          </Card>
        )}

        {step === 2 && selectedType && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="sm" onClick={() => setStep(1)}>Back</Button>
              <h2 className="text-lg font-semibold">{selectedType.name}</h2>
            </div>
            <div className="flex items-center justify-between mb-4">
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(d => addDays(d, -7))}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-sm font-medium">{format(currentDate, "MMMM yyyy")}</span>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(d => addDays(d, 7))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            {slotsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <div className="space-y-4">
                {weekDays.map(d => {
                  const k = format(d, "yyyy-MM-dd");
                  const daySlots = slotsByDay[k] || [];
                  return (
                    <div key={k}>
                      <div className="font-medium text-sm mb-2">{format(d, "EEEE, MMM d")}</div>
                      {daySlots.length === 0 ? (
                        <p className="text-sm text-gray-400">No available slots</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {daySlots.map((s) => {
                            const t = parseISO(s.start);
                            const isSel = selectedSlot?.start === s.start;
                            return (
                              <button key={s.start} onClick={() => setSelectedSlot(s)} className={`px-3 py-1 rounded border text-sm ${isSel ? "bg-primary text-primary-foreground border-primary" : "hover:border-primary"}`}>
                                {format(t, "h:mm a")}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {selectedSlot && (
              <Button className="w-full mt-4" onClick={() => setStep(3)}>Continue</Button>
            )}
          </Card>
        )}

        {step === 3 && (
          <Card className="p-6">
            <Button variant="ghost" size="sm" className="mb-4" onClick={() => setStep(2)}>Back</Button>
            <h2 className="text-lg font-semibold mb-4">Your Details</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><Label>Name *</Label><Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>Email *</Label><Input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><Label>Phone</Label><Input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <Button type="submit" className="w-full" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Book Appointment"}</Button>
            </form>
          </Card>
        )}

        {step === 4 && result && (
          <Card className="p-6 text-center">
            <Check className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Booking Confirmed!</h2>
            <p className="text-gray-600 mb-4">{result.appointment?.type} with {clientData?.name}</p>
            <p className="text-sm text-gray-500">Booking reference: {result.booking_token?.slice(0, 16)}...</p>
            <Button className="mt-6" onClick={() => { setStep(1); setResult(null); setSelectedType(null); setSelectedSlot(null); setForm({ name: "", email: "", phone: "", notes: "" }); }}>Book Another</Button>
          </Card>
        )}
      </div>
    </div>
  );
}

BookingPage.propTypes = {
  params: PropTypes.shape({
    client_slug: PropTypes.string,
  }),
};
