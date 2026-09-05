"use client";

import { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  LayoutGrid,
  Settings,
  Terminal,
  Copy,
  Check,
  Plus,
  X,
  Loader2,
  Video,
  MapPin,
  Phone,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import SelectInput from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { AppointmentCalendarView } from '@/components/appointments/calendar-view';
import { UpcomingAppointments } from '@/components/appointments/upcoming-appointments';
import { AppointmentTypes } from '@/components/appointments/appointment-types';
import { AppointmentSettings } from '@/components/appointments/appointment-settings';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function AppointmentsPage() {
  const { activeClient, clientUrl } = useAuth();
  const [activeTab, setActiveTab] = useState("calendar");
  const [appointments, setAppointments] = useState([]);
  const [appointmentSettings, setAppointmentSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiDialogOpen, setApiDialogOpen] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  // Create-appointment dialog state
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [bookingSlot, setBookingSlot] = useState(null);
  const [appointmentTypes, setAppointmentTypes] = useState([]);
  const [bookingForm, setBookingForm] = useState({
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    appointment_type_id: '',
    scheduled_at: '',
    location: '',
    notes: '',
    timezone: 'UTC',
    status: 'Pending',
  });
  const [bookingLoading, setBookingLoading] = useState(false);

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
          const mapped = (apptJson.appointments || apptJson.data || []).map((a) => ({
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

  // Fetch appointment types for the booking dialog
  useEffect(() => {
    async function fetchTypes() {
      try {
        const res = await fetch('/api/v1/appointment-types');
        if (res.ok) {
          const json = await res.json();
          const types = (json.appointment_types || json.data || []).map((t) => ({
            id: t.id,
            name: t.name,
            duration: t.duration,
          }));
          setAppointmentTypes(types);
        }
      } catch (err) {
        console.error('Error fetching appointment types:', err);
      }
    }
    fetchTypes();
  }, [activeClient?.id]);

  const handleSlotSelect = (dateTime) => {
    // Format the selected datetime for the datetime-local input
    const localValue = format(dateTime, "yyyy-MM-dd'T'HH:mm");
    setBookingSlot(dateTime);
    setBookingForm((prev) => ({
      ...prev,
      scheduled_at: localValue,
    }));
    setBookingDialogOpen(true);
  };

  const resetBookingForm = () => {
    setBookingSlot(null);
    setBookingForm({
      guest_name: '',
      guest_email: '',
      guest_phone: '',
      appointment_type_id: '',
      scheduled_at: '',
      location: '',
      notes: '',
      timezone: 'UTC',
      status: 'Pending',
    });
  };

  const handleNewAppointment = () => {
    resetBookingForm();
    setBookingDialogOpen(true);
  };

  const handleBookingDialogChange = (open) => {
    setBookingDialogOpen(open);
    if (!open) {
      resetBookingForm();
    }
  };

  const handleBookingFormChange = (field, value) => {
    setBookingForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateAppointment = async () => {
    // Validation
    if (!bookingForm.guest_name.trim()) {
      toast.error('Guest name is required');
      return;
    }
    if (!bookingForm.guest_email.trim()) {
      toast.error('Guest email is required');
      return;
    }
    if (!bookingForm.scheduled_at) {
      toast.error('Date and time is required');
      return;
    }
    if (!bookingForm.appointment_type_id) {
      toast.error('Please select an appointment type');
      return;
    }

    try {
      setBookingLoading(true);
      const res = await fetch('/api/v1/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_name: bookingForm.guest_name.trim(),
          guest_email: bookingForm.guest_email.trim(),
          guest_phone: bookingForm.guest_phone.trim() || null,
          appointment_type_id: bookingForm.appointment_type_id,
          scheduled_at: bookingForm.scheduled_at,
          location: bookingForm.location.trim() || null,
          notes: bookingForm.notes.trim() || null,
          timezone: bookingForm.timezone,
          status: bookingForm.status,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create appointment');
      }

      const created = await res.json();
      // Add to the calendar appointments list
      const newAppt = {
        id: created.id,
        name: created.guest_name,
        email: created.guest_email,
        type: created.appointment_type?.name ?? null,
        date: created.scheduled_at,
        status: created.status,
      };
      setAppointments((prev) => [...prev, newAppt]);
      setBookingDialogOpen(false);
      resetBookingForm();
      toast.success('Appointment created successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to create appointment');
    } finally {
      setBookingLoading(false);
    }
  };

  const copyToClipboard = (val, field) => {
    navigator.clipboard.writeText(val);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  return (
    <div className="container px-4 py-6 max-w-7xl mx-auto">
      <div className="flex flex-col space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Appointments</h1>
          <p className="text-gray-500 mt-1">Manage your calendar, appointment types, and scheduling settings</p>
        </div>

        <div className="flex justify-end gap-2 -mt-2 mb-4">
          <Button
            variant="default"
            size="sm"
            onClick={handleNewAppointment}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Appointment
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setApiDialogOpen(true)}
          >
            <Terminal className="h-4 w-4 mr-2" />
            Developer API Reference
          </Button>
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
            <UpcomingAppointments refreshKey={appointments.length} />
          </TabsContent>

          <TabsContent value="types" className="mt-0">
            <AppointmentTypes />
          </TabsContent>

          <TabsContent value="settings" className="mt-0">
            <AppointmentSettings />
          </TabsContent>
        </Tabs>
      </div>

      {/* Developer API Reference Dialog */}
      <Dialog open={apiDialogOpen} onOpenChange={setApiDialogOpen}>
        <DialogContent className="max-w-[70vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Developer API Reference
            </DialogTitle>
            <DialogDescription>
              Public API endpoints for appointment booking. No authentication required — scoped to a client via domain or clientId query parameter.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-2">
            {/* Client Context */}
            <div className="space-y-3 p-3 bg-muted rounded-lg">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Client Context
              </h4>
              <ApiCopyRow
                label="Client ID"
                value={activeClient?.id || "N/A"}
                field="clientId"
                copiedField={copiedField}
                onCopy={copyToClipboard}
              />
              <ApiCopyRow
                label="Domain"
                value={clientUrl || "N/A"}
                field="domain"
                copiedField={copiedField}
                onCopy={copyToClipboard}
              />
            </div>

            {/* Authentication Note */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-800">
                <strong>No authentication required.</strong> All public endpoints are scoped to a client via <code className="font-mono bg-blue-100 px-1 rounded">domain</code>, <code className="font-mono bg-blue-100 px-1 rounded">clientId</code>, or <code className="font-mono bg-blue-100 px-1 rounded">client_slug</code> query parameter. CORS-enabled for cross-origin requests from client websites.
              </p>
            </div>

            {/* Endpoints */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Endpoints
              </h4>
              <ApiEndpointRow
                method="GET"
                label="List Appointment Types"
                url={`/api/public/appointment-types?clientId=${activeClient?.id || "{clientId}"}`}
                field="list-types"
                copiedField={copiedField}
                onCopy={copyToClipboard}
              />
              <ApiEndpointRow
                method="GET"
                label="Get Appointment Type by Slug"
                url={`/api/public/appointment-types/{slug}?clientId=${activeClient?.id || "{clientId}"}`}
                field="get-type"
                copiedField={copiedField}
                onCopy={copyToClipboard}
              />
              <ApiEndpointRow
                method="GET"
                label="Get Available Time Slots"
                url={`/api/public/availability?clientId=${activeClient?.id || "{clientId}"}&appointment_type_slug={slug}&from=YYYY-MM-DD&to=YYYY-MM-DD`}
                field="availability"
                copiedField={copiedField}
                onCopy={copyToClipboard}
              />
              <ApiEndpointRow
                method="POST"
                label="Create Appointment (Guest Booking)"
                url={`/api/public/appointments?clientId=${activeClient?.id || "{clientId}"}`}
                field="create"
                copiedField={copiedField}
                onCopy={copyToClipboard}
              />
              <ApiEndpointRow
                method="GET"
                label="Get Appointment by Token"
                url={`/api/public/appointments/{booking_token}`}
                field="get-token"
                copiedField={copiedField}
                onCopy={copyToClipboard}
              />
              <ApiEndpointRow
                method="PUT"
                label="Reschedule Appointment by Token"
                url={`/api/public/appointments/{booking_token}`}
                field="reschedule"
                copiedField={copiedField}
                onCopy={copyToClipboard}
              />
              <ApiEndpointRow
                method="DELETE"
                label="Cancel Appointment by Token"
                url={`/api/public/appointments/{booking_token}`}
                field="cancel"
                copiedField={copiedField}
                onCopy={copyToClipboard}
              />
            </div>

            {/* Query Parameters */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Query Parameters
              </h4>
              <ApiParamTable
                params={[
                  { name: "clientId", type: "string (UUID)", required: true, description: "Active client ID. Alternative to domain/client_slug." },
                  { name: "domain", type: "string", required: false, description: "Client domain (e.g. example.com). Alternative to clientId." },
                  { name: "client_slug", type: "string", required: false, description: "Public slug (legacy). Alternative to clientId/domain." },
                  { name: "page", type: "integer", required: false, description: "Page number for list endpoints. Default: 1" },
                  { name: "limit", type: "integer", required: false, description: "Items per page. Default: 20, Max: 100" },
                  { name: "search", type: "string", required: false, description: "Search in name and description (list types)." },
                  { name: "sortBy", type: "string", required: false, description: "created_at, updated_at, name, duration, price. Default: created_at" },
                  { name: "sortOrder", type: "string", required: false, description: "asc or desc. Default: desc" },
                  { name: "requires_confirmation", type: "boolean", required: false, description: "Filter types requiring confirmation." },
                  { name: "appointment_type_slug", type: "string", required: false, description: "Slug for availability/booking endpoints. Alternative to appointment_type_id." },
                  { name: "appointment_type_id", type: "string (UUID)", required: false, description: "UUID for availability/booking endpoints. Alternative to slug." },
                  { name: "from", type: "string (ISO 8601)", required: false, description: "Start date for availability. Format: YYYY-MM-DD. Max range: 90 days." },
                  { name: "to", type: "string (ISO 8601)", required: false, description: "End date for availability. Format: YYYY-MM-DD." },
                  { name: "timezone", type: "string", required: false, description: "Guest timezone (e.g. America/New_York). Default: UTC" },
                ]}
              />
            </div>

            {/* POST Body Parameters */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                POST Body Parameters (Create Appointment)
              </h4>
              <ApiParamTable
                params={[
                  { name: "guest_name", type: "string", required: true, description: "Guest's full name" },
                  { name: "guest_email", type: "string", required: true, description: "Guest's email address" },
                  { name: "guest_phone", type: "string", required: false, description: "Guest's phone number" },
                  { name: "appointment_type_id", type: "string (UUID)", required: false, description: "UUID of appointment type. Required if slug not provided." },
                  { name: "appointment_type_slug", type: "string", required: false, description: "Slug of appointment type. Required if id not provided." },
                  { name: "scheduled_at", type: "string (ISO 8601)", required: true, description: "Appointment datetime (e.g. 2026-05-10T14:00:00Z)" },
                  { name: "notes", type: "string", required: false, description: "Guest notes" },
                  { name: "timezone", type: "string", required: false, description: "Guest timezone. Default: UTC" },
                  { name: "honeypot", type: "string", required: false, description: "Anti-spam field — leave empty" },
                ]}
              />
            </div>

            {/* Appointment Type Response Fields */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Appointment Type Response Fields
              </h4>
              <ApiFieldTable
                fields={[
                  { name: "id", type: "string (UUID)", description: "Unique type identifier" },
                  { name: "name", type: "string", description: "Type name (e.g. 30-Minute Consultation)" },
                  { name: "description", type: "string | null", description: "Description of the appointment type" },
                  { name: "duration", type: "integer", description: "Duration in minutes" },
                  { name: "color", type: "string | null", description: "Hex color for calendar display" },
                  { name: "slug", type: "string | null", description: "URL-friendly identifier" },
                  { name: "price", type: "number | null", description: "Price amount" },
                  { name: "price_label", type: "string | null", description: "Free if price is 0/null" },
                  { name: "currency", type: "string | null", description: "Currency code (e.g. CAD)" },
                  { name: "requires_confirmation", type: "boolean", description: "Whether admin must confirm bookings" },
                  { name: "active", type: "boolean", description: "Whether type is bookable" },
                  { name: "created_at", type: "ISO 8601", description: "Creation timestamp" },
                  { name: "updated_at", type: "ISO 8601", description: "Last update timestamp" },
                ]}
              />
            </div>

            {/* Appointment Response Fields */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Appointment Response Fields
              </h4>
              <ApiFieldTable
                fields={[
                  { name: "id", type: "string (UUID)", description: "Unique appointment identifier" },
                  { name: "booking_token", type: "string (64 chars)", description: "Opaque token for guest management (POST only)" },
                  { name: "guest_name", type: "string", description: "Guest's full name" },
                  { name: "guest_email", type: "string", description: "Guest's email" },
                  { name: "guest_phone", type: "string | null", description: "Guest's phone" },
                  { name: "scheduled_at", type: "ISO 8601", description: "Appointment datetime" },
                  { name: "status", type: "string", description: "Pending, Confirmed, Cancelled, Completed, NoShow" },
                  { name: "timezone", type: "string | null", description: "Guest timezone" },
                  { name: "notes", type: "string | null", description: "Guest notes" },
                  { name: "meeting_link", type: "string | null", description: "Video meeting URL (auto-generated for video locations)" },
                  { name: "location", type: "string | null", description: "Location type (Zoom, In-person, etc.)" },
                  { name: "address", type: "string | null", description: "Physical address for in-person" },
                  { name: "type", type: "object | null", description: "{ name, slug, duration, color } of the appointment type" },
                  { name: "client", type: "object", description: "{ id, name, slug, domain } of the owning client" },
                  { name: "requires_confirmation", type: "boolean", description: "Whether confirmation is needed (POST only)" },
                ]}
              />
            </div>

            {/* Availability Response Fields */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Availability Response Fields
              </h4>
              <ApiFieldTable
                fields={[
                  { name: "client", type: "object", description: "{ id, name, slug, domain } of the client" },
                  { name: "appointment_type", type: "object", description: "{ id, name, slug, duration, color, requires_confirmation }" },
                  { name: "range", type: "object", description: "{ from, to, timezone } of the queried range" },
                  { name: "slots", type: "array", description: "Array of { start: ISO 8601 } slot start times" },
                  { name: "total_slots", type: "integer", description: "Total number of available slots" },
                ]}
              />
            </div>

            {/* Status Flow */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Appointment Status Flow
              </h4>
              <div className="p-3 bg-muted rounded-lg">
                <pre className="text-xs font-mono whitespace-pre-wrap">
{`Pending ──→ Confirmed ──→ Completed
   │           │
   │           └──→ Cancelled
   └──→ Cancelled
   └──→ NoShow`}
                </pre>
              </div>
              <ApiFieldTable
                fields={[
                  { name: "Pending", type: "status", description: "Created, awaiting admin confirmation (if requires_confirmation)" },
                  { name: "Confirmed", type: "status", description: "Automatically confirmed or admin-approved" },
                  { name: "Cancelled", type: "status", description: "Cancelled by guest or admin (soft delete)" },
                  { name: "Completed", type: "status", description: "Appointment took place" },
                  { name: "NoShow", type: "status", description: "Guest did not attend" },
                ]}
              />
            </div>

            {/* Rate Limiting & CORS */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Rate Limiting & CORS
              </h4>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                <p className="text-xs text-amber-800">
                  <strong>Rate limits:</strong> 60 req/min per client+IP for list/availability/booking endpoints. 30 req/min per IP for token endpoints. CORS-enabled (<code className="font-mono bg-amber-100 px-1 rounded">Access-Control-Allow-Origin: *</code>) for cross-origin requests from client websites.
                </p>
              </div>
            </div>

            {/* Example: List Appointment Types */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Example: List Appointment Types
              </h4>
              <ApiCodeBlock
                title="GET /api/public/appointment-types?clientId={id}"
                code={`{
  "client": {
    "id": "035053d7-da03-4a53-ae55-1797306cd7ad",
    "name": "Acme Corp",
    "slug": "acme-corp",
    "domain": "example.com"
  },
  "data": [
    {
      "id": "f2929e3f-9bf8-49d9-a083-5d093e3f0859",
      "name": "30-Minute Consultation",
      "description": "Quick strategy session",
      "duration": 30,
      "color": "#4f46e5",
      "slug": "30min-consult",
      "price": 50,
      "price_label": null,
      "currency": "CAD",
      "requires_confirmation": false,
      "active": true,
      "created_at": "2026-01-15T10:00:00.000Z",
      "updated_at": "2026-01-15T10:00:00.000Z"
    }
  ],
  "pagination": {
    "totalItems": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}`}
              />
            </div>

            {/* Example: Create Appointment */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Example: Create Appointment
              </h4>
              <ApiCodeBlock
                title="POST /api/public/appointments?clientId={id}"
                code={`// Request body:
{
  "guest_name": "Jane Doe",
  "guest_email": "jane@example.com",
  "appointment_type_slug": "30min-consult",
  "scheduled_at": "2026-05-10T14:00:00Z",
  "timezone": "America/New_York"
}

// Response (201):
{
  "booking_token": "a1b2c3d4e5f6...64chars",
  "appointment": {
    "id": "e1709ef3-3467-4f18-98a9-b6eba944c5b3",
    "guest_name": "Jane Doe",
    "guest_email": "jane@example.com",
    "guest_phone": null,
    "scheduled_at": "2026-05-10T14:00:00.000Z",
    "status": "Confirmed",
    "timezone": "America/New_York",
    "notes": null,
    "type": "30-Minute Consultation",
    "type_slug": "30min-consult",
    "duration": 30,
    "color": "#4f46e5"
  },
  "client": {
    "id": "035053d7-da03-4a53-ae55-1797306cd7ad",
    "name": "Acme Corp",
    "slug": "acme-corp",
    "domain": "example.com"
  },
  "requires_confirmation": false
}`}
              />
            </div>

            {/* Example: Availability */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Example: Get Available Slots
              </h4>
              <ApiCodeBlock
                title="GET /api/public/availability?clientId={id}&appointment_type_slug=30min-consult&from=2026-05-01&to=2026-05-07"
                code={`{
  "client": {
    "id": "035053d7-da03-4a53-ae55-1797306cd7ad",
    "name": "Acme Corp",
    "slug": "acme-corp",
    "domain": "example.com"
  },
  "appointment_type": {
    "id": "f2929e3f-9bf8-49d9-a083-5d093e3f0859",
    "name": "30-Minute Consultation",
    "slug": "30min-consult",
    "duration": 30,
    "color": "#4f46e5",
    "requires_confirmation": false
  },
  "range": {
    "from": "2026-05-01T00:00:00.000Z",
    "to": "2026-05-07T00:00:00.000Z",
    "timezone": "UTC"
  },
  "slots": [
    { "start": "2026-05-01T14:00:00.000Z" },
    { "start": "2026-05-01T14:15:00.000Z" },
    { "start": "2026-05-01T14:30:00.000Z" }
  ],
  "total_slots": 48
}`}
              />
            </div>

            {/* JavaScript Integration Example */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                JavaScript Integration Example
              </h4>
              <ApiCodeBlock
                title="Full booking flow"
                code={`const API_BASE = "https://www.app.wehoware.ca/api/public";
const CLIENT_PARAM = "clientId=${activeClient?.id || "{clientId}"}";

// 1. Fetch appointment types
const typesRes = await fetch(\`\${API_BASE}/appointment-types?\${CLIENT_PARAM}\`);
const { data: types } = await typesRes.json();

// 2. Get available slots
const availRes = await fetch(
  \`\${API_BASE}/availability?\${CLIENT_PARAM}&appointment_type_slug=\${types[0].slug}&from=2026-05-01&to=2026-05-07\`
);
const { slots } = await availRes.json();

// 3. Book an appointment
const bookingRes = await fetch(\`\${API_BASE}/appointments?\${CLIENT_PARAM}\`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    guest_name: "Jane Doe",
    guest_email: "jane@example.com",
    appointment_type_slug: types[0].slug,
    scheduled_at: slots[0].start,
    timezone: "America/New_York",
  }),
});
const { booking_token, appointment } = await bookingRes.json();

// 4. Look up appointment later
const lookupRes = await fetch(\`\${API_BASE}/appointments/\${booking_token}\`);
const { appointment: appt } = await lookupRes.json();

// 5. Reschedule
await fetch(\`\${API_BASE}/appointments/\${booking_token}\`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ scheduled_at: "2026-05-15T10:00:00Z" }),
});

// 6. Cancel
await fetch(\`\${API_BASE}/appointments/\${booking_token}\`, { method: "DELETE" });`}
              />
            </div>

            {/* Copy All */}
            <div className="pt-2 border-t">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  const lines = [
                    `Client ID: ${activeClient?.id || "N/A"}`,
                    `Domain: ${clientUrl || "N/A"}`,
                    "",
                    "Endpoints:",
                    `GET  /api/public/appointment-types?clientId=${activeClient?.id || "{clientId}"}`,
                    `GET  /api/public/appointment-types/{slug}?clientId=${activeClient?.id || "{clientId}"}`,
                    `GET  /api/public/availability?clientId=${activeClient?.id || "{clientId}"}&appointment_type_slug={slug}&from=YYYY-MM-DD&to=YYYY-MM-DD`,
                    `POST /api/public/appointments?clientId=${activeClient?.id || "{clientId}"}`,
                    `GET  /api/public/appointments/{booking_token}`,
                    `PUT  /api/public/appointments/{booking_token}`,
                    `DELETE /api/public/appointments/{booking_token}`,
                  ];
                  navigator.clipboard.writeText(lines.join("\n"));
                  setCopiedField("all");
                  setTimeout(() => setCopiedField(null), 1500);
                }}
              >
                {copiedField === "all" ? (
                  <Check className="h-4 w-4 mr-2" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                Copy All Endpoints
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Appointment Dialog */}
      <Dialog open={bookingDialogOpen} onOpenChange={handleBookingDialogChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              New Appointment
            </DialogTitle>
            <DialogDescription>
              {bookingSlot
                ? `Selected slot: ${format(bookingSlot, "EEEE, MMM d 'at' h:mm a")}`
                : "Create a new appointment booking for a guest."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Appointment Type */}
            <div className="space-y-2">
              <Label htmlFor="appt-type">Appointment Type <span className="text-red-500">*</span></Label>
              <SelectInput
                id="appt-type"
                value={bookingForm.appointment_type_id}
                onChange={(e) => handleBookingFormChange("appointment_type_id", e.target.value)}
                options={[
                  { value: "", label: "Select a type..." },
                  ...appointmentTypes.map((t) => ({
                    value: t.id,
                    label: `${t.name} (${t.duration} min)`,
                  })),
                ]}
              />
            </div>

            {/* Guest Name */}
            <div className="space-y-2">
              <Label htmlFor="guest-name">Guest Name <span className="text-red-500">*</span></Label>
              <Input
                id="guest-name"
                type="text"
                placeholder="Jane Doe"
                value={bookingForm.guest_name}
                onChange={(e) => handleBookingFormChange("guest_name", e.target.value)}
              />
            </div>

            {/* Guest Email */}
            <div className="space-y-2">
              <Label htmlFor="guest-email">Guest Email <span className="text-red-500">*</span></Label>
              <Input
                id="guest-email"
                type="email"
                placeholder="jane@example.com"
                value={bookingForm.guest_email}
                onChange={(e) => handleBookingFormChange("guest_email", e.target.value)}
              />
            </div>

            {/* Guest Phone */}
            <div className="space-y-2">
              <Label htmlFor="guest-phone">Guest Phone</Label>
              <Input
                id="guest-phone"
                type="tel"
                placeholder="+1-555-0123"
                value={bookingForm.guest_phone}
                onChange={(e) => handleBookingFormChange("guest_phone", e.target.value)}
              />
            </div>

            {/* Scheduled At */}
            <div className="space-y-2">
              <Label htmlFor="scheduled-at">Date & Time <span className="text-red-500">*</span></Label>
              <Input
                id="scheduled-at"
                type="datetime-local"
                value={bookingForm.scheduled_at}
                onChange={(e) => handleBookingFormChange("scheduled_at", e.target.value)}
              />
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <SelectInput
                id="location"
                value={bookingForm.location}
                onChange={(e) => handleBookingFormChange("location", e.target.value)}
                options={[
                  { value: "", label: "Select location..." },
                  { value: "In-person", label: "In-person" },
                  { value: "Zoom", label: "Zoom (auto-generates link)" },
                  { value: "Google Meet", label: "Google Meet" },
                  { value: "Phone Call", label: "Phone Call" },
                ]}
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <SelectInput
                id="status"
                value={bookingForm.status}
                onChange={(e) => handleBookingFormChange("status", e.target.value)}
                options={[
                  { value: "Pending", label: "Pending (awaiting confirmation)" },
                  { value: "Confirmed", label: "Confirmed" },
                ]}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any special requests or context..."
                value={bookingForm.notes}
                onChange={(e) => handleBookingFormChange("notes", e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => handleBookingDialogChange(false)}
              disabled={bookingLoading}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleCreateAppointment}
              disabled={bookingLoading}
            >
              {bookingLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Appointment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// -------------------------------------------------------------------
// API Reference Dialog helper components
// (same pattern as services/blogs admin pages)
// -------------------------------------------------------------------

function ApiCopyRow({ label, value, field, copiedField, onCopy }) {
  const isCopied = copiedField === field;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-mono truncate" title={value}>{value}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 flex-shrink-0"
        onClick={() => onCopy(value, field)}
        disabled={!value || value === "N/A"}
      >
        {isCopied ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

function ApiEndpointRow({ method, label, url, field, copiedField, onCopy }) {
  const isCopied = copiedField === field;
  const methodColor =
    method === "GET"
      ? "text-blue-600 bg-blue-50"
      : method === "POST"
      ? "text-green-600 bg-green-50"
      : method === "PUT"
      ? "text-orange-600 bg-orange-50"
      : method === "DELETE"
      ? "text-red-600 bg-red-50"
      : "text-gray-600 bg-gray-50";
  return (
    <div className="p-3 border rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className={`text-xs font-mono font-semibold px-1.5 py-0.5 rounded ${methodColor}`}>
          {method}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <code className="text-xs font-mono bg-muted px-2 py-1 rounded flex-1 truncate" title={url}>
          {url}
        </code>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 flex-shrink-0"
          onClick={() => onCopy(url, field)}
        >
          {isCopied ? (
            <Check className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

function ApiParamTable({ params }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-muted">
          <tr>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Parameter</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Type</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Required</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {params.map((p) => (
            <tr key={p.name}>
              <td className="px-3 py-2 font-mono text-blue-700">{p.name}</td>
              <td className="px-3 py-2 text-muted-foreground">{p.type}</td>
              <td className="px-3 py-2">
                {p.required ? (
                  <span className="text-red-600 font-semibold">Yes</span>
                ) : (
                  <span className="text-muted-foreground">No</span>
                )}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ApiFieldTable({ fields }) {
  return (
    <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="bg-muted sticky top-0">
          <tr>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Field</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Type</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {fields.map((f) => (
            <tr key={f.name}>
              <td className="px-3 py-2 font-mono text-blue-700">{f.name}</td>
              <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{f.type}</td>
              <td className="px-3 py-2 text-muted-foreground">{f.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ApiCodeBlock({ title, code }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="border rounded-lg overflow-hidden">
      {title && (
        <div className="px-3 py-1.5 bg-muted border-b text-xs font-medium text-muted-foreground flex items-center justify-between">
          <span>{title}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => {
              navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      )}
      <pre className="p-3 text-xs font-mono bg-muted/30 overflow-x-auto whitespace-pre-wrap break-all">
        {code}
      </pre>
    </div>
  );
}
