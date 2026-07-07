-- 012_invoice_billing_dates_share_token.sql
-- Add billing start/end dates and share token fields to wehoware_invoices.

ALTER TABLE wehoware_invoices
  ADD COLUMN billing_start_date DATE NULL DEFAULT NULL,
  ADD COLUMN billing_end_date DATE NULL DEFAULT NULL,
  ADD COLUMN share_token VARCHAR(128) NULL DEFAULT NULL,
  ADD COLUMN share_token_generated_at DATETIME NULL DEFAULT NULL;

CREATE INDEX wehoware_invoices_share_token_idx
  ON wehoware_invoices (share_token);
