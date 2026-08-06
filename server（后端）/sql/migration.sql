-- ============================================================
-- 微信支付服务商模式 - 数据库迁移脚本
-- 执行方式：
--   sudo docker exec -i yihu-mysql mysql -uescort_user -p<密码> community_medical < server（后端）/sql/migration.sql
-- ============================================================

USE `community_medical`;

-- 1. communities 表：新增子商户号和抽佣比例
ALTER TABLE `communities`
  ADD COLUMN IF NOT EXISTS `sub_mchid` VARCHAR(32) DEFAULT NULL COMMENT '微信支付子商户号' AFTER `manager_phone`,
  ADD COLUMN IF NOT EXISTS `commission_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT '平台抽佣比例(%)' AFTER `sub_mchid`;

-- 2. payments 表：新增子商户号和分账状态
ALTER TABLE `payments`
  ADD COLUMN IF NOT EXISTS `sub_mchid` VARCHAR(32) DEFAULT NULL COMMENT '子商户号' AFTER `out_trade_no`,
  ADD COLUMN IF NOT EXISTS `profit_share_status` VARCHAR(20) NOT NULL DEFAULT 'UNSETTLED' COMMENT '分账状态: UNSETTLED/PROCESSING/SUCCESS/FAILED' AFTER `paid_at`;

-- 3. system_configs：新增支付配置项
INSERT INTO `system_configs` (`config_key`, `config_value`, `description`, `created_at`, `updated_at`) VALUES
('pay_mode', 'direct', '支付模式: direct(直连商户) / partner(服务商模式)', NOW(), NOW()),
('sp_mchid', '', '服务商商户号', NOW(), NOW()),
('api_v3_key', '', 'APIv3密钥', NOW(), NOW()),
('serial_no', '', '证书序列号', NOW(), NOW()),
('private_key_path', '', '商户私钥文件路径', NOW(), NOW()),
('profit_share_enabled', '0', '分账功能开关(1开启/0关闭)', NOW(), NOW())
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);
