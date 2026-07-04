-- Add lock_token column to wehoware_seo_analyser_runs for concurrency control
ALTER TABLE wehoware_seo_analyser_runs ADD COLUMN lock_token VARCHAR(36) NULL;

-- Add index on (content_id, status) for fast concurrency checks
CREATE INDEX idx_seo_analyser_runs_content_status ON wehoware_seo_analyser_runs(content_id, status);

-- Add rejected_by, rejected_at, applied_by columns to wehoware_seo_analyser_suggestions
ALTER TABLE wehoware_seo_analyser_suggestions ADD COLUMN rejected_by VARCHAR(36) NULL;
ALTER TABLE wehoware_seo_analyser_suggestions ADD COLUMN rejected_at DATETIME NULL;
ALTER TABLE wehoware_seo_analyser_suggestions ADD COLUMN applied_by VARCHAR(36) NULL;
