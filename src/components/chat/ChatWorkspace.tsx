"use client";

import { workspaceStorage, getWorkspaceIdentity, isWorkspaceCurrent, type WorkspaceIdentity } from "@/lib/workspace-storage";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { ErrorMessage } from "@/components/ErrorMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { ImageAttachmentInput } from "@/components/common/ImageAttachments";
import type { ImageAttachment } from "@/types/learning";
import { KnowledgeScopeControl } from "@/components/chat/KnowledgeScopeControl";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { ContextBanner } from "@/components/chat/ContextBanner";
import { FirstUseGuide } from "@/components/chat/FirstUseGuide";
import { GenerationStatus } from "@/components/common/GenerationStatus";
import { matchesGeneration, type ActiveGenerationDescriptor } from "@/agent/generation-guard";
import { classifyAgentIntent } from "@/agent/intent-classifier";
import {
  createLearningMemory,
  commitLearningMemory,
  updateLearningProfile,
} from "@/agent/memory-manager";
import { courseOptions } from "@/data/courses";
import { AgentStreamError, requestAgentStream } from "@/lib/read-agent-stream";
import { clearLastApiError, saveLastApiError } from "@/lib/api-diagnostics";
import { buildContinuationMessage, withAssistantMessage, isAbortLikeError } from "@/lib/chat-generation";
import { createDraftCheckpoint } from "@/lib/draft-checkpoint";
import { WorkspaceQuotaError } from "@/lib/workspace-sync";
import { getClientProviderOverride } from "@/lib/client-provider";
import { detectLanguage } from "@/lib/language";
import {
  getStoredAnswerDepth,
  getStoredKnowledgeMode,
  saveStoredAnswerDepth,
  saveStoredKnowledgeMode,
} from "@/lib/preferences";
import {
  buildSessionTitle,
  createSessionId,
  getActiveSessionId,
  getStoredLearningProfile,
  getStoredSessions,
  isDefaultSessionTitle,
  setActiveSessionId,
  saveStoredLearningProfile,
  upsertStoredSession,
  type StoredChatSession,
} from "@/lib/storage";
import {
  taskTypeOptions,
  type AgentRequest,
  type AnswerFeedback,
  type AnswerDepth,
  type ChatMessage,
  type CourseId,
  type KnowledgeMode,
  type LearningMemory,
  type GenerationDiagnostics,
  type RagContext,
  type RetrievalStatus,
  type TaskTypeId,
  type ToolContext,
} from "@/types/learning";

function getInitialCourse(value: string | null): CourseId {
  if (value === "general") {
    return "general";
  }

  return courseOptions.some((course) => course.id === value) ? (value as CourseId) : "general";
}

function getInitialTaskType(value: string | null): TaskTypeId {
  return taskTypeOptions.some((task) => task.id === value) ? (value as TaskTypeId) : "qa";
}

function getStoredModel() {
  if (typeof window === "undefined") {
    return "";
  }

  return workspaceStorage().getItem("pla.deepseek.model") || "deepseek-flash";
}

function createMessageId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function debugStream(event: string, detail: Record<string, unknown>) {
  if (process.env.NODE_ENV === "development") {
    console.log(`[${event}]`, detail);
  }
}

type ActiveGeneration = ActiveGenerationDescriptor & {
  workspace: WorkspaceIdentity;
  abortController: AbortController;
  startedAt: number;
};

type PendingContinuation = {
  sessionId: string;
  assistantMessageId: string;
  request: AgentRequest;
  messagesBeforeAssistant: ChatMessage[];
  firstMessage: string;
  partialContent: string;
};

type SessionContextSnapshot = StoredChatSession["context"];

