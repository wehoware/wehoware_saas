-- Create wehoware_user_invites table
CREATE TABLE IF NOT EXISTS `wehoware_user_invites` (
  `id` VARCHAR(36) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `client_id` VARCHAR(36) NOT NULL,
  `role` VARCHAR(20) DEFAULT 'viewer' NOT NULL,
  `invited_by` VARCHAR(36) NOT NULL,
  `token` VARCHAR(255) NOT NULL,
  `status` VARCHAR(20) DEFAULT 'Pending' NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `wehoware_user_invites_token_key`(`token`),
  INDEX `wehoware_user_invites_email_idx`(`email`),
  INDEX `wehoware_user_invites_client_id_idx`(`client_id`),
  INDEX `wehoware_user_invites_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create wehoware_password_resets table
CREATE TABLE IF NOT EXISTS `wehoware_password_resets` (
  `id` VARCHAR(36) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `token` VARCHAR(255) NOT NULL,
  `used` BOOLEAN DEFAULT false NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `wehoware_password_resets_token_key`(`token`),
  INDEX `wehoware_password_resets_email_idx`(`email`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add foreign keys for wehoware_user_invites (skip if they exist)
ALTER TABLE `wehoware_user_invites` ADD CONSTRAINT IF NOT EXISTS `wehoware_user_invites_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `wehoware_clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `wehoware_user_invites` ADD CONSTRAINT IF NOT EXISTS `wehoware_user_invites_invited_by_fkey` FOREIGN KEY (`invited_by`) REFERENCES `wehoware_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
