CREATE TABLE IF NOT EXISTS `order_service_confirmations` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT NOT NULL,
  `escort_id` BIGINT NOT NULL,
  `service_type` VARCHAR(30) NOT NULL,
  `confirm_stage` VARCHAR(30) NOT NULL,
  `checklist_json` TEXT NOT NULL,
  `remark` VARCHAR(500) DEFAULT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_escort_stage` (`order_id`, `escort_id`, `confirm_stage`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_escort_id` (`escort_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
