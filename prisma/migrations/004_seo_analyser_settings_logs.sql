-- 004: SEO Analyser — add settings, logs, and extend issues + suggestions

-- 1. Add new columns to wehoware_seo_analyser_issues
ALTER TABLE wehoware_seo_analyser_issues
  ADD COLUMN client_id VARCHAR(36) NOT NULL DEFAULT '',
  ADD COLUMN item_type VARCHAR(20) NOT NULL DEFAULT '',
  ADD COLUMN item_id VARCHAR(36) NOT NULL DEFAULT '',
  ADD COLUMN item_title VARCHAR(500) NULL,
  ADD COLUMN item_slug VARCHAR(500) NULL,
  ADD COLUMN issue_type VARCHAR(100) NULL,
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'open',
  ADD COLUMN updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- Add foreign key for client_id
ALTER TABLE wehoware_seo_analyser_issues
  ADD CONSTRAINT fk_seo_analyser_issues_client
  FOREIGN KEY (client_id) REFERENCES wehoware_clients(id) ON DELETE CASCADE;

-- Add indexes
CREATE INDEX idx_seo_analyser_issues_client ON wehoware_seo_analyser_issues(client_id);
CREATE INDEX idx_seo_analyser_issues_client_item ON wehoware_seo_analyser_issues(client_id, item_type, item_id);
CREATE INDEX idx_seo_analyser_issues_client_status ON wehoware_seo_analyser_issues(client_id, status);

-- 2. Add new columns to wehoware_seo_analyser_suggestions
ALTER TABLE wehoware_seo_analyser_suggestions
  ADD COLUMN client_id VARCHAR(36) NOT NULL DEFAULT '',
  ADD COLUMN item_type VARCHAR(20) NOT NULL DEFAULT '',
  ADD COLUMN item_id VARCHAR(36) NOT NULL DEFAULT '',
  ADD COLUMN action VARCHAR(50) NOT NULL DEFAULT 'set',
  ADD COLUMN current_value TEXT NULL,
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN approved_by VARCHAR(36) NULL,
  ADD COLUMN approved_at DATETIME(3) NULL,
  ADD COLUMN applied_at DATETIME(3) NULL,
  ADD COLUMN applied_result TEXT NULL,
  ADD COLUMN updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- Change suggested_value to LONGTEXT
ALTER TABLE wehoware_seo_analyser_suggestions
  MODIFY COLUMN suggested_value LONGTEXT;

-- Remove old 'applied' column
ALTER TABLE wehoware_seo_analyser_suggestions
  DROP COLUMN applied;

-- Add foreign key for client_id
ALTER TABLE wehoware_seo_analyser_suggestions
  ADD CONSTRAINT fk_seo_analyser_suggestions_client
  FOREIGN KEY (client_id) REFERENCES wehoware_clients(id) ON DELETE CASCADE;

-- Add indexes
CREATE INDEX idx_seo_analyser_suggestions_client ON wehoware_seo_analyser_suggestions(client_id);
CREATE INDEX idx_seo_analyser_suggestions_client_status ON wehoware_seo_analyser_suggestions(client_id, status);
CREATE INDEX idx_seo_analyser_suggestions_client_item ON wehoware_seo_analyser_suggestions(client_id, item_type, item_id);

-- 3. Create wehoware_seo_analyser_settings
CREATE TABLE wehoware_seo_analyser_settings (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  client_id VARCHAR(36) NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  schedule_frequency VARCHAR(20) NOT NULL DEFAULT 'weekly',
  schedule_day_of_week INT NOT NULL DEFAULT 1,
  schedule_day_of_month INT NOT NULL DEFAULT 1,
  schedule_hour INT NOT NULL DEFAULT 2,
  scan_blogs BOOLEAN NOT NULL DEFAULT TRUE,
  scan_services BOOLEAN NOT NULL DEFAULT TRUE,
  scan_inventory BOOLEAN NOT NULL DEFAULT TRUE,
  scan_static_pages BOOLEAN NOT NULL DEFAULT TRUE,
  min_seo_score INT NOT NULL DEFAULT 80,
  check_meta_tags BOOLEAN NOT NULL DEFAULT TRUE,
  check_schema BOOLEAN NOT NULL DEFAULT TRUE,
  check_internal_links BOOLEAN NOT NULL DEFAULT TRUE,
  check_content_structure BOOLEAN NOT NULL DEFAULT TRUE,
  check_aeo BOOLEAN NOT NULL DEFAULT TRUE,
  check_geo BOOLEAN NOT NULL DEFAULT TRUE,
  check_sxo BOOLEAN NOT NULL DEFAULT TRUE,
  check_keyword_usage BOOLEAN NOT NULL DEFAULT TRUE,
  check_canonical BOOLEAN NOT NULL DEFAULT TRUE,
  check_open_graph BOOLEAN NOT NULL DEFAULT TRUE,
  check_twitter_cards BOOLEAN NOT NULL DEFAULT TRUE,
  check_robots_meta BOOLEAN NOT NULL DEFAULT TRUE,
  check_image_alt BOOLEAN NOT NULL DEFAULT TRUE,
  check_heading_structure BOOLEAN NOT NULL DEFAULT TRUE,
  check_eeat BOOLEAN NOT NULL DEFAULT TRUE,
  check_readability BOOLEAN NOT NULL DEFAULT TRUE,
  check_content_freshness BOOLEAN NOT NULL DEFAULT TRUE,
  check_url_optimization BOOLEAN NOT NULL DEFAULT TRUE,
  check_indexability BOOLEAN NOT NULL DEFAULT TRUE,
  check_duplicate_content BOOLEAN NOT NULL DEFAULT TRUE,
  check_page_depth BOOLEAN NOT NULL DEFAULT TRUE,
  check_https BOOLEAN NOT NULL DEFAULT TRUE,
  check_web_vitals BOOLEAN NOT NULL DEFAULT TRUE,
  check_rich_snippets BOOLEAN NOT NULL DEFAULT TRUE,
  check_tfidf BOOLEAN NOT NULL DEFAULT TRUE,
  check_content_coverage BOOLEAN NOT NULL DEFAULT TRUE,
  check_serp_features BOOLEAN NOT NULL DEFAULT TRUE,
  check_multimedia_seo BOOLEAN NOT NULL DEFAULT TRUE,
  auto_suggest_fixes BOOLEAN NOT NULL DEFAULT TRUE,
  language VARCHAR(10) NOT NULL DEFAULT 'en',
  last_run_at DATETIME(3) NULL,
  next_run_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_seo_analyser_settings_client FOREIGN KEY (client_id) REFERENCES wehoware_clients(id) ON DELETE CASCADE
);

-- 4. Create wehoware_seo_analyser_logs
CREATE TABLE wehoware_seo_analyser_logs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  run_id VARCHAR(36) NOT NULL,
  client_id VARCHAR(36) NOT NULL,
  step VARCHAR(100) NOT NULL,
  step_order INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  input JSON NULL,
  output JSON NULL,
  duration_ms INT NULL,
  error_message TEXT NULL,
  tokens_used INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_seo_analyser_logs_client FOREIGN KEY (client_id) REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  INDEX idx_seo_analyser_logs_run (run_id),
  INDEX idx_seo_analyser_logs_client (client_id),
  INDEX idx_seo_analyser_logs_run_step (run_id, step)
);
