import type { CourseId, TaskTypeId } from "@/types/learning";

type ChatHrefInput = {
  course?: CourseId;
  taskType?: TaskTypeId;
  knowledgePoint?: string;
  prompt?: string;
};

export function buildChatHref(input: ChatHrefInput) {
  const params = new URLSearchParams();

  if (input.course) {
    params.set("course", input.course);
  }

  if (input.taskType) {
    params.set("taskType", input.taskType);
  }

  if (input.knowledgePoint) {
    params.set("knowledgePoint", input.knowledgePoint);
  }

  if (input.prompt) {
    params.set("prompt", input.prompt);
  }

  const query = params.toString();
  return query ? `/chat?${query}` : "/chat";
}
