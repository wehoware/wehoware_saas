-- Allow work item start_time / end_time to be NULL.
-- The report form permits items without times (hours can be entered manually),
-- so writing null previously failed with a generic 500 on save.

ALTER TABLE `wehoware_daily_work_report_items`
  MODIFY COLUMN `start_time` DATETIME(3) NULL,
  MODIFY COLUMN `end_time` DATETIME(3) NULL;
