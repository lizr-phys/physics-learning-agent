"use client";

import { KeyboardEvent, memo, useCallback, useEffect, useRef,type ReactNode } from "react";
import { Loader2, Send, Square } from "lucide-react";

import {
  answerDepthOptions,
  knowledgeModeOptions,
  type AnswerDepth,
  type KnowledgeMode,
} from "@/types/learning";

type ChatInputProps = {
  value: string;
  isLoading: boolean;
  answerDepth: AnswerDepth;
  knowledgeMode: KnowledgeMode;
  onChange: (value: string) => void;
  onAnswerDepthChange: (value: AnswerDepth) => void;
  onKnowledgeModeChange: (value: KnowledgeMode) => void;
  onSubmit: () => void;
  onStop: () => void;
  attachmentControls?: ReactNode;
  hasImages?: boolean;
  attachmentsBusy?: boolean;
};

export const ChatInput = memo(function ChatInput({
  value,
  isLoading,
  answerDepth,
  knowledgeMode,
  onChange,
  onAnswerDepthChange,
  onKnowledgeModeChange,
  onSubmit,
  onStop,
  attachmentControls,
  hasImages=false,
  attachmentsBusy=false,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const composingRef = useRef(false);

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(resizeTextarea);
    return () => window.cancelAnimationFrame(frame);
  }, [resizeTextarea, value]);

  useEffect(() => {
    function focusInput() {
      textareaRef.current?.focus();
    }

    window.addEventListener("pla:focus-chat-input", focusInput);
    return () => window.removeEventListener("pla:focus-chat-input", focusInput);
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (composingRef.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  }

  return (
    <div className="relative rounded-2xl border border-zinc-300 bg-white px-4 py-3 focus-within:border-zinc-500">
      {attachmentControls}
      <textarea
        id="chat-message-input"
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => { composingRef.current = true; }}
        onCompositionEnd={() => { composingRef.current = false; }}
        aria-label="Message"
        placeholder="Ask a question or paste an image…"
        rows={1}
        className="max-h-36 min-h-16 w-full resize-none overflow-y-auto bg-transparent pb-7 pr-12 text-sm leading-6 text-zinc-950 outline-none md:max-h-[180px]"
        data-testid="chat-input"
      />
      <details className="max-w-[calc(100%-3rem)] text-xs text-zinc-500">
        <summary className="w-fit cursor-pointer py-1">Options</summary>
        <div className="mt-1 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1">
          <span className="hidden sm:inline">Depth</span>
          <select
            value={answerDepth}
            onChange={(event) => onAnswerDepthChange(event.target.value as AnswerDepth)}
            className="max-w-28 rounded-md border-0 bg-transparent py-1 pr-1 text-xs text-zinc-600 outline-none hover:text-zinc-950 sm:max-w-none"
            aria-label="Answer depth"
          >
            {answerDepthOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <span className="hidden sm:inline">Knowledge</span>
          <select
            value={knowledgeMode}
            onChange={(event) => onKnowledgeModeChange(event.target.value as KnowledgeMode)}
            className="max-w-28 rounded-md border-0 bg-transparent py-1 pr-1 text-xs text-zinc-600 outline-none hover:text-zinc-950 sm:max-w-none"
            aria-label="Personal knowledge mode"
          >
            {knowledgeModeOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.id === "auto"
                  ? "Auto"
                  : option.id === "always"
                    ? "Always"
                    : "Off"}
              </option>
            ))}
          </select>
        </label>
        </div>
      </details>
      <button
        type="button"
        disabled={!isLoading && ((!value.trim() && !hasImages) || attachmentsBusy)}
        onClick={isLoading ? onStop : onSubmit}
        className="absolute bottom-3 right-3 flex size-9 items-center justify-center rounded-full bg-[#111111] text-white disabled:bg-zinc-300"
        aria-label={isLoading ? "Stop generation" : "Send"}
        data-testid={isLoading ? "stop-generation" : "send-message"}
      >
        {isLoading ? (
          <>
            <Loader2 size={14} className="absolute animate-spin opacity-40" />
            <Square size={12} fill="currentColor" />
          </>
        ) : (
          <Send size={16} />
        )}
      </button>
    </div>
  );
});
