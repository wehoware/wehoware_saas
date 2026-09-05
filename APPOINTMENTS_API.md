# Appointments Developer API

Public REST API for appointment booking. Client websites use these endpoints to display appointment types, show available time slots, accept guest bookings, and let guests manage their appointments.

**No authentication required.** All endpoints are CORS-enabled and rate-limited (60 req/min per client+IP).

## Client Resolution

All endpoints (except token management) require one of these query params to identify the client/tenant:

| Param | Description | Example |
|---|---|---|
| `domain` | Client's registered domain | `?domain=example.com` |
| `clientId` | Client UUID | `?clientId=035053d7-da03-4a53-ae55-1797306cd7ad` |
| `client_slug` | Public slug (legacy) | `?client_slug=acme-corp` |

Priority: `domain` > `clientId` > `client_slug`

---

## Endpoints

### 1. List Appointment Types

```
GET /api/public/appointment-types
```

Returns active appointment types for a client, with pagination, search, and sort.

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `domain` / `clientId` / `client_slug` | string | *required* | Client identifier |
| `page` | int | 1 | Page number |
| `limit` | int | 20 | Items per page (max 100) |
| `search` | string | — | Search in name/description |
| `sortBy` | string | `created_at` | `created_at`, `updated_at`, `name`, `duration`, `price` |
| `sortOrder` | string | `desc` | `asc` or `desc` |
| `requires_confirmation` | bool | — | Filter to types requiring confirmation |

**Example:**
```bash
curl "https://www.app.wehoware.ca/api/public/appointment-types?domain=example.com&search=consult&sortBy=duration&sortOrder=asc"
```

**Response (200):**
```json
{
  "client": {
    "id": "uuid",
    "name": "Acme Corp",
    "slug": "acme-corp",
    "domain": "example.com"
  },
  "data": [
    {
      "id": "uuid",
      "name": "30-Minute Consultation",
      "description": "Quick strategy session",
      "duration": 30,
      "color": "#4f46e5",
      "slug": "30min-consult",
      "price": 50.00,
      "price_label": null,
      "currency": "CAD",
      "requires_confirmation": false,
      "active": true,
      "created_at": "2026-01-15T10:00:00.000Z",
      "updated_at": "2026-01-15T10:00:00.000Z"
    }
  ],
  "pagination": {
    "totalItems": 5,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### 2. Get Single Appointment Type by Slug

```
GET /api/public/appointment-types/[slug]
```

Returns full details for a single appointment type, including upcoming appointment count.

**Example:**
```bash
curl "https://www.app.wehoware.ca/api/public/appointment-types/30min-consult?domain=example.com"
```

**Response (200):**
```json
{
  "client": {
    "id": "uuid",
    "name": "Acme Corp",
    "slug": "acme-corp",
    "domain": "example.com"
  },
  "appointment_type": {
    "id": "uuid",
    "name": "30-Minute Consultation",
    "description": "Quick strategy session",
    "duration": 30,
    "color": "#4f46e5",
    "slug": "30min-consult",
    "price": 50.00,
    "price_label": null,
    "currency": "CAD",
    "requires_confirmation": false,
    "active": true,
    "created_at": "2026-01-15T10:00:00.000Z",
    "updated_at": "2026-01-15T10:00:00.000Z",
    "booking_url": "/api/public/appointments?client_slug=uuid",
    "appointments_count": 3
  }
}
```

**Errors:**
- `404` — Appointment type not found or inactive

---

### 3. Get Available Time Slots

```
GET /api/public/availability
```

Returns free time slots for a given appointment type across a date range. Slots are computed based on the client's availability settings (working hours, buffer time, minimum notice, future booking limit).

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `domain` / `clientId` / `client_slug` | string | *required* | Client identifier |
| `appointment_type_slug` | string | — | Slug of the appointment type (preferred) |
| `appointment_type_id` | string | — | UUID of the appointment type (alternative) |
| `from` | string | *required* | Start date (ISO 8601: `YYYY-MM-DD`) |
| `to` | string | *required* | End date (ISO 8601: `YYYY-MM-DD`) |
| `timezone` | string | `UTC` | Display timezone (informational) |

*Either `appointment_type_slug` or `appointment_type_id` is required.*

*Maximum range: 90 days.*

**Example:**
```bash
curl "https://www.app.wehoware.ca/api/public/availability?domain=example.com&appointment_type_slug=30min-consult&from=2026-05-01&to=2026-05-07"
```

**Response (200):**
```json
{
  "client": {
    "id": "uuid",
    "name": "Acme Corp",
    "slug": "acme-corp",
    "domain": "example.com"
  },
  "appointment_type": {
    "id": "uuid",
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
}
```

**Errors:**
- `400` — Missing/invalid params, or range exceeds 90 days
- `404` — Appointment type not found or inactive

---

### 4. Create Appointment (Guest Booking)

```
POST /api/public/appointments
```

Creates a new appointment for a guest. Validates slot availability before booking. Returns a secure booking token for future management.

**Query Parameters:** Same client resolution as other endpoints.

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `guest_name` | string | yes | Guest's full name |
| `guest_email` | string | yes | Guest's email |
| `guest_phone` | string | no | Guest's phone |
| `appointment_type_id` | string | yes* | UUID of appointment type |
| `appointment_type_slug` | string | yes* | Slug of appointment type (alternative to id) |
| `scheduled_at` | string | yes | ISO 8601 datetime |
| `notes` | string | no | Guest notes |
| `timezone` | string | no | Guest timezone (default: `UTC`) |
| `honeypot` | string | no | Anti-spam field — **leave empty** |

*Either `appointment_type_id` or `appointment_type_slug` is required.*

**Example:**
```bash
curl -X POST "https://www.app.wehoware.ca/api/public/appointments?domain=example.com" \
  -H "Content-Type: application/json" \
  -d '{
    "guest_name": "Jane Doe",
    "guest_email": "jane@example.com",
    "appointment_type_slug": "30min-consult",
    "scheduled_at": "2026-05-10T14:00:00Z",
    "timezone": "America/New_York"
  }'
