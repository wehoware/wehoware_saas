-- Add color column to wehoware_crm_contact_lists
ALTER TABLE wehoware_crm_contact_lists
  ADD COLUMN color VARCHAR(20) NULL AFTER description;
