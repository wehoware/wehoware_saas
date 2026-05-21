-- =============================================================
-- Migration 003: Add public booking fields for guest appointment scheduling
--
-- 1. wehoware_clients.public_slug  — unique public identifier for client booking pages
-- 2. wehoware_appointments.booking_token — secure opaque token for public lookup/reschedule/cancel
-- =============================================================

ALTER TABLE wehoware_clients
  ADD COLUMN public_slug VARCHAR(255) NULL AFTER domain,
  ADD UNIQUE INDEX wehoware_clients_public_slug_unique (public_slug);

ALTER TABLE wehoware_appointments
  ADD COLUMN booking_token VARCHAR(64) NULL AFTER timezone,
  ADD UNIQUE INDEX wehoware_appointments_booking_token_unique (booking_token);