export function ChatWorkspace() {
  const searchParams = useSearchParams();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLElement | null>(null);
  const [footerHeight, setFooterHeight] = useState(160);
  const activeGenerationRef = useRef<ActiveGeneration | null>(null);
  const draftCheckpointRef = useRef<{flush:()=>void;discard:()=>void} | null>(null);
  const currentSessionIdRef = useRef("");
  const isNearBottomRef = useRef(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [course, setCourse] = useState<CourseId>(() => getInitialCourse(searchParams.get("course")));
  const [taskType, setTaskType] = useState<TaskTypeId>(() =>
    getInitialTaskType(searchParams.get("taskType")),
  );
  const [knowledgePoint, setKnowledgePoint] = useState(
    searchParams.get("knowledgePoint") ?? searchParams.get("knowledgeId") ?? "",
  );
  const [useRag, setUseRag] = useState(false);
  const [knowledgeDocumentIds, setKnowledgeDocumentIds] = useState<string[]>([]);
  const [knowledgeCourseOnly, setKnowledgeCourseOnly] = useState(false);
  const [model, setModel] = useState(() => getStoredModel());
  const [draftImages,setDraftImages]=useState<ImageAttachment[]>([]);
  const [imagesBusy,setImagesBusy]=useState(false);
  const [imageDraftEpoch,setImageDraftEpoch]=useState(0);
  const [answerDepth, setAnswerDepth] = useState<AnswerDepth>(() =>
    getStoredAnswerDepth(),
  );
  const [knowledgeMode, setKnowledgeMode] = useState<KnowledgeMode>(() =>
    getStoredKnowledgeMode(),
  );
  const [input, setInput] = useState(
    searchParams.get("prompt") ?? searchParams.get("initialPrompt") ?? "",
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toolContext, setToolContext] = useState<ToolContext | undefined>();
  const [memory, setMemory] = useState<LearningMemory>(() => createLearningMemory());
  const [error, setError] = useState("");
  const [generationStage, setGenerationStage] = useState<string>();
  const [pendingContinuation, setPendingContinuation] = useState<PendingContinuation | null>(null);
  const [activeGeneration, setActiveGeneration] = useState<ActiveGeneration | null>(null);

  const isCurrentSessionGenerating = activeGeneration?.sessionId === sessionId;
  const currentPendingContinuation =
    pendingContinuation?.sessionId === sessionId ? pendingContinuation : null;

  useEffect(() => {
    if (!footerRef.current) return;
    const observer = new ResizeObserver(entries => setFooterHeight(entries[0].contentRect.height));
    observer.observe(footerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    currentSessionIdRef.current = sessionId;
  }, [sessionId]);

  const setSessionIdSafe = useCallback((nextSessionId: string) => {
    currentSessionIdRef.current = nextSessionId;
    setSessionId(nextSessionId);
  }, []);

  const setActiveGenerationSafe = useCallback((next: ActiveGeneration | null) => {
    activeGenerationRef.current = next;
    setActiveGeneration(next);
  }, []);

  const isRequestStillActive = useCallback(
    (requestId: string, targetSessionId: string, assistantMessageId: string) =>
      Boolean(activeGenerationRef.current && isWorkspaceCurrent(activeGenerationRef.current.workspace)) && matchesGeneration(activeGenerationRef.current, {
        requestId,
        sessionId: targetSessionId,
        assistantMessageId,
      }),
    [],
  );

  const cancelActiveGeneration = useCallback(
    (reason: string) => {
      const active = activeGenerationRef.current;
      draftCheckpointRef.current?.flush();
      draftCheckpointRef.current = null;

      if (active) {
        debugStream("stream:abort", {
          reason,
          sessionId: active.sessionId,
          requestId: active.requestId,
          assistantMessageId: active.assistantMessageId,
        });
        const session = getStoredSessions().find(
          (item) => item.id === active.sessionId,
        );

        if (session && isWorkspaceCurrent(active.workspace)) {
          const interruptedMessages = session.messages.map((message) =>
            message.id === active.assistantMessageId &&
            message.status === "streaming"
              ? { ...message, status: "interrupted" as const,
                  generation: { ...(message.generation ?? {}), requestId: active.requestId, terminal: "cancelled" as const, reason,
                    startedAt: active.startedAt, durationMs: Date.now() - active.startedAt, outputChars: message.content.length },
                  generationAttempts: [...(message.generationAttempts ?? []).filter(attempt => attempt.requestId !== active.requestId),
                    { ...(message.generation ?? {}), requestId: active.requestId, terminal: "cancelled" as const, reason,
                      startedAt: active.startedAt, durationMs: Date.now() - active.startedAt, outputChars: message.content.length }],
                }
              : message,
          );
          try {
            upsertStoredSession({ ...session, messages: interruptedMessages, updatedAt: Date.now() });
          } catch {
            setError("The response remains on screen, but could not be saved. Copy or export it before leaving.");
          }

          if (currentSessionIdRef.current === active.sessionId) {
            setMessages(interruptedMessages);
          }
        }
        active.abortController.abort();
      }

      setActiveGenerationSafe(null);
    },
    [setActiveGenerationSafe],
  );

  const scrollToBottom = useCallback((options?: { smooth?: boolean }) => {
    const el = scrollRef.current;

    if (!el) {
      return;
    }

    if (options?.smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;

    if (!el) {
      return;
    }

    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceToBottom < 120;

    isNearBottomRef.current = nearBottom;
    setShowScrollButton(!nearBottom);
  }, []);

  const markShouldFollowOutput = useCallback(() => {
    isNearBottomRef.current = true;
    setShowScrollButton(false);
  }, []);

  const persistTargetSession = useCallback(
    (options: {
      targetSessionId: string;
      nextMessages: ChatMessage[];
      firstMessage: string;
      context: SessionContextSnapshot;
      toolContextSnapshot?: ToolContext;
      memorySnapshot: LearningMemory;
      allowCreate: boolean;
    }) => {
      const now = Date.now();
      const sessions = getStoredSessions();
      const existingSession = sessions.find((item) => item.id === options.targetSessionId);

      if (!existingSession && !options.allowCreate) {
        debugStream("stream:stale-ignore", {
          reason: "session-missing",
          sessionId: options.targetSessionId,
        });
        return false;
      }

      const title =
        existingSession && !isDefaultSessionTitle(existingSession.title)
          ? existingSession.title
          : buildSessionTitle(options.firstMessage);
      const session: StoredChatSession = {
        id: options.targetSessionId,
        title,
        source: existingSession?.source ?? (options.toolContextSnapshot ? "tool" : "manual"),
        createdAt: existingSession?.createdAt ?? now,
        updatedAt: now,
        messages: options.nextMessages,
        context: options.context,
        toolContext: existingSession?.toolContext ?? options.toolContextSnapshot,
        memory: options.memorySnapshot,
      };

      try {
        upsertStoredSession(session);
        return true;
      } catch (storageError) {
        const message = storageError instanceof WorkspaceQuotaError ? storageError.message
          : "The response could not be saved. Copy or export it before leaving, then free browser storage and retry.";
        setError(message);
        window.dispatchEvent(new CustomEvent("pla:storage-failed", { detail: message }));
        return false;
      }
    },
    [],
  );

  const loadSession = useCallback(
    (session: StoredChatSession) => {
      const switchingConversation = currentSessionIdRef.current !== session.id;
      if (switchingConversation) {setDraftImages([]);setImagesBusy(false);setImageDraftEpoch(value=>value+1);}
      if (activeGenerationRef.current && activeGenerationRef.current.sessionId !== session.id) {
        cancelActiveGeneration("session-switch");
      }

      debugStream("session:switch", {
        from: currentSessionIdRef.current,
        to: session.id,
      });
      markShouldFollowOutput();
      setSessionIdSafe(session.id);
      if (switchingConversation) setActiveSessionId(session.id);
      setMessages(session.messages);
      setCourse(session.context.course);
      setTaskType(session.context.taskType);
      setKnowledgePoint(session.context.knowledgePoint ?? "");
      setUseRag(Boolean(session.context.useRag));
      setKnowledgeDocumentIds(session.context.knowledgeDocumentIds ?? []);
      setKnowledgeCourseOnly(Boolean(session.context.knowledgeCourseOnly));
      setToolContext(session.toolContext);
      setMemory(session.memory ?? createLearningMemory());
      setModel(session.context.model ?? getStoredModel());
      setAnswerDepth(session.context.answerDepth ?? getStoredAnswerDepth());
      setKnowledgeMode(session.context.knowledgeMode ?? getStoredKnowledgeMode());
      if (switchingConversation) { setInput(""); setError(""); }
      setPendingContinuation((current) => (current?.sessionId === session.id ? current : null));
    },
    [cancelActiveGeneration, markShouldFollowOutput, setSessionIdSafe],
  );

  useEffect(() => {
    const initialPrompt = searchParams.get("prompt");
    const sessionIdFromUrl = searchParams.get("sessionId");

    if (sessionIdFromUrl) {
      const session = getStoredSessions().find((item) => item.id === sessionIdFromUrl);

      if (session) {
        const restoreTimer = window.setTimeout(() => loadSession(session), 0);
        return () => window.clearTimeout(restoreTimer);
      }
    }

    if (initialPrompt) {
      return;
    }

    const activeId = getActiveSessionId();
    const activeSession = getStoredSessions().find((session) => session.id === activeId);

    if (!activeSession) {
      return;
    }

    const restoreTimer = window.setTimeout(() => loadSession(activeSession), 0);
    return () => window.clearTimeout(restoreTimer);
  }, [loadSession, searchParams]);

  useEffect(() => {
    function handleNewSession() {
      setDraftImages([]);setImagesBusy(false);setImageDraftEpoch(value=>value+1);
      cancelActiveGeneration("new-session");
      markShouldFollowOutput();
      setSessionIdSafe("");
      setActiveSessionId("");
      setMessages([]);
      setToolContext(undefined);
      setMemory(createLearningMemory());
      setInput("");
      setError("");
      setPendingContinuation(null);
    }

    function handleLoadSession(event: Event) {
      const sessionIdFromEvent = (event as CustomEvent<string>).detail;
      const session = getStoredSessions().find((item) => item.id === sessionIdFromEvent);

      if (session) {
        loadSession(session);
      }
    }

    function handleWorkspaceLoaded() {
      if (activeGenerationRef.current) return;
      const activeId = currentSessionIdRef.current || getActiveSessionId();
      const session = getStoredSessions().find(item => item.id === activeId);
      if (session) loadSession(session);
      else if (currentSessionIdRef.current) handleNewSession();
    }

    function handleDeleteSession(event: Event) {
      const deletedSessionId = (event as CustomEvent<string>).detail;

      debugStream("session:delete", { sessionId: deletedSessionId });
      if (activeGenerationRef.current?.sessionId === deletedSessionId) {
        cancelActiveGeneration("session-delete");
      }

      if (currentSessionIdRef.current === deletedSessionId) {
        setDraftImages([]); setImagesBusy(false); setImageDraftEpoch(value => value + 1);
        markShouldFollowOutput();
        setSessionIdSafe("");
        setMessages([]);
        setToolContext(undefined);
        setMemory(createLearningMemory());
        setInput("");
        setError("");
        setPendingContinuation(null);
      }
    }

    function flushDraft() { draftCheckpointRef.current?.flush(); }
    window.addEventListener("pagehide", flushDraft);
    document.addEventListener("visibilitychange", flushDraft);
    window.addEventListener("pla:new-session", handleNewSession);
    window.addEventListener("pla:workspace-will-change", handleNewSession);
    window.addEventListener("pla:workspace-loaded", handleWorkspaceLoaded);
    window.addEventListener("pla:load-session", handleLoadSession);
    window.addEventListener("pla:delete-session", handleDeleteSession);
    return () => {
      window.removeEventListener("pagehide", flushDraft);
      document.removeEventListener("visibilitychange", flushDraft);
      window.removeEventListener("pla:new-session", handleNewSession);
      window.removeEventListener("pla:workspace-will-change", handleNewSession);
      window.removeEventListener("pla:workspace-loaded", handleWorkspaceLoaded);
      cancelActiveGeneration("unmount");
      window.removeEventListener("pla:load-session", handleLoadSession);
      window.removeEventListener("pla:delete-session", handleDeleteSession);
    };
  }, [cancelActiveGeneration, loadSession, markShouldFollowOutput, setSessionIdSafe]);

  useEffect(() => {
    if (!isNearBottomRef.current) {
      return;
    }

    const frame = window.requestAnimationFrame(() => { if (isNearBottomRef.current) scrollToBottom(); });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, isCurrentSessionGenerating, scrollToBottom]);

  const runAssistantRequest = useCallback(
    async (options: {
      targetSessionId: string;
      assistantMessageId: string;
      requestId: string;
      request: AgentRequest;
      messagesBeforeAssistant: ChatMessage[];
      firstMessage: string;
      context: SessionContextSnapshot;
      toolContextSnapshot?: ToolContext;
      memorySnapshot: LearningMemory;
      appendToExistingAssistant?: boolean;
      existingAssistantContent?: string;
      originalRequest?: AgentRequest;
    }) => {
      let normalizedRequest = options.request;
      let serverMemory: LearningMemory | undefined;
      const normalizedContext = { ...options.context };
      let sources: RagContext["snippets"] | undefined;
      let retrievalStatus: RetrievalStatus | undefined;
      const previousAssistant = getStoredSessions().find(session => session.id === options.targetSessionId)?.messages.find(message => message.id === options.assistantMessageId);
      const previousAttempts = [...new Map([...(previousAssistant?.generationAttempts ?? []), ...(previousAssistant?.generation ? [previousAssistant.generation] : [])].filter(attempt => attempt.requestId !== options.requestId).map(attempt => [attempt.requestId, attempt])).values()];
      const diagnostics: GenerationDiagnostics = {
        requestId: options.requestId, provider: options.request.clientProvider?.provider ?? "server-default",
        model: options.request.clientProvider?.model ?? options.request.model,
        intent: options.request.intent, terminal: "interrupted", startedAt: Date.now(),
      };
      const decorate = (next: ChatMessage[]) => next.map(message => message.id === options.assistantMessageId ? {
        ...message, sources, retrievalStatus,
        generation: { ...diagnostics, durationMs: Date.now() - diagnostics.startedAt!, outputChars: message.content.length },
        generationAttempts: [...previousAttempts, { ...diagnostics, durationMs: Date.now() - diagnostics.startedAt!, outputChars: message.content.length }],
      } : message);
      const abortController = new AbortController();
      const active: ActiveGeneration = {
        workspace: getWorkspaceIdentity(),
        sessionId: options.targetSessionId,
        assistantMessageId: options.assistantMessageId,
        requestId: options.requestId,
        abortController,
        startedAt: Date.now(),
      };

      setActiveGenerationSafe(active);
      const checkpoint = createDraftCheckpoint<ChatMessage[]>(nextMessages => {
        const persisted = persistTargetSession({ targetSessionId: options.targetSessionId,
          nextMessages, firstMessage: options.firstMessage, context: normalizedContext,
          toolContextSnapshot: options.toolContextSnapshot, memorySnapshot: options.memorySnapshot, allowCreate: false });
        if (!persisted) abortController.abort();
      }, () => isWorkspaceCurrent(active.workspace) && isRequestStillActive(options.requestId, options.targetSessionId, options.assistantMessageId));
      draftCheckpointRef.current = checkpoint;
      debugStream("stream:start", {
        sessionId: options.targetSessionId,
        requestId: options.requestId,
        assistantMessageId: options.assistantMessageId,
      });
      markShouldFollowOutput();
      setError("");
      setPendingContinuation(null);
      setGenerationStage(undefined);

      try {
        const generated = await requestAgentStream(
          options.request,
          (partial) => {
            if (
              !isRequestStillActive(
                options.requestId,
                options.targetSessionId,
                options.assistantMessageId,
              )
            ) {
              debugStream("stream:stale-ignore", {
                reason: "chunk-inactive",
                sessionId: options.targetSessionId,
                requestId: options.requestId,
              });
              return;
            }

            const assistantContent = options.appendToExistingAssistant
              ? `${options.existingAssistantContent ?? ""}${partial}`
              : partial;
            const nextMessages = decorate(withAssistantMessage(
              options.messagesBeforeAssistant,
              options.assistantMessageId,
              assistantContent,
              "streaming",
              options.requestId,
            ));
            checkpoint.update(nextMessages);

            if (currentSessionIdRef.current === options.targetSessionId) {
              setMessages(nextMessages);
            }
          },
          { signal: abortController.signal, throttleMs: 64, idleTimeoutMs: 120000,
            onEvent: event => {
              if (!isRequestStillActive(options.requestId, options.targetSessionId, options.assistantMessageId)) return;
              if (event.type === "delta" && event.text.trim()) diagnostics.firstTokenMs ??= Date.now() - diagnostics.startedAt!;
              if (event.type === "stage") setGenerationStage(event.stage);
              if (event.type === "context") {
                normalizedRequest = { ...normalizedRequest, ...event.context };
                normalizedContext.course = event.context.course ?? normalizedContext.course;
                normalizedContext.knowledgePoint = event.context.knowledgePoint;
                normalizedContext.detectedLanguage = event.context.detectedLanguage;
                normalizedContext.practiceStyle = event.context.practiceStyle;
                normalizedContext.referenceProfile = event.context.referenceProfile;
                setCourse(normalizedContext.course);
                setKnowledgePoint(normalizedContext.knowledgePoint ?? "");
              }
              if (event.type === "sources") {
                sources = event.sources;
                if (["disabled", "unauthenticated", "no_match", "retrieved", "failed"].includes(event.status ?? "")) retrievalStatus = event.status as RetrievalStatus;
              }
              if (event.type === "complete") { diagnostics.terminal = "complete"; diagnostics.finishReason = event.finishReason; diagnostics.usage = event.usage; }
              if (event.type === "truncated" || event.type === "interrupted" || event.type === "cancelled") { diagnostics.terminal = event.type; diagnostics.reason = event.reason; if ("usage" in event) diagnostics.usage = event.usage; }
              if (event.type === "memory") serverMemory = event.memory;
            },
          },
        );

        if (
          !isRequestStillActive(
            options.requestId,
            options.targetSessionId,
            options.assistantMessageId,
          )
        ) {
          return;
        }

        checkpoint.discard();
        const finalAssistantContent = options.appendToExistingAssistant
          ? `${options.existingAssistantContent ?? ""}${generated}`
          : generated;
        diagnostics.terminal = "complete";
        const finalMessages = decorate(withAssistantMessage(
          options.messagesBeforeAssistant,
          options.assistantMessageId,
          finalAssistantContent,
          "complete",
          options.requestId,
        ));
        const finalMemory = serverMemory ?? commitLearningMemory(normalizedRequest, finalAssistantContent);
        const persisted = persistTargetSession({
          targetSessionId: options.targetSessionId,
          nextMessages: finalMessages,
          firstMessage: options.firstMessage,
          context: normalizedContext,
          toolContextSnapshot: options.toolContextSnapshot,
          memorySnapshot: finalMemory,
          allowCreate: false,
        });

        if (currentSessionIdRef.current === options.targetSessionId) {
          setMessages(finalMessages);
          setMemory(finalMemory);
        }
        if (persisted) {
          try {
            saveStoredLearningProfile(updateLearningProfile(getStoredLearningProfile(), finalMemory));
            clearLastApiError();
          } catch {
            setError("The answer was saved, but learning preferences could not be saved. Free browser storage and retry saving.");
          }
        }
      } catch (requestError) {
        if (
          !isRequestStillActive(
            options.requestId,
            options.targetSessionId,
            options.assistantMessageId,
          )
        ) {
          debugStream("stream:stale-ignore", {
            reason: "catch-inactive",
            sessionId: options.targetSessionId,
            requestId: options.requestId,
          });
          return;
        }

        checkpoint.discard();
        const streamError =
          requestError instanceof AgentStreamError
            ? requestError
            : new AgentStreamError(
                requestError instanceof Error ? requestError.message : "Request failed.",
              );
        diagnostics.terminal = streamError.reason === "abort" ? "cancelled" : streamError.reason === "length" ? "truncated" : "interrupted";
        diagnostics.reason ??= streamError.reason;
        const partialContent = options.appendToExistingAssistant
          ? `${options.existingAssistantContent ?? ""}${streamError.partialContent}`
          : streamError.partialContent;

        let partialSaved = false;
        {
          const partialMessages = decorate(withAssistantMessage(
            options.messagesBeforeAssistant,
            options.assistantMessageId,
            partialContent,
            streamError.reason === "abort" ? "interrupted" : "error",
            options.requestId,
          ));
          partialSaved = persistTargetSession({
            targetSessionId: options.targetSessionId,
            nextMessages: partialMessages,
            firstMessage: options.firstMessage,
            context: normalizedContext,
            toolContextSnapshot: options.toolContextSnapshot,
            memorySnapshot: options.memorySnapshot,
            allowCreate: false,
          });

          if (currentSessionIdRef.current === options.targetSessionId) {
            setMessages(partialMessages);
          }

          setPendingContinuation({
            sessionId: options.targetSessionId,
            assistantMessageId: options.assistantMessageId,
            request: options.originalRequest ?? options.request,
            messagesBeforeAssistant: options.messagesBeforeAssistant,
            firstMessage: options.firstMessage,
            partialContent,
          });
        }

        if (currentSessionIdRef.current === options.targetSessionId) {
          const message = !partialSaved ? "The current response is on screen but could not be saved. Copy it before leaving, then free storage and retry."
            : isAbortLikeError(streamError)
            ? "Generation stopped. The current content has been preserved and can be continued."
            : streamError.message || "Request failed.";
          setError(message);
          try { saveLastApiError({ message, status: streamError.reason, occurredAt: Date.now() }); }
          catch { /* The save-state warning already reports the storage failure. */ }
        }
      } finally {
        checkpoint.discard();
        if (draftCheckpointRef.current === checkpoint) draftCheckpointRef.current = null;
        if (
          isRequestStillActive(
            options.requestId,
            options.targetSessionId,
            options.assistantMessageId,
          )
        ) {
          setActiveGenerationSafe(null);
        }
      }
    },
    [
      isRequestStillActive,
      markShouldFollowOutput,
      persistTargetSession,
      setActiveGenerationSafe,
    ],
  );

  const stopGeneration = useCallback(() => {
    const active = activeGenerationRef.current;

    if (!active || active.sessionId !== currentSessionIdRef.current) {
      return;
    }

    debugStream("stream:abort", {
      reason: "manual-stop",
      sessionId: active.sessionId,
      requestId: active.requestId,
    });
    active.abortController.abort();
  }, []);

  const submitMessage = useCallback(async () => {
    const message = input.trim() || (draftImages.length ? (memory.recentLanguage === "zh" || navigator.language.startsWith("zh") ? "请帮我理解这些图片。" : "Help me understand these images.") : "");

    if (!message || isCurrentSessionGenerating || imagesBusy) {
      return;
    }

    if (activeGenerationRef.current) {
      cancelActiveGeneration("new-submit");
    }

    const targetSessionId = sessionId || createSessionId();
    const now = Date.now();
    const userMessage: ChatMessage = {
      id: createMessageId("user"),
      role: "user",
      content: message,
      images: draftImages.length ? draftImages : undefined,
      createdAt: now,
    };
    const assistantMessageId = createMessageId("assistant");
    const requestId = createMessageId("request");
    const nextMessages: ChatMessage[] = [...messages, userMessage];
    const detectedLanguage = detectLanguage(message, memory.recentLanguage ?? "en");
    const initialMessages = withAssistantMessage(
      nextMessages,
      assistantMessageId,
      "",
      "streaming",
      requestId,
    );
    const contextSnapshot: SessionContextSnapshot = {
      course,
      taskType,
      knowledgePoint: knowledgePoint || undefined,
      model: model || undefined,
      useRag,
      answerDepth,
      detectedLanguage,
      practiceStyle: memory.practiceStyle,
      referenceProfile: memory.referenceProfile,
      knowledgeMode,
      knowledgeDocumentIds,
      knowledgeCourseOnly,
    };
    const toolContextSnapshot = toolContext;
    const intent = classifyAgentIntent({
      message,
      course,
      taskType,
      knowledgePoint: knowledgePoint || undefined,
      toolContext,
    });
    const memorySnapshot = memory;
    const request: AgentRequest = {
      message,
      images: draftImages.length ? draftImages : undefined,
      intent,
      module: "chat",
      course,
      taskType,
      knowledgePoint: knowledgePoint || undefined,
      history: messages,
      useRag,
      toolContext,
      model: model || undefined,
      memory: memorySnapshot,
      answerDepth,
      knowledgeMode,
      knowledgeDocumentIds,
      knowledgeCourseOnly,
      clientProvider: getClientProviderOverride(),
      conversationId: targetSessionId,
      assistantMessageId,
      requestId,
    };

    const saved = persistTargetSession({
      targetSessionId,
      nextMessages: initialMessages,
      firstMessage: nextMessages[0]?.content ?? message,
      context: contextSnapshot,
      toolContextSnapshot,
      memorySnapshot,
      allowCreate: true,
    });
    if (!saved) return;
    setDraftImages([]);setImagesBusy(false);setImageDraftEpoch(value=>value+1);
    setSessionIdSafe(targetSessionId);
    setActiveSessionId(targetSessionId);
    setMessages(initialMessages);
    setMemory(memorySnapshot);
    setInput("");

    await runAssistantRequest({
      targetSessionId,
      assistantMessageId,
      requestId,
      request,
      messagesBeforeAssistant: nextMessages,
      firstMessage: nextMessages[0]?.content ?? message,
      context: contextSnapshot,
      toolContextSnapshot,
      memorySnapshot,
    });
  }, [
    cancelActiveGeneration,
    answerDepth,
    course,
    input,
    draftImages,
    imagesBusy,
    isCurrentSessionGenerating,
    knowledgePoint,
    knowledgeMode,
    knowledgeDocumentIds,
    knowledgeCourseOnly,
    messages,
    memory,
    model,
    persistTargetSession,
    runAssistantRequest,
    sessionId,
    setSessionIdSafe,
    taskType,
    toolContext,
    useRag,
  ]);

  const continueGeneration = useCallback(async () => {
    if (!currentPendingContinuation || isCurrentSessionGenerating) {
      return;
    }

    if (activeGenerationRef.current) {
      cancelActiveGeneration("continue-submit");
    }

    const originalMessage = currentPendingContinuation.request.message;
    const assistantHistoryMessage: ChatMessage = {
      id: currentPendingContinuation.assistantMessageId,
      role: "assistant",
      content: currentPendingContinuation.partialContent,
      status: "interrupted",
      requestId: currentPendingContinuation.request.requestId,
    };
    const continuationHistory: ChatMessage[] = [
      ...(currentPendingContinuation.request.history ?? []),
      assistantHistoryMessage,
    ];
    const continuationRequest: AgentRequest = {
      ...currentPendingContinuation.request,
      message: buildContinuationMessage(originalMessage),
      history: continuationHistory,
      conversationId: currentPendingContinuation.sessionId,
      assistantMessageId: currentPendingContinuation.assistantMessageId,
      requestId: createMessageId("request"),
      memory,
      answerDepth,
      detectedLanguage: memory.recentLanguage,
      practiceStyle: memory.practiceStyle,
      referenceProfile: memory.referenceProfile,
      knowledgeMode,
      knowledgeDocumentIds,
      knowledgeCourseOnly,
      clientProvider: getClientProviderOverride(),
    };
    const contextSnapshot: SessionContextSnapshot = {
      course,
      taskType,
      knowledgePoint: knowledgePoint || undefined,
      model: model || undefined,
      useRag,
      answerDepth,
      detectedLanguage: memory.recentLanguage,
      practiceStyle: memory.practiceStyle,
      referenceProfile: memory.referenceProfile,
      knowledgeMode,
      knowledgeDocumentIds,
      knowledgeCourseOnly,
    };

    await runAssistantRequest({
      targetSessionId: currentPendingContinuation.sessionId,
      assistantMessageId: currentPendingContinuation.assistantMessageId,
      requestId: continuationRequest.requestId!,
      request: continuationRequest,
      messagesBeforeAssistant: currentPendingContinuation.messagesBeforeAssistant,
      firstMessage: currentPendingContinuation.firstMessage,
      context: contextSnapshot,
      toolContextSnapshot: toolContext,
      memorySnapshot: memory,
      appendToExistingAssistant: true,
      existingAssistantContent: currentPendingContinuation.partialContent,
      originalRequest: currentPendingContinuation.request,
    });
  }, [
    cancelActiveGeneration,
    answerDepth,
    course,
    currentPendingContinuation,
    isCurrentSessionGenerating,
    knowledgePoint,
    knowledgeMode,
    knowledgeDocumentIds,
    knowledgeCourseOnly,
    memory,
    model,
    runAssistantRequest,
    taskType,
    toolContext,
    useRag,
  ]);

  const retryGeneration = useCallback(async () => {
    if (!currentPendingContinuation || isCurrentSessionGenerating) {
      return;
    }

    if (activeGenerationRef.current) {
      cancelActiveGeneration("retry-submit");
    }

    const retryRequestId = createMessageId("request");
    const retryRequest: AgentRequest = {
      ...currentPendingContinuation.request,
      history: currentPendingContinuation.request.history ?? [],
      conversationId: currentPendingContinuation.sessionId,
      assistantMessageId: currentPendingContinuation.assistantMessageId,
      requestId: retryRequestId,
      memory,
      answerDepth,
      knowledgeMode,
      knowledgeDocumentIds,
      knowledgeCourseOnly,
      clientProvider: getClientProviderOverride(),
    };
    const contextSnapshot: SessionContextSnapshot = {
      course,
      taskType,
      knowledgePoint: knowledgePoint || undefined,
      model: model || undefined,
      useRag,
      answerDepth,
      knowledgeMode,
      knowledgeDocumentIds,
      knowledgeCourseOnly,
    };

    await runAssistantRequest({
      targetSessionId: currentPendingContinuation.sessionId,
      assistantMessageId: currentPendingContinuation.assistantMessageId,
      requestId: retryRequestId,
      request: retryRequest,
      messagesBeforeAssistant: currentPendingContinuation.messagesBeforeAssistant,
      firstMessage: currentPendingContinuation.firstMessage,
      context: contextSnapshot,
      toolContextSnapshot: toolContext,
      memorySnapshot: memory,
      originalRequest: currentPendingContinuation.request,
    });
  }, [
    answerDepth,
    cancelActiveGeneration,
    course,
    currentPendingContinuation,
    isCurrentSessionGenerating,
    knowledgePoint,
    knowledgeMode,
    knowledgeDocumentIds,
    knowledgeCourseOnly,
    memory,
    model,
    runAssistantRequest,
    taskType,
    toolContext,
    useRag,
  ]);

  const clearToolContext = useCallback(() => {
    setToolContext(undefined);

    if (!sessionId) {
      return;
    }

    const current = getStoredSessions().find((item) => item.id === sessionId);

    if (current) {
      upsertStoredSession({
        ...current,
        source: "manual",
        toolContext: undefined,
        updatedAt: Date.now(),
      });
    }
  }, [sessionId]);

  const handleAnswerFeedback = useCallback(
    (messageId: string, feedback?: AnswerFeedback) => {
      const targetSessionId = currentSessionIdRef.current;

      if (!targetSessionId) {
        return;
      }

      const currentSession = getStoredSessions().find(
        (item) => item.id === targetSessionId,
      );

      if (!currentSession) {
        return;
      }

      const nextMessages = currentSession.messages.map((message) =>
        message.id === messageId ? { ...message, feedback: feedback ? {...feedback, updatedAt: Math.max(feedback.updatedAt, (message.feedbackDeletedAt ?? 0) + 1)} : undefined, feedbackDeletedAt: feedback ? message.feedbackDeletedAt : Date.now() } : message,
      );

      upsertStoredSession({
        ...currentSession,
        messages: nextMessages,
        updatedAt: Date.now(),
      });

      if (currentSessionIdRef.current === targetSessionId) {
        setMessages(nextMessages);
      }
    },
    [],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitMessage();
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-white">
      <section
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-white"
        data-testid="chat-scroll-area"
      >
        {toolContext ? (
          <ContextBanner context={toolContext} onClear={clearToolContext} />
        ) : null}
        {!messages.length ? <FirstUseGuide /> : null}
        <ChatWindow
          messages={messages}
          onPickPrompt={setInput}
          onFeedback={handleAnswerFeedback}
        />
        <div className="mx-auto w-full max-w-3xl space-y-3 px-4 pb-6">
          {isCurrentSessionGenerating ? (
            <GenerationStatus stage={generationStage}
              module="chat"
              taskType={taskType}
              hasContent={Boolean(messages.at(-1)?.content)}
            />
          ) : null}
          <ErrorMessage message={error} />
          {currentPendingContinuation ? (
            <div className="flex flex-wrap gap-2">
              {currentPendingContinuation.partialContent ? <button
                type="button"
                onClick={() => void continueGeneration()}
                disabled={isCurrentSessionGenerating}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:border-zinc-400 hover:text-zinc-950 disabled:cursor-not-allowed disabled:text-zinc-400"
              >
                Continue generation
              </button> : null}
              <button
                type="button"
                onClick={() => void retryGeneration()}
                disabled={isCurrentSessionGenerating}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:border-zinc-400 hover:text-zinc-950 disabled:cursor-not-allowed disabled:text-zinc-400"
              >
                Regenerate
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {showScrollButton ? (
        <button
          type="button"
          onClick={() => scrollToBottom({ smooth: true })}
          style={{bottom: footerHeight + 12}}
          className="absolute left-1/2 z-30 -translate-x-1/2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm hover:bg-zinc-50"
        >
          <span className="flex items-center gap-1">
            <ArrowDown size={14} />
             Back to bottom
          </span>
        </button>
      ) : null}

      <footer ref={footerRef} className="z-20 shrink-0 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <form onSubmit={handleSubmit} className="mx-auto w-full max-w-3xl px-4 py-3">
          <ChatInput
            attachmentControls={<ImageAttachmentInput key={`${sessionId}-${imageDraftEpoch}`} images={draftImages} onChange={setDraftImages} onBusyChange={setImagesBusy} disabled={isCurrentSessionGenerating} pasteTargetId="chat-message-input"/>}
            hasImages={draftImages.length>0}
            attachmentsBusy={imagesBusy}
            value={input}
            isLoading={isCurrentSessionGenerating}
            onChange={setInput}
            onSubmit={submitMessage}
            onStop={stopGeneration}
            answerDepth={answerDepth}
            knowledgeMode={knowledgeMode}
            onAnswerDepthChange={(nextDepth) => {
              setAnswerDepth(nextDepth);
              saveStoredAnswerDepth(nextDepth);
            }}
            onKnowledgeModeChange={(nextMode) => {
              setKnowledgeMode(nextMode);
              saveStoredKnowledgeMode(nextMode);
            }}
          />
          {knowledgeMode !== "never" ? <KnowledgeScopeControl documentIds={knowledgeDocumentIds} courseOnly={knowledgeCourseOnly} onChange={(ids, only) => { setKnowledgeDocumentIds(ids); setKnowledgeCourseOnly(only); }} /> : null}
          <p className="mt-2 pb-4 text-center text-xs text-zinc-500">
            Check important results against your course materials.
          </p>
        </form>
      </footer>
    </div>
  );
}
