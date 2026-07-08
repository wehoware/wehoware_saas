-- 013_attachments_table.sql
-- Create wehoware_attachments table for multi-file attachments on bills and expenses.
-- FK constraints omitted due to charset/collation mismatches with existing tables.
-- Cascading deletes are handled at the application level in DELETE handlers.

CREATE TABLE wehoware_attachments (
  id          VARCHAR(36)  NOT NULL PRIMARY KEY,
  client_id   VARCHAR(36)  NOT NULL,
  bill_id     VARCHAR(36)  NULL DEFAULT NULL,
  expense_id  VARCHAR(36)  NULL DEFAULT NULL,
  file_name   VARCHAR(255) NOT NULL,
  file_url    VARCHAR(500) NOT NULL,
  file_type   VARCHAR(100) NOT NULL,
  file_size   INT          NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX wehoware_attachments_bill_id_idx
  ON wehoware_attachments (bill_id);
CREATE INDEX wehoware_attachments_expense_id_idx
  ON wehoware_attachments (expense_id);
CREATE INDEX wehoware_attachments_client_id_idx
  ON wehoware_attachments (client_id);

-- Migrate existing expense receipt_url values into the attachments table.
-- Only rows with a non-empty receipt_url are migrated.
INSERT INTO wehoware_attachments (id, client_id, expense_id, file_name, file_url, file_type, file_size, created_at)
SELECT
  UUID() AS id,
  e.client_id,
  e.id AS expense_id,
  COALESCE(
    NULLIF(SUBSTRING_INDEX(REVERSE(SUBSTRING_INDEX(REVERSE(e.receipt_url), '/', 1)), '/', -1), ''),
    'receipt'
  ) AS file_name,
  e.receipt_url AS file_url,
  CASE
    WHEN e.receipt_url LIKE '%.pdf' THEN 'application/pdf'
    WHEN e.receipt_url LIKE '%.png' THEN 'image/png'
    WHEN e.receipt_url LIKE '%.jpg' OR e.receipt_url LIKE '%.jpeg' THEN 'image/jpeg'
    WHEN e.receipt_url LIKE '%.gif' THEN 'image/gif'
    WHEN e.receipt_url LIKE '%.webp' THEN 'image/webp'
    ELSE 'application/octet-stream'
  END AS file_type,
  0 AS file_size,
  NOW() AS created_at
FROM wehoware_expenses e
WHERE e.receipt_url IS NOT NULL
  AND TRIM(e.receipt_url) <> '';
