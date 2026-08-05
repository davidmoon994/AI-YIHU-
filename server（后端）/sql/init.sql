-- ============================================================
-- AI社区陪诊系统 数据库初始化脚本
-- 对应 02-DATABASE.md
-- ============================================================

CREATE DATABASE IF NOT EXISTS `community_medical`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `community_medical`;

SET NAMES utf8mb4;
SET time_zone = '+08:00';

-- ------------------------------------------------------------
-- 社区表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `communities` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `manager_name` VARCHAR(50) DEFAULT NULL,
  `manager_phone` VARCHAR(20) DEFAULT NULL,
  `province` VARCHAR(50) DEFAULT NULL,
  `city` VARCHAR(50) DEFAULT NULL,
  `district` VARCHAR(50) DEFAULT NULL,
  `address` VARCHAR(255) DEFAULT NULL,
  `latitude` DECIMAL(10,6) DEFAULT NULL,
  `longitude` DECIMAL(10,6) DEFAULT NULL,
  `status` TINYINT NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 用户表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `openid` VARCHAR(64) NOT NULL,
  `unionid` VARCHAR(64) DEFAULT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `nickname` VARCHAR(100) DEFAULT NULL,
  `avatar` VARCHAR(500) DEFAULT NULL,
  `gender` TINYINT DEFAULT 0,
  `real_name` VARCHAR(50) DEFAULT NULL,
  `status` TINYINT NOT NULL DEFAULT 1,
  `community_id` BIGINT NOT NULL DEFAULT 1,
  `last_login_at` DATETIME DEFAULT NULL,
  `is_deleted` TINYINT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_openid` (`openid`),
  KEY `idx_phone` (`phone`),
  KEY `idx_community_id` (`community_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 陪诊员表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `escorts` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `password_hash` VARCHAR(100) DEFAULT NULL,
  `avatar` VARCHAR(500) DEFAULT NULL,
  `gender` TINYINT DEFAULT 0,
  `id_card` VARCHAR(30) DEFAULT NULL,
  `community_id` BIGINT NOT NULL DEFAULT 1,
  `status` VARCHAR(20) NOT NULL DEFAULT 'offline',
  `work_status` VARCHAR(20) NOT NULL DEFAULT 'idle',
  `rating` DECIMAL(3,2) NOT NULL DEFAULT 5.00,
  `total_orders` INT NOT NULL DEFAULT 0,
  `completed_orders` INT NOT NULL DEFAULT 0,
  `latitude` DECIMAL(10,6) DEFAULT NULL,
  `longitude` DECIMAL(10,6) DEFAULT NULL,
  `is_deleted` TINYINT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_phone` (`phone`),
  KEY `idx_community_id` (`community_id`),
  KEY `idx_status` (`status`),
  KEY `idx_work_status` (`work_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 订单表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `orders` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `order_no` VARCHAR(32) NOT NULL,
  `user_id` BIGINT NOT NULL,
  `escort_id` BIGINT DEFAULT NULL,
  `community_id` BIGINT NOT NULL DEFAULT 1,
  `service_type` VARCHAR(20) NOT NULL,
  `hospital_name` VARCHAR(100) DEFAULT NULL,
  `department_name` VARCHAR(100) DEFAULT NULL,
  `patient_name` VARCHAR(50) DEFAULT NULL,
  `patient_phone` VARCHAR(20) DEFAULT NULL,
  `appointment_time` DATETIME DEFAULT NULL,
  `service_address` VARCHAR(255) DEFAULT NULL,
  `latitude` DECIMAL(10,6) DEFAULT NULL,
  `longitude` DECIMAL(10,6) DEFAULT NULL,
  `original_amount` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `discount_amount` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `payable_amount` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `paid_amount` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `payment_status` VARCHAR(20) NOT NULL DEFAULT 'UNPAID',
  `order_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `remark` TEXT,
  `is_deleted` TINYINT NOT NULL DEFAULT 0,
  `cancelled_at` DATETIME DEFAULT NULL,
  `completed_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_no` (`order_no`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_escort_id` (`escort_id`),
  KEY `idx_community_id` (`community_id`),
  KEY `idx_order_status` (`order_status`),
  KEY `idx_payment_status` (`payment_status`),
  KEY `idx_appointment_time` (`appointment_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 订单日志
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `order_logs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT NOT NULL,
  `from_status` VARCHAR(50) DEFAULT NULL,
  `to_status` VARCHAR(50) DEFAULT NULL,
  `remark` VARCHAR(500) DEFAULT NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_order_id` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 支付记录
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `payments` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT NOT NULL,
  `order_no` VARCHAR(32) NOT NULL,
  `transaction_id` VARCHAR(64) DEFAULT NULL,
  `out_trade_no` VARCHAR(64) NOT NULL,
  `pay_channel` VARCHAR(20) NOT NULL DEFAULT 'WECHAT',
  `pay_amount` DECIMAL(10,2) NOT NULL,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'CNY',
  `pay_status` VARCHAR(20) NOT NULL DEFAULT 'PAYING',
  `notify_result` JSON DEFAULT NULL,
  `paid_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_out_trade_no` (`out_trade_no`),
  UNIQUE KEY `uk_transaction_id` (`transaction_id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_pay_status` (`pay_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 退款记录
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `refunds` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT NOT NULL,
  `payment_id` BIGINT DEFAULT NULL,
  `refund_no` VARCHAR(32) NOT NULL,
  `refund_amount` DECIMAL(10,2) NOT NULL,
  `refund_status` VARCHAR(20) NOT NULL DEFAULT 'PROCESSING',
  `refund_reason` VARCHAR(255) DEFAULT NULL,
  `refund_result` JSON DEFAULT NULL,
  `refunded_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_refund_no` (`refund_no`),
  KEY `idx_order_id` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 派单记录
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `dispatch_records` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT NOT NULL,
  `escort_id` BIGINT DEFAULT NULL,
  `dispatch_type` VARCHAR(20) NOT NULL DEFAULT 'auto',
  `dispatch_status` VARCHAR(20) NOT NULL DEFAULT 'waiting',
  `response_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `dispatch_time` DATETIME DEFAULT NULL,
  `response_time` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_escort_id` (`escort_id`),
  KEY `idx_dispatch_status` (`dispatch_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 就诊人信息
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `patient_profiles` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `name` VARCHAR(50) NOT NULL,
  `gender` TINYINT DEFAULT 0,
  `birthday` DATE DEFAULT NULL,
  `id_card` VARCHAR(30) DEFAULT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `relationship` VARCHAR(20) DEFAULT NULL,
  `is_default` TINYINT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 地址信息
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `addresses` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `receiver_name` VARCHAR(50) DEFAULT NULL,
  `receiver_phone` VARCHAR(20) DEFAULT NULL,
  `province` VARCHAR(50) DEFAULT NULL,
  `city` VARCHAR(50) DEFAULT NULL,
  `district` VARCHAR(50) DEFAULT NULL,
  `detail_address` VARCHAR(255) DEFAULT NULL,
  `latitude` DECIMAL(10,6) DEFAULT NULL,
  `longitude` DECIMAL(10,6) DEFAULT NULL,
  `is_default` TINYINT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 系统消息
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `messages` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_type` VARCHAR(20) NOT NULL DEFAULT 'user',
  `user_id` BIGINT NOT NULL,
  `title` VARCHAR(200) DEFAULT NULL,
  `content` TEXT,
  `message_type` VARCHAR(50) DEFAULT NULL,
  `is_read` TINYINT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_is_read` (`is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 学习课程
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `learning_courses` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(200) NOT NULL,
  `cover` VARCHAR(500) DEFAULT NULL,
  `category` VARCHAR(50) DEFAULT NULL,
  `content` LONGTEXT,
  `duration` INT DEFAULT NULL,
  `sort` INT NOT NULL DEFAULT 0,
  `status` TINYINT NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 学习记录
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `learning_records` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `escort_id` BIGINT NOT NULL,
  `course_id` BIGINT NOT NULL,
  `progress` INT NOT NULL DEFAULT 0,
  `finished_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_escort_id` (`escort_id`),
  KEY `idx_course_id` (`course_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 评价表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ratings` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT NOT NULL,
  `user_id` BIGINT NOT NULL,
  `escort_id` BIGINT NOT NULL,
  `score` TINYINT NOT NULL DEFAULT 5,
  `content` VARCHAR(500) DEFAULT NULL,
  `images` JSON DEFAULT NULL,
  `anonymous` TINYINT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_escort_id` (`escort_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 系统配置
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `system_configs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `config_key` VARCHAR(100) NOT NULL,
  `config_value` VARCHAR(1000) DEFAULT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 后台操作日志
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `operation_logs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `admin_id` BIGINT DEFAULT NULL,
  `module` VARCHAR(50) DEFAULT NULL,
  `action` VARCHAR(50) DEFAULT NULL,
  `request_url` VARCHAR(255) DEFAULT NULL,
  `request_method` VARCHAR(10) DEFAULT NULL,
  `request_ip` VARCHAR(50) DEFAULT NULL,
  `request_body` JSON DEFAULT NULL,
  `result` VARCHAR(20) DEFAULT NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_admin_id` (`admin_id`),
  KEY `idx_module` (`module`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 后台管理员表（补充：SUPER_ADMIN / COMMUNITY_ADMIN 登录用，文档未单独建表，此处按规范补充）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admins` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(50) NOT NULL,
  `password_hash` VARCHAR(100) NOT NULL,
  `real_name` VARCHAR(50) DEFAULT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'COMMUNITY_ADMIN',
  `community_id` BIGINT DEFAULT NULL,
  `status` TINYINT NOT NULL DEFAULT 1,
  `last_login_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  KEY `idx_community_id` (`community_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
