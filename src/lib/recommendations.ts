"use client";

import { recommendationItems, type RecommendationItem, type RecommendationType } from "@/data/recommendations";
import type { StoredChatSession } from "@/lib/storage";
import type { LearningProfile } from "@/types/learning";

type RecommendationInput = {
  type: RecommendationType;
  count: number;
  sessions?: StoredChatSession[];
  profile?: LearningProfile;
  excludeIds?: string[];
};

function shuffle<T>(items: T[]) {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

function collectHistoryText(sessions: StoredChatSession[]) {
  return sessions
    .slice(0, 12)
    .flatMap((session) => [
      session.title,
      session.toolContext?.topic ?? "",
      session.toolContext?.knowledgeTitle ?? "",
      session.context.course,
      ...session.messages.slice(-3).map((message) => message.content),
    ])
    .join("\n");
}

function scoreRecommendation(
  item: RecommendationItem,
  historyText: string,
  profile?: LearningProfile,
) {
  let score = 0;

  if (historyText.includes(item.course)) {
    score += 3;
  }

  for (const tag of item.tags) {
    if (historyText.includes(tag)) {
      score += 2;
    }
  }

  if (item.knowledgeTitle && historyText.includes(item.knowledgeTitle)) {
    score += 3;
  }

  score += Math.min(profile?.courseFrequency[item.course] ?? 0, 4);

  for (const topic of profile?.recentTopics ?? []) {
    if (
      item.title.includes(topic) ||
      item.prompt.includes(topic) ||
      item.tags.some((tag) => topic.includes(tag) || tag.includes(topic))
    ) {
      score += 2;
    }
  }

  return score;
}

export function getRandomRecommendations(input: RecommendationInput) {
  const excluded = new Set(input.excludeIds ?? []);
  return shuffle(recommendationItems.filter((item) => item.type === input.type && !excluded.has(item.id))).slice(
    0,
    input.count,
  );
}

export function getPersonalizedRecommendations(input: RecommendationInput) {
  const sessions = input.sessions ?? [];
  const excluded = new Set(input.excludeIds ?? []);
  const candidates = recommendationItems.filter((item) => item.type === input.type && !excluded.has(item.id));

  if (
    !sessions.length &&
    !input.profile?.recentTopics.length &&
    !Object.keys(input.profile?.courseFrequency ?? {}).length
  ) {
    return getRandomRecommendations(input);
  }

  const historyText = collectHistoryText(sessions);
  const personalized = shuffle(candidates)
    .map((item) => ({
      item,
      score: scoreRecommendation(item, historyText, input.profile),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item)
    .slice(0, Math.ceil(input.count / 2));
  const random = getRandomRecommendations({
    ...input,
    count: input.count - personalized.length,
    excludeIds: [...excluded, ...personalized.map((item) => item.id)],
  });

  return [...personalized, ...random].slice(0, input.count);
}
