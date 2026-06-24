"use client";

import { KeyboardEvent, memo, useCallback, useEffect, useRef } from "react";
import { Loader2, Send, Square } from "lucide-react";

type ChatInputProps = {
  value: string;
  isLoading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
};

export const ChatInput = memo(function ChatInput({
  value,
  isLoading,
  onChange,
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
        placeholder="输入物理概念、题型或推导问题..."
        rows={1}
        className="max-h-36 min-h-12 w-full resize-none overflow-y-auto bg-transparent pr-12 text-sm leading-6 text-zinc-950 outline-none md:max-h-[180px]"
        data-testid="chat-input"
      />
      <button
        type="button"
        disabled={!isLoading && !value.trim()}
        onClick={isLoading ? onStop : onSubmit}
        className="absolute bottom-3 right-3 flex size-9 items-center justify-center rounded-full bg-[#111111] text-white disabled:bg-zinc-300"
        aria-label={isLoading ? "停止生成" : "发送"}
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
