"use client";

import { getWorkspacePreferenceChanges, runWorkspaceTransaction, saveWorkspacePreferenceChanges, workspaceStorage } from "@/lib/workspace-storage";
import { getWorkspaceMetadata, saveWorkspaceMetadata, type WorkspaceTombstones } from "@/lib/workspace-metadata";
import { assertWorkspaceCapacity, mergeWorkspaceSnapshots, type WorkspaceConflict } from "@/lib/workspace-sync";

import {
  getClientProviderPublicConfig,
  saveClientProviderPublicConfig,
} from "@/lib/client-provider";
import {
  getStoredPracticeGenerations,
  saveStoredPracticeGenerations,
  type StoredPracticeGeneration,
} from "@/lib/practice-history";
import {
  dismissOnboarding,
  getStoredAnswerDepth,
  getStoredKnowledgeMode,
  isOnboardingDismissed,
  resetOnboarding,
  saveStoredAnswerDepth,
  saveStoredKnowledgeMode,
} from "@/lib/preferences";
import {
  getActiveSessionId,
  getTabActiveSessionId,
  getStoredLearningProfile,
  getStoredSessions,
  saveStoredLearningProfile,
  saveStoredSessions,
  setActiveSessionId,
  type StoredChatSession,
} from "@/lib/storage";
import type { AnswerDepth, KnowledgeMode, LearningProfile } from "@/types/learning";
import type { ClientProviderId } from "@/types/learning";
import { acknowledgeSessionJournal, removeSessionJournal } from "@/lib/session-journal";
import { acknowledgePracticeJournal, removePracticeJournal } from "@/lib/practice-journal";

export type ClientUserDataSnapshot = {
  version: 1;
  revision?: number;
  operationId?: string;
  tombstones?: WorkspaceTombstones;
  conflicts?: WorkspaceConflict[];
  sessions: StoredChatSession[];
  activeSessionId?: string;
  learningProfile?: LearningProfile;
  preferences?: {
    answerDepth?: AnswerDepth;
    onboardingDismissed?: boolean;
    selectedModel?: string;
    knowledgeMode?: KnowledgeMode;
  };
  providerPreferences?: {
    enabled?: boolean;
    provider?: string;
    type?: string;
    label?: string;
    baseUrl?: string;
    model?: string;
  };
  practiceHistory: StoredPracticeGeneration[];
  updatedAt: number;
};

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function selectedServerModel() {
  return canUseStorage() ? workspaceStorage().getItem("pla.deepseek.model") ?? undefined : undefined;
}

function setSelectedServerModel(model?: string) {
  if (!canUseStorage()) return;
  if (model) workspaceStorage().setItem("pla.deepseek.model", model);
  else workspaceStorage().removeItem("pla.deepseek.model");
}

export function collectClientUserDataSnapshot(): ClientUserDataSnapshot {
  const provider = getClientProviderPublicConfig();
  let conflicts: WorkspaceConflict[] = [];
  try { conflicts = JSON.parse(workspaceStorage().getItem("sync.conflicts.v2") ?? "[]"); } catch { /* No pending conflicts. */ }

  return {
    version: 1,
    ...getWorkspaceMetadata(),
    conflicts,
    sessions: getStoredSessions(),
    activeSessionId: getActiveSessionId() || undefined,
    learningProfile: getStoredLearningProfile(),
    preferences: {
      answerDepth: getStoredAnswerDepth(),
      onboardingDismissed: isOnboardingDismissed(),
      selectedModel: selectedServerModel(),
      knowledgeMode: getStoredKnowledgeMode(),
    },
    providerPreferences: {
      enabled: provider.enabled,
      provider: provider.provider,
      type: provider.type,
      label: provider.label,
      baseUrl: provider.baseUrl,
      model: provider.model,
    },
    practiceHistory: getStoredPracticeGenerations(),
    updatedAt: Date.now(),
  };
}

export function getWorkspaceAcknowledgement(): Partial<ClientUserDataSnapshot> | undefined {
  try { return JSON.parse(workspaceStorage().getItem("sync.acknowledged.v2") ?? "null") ?? undefined; }
  catch { return undefined; }
}

