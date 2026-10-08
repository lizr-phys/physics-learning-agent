"use client";

import { workspaceStorage } from "@/lib/workspace-storage";

import type { AnswerDepth, KnowledgeMode } from "@/types/learning";

const answerDepthKey = "pla.preferences.answerDepth.v1";
const knowledgeModeKey = "pla.preferences.knowledgeMode.v1";
const onboardingKey = "pla.onboarding.dismissed.v1";

export function getStoredAnswerDepth(): AnswerDepth {
  if (typeof window === "undefined") {
    return "standard";
  }

  const value = workspaceStorage().getItem(answerDepthKey);

  return value === "concise" ||
    value === "detailed" ||
    value === "derivation-first" ||
    value === "problem-type-first"
    ? value
    : "standard";
}

export function saveStoredAnswerDepth(value: AnswerDepth) {
  workspaceStorage().setItem(answerDepthKey, value);
  window.dispatchEvent(new Event("pla:user-data-changed"));
}

export function getStoredKnowledgeMode(): KnowledgeMode {
  if (typeof window === "undefined") {
    return "auto";
  }

  const value = workspaceStorage().getItem(knowledgeModeKey);

  return value === "always" || value === "never" ? value : "auto";
}

export function saveStoredKnowledgeMode(value: KnowledgeMode) {
  workspaceStorage().setItem(knowledgeModeKey, value);
  window.dispatchEvent(new Event("pla:user-data-changed"));
}

export function isOnboardingDismissed() {
  return typeof window !== "undefined" && workspaceStorage().getItem(onboardingKey) === "1";
}

export function dismissOnboarding() {
  workspaceStorage().setItem(onboardingKey, "1");
  window.dispatchEvent(new Event("pla:user-data-changed"));
}

export function resetOnboarding() {
  workspaceStorage().removeItem(onboardingKey);
  window.dispatchEvent(new Event("pla:user-data-changed"));
}
