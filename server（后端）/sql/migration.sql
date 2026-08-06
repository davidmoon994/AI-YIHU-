-- ============================================================
-- 微信支付服务商模式 - 数据库迁移脚本
-- 执行方式：
--   sudo docker exec -i yihu-mysql mysql -uescort_user -p<密码> community_medical < server（后端）/sql/migration.sql
-- ============================================================

USE `community_medical`;

-- 1. communities 表：新增子商户号和抽佣比例（MySQL 8.0 兼容）
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='community_medical' AND TABLE_NAME='communities' AND COLUMN_NAME='sub_mchid');
SET @sql = IF(@col_exists = 0, "ALTER TABLE `communities` ADD COLUMN `sub_mchid` VARCHAR(32) DEFAULT NULL COMMENT '微信支付子商户号' AFTER `manager_phone`", "SELECT 1");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='community_medical' AND TABLE_NAME='communities' AND COLUMN_NAME='commission_rate');
SET @sql = IF(@col_exists = 0, "ALTER TABLE `communities` ADD COLUMN `commission_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT '平台抽佣比例(%)' AFTER `sub_mchid`", "SELECT 1");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. payments 表：新增子商户号和分账状态
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='community_medical' AND TABLE_NAME='payments' AND COLUMN_NAME='sub_mchid');
SET @sql = IF(@col_exists = 0, "ALTER TABLE `payments` ADD COLUMN `sub_mchid` VARCHAR(32) DEFAULT NULL COMMENT '子商户号' AFTER `out_trade_no`", "SELECT 1");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='community_medical' AND TABLE_NAME='payments' AND COLUMN_NAME='profit_share_status');
SET @sql = IF(@col_exists = 0, "ALTER TABLE `payments` ADD COLUMN `profit_share_status` VARCHAR(20) NOT NULL DEFAULT 'UNSETTLED' COMMENT '分账状态' AFTER `sub_mchid`", "SELECT 1");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. system_configs：新增支付配置项
INSERT INTO `system_configs` (`config_key`, `config_value`, `description`, `created_at`, `updated_at`) VALUES
('pay_mode', 'direct', '支付模式: direct(直连商户) / partner(服务商模式)', NOW(), NOW()),
('sp_mchid', '', '服务商商户号', NOW(), NOW()),
('api_v3_key', '', 'APIv3密钥', NOW(), NOW()),
('serial_no', '', '证书序列号', NOW(), NOW()),
('private_key_path', '', '商户私钥文件路径', NOW(), NOW()),
('profit_share_enabled', '0', '分账功能开关(1开启/0关闭)', NOW(), NOW())
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

-- 4. 图标管理表
CREATE TABLE IF NOT EXISTS `icons` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `icon_key` VARCHAR(64) NOT NULL COMMENT '图标标识键',
  `name` VARCHAR(100) NOT NULL COMMENT '图标名称',
  `category` VARCHAR(20) NOT NULL DEFAULT 'tab' COMMENT '分类: tab/banner/service',
  `client` VARCHAR(20) NOT NULL DEFAULT 'user' COMMENT '所属端: user/escort/common',
  `file_path` VARCHAR(500) DEFAULT NULL COMMENT '自定义文件路径(上传后)',
  `default_path` VARCHAR(500) DEFAULT NULL COMMENT '默认文件路径',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_icon_key` (`icon_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='图标管理表';

-- 5. 预置图标数据
INSERT INTO `icons` (`icon_key`, `name`, `category`, `client`, `default_path`) VALUES
('user-home-normal', '首页-默认', 'tab', 'user', '/default-icons/user-home-normal.svg'),
('user-home-active', '首页-选中', 'tab', 'user', '/default-icons/user-home-active.svg'),
('user-ai-normal', 'AI问诊-默认', 'tab', 'user', '/default-icons/user-ai-normal.svg'),
('user-ai-active', 'AI问诊-选中', 'tab', 'user', '/default-icons/user-ai-active.svg'),
('user-service-normal', '服务-默认', 'tab', 'user', '/default-icons/user-service-normal.svg'),
('user-service-active', '服务-选中', 'tab', 'user', '/default-icons/user-service-active.svg'),
('user-mine-normal', '我的-默认', 'tab', 'user', '/default-icons/user-mine-normal.svg'),
('user-mine-active', '我的-选中', 'tab', 'user', '/default-icons/user-mine-active.svg'),
('escort-home-normal', '首页-默认', 'tab', 'escort', '/default-icons/escort-home-normal.svg'),
('escort-home-active', '首页-选中', 'tab', 'escort', '/default-icons/escort-home-active.svg'),
('escort-order-normal', '接单-默认', 'tab', 'escort', '/default-icons/escort-order-normal.svg'),
('escort-order-active', '接单-选中', 'tab', 'escort', '/default-icons/escort-order-active.svg'),
('escort-task-normal', '任务-默认', 'tab', 'escort', '/default-icons/escort-task-normal.svg'),
('escort-task-active', '任务-选中', 'tab', 'escort', '/default-icons/escort-task-active.svg'),
('escort-wallet-normal', '钱包-默认', 'tab', 'escort', '/default-icons/escort-wallet-normal.svg'),
('escort-wallet-active', '钱包-选中', 'tab', 'escort', '/default-icons/escort-wallet-active.svg'),
('escort-learn-normal', '学习-默认', 'tab', 'escort', '/default-icons/escort-learn-normal.svg'),
('escort-learn-active', '学习-选中', 'tab', 'escort', '/default-icons/escort-learn-active.svg')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);
