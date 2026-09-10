-- 阶段7：服务人员四大业务能力匹配
-- MySQL 8+
ALTER TABLE escorts
  ADD COLUMN service_skills JSON NULL COMMENT '可接服务类型数组，例如 ["medical_escort","elderly_care"]';

-- 兼容历史服务人员：未设置技能时默认可接全部四类家庭服务
UPDATE escorts
SET service_skills = JSON_ARRAY('medical_escort','elderly_care','child_care','pet_care')
WHERE service_skills IS NULL;
