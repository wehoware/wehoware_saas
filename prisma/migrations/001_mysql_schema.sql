-- ================================================================
-- Wehoware SaaS — MySQL 8.0+ Schema
-- Migration: 001_mysql_schema.sql
-- Converted from PostgreSQL (Supabase) to MySQL 8.0+
--
-- Key conversions:
--   UUID PRIMARY KEY DEFAULT uuid_generate_v4() → VARCHAR(36)
--     (Prisma generates UUIDs at app layer)
--   TIMESTAMPTZ → DATETIME(3)  (millisecond precision, UTC at app)
--   JSONB        → JSON
--   TEXT (unlimited) → TEXT / MEDIUMTEXT / LONGTEXT as appropriate
--   REFERENCES auth.users(id) → REFERENCES wehoware_profiles(id)
--     (wehoware_profiles IS the user table post-migration)
--   CHECK constraints on status → ENUM types
-- ================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION';

-- ================================================================
-- 1. Clients (Tenants)
-- ================================================================
CREATE TABLE IF NOT EXISTS wehoware_clients (
  id             VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  company_name   VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  contact_number VARCHAR(50),
  email          VARCHAR(255),
  address        TEXT,
  website        VARCHAR(500),
  industry       VARCHAR(100),
  domain         VARCHAR(255),
  active         TINYINT(1)   NOT NULL DEFAULT 1,
  created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 2. Profiles  (replaces Supabase auth.users)
--    email + password_hash added for NextAuth Credentials
-- ================================================================
CREATE TABLE IF NOT EXISTS wehoware_profiles (
  id            VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),
  first_name    VARCHAR(100),
  last_name     VARCHAR(100),
  avatar_url    VARCHAR(500),
  role          ENUM('client','employee','admin') NOT NULL DEFAULT 'client',
  client_id     VARCHAR(36),
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_profiles_email (email),
  KEY idx_profiles_role (role),
  KEY idx_profiles_client_id (client_id),
  CONSTRAINT fk_profiles_client
    FOREIGN KEY (client_id) REFERENCES wehoware_clients(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 3. Blog Categories
-- ================================================================
CREATE TABLE IF NOT EXISTS wehoware_blog_categories (
  id          VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  client_id   VARCHAR(36)  NOT NULL,
  name        VARCHAR(255) NOT NULL,
  slug        VARCHAR(255) NOT NULL,
  description TEXT,
  icon_url    VARCHAR(500),
  active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  created_by  VARCHAR(36),
  updated_by  VARCHAR(36),
  PRIMARY KEY (id),
  UNIQUE KEY uq_blog_categories_slug (slug),
  CONSTRAINT fk_blog_categories_client
    FOREIGN KEY (client_id) REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_blog_categories_creator
    FOREIGN KEY (created_by) REFERENCES wehoware_profiles(id) ON DELETE SET NULL,
  CONSTRAINT fk_blog_categories_updater
    FOREIGN KEY (updated_by) REFERENCES wehoware_profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 4. Blogs
-- ================================================================
CREATE TABLE IF NOT EXISTS wehoware_blogs (
  id               VARCHAR(36)                          NOT NULL DEFAULT (UUID()),
  client_id        VARCHAR(36)                          NOT NULL,
  title            VARCHAR(500)                         NOT NULL,
  slug             VARCHAR(500)                         NOT NULL,
  excerpt          TEXT,
  content          LONGTEXT,
  thumbnail        VARCHAR(500),
  status           ENUM('Draft','Published','Archived')  NOT NULL DEFAULT 'Draft',
  category_id      VARCHAR(36),
  featured         TINYINT(1)                           NOT NULL DEFAULT 0,
  read_time        INT,
  views            INT                                  NOT NULL DEFAULT 0,
  likes            INT                                  NOT NULL DEFAULT 0,
  tags             JSON                                 NOT NULL DEFAULT ('[]'),
  created_at       DATETIME(3)                          NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)                          NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  published_at     DATETIME(3),
  created_by       VARCHAR(36),
  updated_by       VARCHAR(36),
  meta_title       VARCHAR(255),
  meta_description VARCHAR(500),
  meta_keywords    VARCHAR(500),
  PRIMARY KEY (id),
  UNIQUE KEY uq_blogs_slug (slug),
  KEY wehoware_blogs_category_id_idx (category_id),
  KEY wehoware_blogs_status_idx (status),
  KEY wehoware_blogs_created_at_idx (created_at),
  CONSTRAINT fk_blogs_client
    FOREIGN KEY (client_id) REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_blogs_category
    FOREIGN KEY (category_id) REFERENCES wehoware_blog_categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_blogs_creator
    FOREIGN KEY (created_by) REFERENCES wehoware_profiles(id) ON DELETE SET NULL,
  CONSTRAINT fk_blogs_updater
    FOREIGN KEY (updated_by) REFERENCES wehoware_profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 5. Service Categories
-- ================================================================
CREATE TABLE IF NOT EXISTS wehoware_service_categories (
  id          VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  client_id   VARCHAR(36)  NOT NULL,
  name        VARCHAR(255) NOT NULL,
  slug        VARCHAR(255) NOT NULL,
  description TEXT,
  icon_url    VARCHAR(500),
  active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  created_by  VARCHAR(36),
  updated_by  VARCHAR(36),
  PRIMARY KEY (id),
  UNIQUE KEY uq_service_categories_slug (slug),
  CONSTRAINT fk_service_categories_client
    FOREIGN KEY (client_id) REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_service_categories_creator
    FOREIGN KEY (created_by) REFERENCES wehoware_profiles(id) ON DELETE SET NULL,
  CONSTRAINT fk_service_categories_updater
    FOREIGN KEY (updated_by) REFERENCES wehoware_profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 6. Services
-- ================================================================
CREATE TABLE IF NOT EXISTS wehoware_services (
  id               VARCHAR(36)   NOT NULL DEFAULT (UUID()),
  client_id        VARCHAR(36)   NOT NULL,
  title            VARCHAR(500)  NOT NULL,
  slug             VARCHAR(500)  NOT NULL,
  description      TEXT,
  content          LONGTEXT,
  thumbnail        VARCHAR(500),
  active           TINYINT(1)    NOT NULL DEFAULT 1,
  category_id      VARCHAR(36),
  fee              DECIMAL(10,2),
  fee_currency     VARCHAR(10)   NOT NULL DEFAULT 'CAD',
  service_code     VARCHAR(100),
  featured         TINYINT(1)    NOT NULL DEFAULT 0,
  rating           DECIMAL(3,2)  NOT NULL DEFAULT 0.00,
  reviews_count    INT           NOT NULL DEFAULT 0,
  tags             JSON          NOT NULL DEFAULT ('[]'),
  duration         VARCHAR(100),
  created_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  created_by       VARCHAR(36),
  updated_by       VARCHAR(36),
  meta_title       VARCHAR(255),
  meta_description VARCHAR(500),
  meta_keywords    VARCHAR(500),
  PRIMARY KEY (id),
  UNIQUE KEY uq_services_slug (slug),
  KEY wehoware_services_category_id_idx (category_id),
  KEY wehoware_services_active_idx (active),
  CONSTRAINT fk_services_client
    FOREIGN KEY (client_id) REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_services_category
    FOREIGN KEY (category_id) REFERENCES wehoware_service_categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_services_creator
    FOREIGN KEY (created_by) REFERENCES wehoware_profiles(id) ON DELETE SET NULL,
  CONSTRAINT fk_services_updater
    FOREIGN KEY (updated_by) REFERENCES wehoware_profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 7. Inquiries
-- ================================================================
CREATE TABLE IF NOT EXISTS wehoware_inquiries (
  id         VARCHAR(36)                            NOT NULL DEFAULT (UUID()),
  client_id  VARCHAR(36)                            NOT NULL,
  name       VARCHAR(255)                           NOT NULL,
  email      VARCHAR(255)                           NOT NULL,
  phone      VARCHAR(50),
  subject    VARCHAR(500)                           NOT NULL,
  message    TEXT                                   NOT NULL,
  service_id VARCHAR(36),
  status     ENUM('New','In Progress','Resolved')   NOT NULL DEFAULT 'New',
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  created_at DATETIME(3)                            NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3)                            NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(36),
  PRIMARY KEY (id),
  KEY wehoware_inquiries_status_idx (status),
  KEY wehoware_inquiries_created_at_idx (created_at),
  CONSTRAINT fk_inquiries_client
    FOREIGN KEY (client_id) REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_inquiries_service
    FOREIGN KEY (service_id) REFERENCES wehoware_services(id) ON DELETE SET NULL,
  CONSTRAINT fk_inquiries_updater
    FOREIGN KEY (updated_by) REFERENCES wehoware_profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 8. Static Pages
-- ================================================================
CREATE TABLE IF NOT EXISTS wehoware_static_pages (
  id                     VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  client_id              VARCHAR(36)  NOT NULL,
  page_slug              VARCHAR(255) NOT NULL,
  title                  VARCHAR(500),
  content                LONGTEXT,
  template_name          VARCHAR(255),
  layout                 JSON,
  meta_title             VARCHAR(255),
  meta_description       VARCHAR(500),
  meta_keywords          VARCHAR(500),
  open_graph_title       VARCHAR(255),
  open_graph_description VARCHAR(500),
  open_graph_image       VARCHAR(500),
  is_active              TINYINT(1)   NOT NULL DEFAULT 1,
  created_at             DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at             DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_static_pages_client
    FOREIGN KEY (client_id) REFERENCES wehoware_clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 9. Settings
-- ================================================================
CREATE TABLE IF NOT EXISTS wehoware_settings (
  id            VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  client_id     VARCHAR(36)  NOT NULL,
  setting_key   VARCHAR(255) NOT NULL,
  setting_value TEXT,
  setting_group VARCHAR(100),
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_settings_client_key (client_id, setting_key),
  KEY idx_settings_client_id (client_id),
  KEY idx_settings_setting_key (setting_key),
  CONSTRAINT fk_settings_client
    FOREIGN KEY (client_id) REFERENCES wehoware_clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 10. Notification Preferences
-- ================================================================
CREATE TABLE IF NOT EXISTS wehoware_notification_preferences (
  id             VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  client_id      VARCHAR(36)  NOT NULL,
  preference_key VARCHAR(255) NOT NULL,
  description    TEXT,
  enabled        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_notif_prefs_client
    FOREIGN KEY (client_id) REFERENCES wehoware_clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 11. Form Templates
-- ================================================================
CREATE TABLE IF NOT EXISTS wehoware_form_templates (
  id                 VARCHAR(36)                          NOT NULL DEFAULT (UUID()),
  client_id          VARCHAR(36)                          NOT NULL,
  title              VARCHAR(500)                         NOT NULL,
  description        TEXT,
  status             ENUM('Draft','Published','Archived')  NOT NULL DEFAULT 'Draft',
  created_at         DATETIME(3)                          NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3)                          NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  created_by         VARCHAR(36),
  updated_by         VARCHAR(36),
  success_message    VARCHAR(500)                                  DEFAULT 'Thank you for your submission!',
  redirect_url       VARCHAR(500),
  notification_emails JSON                                NOT NULL DEFAULT ('[]'),
  PRIMARY KEY (id),
  CONSTRAINT fk_form_templates_client
    FOREIGN KEY (client_id) REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_form_templates_creator
    FOREIGN KEY (created_by) REFERENCES wehoware_profiles(id) ON DELETE SET NULL,
  CONSTRAINT fk_form_templates_updater
    FOREIGN KEY (updated_by) REFERENCES wehoware_profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 12. Form Fields
-- ================================================================
CREATE TABLE IF NOT EXISTS wehoware_form_fields (
  id               VARCHAR(36) NOT NULL DEFAULT (UUID()),
  client_id        VARCHAR(36) NOT NULL,
  form_template_id VARCHAR(36) NOT NULL,
  field_type       ENUM('text','textarea','email','phone','number','date','time',
                        'checkbox','radio','select','file','hidden') NOT NULL,
  label            VARCHAR(255) NOT NULL,
  placeholder      VARCHAR(255),
  help_text        VARCHAR(500),
  required         TINYINT(1)   NOT NULL DEFAULT 0,
  field_order      INT          NOT NULL,
  default_value    VARCHAR(500),
  options          JSON         NOT NULL DEFAULT ('[]'),
  validation_rules JSON         NOT NULL DEFAULT ('{}'),
  css_class        VARCHAR(255),
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_form_fields_client
    FOREIGN KEY (client_id) REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_form_fields_template
    FOREIGN KEY (form_template_id) REFERENCES wehoware_form_templates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 13. Form Submissions
-- ================================================================
CREATE TABLE IF NOT EXISTS wehoware_form_submissions (
  id               VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  client_id        VARCHAR(36)  NOT NULL,
  form_template_id VARCHAR(36)  NOT NULL,
  submission_data  JSON         NOT NULL,
  submitted_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ip_address       VARCHAR(45),
  user_agent       VARCHAR(500),
  status           ENUM('New','Viewed','Contacted','Converted','Archived') NOT NULL DEFAULT 'New',
  notes            TEXT,
  tags             JSON         NOT NULL DEFAULT ('[]'),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  updated_by       VARCHAR(36),
  PRIMARY KEY (id),
  CONSTRAINT fk_form_submissions_client
    FOREIGN KEY (client_id) REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_form_submissions_template
    FOREIGN KEY (form_template_id) REFERENCES wehoware_form_templates(id) ON DELETE CASCADE,
  CONSTRAINT fk_form_submissions_updater
    FOREIGN KEY (updated_by) REFERENCES wehoware_profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 14. Integration Providers
-- ================================================================
CREATE TABLE IF NOT EXISTS wehoware_integration_providers (
  id                VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  name              VARCHAR(255) NOT NULL,
  category          VARCHAR(100) NOT NULL,
  description       TEXT,
  logo_url          VARCHAR(500),
  documentation_url VARCHAR(500),
  active            TINYINT(1)   NOT NULL DEFAULT 1,
  created_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 15. Integrations
-- ================================================================
CREATE TABLE IF NOT EXISTS wehoware_integrations (
  id              VARCHAR(36)                       NOT NULL DEFAULT (UUID()),
  client_id       VARCHAR(36)                       NOT NULL,
  provider_id     VARCHAR(36)                       NOT NULL,
  name            VARCHAR(255)                      NOT NULL,
  api_key         VARCHAR(500),
  api_secret      VARCHAR(500),
  access_token    TEXT,
  refresh_token   TEXT,
  token_expires_at DATETIME(3),
  config          JSON                              NOT NULL DEFAULT ('{}'),
  status          ENUM('Active','Paused','Error')   NOT NULL DEFAULT 'Active',
  last_sync_at    DATETIME(3),
  sync_frequency  VARCHAR(100),
  created_at      DATETIME(3)                       NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)                       NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  created_by      VARCHAR(36),
  updated_by      VARCHAR(36),
  PRIMARY KEY (id),
  CONSTRAINT fk_integrations_client
    FOREIGN KEY (client_id) REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_integrations_provider
    FOREIGN KEY (provider_id) REFERENCES wehoware_integration_providers(id),
  CONSTRAINT fk_integrations_creator
    FOREIGN KEY (created_by) REFERENCES wehoware_profiles(id) ON DELETE SET NULL,
  CONSTRAINT fk_integrations_updater
    FOREIGN KEY (updated_by) REFERENCES wehoware_profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 16. Integration Webhooks
-- ================================================================
CREATE TABLE IF NOT EXISTS wehoware_integration_webhooks (
  id             VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  client_id      VARCHAR(36)  NOT NULL,
  integration_id VARCHAR(36)  NOT NULL,
  event_type     VARCHAR(100) NOT NULL,
  webhook_url    VARCHAR(500) NOT NULL,
  active         TINYINT(1)   NOT NULL DEFAULT 1,
  secret_key     VARCHAR(255),
  created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_integration_webhooks_client
    FOREIGN KEY (client_id) REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_integration_webhooks_integration
    FOREIGN KEY (integration_id) REFERENCES wehoware_integrations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 17. Integration Logs
-- ================================================================
CREATE TABLE IF NOT EXISTS wehoware_integration_logs (
  id                VARCHAR(36)                        NOT NULL DEFAULT (UUID()),
  client_id         VARCHAR(36)                        NOT NULL,
  integration_id    VARCHAR(36)                        NOT NULL,
  operation         VARCHAR(255)                       NOT NULL,
  status            ENUM('Success','Failed','Partial') NOT NULL,
  details           JSON,
  start_time        DATETIME(3)                        NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  end_time          DATETIME(3),
  records_processed INT,
  error_message     TEXT,
  PRIMARY KEY (id),
  CONSTRAINT fk_integration_logs_client
    FOREIGN KEY (client_id) REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_integration_logs_integration
    FOREIGN KEY (integration_id) REFERENCES wehoware_integrations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 18. Report Templates
-- ================================================================
CREATE TABLE IF NOT EXISTS wehoware_report_templates (
  id                VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  client_id         VARCHAR(36)  NOT NULL,
  title             VARCHAR(500) NOT NULL,
  description       TEXT,
  report_type       VARCHAR(100) NOT NULL,
  layout            JSON,
  components        JSON,
  is_system_template TINYINT(1)  NOT NULL DEFAULT 0,
  created_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  created_by        VARCHAR(36),
  updated_by        VARCHAR(36),
  PRIMARY KEY (id),
  CONSTRAINT fk_report_templates_client
    FOREIGN KEY (client_id) REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_report_templates_creator
    FOREIGN KEY (created_by) REFERENCES wehoware_profiles(id) ON DELETE SET NULL,
  CONSTRAINT fk_report_templates_updater
    FOREIGN KEY (updated_by) REFERENCES wehoware_profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 19. Reports
-- ================================================================
CREATE TABLE IF NOT EXISTS wehoware_reports (
  id                  VARCHAR(36)                          NOT NULL DEFAULT (UUID()),
  client_id           VARCHAR(36)                          NOT NULL,
  template_id         VARCHAR(36)                          NOT NULL,
  title               VARCHAR(500)                         NOT NULL,
  description         TEXT,
  report_data         JSON,
  date_range_start    DATE,
  date_range_end      DATE,
  status              ENUM('Draft','Published','Archived')  NOT NULL DEFAULT 'Draft',
  is_scheduled        TINYINT(1)                           NOT NULL DEFAULT 0,
  schedule_frequency  VARCHAR(100),
  last_generated_at   DATETIME(3),
  next_generation_at  DATETIME(3),
  created_at          DATETIME(3)                          NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)                          NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  created_by          VARCHAR(36),
  updated_by          VARCHAR(36),
  PRIMARY KEY (id),
  CONSTRAINT fk_reports_client
    FOREIGN KEY (client_id) REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_reports_template
    FOREIGN KEY (template_id) REFERENCES wehoware_report_templates(id),
  CONSTRAINT fk_reports_creator
    FOREIGN KEY (created_by) REFERENCES wehoware_profiles(id) ON DELETE SET NULL,
  CONSTRAINT fk_reports_updater
    FOREIGN KEY (updated_by) REFERENCES wehoware_profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 20. Report Shares
-- ================================================================
CREATE TABLE IF NOT EXISTS wehoware_report_shares (
  id              VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  client_id       VARCHAR(36)  NOT NULL,
  report_id       VARCHAR(36)  NOT NULL,
  access_token    VARCHAR(255) NOT NULL,
  recipient_email VARCHAR(255),
  recipient_name  VARCHAR(255),
  message         TEXT,
  expires_at      DATETIME(3),
  last_accessed_at DATETIME(3),
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_by      VARCHAR(36),
  PRIMARY KEY (id),
  CONSTRAINT fk_report_shares_client
    FOREIGN KEY (client_id) REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_report_shares_report
    FOREIGN KEY (report_id) REFERENCES wehoware_reports(id) ON DELETE CASCADE,
  CONSTRAINT fk_report_shares_creator
    FOREIGN KEY (created_by) REFERENCES wehoware_profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 21. User-Client Associations (multi-tenant access)
-- ================================================================
CREATE TABLE IF NOT EXISTS wehoware_user_clients (
  id         VARCHAR(36) NOT NULL DEFAULT (UUID()),
  user_id    VARCHAR(36) NOT NULL,
  client_id  VARCHAR(36) NOT NULL,
  is_primary TINYINT(1)  NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_clients (user_id, client_id),
  KEY idx_user_clients_user_id (user_id),
  KEY idx_user_clients_client_id (client_id),
  CONSTRAINT fk_user_clients_user
    FOREIGN KEY (user_id) REFERENCES wehoware_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_clients_client
    FOREIGN KEY (client_id) REFERENCES wehoware_clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 22. Client Switch History (Audit)
-- ================================================================
CREATE TABLE IF NOT EXISTS wehoware_client_switch_history (
  id         VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  user_id    VARCHAR(36)  NOT NULL,
  client_id  VARCHAR(36)  NOT NULL,
  switched_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  PRIMARY KEY (id),
  KEY idx_client_switch_history_user_id (user_id),
  KEY idx_client_switch_history_client_id (client_id),
  CONSTRAINT fk_switch_history_user
    FOREIGN KEY (user_id) REFERENCES wehoware_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_switch_history_client
    FOREIGN KEY (client_id) REFERENCES wehoware_clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 23. Client Keywords (SEO)
-- ================================================================
CREATE TABLE IF NOT EXISTS wehoware_client_keywords (
  id          VARCHAR(36) NOT NULL DEFAULT (UUID()),
  client_id   VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  keywords    JSON        NOT NULL DEFAULT ('{"sections": []}'),
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_client_keywords (client_id, employee_id),
  KEY idx_client_keywords_client_id (client_id),
  KEY idx_client_keywords_employee_id (employee_id),
  CONSTRAINT fk_client_keywords_client
    FOREIGN KEY (client_id) REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_client_keywords_employee
    FOREIGN KEY (employee_id) REFERENCES wehoware_profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 24. Tasks
-- ================================================================
CREATE TABLE IF NOT EXISTS wehoware_tasks (
  id          VARCHAR(36) NOT NULL DEFAULT (UUID()),
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  title       VARCHAR(500) NOT NULL,
  description TEXT,
  due_date    DATETIME(3),
  priority    ENUM('Low','Medium','High'),
  status      ENUM('To Do','In Progress','Done','Backlog'),
  client_id   VARCHAR(36),
  assignee_id VARCHAR(36),
  created_by  VARCHAR(36),
  PRIMARY KEY (id),
  CONSTRAINT fk_tasks_client
    FOREIGN KEY (client_id) REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_tasks_assignee
    FOREIGN KEY (assignee_id) REFERENCES wehoware_profiles(id) ON DELETE SET NULL,
  CONSTRAINT fk_tasks_creator
    FOREIGN KEY (created_by) REFERENCES wehoware_profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 25. Task Activities
-- ================================================================
CREATE TABLE IF NOT EXISTS wehoware_task_activities (
  id            VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  task_id       VARCHAR(36)  NOT NULL,
  user_id       VARCHAR(36),
  activity_type VARCHAR(100) NOT NULL,
  details       JSON,
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_task_activities_task
    FOREIGN KEY (task_id) REFERENCES wehoware_tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_task_activities_user
    FOREIGN KEY (user_id) REFERENCES wehoware_profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 26. Task Comments
-- ================================================================
CREATE TABLE IF NOT EXISTS wehoware_task_comments (
  id         VARCHAR(36) NOT NULL DEFAULT (UUID()),
  task_id    VARCHAR(36) NOT NULL,
  user_id    VARCHAR(36),
  content    TEXT        NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_task_comments_task
    FOREIGN KEY (task_id) REFERENCES wehoware_tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_task_comments_user
    FOREIGN KEY (user_id) REFERENCES wehoware_profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- Re-enable FK checks
-- ================================================================
SET FOREIGN_KEY_CHECKS = 1;