```

**Response (201):**
```json
{
  "booking_token": "a1b2c3d4e5f6...64chars",
  "appointment": {
    "id": "uuid",
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
    "id": "uuid",
    "name": "Acme Corp",
    "slug": "acme-corp",
    "domain": "example.com"
  },
  "requires_confirmation": false
}
```

If the appointment type has `requires_confirmation: true`, the status will be `"Pending"` instead of `"Confirmed"`.

**Errors:**
- `400` — Missing required fields, invalid date, honeypot triggered
- `404` — Appointment type not found or inactive
- `409` — Slot no longer available (double-booking prevented)

---

### 5. Get Appointment by Token

```
GET /api/public/appointments/[token]
```

Retrieves appointment details using the booking token. No client param needed — the token uniquely identifies the appointment.

**Example:**
```bash
curl "https://www.app.wehoware.ca/api/public/appointments/a1b2c3d4e5f6...64chars"
```

**Response (200):**
```json
{
  "appointment": {
    "id": "uuid",
    "guest_name": "Jane Doe",
    "guest_email": "jane@example.com",
    "guest_phone": null,
    "scheduled_at": "2026-05-10T14:00:00.000Z",
    "status": "Confirmed",
    "timezone": "America/New_York",
    "notes": null,
    "meeting_link": "https://zoom.us/j/123",
    "location": "Zoom",
    "address": null,
    "type": {
      "name": "30-Minute Consultation",
      "slug": "30min-consult",
      "duration": 30,
      "color": "#4f46e5"
    },
    "client": {
      "name": "Acme Corp",
      "domain": "example.com"
    }
  }
}
```

**Errors:**
- `404` — Appointment not found (invalid token)

---

### 6. Reschedule Appointment by Token

```
PUT /api/public/appointments/[token]
```

Reschedules an existing appointment. Validates the new slot's availability before updating.

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `scheduled_at` | string | yes | New ISO 8601 datetime |
| `notes` | string | no | Updated notes |

**Example:**
```bash
curl -X PUT "https://www.app.wehoware.ca/api/public/appointments/a1b2c3d4e5f6...64chars" \
  -H "Content-Type: application/json" \
  -d '{ "scheduled_at": "2026-05-12T15:00:00Z" }'
