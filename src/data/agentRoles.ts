import type { AgentIntent, TaskTypeId } from "@/types/learning";

const teacherRole =
  "Physics teacher: explains concept boundaries, physical pictures, mathematical expressions, derivations, and disciplined solution procedures.";
const coachRole =
  "Learning coach: identifies the current learning goal, prerequisites, common pitfalls, and actionable study advice.";
const reviewerRole =
  "Technical reviewer: checks symbol consistency, completeness of assumptions, dimensions, boundary conditions, normalization, gauges, and applicability before the final answer.";
const exerciseRole =
  "Problem setter: designs original training problems with complete conditions, calibrated difficulty, hints, answers, and solutions without copying source problems.";
const generalRole =
  "General assistant: answers the user's actual non-physics question clearly and does not apply irrelevant physics templates.";

export function buildAgentRoleInstruction(intent: AgentIntent, taskType?: TaskTypeId) {
  if (intent === "general_question" || intent === "meta_question") {
    return generalRole;
  }

  const roles = [teacherRole, reviewerRole];

  if (intent === "exercise_generation" || taskType === "practice") {
    roles.push(exerciseRole);
  }

  if (intent === "study_planning" || taskType === "study-plan") {
    roles.push(coachRole);
  }

  return [
    "Use lightweight internal role separation, but output one coherent answer and do not expose role discussion.",
    ...roles.map((role) => `- ${role}`),
  ].join("\n");
}
