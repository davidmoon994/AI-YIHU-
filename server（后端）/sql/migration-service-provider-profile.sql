-- AI-YIHU 阶段12：服务人员资料与服务能力
-- 兼容现有 escorts 表，不修改原字段。

CREATE TABLE IF NOT EXISTS `escort_service_profiles` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `escort_id` BIGINT NOT NULL,
  `bio` VARCHAR(600) DEFAULT NULL,
  `experience_years` INT NOT NULL DEFAULT 0,
  `service_area` VARCHAR(100) DEFAULT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_escort_id` (`escort_id`),
  KEY `idx_service_area` (`service_area`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `escort_service_skills` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `escort_id` BIGINT NOT NULL,
  `service_type` VARCHAR(30) NOT NULL,
  `approval_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `review_remark` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_escort_service_type` (`escort_id`, `service_type`),
  KEY `idx_service_type_status` (`service_type`, `approval_status`),
  KEY `idx_escort_status` (`escort_id`, `approval_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