```

**Response (200):**
```json
{
  "appointment": { ... },
  "message": "Appointment rescheduled successfully"
}
```

**Errors:**
- `400` — Missing `scheduled_at`, invalid date, cannot reschedule cancelled/completed
- `404` — Appointment not found
- `409` — New slot not available

---

### 7. Cancel Appointment by Token

```
DELETE /api/public/appointments/[token]
```

Cancels an appointment (soft delete via status update — the record is preserved per data-safety policy).

**Example:**
```bash
curl -X DELETE "https://www.app.wehoware.ca/api/public/appointments/a1b2c3d4e5f6...64chars"
```

**Response (200):**
```json
{
  "success": true,
  "message": "Appointment cancelled successfully"
}
```

**Errors:**
- `400` — Already cancelled, or cannot cancel completed appointment
- `404` — Appointment not found

---

## Appointment Status Flow

```
Pending ──→ Confirmed ──→ Completed
   │           │
   │           └──→ Cancelled
   └──→ Cancelled
   └──→ NoShow
```

| Status | Description |
|---|---|
| `Pending` | Created, awaiting admin confirmation (if `requires_confirmation`) |
| `Confirmed` | Automatically confirmed (no confirmation needed) or admin-approved |
| `Cancelled` | Cancelled by guest or admin |
| `Completed` | Appointment took place |
| `NoShow` | Guest did not attend |

---

## Rate Limiting

- **List/availability/booking endpoints:** 60 requests/min per client+IP
- **Token endpoints:** 30 requests/min per IP
- **Rate limit exceeded:** HTTP 429 with `{ "error": "Rate limit exceeded..." }`

---

## CORS

All endpoints include CORS headers for cross-origin requests from client websites:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

`OPTIONS` preflight requests return `204 No Content`.

---

## Integration Example (JavaScript)

```javascript
const API_BASE = "https://www.app.wehoware.ca/api/public";
const CLIENT_PARAM = "domain=example.com";

// 1. Fetch appointment types
const typesRes = await fetch(`${API_BASE}/appointment-types?${CLIENT_PARAM}`);
const { data: types } = await typesRes.json();

// 2. Get available slots for a type
const availRes = await fetch(
  `${API_BASE}/availability?${CLIENT_PARAM}&appointment_type_slug=${types[0].slug}&from=2026-05-01&to=2026-05-07`
);
const { slots } = await availRes.json();

// 3. Book an appointment
const bookingRes = await fetch(`${API_BASE}/appointments?${CLIENT_PARAM}`, {
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
const lookupRes = await fetch(`${API_BASE}/appointments/${booking_token}`);
const { appointment: appt } = await lookupRes.json();

// 5. Reschedule
await fetch(`${API_BASE}/appointments/${booking_token}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ scheduled_at: "2026-05-15T10:00:00Z" }),
});

// 6. Cancel
await fetch(`${API_BASE}/appointments/${booking_token}`, { method: "DELETE" });
```

---

## Error Response Format

All errors return a consistent JSON shape:

```json
{
  "error": "Human-readable error message"
}
```

| Status | Meaning |
|---|---|
| `400` | Bad request — missing/invalid params |
| `403` | Client is inactive |
| `404` | Resource not found |
| `409` | Conflict — slot unavailable |
| `429` | Rate limit exceeded |
| `500` | Internal server error |
