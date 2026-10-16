"use client";

import { KeyboardEvent, memo, useCallback, useEffect, useRef,type ReactNode } from "react";
import { Loader2, Send, SlidersHorizontal, Square } from "lucide-react";
import { Popover } from "@/components/common/Popover";

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
  renderAttachmentControls?: (actions: ReactNode) => ReactNode;
  hasImages?: boolean;
  attachmentsBusy?: boolean;
  optionsContent?: ReactNode;
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
  renderAttachmentControls,
  hasImages=false,
  attachmentsBusy=false,
  optionsContent,
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

  const actions = (
    <>
      <Popover label="Chat options" trigger={<><SlidersHorizontal size={16} /><span className="composer-options-label">Options</span></>} side="top" anchorToParent triggerClassName="flex h-11 items-center gap-1.5 rounded-lg px-2 text-sm leading-5 text-zinc-600 hover:bg-zinc-100" panelClassName="w-80">
        <div className="space-y-4">
        <label className="block space-y-1.5 text-xs text-zinc-600">
          <span>Answer depth</span>
          <select
            value={answerDepth}
            onChange={(event) => onAnswerDepthChange(event.target.value as AnswerDepth)}
            className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-950"
            aria-label="Answer depth"
          >
            {answerDepthOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5 text-xs text-zinc-600">
          <span>Personal knowledge</span>
          <select
            value={knowledgeMode}
            onChange={(event) => onKnowledgeModeChange(event.target.value as KnowledgeMode)}
            className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-950"
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
        {optionsContent}
        </div>
      </Popover>
      <span className="min-w-0 flex-1" aria-hidden="true" />
      <button
        type="button"
        disabled={!isLoading && ((!value.trim() && !hasImages) || attachmentsBusy)}
        onClick={isLoading ? onStop : onSubmit}
        className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-white hover:bg-zinc-800 disabled:bg-zinc-300"
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
    </>
  );

  return (
    <div className="chat-composer relative space-y-2 rounded-2xl border border-zinc-300 bg-white p-3 focus-within:border-zinc-500">
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
        className="block max-h-36 min-h-12 w-full resize-none overflow-y-auto bg-transparent px-2 pb-2 text-base leading-7 text-zinc-950 outline-none md:max-h-[180px]"
        data-testid="chat-input"
      />
      {renderAttachmentControls ? renderAttachmentControls(actions) : <div className="relative flex min-h-11 items-center gap-1">{actions}</div>}
    </div>
  );
});
