"use strict";

const axios = require("axios");
const db = require("../db");
const logger = require("../utils/logger");
const { BizError } = require("../middleware/error");

const SYSTEM_PROMPT =
  "你是社区陪诊平台的AI助手，只能提供就医流程指引、科室推荐、材料准备提醒等辅助信息，" +
  "不得给出任何医疗诊断结论或用药建议，涉及具体病情判断时必须提示用户前往医院由医生诊断。";

async function isAiEnabled() {
  const rows = await db.query("SELECT config_value FROM system_configs WHERE config_key = 'ai_enabled' LIMIT 1");
  if (rows.length === 0) return true;
  return rows[0].config_value !== "0";
}

/**
 * 统一调用底层大模型接口。ANTHROPIC_API_KEY 由部署环境注入，未配置时走降级兜底回复，
 * 避免AI模块不可用导致整条问诊链路报错。
 */
async function callModel(userMessage) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return "AI助手当前暂未配置，建议直接联系社区陪诊员或前往医院咨询导诊台。";
  }
  try {
    const { data } = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-sonnet-4-6",
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }]
      },
      { headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" } }
    );
    const textBlock = (data.content || []).find((b) => b.type === "text");
    return textBlock ? textBlock.text : "抱歉，暂时无法生成回复，请稍后再试。";
  } catch (err) {
    logger.error(`[AI CALL ERROR] ${err.message}`);
    return "AI助手暂时繁忙，请稍后再试，或直接联系社区陪诊员。";
  }
}

async function chat(userId, message) {
  if (!(await isAiEnabled())) {
    throw new BizError(403, "AI功能已被管理员关闭");
  }
  const reply = await callModel(message);
  return { reply };
}

async function planning(userId, symptomDescription) {
  if (!(await isAiEnabled())) {
    throw new BizError(403, "AI功能已被管理员关闭");
  }
  const prompt = `用户描述的就医诉求：${symptomDescription}\n请给出一份就医流程规划建议，包含挂号、检查、缴费、取药等环节顺序。`;
  const reply = await callModel(prompt);
  return { plan: reply };
}

async function departmentRecommend(userId, symptomDescription) {
  if (!(await isAiEnabled())) {
    throw new BizError(403, "AI功能已被管理员关闭");
  }
  const prompt = `用户描述：${symptomDescription}\n请仅推荐可能相关的医院科室名称（例如内科、骨科等），并说明推荐理由，不要给出诊断结论。`;
  const reply = await callModel(prompt);
  return { recommendation: reply };
}

async function checkProcess(userId, checkType) {
  if (!(await isAiEnabled())) {
    throw new BizError(403, "AI功能已被管理员关闭");
  }
  const prompt = `请说明"${checkType}"这项检查的一般流程、注意事项和大致所需时间。`;
  const reply = await callModel(prompt);
  return { process: reply };
}

module.exports = {
  chat,
  planning,
  departmentRecommend,
  checkProcess
};
