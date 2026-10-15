"use client";

import type { FormEvent, RefObject } from "react";
import { Loader2, Upload } from "lucide-react";
import { courseOptions } from "@/data/courses";
import type { CourseId } from "@/types/learning";

export function DocumentUploadForm({ inputRef, onSubmit, busy, course, onCourseChange, topic, onTopicChange, description, onDescriptionChange }: {
  inputRef: RefObject<HTMLInputElement | null>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  course: CourseId | "";
  onCourseChange: (course: CourseId | "") => void;
  topic: string;
  onTopicChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
}) {
  return <form onSubmit={onSubmit} className="space-y-5">
    <p className="text-xs leading-5 text-zinc-500">Add notes, a text-based PDF or an office document. Scanned questions can be added as photo problems.</p>
    <label className="block space-y-2 text-sm text-zinc-700">File
      <input ref={inputRef} type="file" required accept=".md,.markdown,.txt,.tex,.csv,.pdf,.docx,.pptx,.xlsx,.rtf,.odt,.odp,.ods" className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:text-zinc-950" />
    </label>
    <details className="text-sm text-zinc-600"><summary className="cursor-pointer py-1">Course, topic and description</summary><div className="mt-3 space-y-4">
      <label className="block space-y-1.5 text-xs">Course<select aria-label="Document course" value={course} onChange={event => onCourseChange(event.target.value as CourseId | "")} className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm"><option value="">Detect from the document</option>{courseOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
      <label className="block space-y-1.5 text-xs">Topic<input value={topic} onChange={event => onTopicChange(event.target.value)} placeholder="Optional chapter or topic" className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm" /></label>
      <label className="block space-y-1.5 text-xs">Description<textarea value={description} onChange={event => onDescriptionChange(event.target.value)} rows={3} className="w-full resize-y rounded-lg border border-zinc-300 px-3 py-2 text-sm" /></label>
    </div></details>
    <button type="submit" disabled={busy} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:bg-zinc-300">{busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}{busy ? "Uploading…" : "Upload and index"}</button>
  </form>;
}
