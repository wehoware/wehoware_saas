-- =============================================================
-- Migration 006: Add FAQ tables for Services and Blogs
-- =============================================================
-- Purpose: Support admin-curated Q&A pairs attached to each
--          service and blog post. Enables FAQPage structured data
--          for SEO-rich snippets.
--
-- Backward compatibility: Safe — new tables, no existing data
--                           or schema changes to current tables.
-- =============================================================

-- ─── Service FAQs ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wehoware_service_faqs (
  id            VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  client_id     VARCHAR(36)  NOT NULL,
  service_id    VARCHAR(36)  NOT NULL,
  question      VARCHAR(500) NOT NULL,
  answer        TEXT         NOT NULL,
  display_order INT          NOT NULL DEFAULT 0,
  active        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY wehoware_service_faqs_service_id_idx (service_id),
  KEY wehoware_service_faqs_client_id_idx (client_id),
  KEY wehoware_service_faqs_display_order_idx (display_order),
  CONSTRAINT fk_service_faqs_service
    FOREIGN KEY (service_id) REFERENCES wehoware_services(id) ON DELETE CASCADE,
  CONSTRAINT fk_service_faqs_client
    FOREIGN KEY (client_id) REFERENCES wehoware_clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Blog FAQs ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wehoware_blog_faqs (
  id            VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  client_id     VARCHAR(36)  NOT NULL,
  blog_id       VARCHAR(36)  NOT NULL,
  question      VARCHAR(500) NOT NULL,
  answer        TEXT         NOT NULL,
  display_order INT          NOT NULL DEFAULT 0,
  active        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY wehoware_blog_faqs_blog_id_idx (blog_id),
  KEY wehoware_blog_faqs_client_id_idx (client_id),
  KEY wehoware_blog_faqs_display_order_idx (display_order),
  CONSTRAINT fk_blog_faqs_blog
    FOREIGN KEY (blog_id) REFERENCES wehoware_blogs(id) ON DELETE CASCADE,
  CONSTRAINT fk_blog_faqs_client
    FOREIGN KEY (client_id) REFERENCES wehoware_clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
