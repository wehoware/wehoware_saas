-- Migration: Add SEO and Marketing fields to wehoware_services and wehoware_blogs
-- Created: 2026-06-12
-- Author: Cascade AI
-- Description: Adds Open Graph, Twitter Card, Schema, CTA, and SEO scoring fields
--              to both services and blogs tables. All new columns are nullable
--              (or have defaults) for backward compatibility — zero downtime.

-- ---------------------------------------------------------------------------
-- wehoware_services
-- ---------------------------------------------------------------------------
ALTER TABLE wehoware_services
  ADD COLUMN open_graph_title VARCHAR(255) NULL AFTER meta_keywords,
  ADD COLUMN open_graph_description VARCHAR(500) NULL AFTER open_graph_title,
  ADD COLUMN open_graph_image VARCHAR(500) NULL AFTER open_graph_description,
  ADD COLUMN twitter_title VARCHAR(255) NULL AFTER open_graph_image,
  ADD COLUMN twitter_description VARCHAR(500) NULL AFTER twitter_title,
  ADD COLUMN twitter_image VARCHAR(500) NULL AFTER twitter_description,
  ADD COLUMN canonical_url VARCHAR(500) NULL AFTER twitter_image,
  ADD COLUMN robots_meta VARCHAR(50) NOT NULL DEFAULT 'index,follow' AFTER canonical_url,
  ADD COLUMN schema_type VARCHAR(100) NOT NULL DEFAULT 'Service' AFTER robots_meta,
  ADD COLUMN seo_score INT NOT NULL DEFAULT 0 AFTER schema_type,
  ADD COLUMN target_keywords JSON NULL AFTER seo_score,
  ADD COLUMN cta_heading VARCHAR(255) NULL AFTER target_keywords,
  ADD COLUMN cta_body TEXT NULL AFTER cta_heading,
  ADD COLUMN cta_button_text VARCHAR(100) NULL AFTER cta_body,
  ADD COLUMN cta_button_url VARCHAR(500) NULL AFTER cta_button_text,
  ADD COLUMN allow_social_share TINYINT(1) NOT NULL DEFAULT 1 AFTER cta_button_url;

-- ---------------------------------------------------------------------------
-- wehoware_blogs
-- ---------------------------------------------------------------------------
ALTER TABLE wehoware_blogs
  ADD COLUMN open_graph_title VARCHAR(255) NULL AFTER meta_keywords,
  ADD COLUMN open_graph_description VARCHAR(500) NULL AFTER open_graph_title,
  ADD COLUMN open_graph_image VARCHAR(500) NULL AFTER open_graph_description,
  ADD COLUMN twitter_title VARCHAR(255) NULL AFTER open_graph_image,
  ADD COLUMN twitter_description VARCHAR(500) NULL AFTER twitter_title,
  ADD COLUMN twitter_image VARCHAR(500) NULL AFTER twitter_description,
  ADD COLUMN canonical_url VARCHAR(500) NULL AFTER twitter_image,
  ADD COLUMN robots_meta VARCHAR(50) NOT NULL DEFAULT 'index,follow' AFTER canonical_url,
  ADD COLUMN schema_type VARCHAR(100) NOT NULL DEFAULT 'BlogPosting' AFTER robots_meta,
  ADD COLUMN seo_score INT NOT NULL DEFAULT 0 AFTER schema_type,
  ADD COLUMN target_keywords JSON NULL AFTER seo_score,
  ADD COLUMN show_toc TINYINT(1) NOT NULL DEFAULT 0 AFTER target_keywords,
  ADD COLUMN show_author_box TINYINT(1) NOT NULL DEFAULT 1 AFTER show_toc,
  ADD COLUMN cta_heading VARCHAR(255) NULL AFTER show_author_box,
  ADD COLUMN cta_body TEXT NULL AFTER cta_heading,
  ADD COLUMN cta_button_text VARCHAR(100) NULL AFTER cta_body,
  ADD COLUMN cta_button_url VARCHAR(500) NULL AFTER cta_button_text,
  ADD COLUMN allow_social_share TINYINT(1) NOT NULL DEFAULT 1 AFTER cta_button_url;
