-- 阶段19：平台财务与运营数据体系
-- 可重复执行；仅增加查询索引，不涉及真实提现/微信打款。
USE `community_medical`;

SET @idx1 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='orders' AND INDEX_NAME='idx_finance_created_community');
SET @sql1 = IF(@idx1=0, 'ALTER TABLE `orders` ADD KEY `idx_finance_created_community` (`created_at`, `community_id`, `payment_status`, `order_status`)', 'SELECT 1');
PREPARE stmt1 FROM @sql1; EXECUTE stmt1; DEALLOCATE PREPARE stmt1;

SET @idx2 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='escort_settlements' AND INDEX_NAME='idx_finance_settlement_created');
SET @sql2 = IF(@idx2=0, 'ALTER TABLE `escort_settlements` ADD KEY `idx_finance_settlement_created` (`created_at`, `community_id`, `settlement_status`)', 'SELECT 1');
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;
