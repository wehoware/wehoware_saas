-- Add report-level start_time and end_time columns to wehoware_daily_work_reports
-- These allow totalHours to be computed even when no Work Items are added

ALTER TABLE `wehoware_daily_work_reports`
  ADD COLUMN `start_time` DATETIME(3) NULL AFTER `report_date`,
  ADD COLUMN `end_time` DATETIME(3) NULL AFTER `start_time`;
