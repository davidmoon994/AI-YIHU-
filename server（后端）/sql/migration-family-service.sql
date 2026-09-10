-- AI家庭服务平台升级迁移（可重复执行）
USE `community_medical`;

INSERT INTO `system_configs` (`config_key`, `config_value`, `description`, `created_at`, `updated_at`) VALUES
('price_medical_escort_base', '199.00', '就医陪诊基础价格', NOW(), NOW()),
('price_elderly_care_base', '199.00', '老人陪护基础价格', NOW(), NOW()),
('price_child_care_base', '159.00', '儿童托管基础价格', NOW(), NOW()),
('price_pet_care_base', '99.00', '宠物托管基础价格', NOW(), NOW())
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

-- orders.service_type 为 VARCHAR，无需改表即可支持新类型。
-- escorts / dispatch_records 保持原表名和内部角色字段，避免影响已部署数据库和历史数据。
