"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { ErrorMessage } from "@/components/ErrorMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { ContextBanner } from "@/components/chat/ContextBanner";
import { FirstUseGuide } from "@/components/chat/FirstUseGuide";
import { GenerationStatus } from "@/components/common/GenerationStatus";
import { buildConversationSummary } from "@/agent/context-manager";
import { matchesGeneration, type ActiveGenerationDescriptor } from "@/agent/generation-guard";
import { classifyAgentIntent } from "@/agent/intent-classifier";
import {
  createLearningMemory,
  updateLearningMemory,
  updateLearningProfile,
} from "@/agent/memory-manager";
import { courseOptions } from "@/data/courses";
import { AgentStreamError, requestAgentStream } from "@/lib/read-agent-stream";
import { clearLastApiError, saveLastApiError } from "@/lib/api-diagnostics";
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
  type AnswerDepth,
  type ChatMessage,
  type CourseId,
  type KnowledgeMode,
  type LearningMemory,
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

  return window.localStorage.getItem("pla.deepseek.model") ?? "";
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

function buildContinuationMessage(originalMessage: string, partialContent: string) {
  return `The previous answer stopped at the following point. Do not repeat existing content. Continue from the interruption point while preserving the structure, numbering, notation, language, and LaTeX format.

Original user request:
${originalMessage}

Generated content:
${partialContent}`;
}

function withAssistantMessage(
  messagesBeforeAssistant: ChatMessage[],
  assistantMessageId: string,
  content: string,
  status: ChatMessage["status"] = "streaming",
  requestId?: string,
) {
  const assistantMessage: ChatMessage = {
    id: assistantMessageId,
    role: "assistant",
    content,
    createdAt: Date.now(),
    status,
    requestId,
  };
  const existingIndex = messagesBeforeAssistant.findIndex(
    (message) => message.id === assistantMessageId,
  );

  if (existingIndex < 0) {
    return [...messagesBeforeAssistant, assistantMessage];
  }

  return messagesBeforeAssistant.map((message, index) =>
    index === existingIndex ? { ...message, ...assistantMessage } : message,
  );
}

function isAbortLikeError(error: unknown) {
  if (error instanceof AgentStreamError) {
    return error.reason === "abort";
  }

  return error instanceof DOMException && error.name === "AbortError";
}

