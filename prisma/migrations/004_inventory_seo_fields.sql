-- Add SEO fields to wehoware_inventory_items (matching blogs & services)
ALTER TABLE wehoware_inventory_items
  ADD COLUMN open_graph_title VARCHAR(255) DEFAULT NULL,
  ADD COLUMN open_graph_description VARCHAR(500) DEFAULT NULL,
  ADD COLUMN open_graph_image VARCHAR(500) DEFAULT NULL,
  ADD COLUMN twitter_title VARCHAR(255) DEFAULT NULL,
  ADD COLUMN twitter_description VARCHAR(500) DEFAULT NULL,
  ADD COLUMN twitter_image VARCHAR(500) DEFAULT NULL,
  ADD COLUMN canonical_url VARCHAR(500) DEFAULT NULL,
  ADD COLUMN robots_meta VARCHAR(50) NOT NULL DEFAULT 'index,follow',
  ADD COLUMN schema_type VARCHAR(100) NOT NULL DEFAULT 'Product',
  ADD COLUMN seo_score INT NOT NULL DEFAULT 0,
  ADD COLUMN target_keywords JSON DEFAULT NULL,
  ADD COLUMN cta_heading VARCHAR(255) DEFAULT NULL,
  ADD COLUMN cta_body TEXT DEFAULT NULL,
  ADD COLUMN cta_button_text VARCHAR(100) DEFAULT NULL,
  ADD COLUMN cta_button_url VARCHAR(500) DEFAULT NULL,
  ADD COLUMN allow_social_share BOOLEAN NOT NULL DEFAULT TRUE;
