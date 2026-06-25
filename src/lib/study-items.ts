"use client";

import type { StudyItem, StudyItemStatus } from "@/types/study";

const storageKey = "pla.study.items.v1";

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function getStudyItems(): StudyItem[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as StudyItem[];
    return parsed
      .filter((item) => item.id && item.title && item.content)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function saveStudyItems(items: StudyItem[]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(items.slice(0, 200)));
  window.dispatchEvent(new Event("pla:study-items-changed"));
}

export function upsertStudyItem(
  input: Omit<StudyItem, "id" | "createdAt" | "updatedAt"> & { id?: string },
) {
  const now = Date.now();
  const items = getStudyItems();
  const contentKey = `${input.source}:${input.type}:${input.title}:${input.sessionId ?? ""}`;
  const existing = items.find(
    (item) =>
      item.id === input.id ||
      `${item.source}:${item.type}:${item.title}:${item.sessionId ?? ""}` === contentKey,
  );
  const next: StudyItem = {
    ...input,
    id: existing?.id ?? input.id ?? `study-${now}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  saveStudyItems([next, ...items.filter((item) => item.id !== next.id)]);
  return next;
}

export function updateStudyItemStatus(id: string, status: StudyItemStatus) {
  const nextItems = getStudyItems().map((item) =>
    item.id === id ? { ...item, status, updatedAt: Date.now() } : item,
  );
  saveStudyItems(nextItems);
  return nextItems;
}

export function deleteStudyItem(id: string) {
  const nextItems = getStudyItems().filter((item) => item.id !== id);
  saveStudyItems(nextItems);
  return nextItems;
}
