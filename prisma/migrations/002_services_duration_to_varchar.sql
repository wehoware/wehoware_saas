-- =============================================================
-- Migration 002: Change wehoware_services.duration from INT to VARCHAR(100)
--
-- Reason: The admin form accepts free-form duration strings
--         (e.g., "3 hours", "1 year", "Varies"). Storing these in an
--         INT column caused Prisma validation errors on POST/PUT,
--         surfacing as 500 "Failed to create service".
--
-- Safe to run with zero downtime:
--   * INT → VARCHAR(100) is a widening, lossless conversion in MySQL 8+.
--   * Existing numeric values are preserved as their decimal string form.
-- =============================================================

ALTER TABLE wehoware_services
  MODIFY COLUMN duration VARCHAR(100) NULL;