export function applyClientUserDataSnapshot(remote: Partial<ClientUserDataSnapshot>, base?: Partial<ClientUserDataSnapshot>) {
  const local = collectClientUserDataSnapshot();
  const commonBase = base ?? getWorkspaceAcknowledgement();
  const changes = getWorkspacePreferenceChanges();
  const capturedChanges = { preferences: { ...changes.preferences }, providerPreferences: { ...changes.providerPreferences } };
  const remotePreferences = typeof remote.revision === "number"
    ? { answerDepth: "standard" as AnswerDepth, knowledgeMode: "auto" as KnowledgeMode, onboardingDismissed: false,
      selectedModel: undefined, ...remote.preferences } : remote.preferences;
  const normalizedRemote = { ...remote, preferences: remotePreferences };
  const rebased = mergeWorkspaceSnapshots(local, normalizedRemote, commonBase);
  const preferences = { ...rebased.preferences } as NonNullable<ClientUserDataSnapshot["preferences"]>;
  const providerPreferences = { ...rebased.providerPreferences } as NonNullable<ClientUserDataSnapshot["providerPreferences"]>;
  for (const [group, selected, current, incoming] of [
    ["preferences", preferences, local.preferences, remotePreferences],
    ["providerPreferences", providerPreferences, local.providerPreferences, remote.providerPreferences],
  ] as const) {
    const fields = selected as Record<string, unknown>;
    for (const key of new Set([...Object.keys(current ?? {}), ...Object.keys(incoming ?? {})])) {
      if (Object.hasOwn(changes[group], key)) fields[key] = (current as Record<string, unknown> | undefined)?.[key];
      else if (incoming && Object.hasOwn(incoming, key)) fields[key] = (incoming as Record<string, unknown>)[key];
    }
  }
  const priorConflicts = new Set([...(local.conflicts ?? []), ...(remote.conflicts ?? [])].map((conflict) => JSON.stringify(conflict)));
  const conflicts = rebased.conflicts?.filter((conflict) => conflict.entity !== "preference"
    || priorConflicts.has(JSON.stringify(conflict))
    || Object.hasOwn(changes[conflict.id === "providerPreferences" ? "providerPreferences" : "preferences"], conflict.field));
  const sessions = rebased.sessions;
  const practiceHistory = rebased.practiceHistory;
  // Tombstones were already applied by the shared merge; validate the actual final set before any writes.
  assertWorkspaceCapacity({ sessions, practiceHistory });
  const activeId = getTabActiveSessionId() === "" ? "" : [local.activeSessionId, remote.activeSessionId, sessions[0]?.id]
    .find((id) => id && sessions.some((session) => session.id === id));

  runWorkspaceTransaction(() => {
    workspaceStorage().setItem("sync.conflicts.v2", JSON.stringify(conflicts ?? []));
    saveWorkspaceMetadata({ revision: remote.revision ?? local.revision ?? 0,
      tombstones: rebased.tombstones ?? { sessions: {}, practiceHistory: {} } });
    saveStoredSessions(sessions);
    setActiveSessionId(activeId ?? "", { updateTab: false });
    if (remote.learningProfile && (remote.learningProfile.updatedAt ?? 0) >= getStoredLearningProfile().updatedAt) {
      saveStoredLearningProfile(remote.learningProfile);
    }
    saveStoredPracticeGenerations(practiceHistory, { journal: false });
    if (preferences.answerDepth) saveStoredAnswerDepth(preferences.answerDepth);
    if (preferences.knowledgeMode) saveStoredKnowledgeMode(preferences.knowledgeMode);
    if (typeof preferences.onboardingDismissed === "boolean") {
      if (preferences.onboardingDismissed) dismissOnboarding(); else resetOnboarding();
    }
    setSelectedServerModel(preferences.selectedModel);
    if (providerPreferences.provider && providerPreferences.model && providerPreferences.type) {
      saveClientProviderPublicConfig({ enabled: Boolean(providerPreferences.enabled),
        provider: providerPreferences.provider as ClientProviderId, label: providerPreferences.label,
        baseUrl: providerPreferences.baseUrl, model: providerPreferences.model });
    }
    if (typeof remote.revision === "number") {
      acknowledgeSessionJournal(remote.sessions ?? [], remote.revision);
      acknowledgePracticeJournal(remote.practiceHistory ?? [], remote.revision);
      for (const id of Object.keys(rebased.tombstones?.sessions ?? {})) removeSessionJournal(id);
      for (const id of Object.keys(rebased.tombstones?.practiceHistory ?? {})) removePracticeJournal(id);
      // Persist the small common base; do not duplicate entire conversations in browser storage.
      workspaceStorage().setItem("sync.acknowledged.v2", JSON.stringify({ version: 1, revision: remote.revision,
        preferences: remotePreferences, providerPreferences: remote.providerPreferences,
        learningProfile: remote.learningProfile, activeSessionId: remote.activeSessionId, updatedAt: remote.updatedAt }));
      const current = collectClientUserDataSnapshot();
      for (const group of ["preferences", "providerPreferences"] as const) {
        const acknowledgedFields = normalizedRemote[group] as Record<string, unknown> | undefined;
        for (const key of Object.keys(changes[group])) {
          if (acknowledgedFields && Object.hasOwn(acknowledgedFields, key)
            && JSON.stringify((current[group] as Record<string, unknown> | undefined)?.[key]) === JSON.stringify(acknowledgedFields[key])) delete changes[group][key];
        }
      }
      saveWorkspacePreferenceChanges(changes, capturedChanges);
    }
  }, { applyingSnapshot: true });
}