export function ChatWorkspace() {
  const searchParams = useSearchParams();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const activeGenerationRef = useRef<ActiveGeneration | null>(null);
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
  const [model, setModel] = useState(() => getStoredModel());
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
  const [pendingContinuation, setPendingContinuation] = useState<PendingContinuation | null>(null);
  const [activeGeneration, setActiveGeneration] = useState<ActiveGeneration | null>(null);

  const isCurrentSessionGenerating = activeGeneration?.sessionId === sessionId;
  const currentPendingContinuation =
    pendingContinuation?.sessionId === sessionId ? pendingContinuation : null;

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
      matchesGeneration(activeGenerationRef.current, {
        requestId,
        sessionId: targetSessionId,
        assistantMessageId,
      }),
    [],
  );

  const cancelActiveGeneration = useCallback(
    (reason: string) => {
      const active = activeGenerationRef.current;

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

        if (session) {
          const interruptedMessages = session.messages.map((message) =>
            message.id === active.assistantMessageId &&
            message.status === "streaming"
              ? { ...message, status: "interrupted" as const }
              : message,
          );
          upsertStoredSession({
            ...session,
            messages: interruptedMessages,
            updatedAt: Date.now(),
          });

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

      upsertStoredSession(session);
      return true;
    },
    [],
  );

  const loadSession = useCallback(
    (session: StoredChatSession) => {
      if (activeGenerationRef.current && activeGenerationRef.current.sessionId !== session.id) {
        cancelActiveGeneration("session-switch");
      }

      debugStream("session:switch", {
        from: currentSessionIdRef.current,
        to: session.id,
      });
      markShouldFollowOutput();
      setSessionIdSafe(session.id);
      setActiveSessionId(session.id);
      setMessages(session.messages);
      setCourse(session.context.course);
      setTaskType(session.context.taskType);
      setKnowledgePoint(session.context.knowledgePoint ?? "");
      setUseRag(Boolean(session.context.useRag));
      setToolContext(session.toolContext);
      setMemory(session.memory ?? createLearningMemory());
      setModel(session.context.model ?? getStoredModel());
      setAnswerDepth(session.context.answerDepth ?? getStoredAnswerDepth());
      setKnowledgeMode(session.context.knowledgeMode ?? getStoredKnowledgeMode());
      setInput("");
      setError("");
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

    function handleDeleteSession(event: Event) {
      const deletedSessionId = (event as CustomEvent<string>).detail;

      debugStream("session:delete", { sessionId: deletedSessionId });
      if (activeGenerationRef.current?.sessionId === deletedSessionId) {
        cancelActiveGeneration("session-delete");
      }

      if (currentSessionIdRef.current === deletedSessionId) {
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

    window.addEventListener("pla:new-session", handleNewSession);
    window.addEventListener("pla:load-session", handleLoadSession);
    window.addEventListener("pla:delete-session", handleDeleteSession);
    return () => {
      window.removeEventListener("pla:new-session", handleNewSession);
      window.removeEventListener("pla:load-session", handleLoadSession);
      window.removeEventListener("pla:delete-session", handleDeleteSession);
    };
  }, [cancelActiveGeneration, loadSession, markShouldFollowOutput, setSessionIdSafe]);

  useEffect(() => {
    if (!isNearBottomRef.current) {
      return;
    }

    const frame = window.requestAnimationFrame(() => scrollToBottom());
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
      const abortController = new AbortController();
      const active: ActiveGeneration = {
        sessionId: options.targetSessionId,
        assistantMessageId: options.assistantMessageId,
        requestId: options.requestId,
        abortController,
        startedAt: Date.now(),
      };

      setActiveGenerationSafe(active);
      debugStream("stream:start", {
        sessionId: options.targetSessionId,
        requestId: options.requestId,
        assistantMessageId: options.assistantMessageId,
      });
      markShouldFollowOutput();
      setError("");
      setPendingContinuation(null);

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
            const nextMessages = withAssistantMessage(
              options.messagesBeforeAssistant,
              options.assistantMessageId,
              assistantContent,
              "streaming",
              options.requestId,
            );
            const persisted = persistTargetSession({
              targetSessionId: options.targetSessionId,
              nextMessages,
              firstMessage: options.firstMessage,
              context: options.context,
              toolContextSnapshot: options.toolContextSnapshot,
              memorySnapshot: options.memorySnapshot,
              allowCreate: false,
            });

            if (!persisted) {
              abortController.abort();
              setActiveGenerationSafe(null);
              return;
            }

            if (currentSessionIdRef.current === options.targetSessionId) {
              setMessages(nextMessages);
            }
          },
          { signal: abortController.signal, throttleMs: 64, idleTimeoutMs: 120000 },
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

        const finalAssistantContent = options.appendToExistingAssistant
          ? `${options.existingAssistantContent ?? ""}${generated}`
          : generated;
        const finalMessages = withAssistantMessage(
          options.messagesBeforeAssistant,
          options.assistantMessageId,
          finalAssistantContent,
          "complete",
          options.requestId,
        );
        const finalMemory = {
          ...options.memorySnapshot,
          conversationSummary: buildConversationSummary(
            finalMessages,
            options.memorySnapshot,
          ),
          updatedAt: Date.now(),
        };
        const persisted = persistTargetSession({
          targetSessionId: options.targetSessionId,
          nextMessages: finalMessages,
          firstMessage: options.firstMessage,
          context: options.context,
          toolContextSnapshot: options.toolContextSnapshot,
          memorySnapshot: finalMemory,
          allowCreate: false,
        });

        if (persisted && currentSessionIdRef.current === options.targetSessionId) {
          setMessages(finalMessages);
          setMemory(finalMemory);
        }
        clearLastApiError();
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

        const streamError =
          requestError instanceof AgentStreamError
            ? requestError
            : new AgentStreamError(
                requestError instanceof Error ? requestError.message : "Request failed.",
              );
        const partialContent = options.appendToExistingAssistant
          ? `${options.existingAssistantContent ?? ""}${streamError.partialContent}`
          : streamError.partialContent;

        if (partialContent) {
          const partialMessages = withAssistantMessage(
            options.messagesBeforeAssistant,
            options.assistantMessageId,
            partialContent,
            streamError.reason === "abort" ? "interrupted" : "error",
            options.requestId,
          );
          const persisted = persistTargetSession({
            targetSessionId: options.targetSessionId,
            nextMessages: partialMessages,
            firstMessage: options.firstMessage,
            context: options.context,
            toolContextSnapshot: options.toolContextSnapshot,
            memorySnapshot: options.memorySnapshot,
            allowCreate: false,
          });

          if (persisted && currentSessionIdRef.current === options.targetSessionId) {
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
          const message = isAbortLikeError(streamError)
            ? "Generation stopped. The current content has been preserved and can be continued."
            : streamError.message || "Request failed.";
          setError(message);
          saveLastApiError({
            message,
            status: streamError.reason,
            occurredAt: Date.now(),
          });
        }
      } finally {
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
    const message = input.trim();

    if (!message || isCurrentSessionGenerating) {
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
    };
    const toolContextSnapshot = toolContext;
    const intent = classifyAgentIntent({
      message,
      course,
      taskType,
      knowledgePoint: knowledgePoint || undefined,
      toolContext,
    });
    const memorySnapshot = updateLearningMemory(
      memory,
      {
        message,
        course,
        taskType,
        knowledgePoint: knowledgePoint || undefined,
        toolContext,
        detectedLanguage,
      },
      intent,
    );
    contextSnapshot.practiceStyle = memorySnapshot.practiceStyle;
    contextSnapshot.referenceProfile = memorySnapshot.referenceProfile;
    saveStoredLearningProfile(
      updateLearningProfile(getStoredLearningProfile(), memorySnapshot),
    );
    const request: AgentRequest = {
      message,
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
      detectedLanguage: memorySnapshot.recentLanguage,
      practiceStyle: memorySnapshot.practiceStyle,
      referenceProfile: memorySnapshot.referenceProfile,
      knowledgeMode,
      clientProvider: getClientProviderOverride(),
      conversationId: targetSessionId,
      assistantMessageId,
      requestId,
    };

    persistTargetSession({
      targetSessionId,
      nextMessages: initialMessages,
      firstMessage: nextMessages[0]?.content ?? message,
      context: contextSnapshot,
      toolContextSnapshot,
      memorySnapshot,
      allowCreate: true,
    });
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
    isCurrentSessionGenerating,
    knowledgePoint,
    knowledgeMode,
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
    ].slice(-16);
    const continuationRequest: AgentRequest = {
      ...currentPendingContinuation.request,
      message: buildContinuationMessage(originalMessage, currentPendingContinuation.partialContent),
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
        />
        <div className="mx-auto w-full max-w-3xl space-y-3 px-4 pb-6">
          {isCurrentSessionGenerating ? (
            <GenerationStatus
              module="chat"
              taskType={taskType}
              hasContent={Boolean(messages.at(-1)?.content)}
            />
          ) : null}
          <ErrorMessage message={error} />
          {currentPendingContinuation ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void continueGeneration()}
                disabled={isCurrentSessionGenerating}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:border-zinc-400 hover:text-zinc-950 disabled:cursor-not-allowed disabled:text-zinc-400"
              >
                Continue generation
              </button>
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
          className="absolute bottom-32 left-1/2 z-30 -translate-x-1/2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm hover:bg-zinc-50 md:bottom-28"
        >
          <span className="flex items-center gap-1">
            <ArrowDown size={14} />
             Back to bottom
          </span>
        </button>
      ) : null}

      <footer className="z-20 shrink-0 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <form onSubmit={handleSubmit} className="mx-auto w-full max-w-3xl px-4 py-3">
          <ChatInput
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
          <p className="mt-2 text-center text-xs text-zinc-500">
            Model-generated responses may contain errors. Check formulas and derivations against
            your course materials.
          </p>
        </form>
      </footer>
    </div>
  );
}
