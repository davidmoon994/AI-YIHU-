-- ============================================================
-- 阶段18：服务人员收入结算与订单佣金体系
-- 说明：仅建立平台内部结算账，不自动发起真实提现/打款。
-- 可重复执行。
-- ============================================================
USE `community_medical`;

CREATE TABLE IF NOT EXISTS `escort_settlements` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT NOT NULL,
  `order_no` VARCHAR(32) NOT NULL,
  `escort_id` BIGINT NOT NULL,
  `community_id` BIGINT NOT NULL,
  `service_type` VARCHAR(20) NOT NULL,
  `gross_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '订单实际支付总额',
  `commission_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT '平台抽佣比例(%)',
  `platform_fee` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '平台服务费',
  `escort_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '服务人员应结算金额',
  `settlement_status` VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING/SETTLED',
  `settled_at` DATETIME DEFAULT NULL,
  `settled_by` BIGINT DEFAULT NULL,
  `settlement_remark` VARCHAR(500) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_settlement_order` (`order_id`),
  KEY `idx_settlement_escort` (`escort_id`, `settlement_status`),
  KEY `idx_settlement_community` (`community_id`, `settlement_status`),
  KEY `idx_settlement_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 历史数据回填：为已经完成且支付成功的订单建立内部结算记录。
INSERT INTO escort_settlements
  (order_id, order_no, escort_id, community_id, service_type, gross_amount, commission_rate, platform_fee, escort_amount, settlement_status, created_at, updated_at)
SELECT o.id, o.order_no, o.escort_id, o.community_id, o.service_type,
       COALESCE(o.paid_amount, o.payable_amount, 0),
       LEAST(100, GREATEST(0, COALESCE(c.commission_rate, 0))),
       ROUND(COALESCE(o.paid_amount, o.payable_amount, 0) * LEAST(100, GREATEST(0, COALESCE(c.commission_rate, 0))) / 100, 2),
       ROUND(COALESCE(o.paid_amount, o.payable_amount, 0) * (1 - LEAST(100, GREATEST(0, COALESCE(c.commission_rate, 0))) / 100), 2),
       'PENDING', COALESCE(o.completed_at, o.updated_at, NOW()), NOW()
FROM orders o
LEFT JOIN communities c ON c.id = o.community_id
LEFT JOIN escort_settlements s ON s.order_id = o.id
WHERE o.order_status = 'completed'
  AND o.payment_status = 'SUCCESS'
  AND o.escort_id IS NOT NULL
  AND s.id IS NULL;
