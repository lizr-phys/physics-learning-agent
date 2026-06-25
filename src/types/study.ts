export type StudyItemType =
  | "answer"
  | "problem"
  | "problem-type"
  | "review"
  | "knowledge";

export type StudyItemStatus = "saved" | "unclear" | "mastered" | "review";

export type StudyItemSource = "chat" | "practice" | "types" | "review" | "map";

export type StudyItem = {
  id: string;
  title: string;
  content: string;
  type: StudyItemType;
  source: StudyItemSource;
  status: StudyItemStatus;
  sessionId?: string;
  course?: string;
  knowledgeTitle?: string;
  createdAt: number;
  updatedAt: number;
};
