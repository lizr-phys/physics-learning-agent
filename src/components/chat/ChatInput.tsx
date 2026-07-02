"use client";

import { KeyboardEvent, memo, useCallback, useEffect, useRef } from "react";
import { Loader2, Send, Square } from "lucide-react";

import { answerDepthOptions, type AnswerDepth } from "@/types/learning";

type ChatInputProps = {
  value: string;
  isLoading: boolean;
  answerDepth: AnswerDepth;
  onChange: (value: string) => void;
  onAnswerDepthChange: (value: AnswerDepth) => void;
  onSubmit: () => void;
  onStop: () => void;
};

export const ChatInput = memo(function ChatInput({
  value,
  isLoading,
  answerDepth,
  onChange,
  onAnswerDepthChange,
  onSubmit,
  onStop,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  }

  return (
    <div className="relative rounded-[24px] border border-[#dcdcdc] bg-white px-4 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.06)] focus-within:border-[#999]">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask a physics concept, derivation, or practice question..."
        rows={1}
        className="max-h-36 min-h-16 w-full resize-none overflow-y-auto bg-transparent pb-7 pr-12 text-sm leading-6 text-zinc-950 outline-none md:max-h-[180px]"
        data-testid="chat-input"
      />
      <label className="absolute bottom-3 left-4 flex items-center gap-2 text-xs text-zinc-500">
        <span className="hidden sm:inline">Depth</span>
        <select
          value={answerDepth}
          onChange={(event) => onAnswerDepthChange(event.target.value as AnswerDepth)}
          className="rounded-md border-0 bg-transparent py-1 pr-1 text-xs text-zinc-600 outline-none hover:text-zinc-950"
          aria-label="Answer depth"
        >
          {answerDepthOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={!isLoading && !value.trim()}
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
