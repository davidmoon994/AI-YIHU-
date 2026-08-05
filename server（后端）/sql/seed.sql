-- ============================================================
-- 初始化种子数据
-- 使用前请先执行 init.sql
-- 默认超级管理员密码为 Admin@123（bcrypt哈希），首次登录后请立即修改
-- ============================================================

USE `community_medical`;

-- 默认社区（单社区阶段固定 ID=1）
INSERT INTO `communities` (`id`, `name`, `code`, `manager_name`, `manager_phone`, `status`, `created_at`, `updated_at`)
VALUES (1, '示范社区', 'DEFAULT_COMMUNITY', '待设置', '待设置', 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 默认超级管理员账号：admin / Admin@123
-- 该哈希值对应明文 "Admin@123"，bcrypt cost=10
INSERT INTO `admins` (`id`, `username`, `password_hash`, `real_name`, `role`, `community_id`, `status`, `created_at`, `updated_at`)
VALUES (1, 'admin', '$2b$10$TMhp84nZaw38yw9.U9eibeW2B3v/LiTofvO6wFZmSwchih62NiT/O', '超级管理员', 'SUPER_ADMIN', NULL, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE `username` = VALUES(`username`);

-- 系统默认配置（对应 05-DISPATCH.md 第十五条 / 06-WECHAT_PAY.md 第十四条）
INSERT INTO `system_configs` (`config_key`, `config_value`, `description`, `created_at`, `updated_at`) VALUES
('dispatch_response_timeout_seconds', '60', '派单响应超时时间（秒）', NOW(), NOW()),
('dispatch_max_retry', '5', '最大重派次数', NOW(), NOW()),
('auto_dispatch_enabled', '1', '自动派单开关（1开启/0关闭）', NOW(), NOW()),
('manual_dispatch_enabled', '1', '人工派单开关', NOW(), NOW()),
('ai_dispatch_enabled', '0', 'AI智能派单开关（预留）', NOW(), NOW()),
('ai_enabled', '1', 'AI功能总开关', NOW(), NOW()),
('price_escort_base', '199.00', '陪诊服务基础价格', NOW(), NOW()),
('price_register_base', '99.00', '代挂号服务基础价格', NOW(), NOW()),
('price_pickup_base', '89.00', '接送服务基础价格', NOW(), NOW()),
('price_planning_base', '0.00', 'AI就医规划基础价格（免费）', NOW(), NOW()),
('auto_refund_enabled', '0', '自动退款开关', NOW(), NOW()),
('auto_settlement_enabled', '0', '自动分账开关（预留）', NOW(), NOW())
ON DUPLICATE KEY UPDATE `config_value` = VALUES(`config_value`);

-- 示例学习课程
INSERT INTO `learning_courses` (`title`, `category`, `content`, `duration`, `sort`, `status`, `created_at`, `updated_at`) VALUES
('陪诊服务基础规范', '服务规范', '包含服务礼仪、沟通规范、突发情况处理等基础内容。', 30, 1, 1, NOW(), NOW()),
('医院就诊流程详解', '医院流程', '讲解挂号、分诊、检查、缴费、取药等完整就诊流程。', 20, 2, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`);
