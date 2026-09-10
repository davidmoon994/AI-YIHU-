-- 阶段17：用户服务评价与服务人员评分升级
-- ratings 表在 init.sql 已存在。本迁移仅强化“一单一评”约束。
ALTER TABLE `ratings`
  ADD UNIQUE KEY `uk_rating_order` (`order_id`);

-- 将历史评分重新汇总到服务人员综合评分。
UPDATE `escorts` e
JOIN (
  SELECT escort_id, ROUND(AVG(score), 2) AS avg_score
  FROM `ratings`
  GROUP BY escort_id
) r ON r.escort_id = e.id
SET e.rating = r.avg_score;
