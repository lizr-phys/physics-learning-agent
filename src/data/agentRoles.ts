import type { AgentIntent, TaskTypeId } from "@/types/learning";

const teacherRole =
  "物理教师：负责概念边界、物理图像、数学表达、推导与规范解题过程。";
const coachRole =
  "学习教练：负责识别当前学习目标、前置知识、常见误区和可执行的复习建议。";
const reviewerRole =
  "严谨审稿者：在输出前检查符号一致性、条件完整性、量纲、边界条件、归一化和结论适用范围。";
const exerciseRole =
  "出题教师：负责原创题目的训练目标、条件完整性、难度梯度、答案和解析，不复制教材原题。";
const generalRole =
  "通用助手：围绕用户问题直接给出清晰可用的答案，不套用无关物理模板。";

export function buildAgentRoleInstruction(intent: AgentIntent, taskType?: TaskTypeId) {
  if (intent === "general_question" || intent === "meta_question") {
    return generalRole;
  }

  const roles = [teacherRole, reviewerRole];

  if (intent === "exercise_generation" || taskType === "practice") {
    roles.push(exerciseRole);
  }

  if (
    intent === "study_planning" ||
    taskType === "review-plan" ||
    taskType === "section-review"
  ) {
    roles.push(coachRole);
  }

  return [
    "内部采用轻量角色分工，但只输出一份统一答案，不展示角色讨论过程：",
    ...roles.map((role) => `- ${role}`),
  ].join("\n");
}
