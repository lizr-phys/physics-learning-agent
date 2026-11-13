"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Database,
  MoreHorizontal,
  PenLine,
  Plus,
  Route,
  Settings,
  Trash2,
  Pencil,
  MessageCircle,
} from "lucide-react";
import { KeyboardEvent, useEffect, useMemo, useState } from "react";
import { Popover } from "@/components/common/Popover";

import {
  compactEmptyManualSessions,
  createEmptySession,
  deleteStoredSession,
  getActiveSessionId,
  groupSessionsByTime,
  isEmptySession,
  renameStoredSession,
  setActiveSessionId,
  upsertStoredSession,
  type StoredChatSession,
} from "@/lib/storage";

type SidebarProps = {
  onNavigate?: () => void;
};

const navItems = [
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/practice", label: "Practice Problems", icon: PenLine },
  { href: "/map", label: "Knowledge Map", icon: Route },
  { href: "/knowledge-base", label: "Personal Knowledge", icon: Database },
];

type SessionGroupProps = {
  title: string;
  sessions: StoredChatSession[];
  activeId: string;
  editingId: string;
  editingTitle: string;
  onSelect: (session: StoredChatSession) => void;
  onStartRename: (session: StoredChatSession) => void;
  onRenameTitleChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDelete: (session: StoredChatSession) => void;
};

function SessionGroup({
  title,
  sessions,
  activeId,
  editingId,
  editingTitle,
  onSelect,
  onStartRename,
  onRenameTitleChange,
  onCommitRename,
  onCancelRename,
  onDelete,
}: SessionGroupProps) {
  if (!sessions.length) {
    return null;
  }

  function handleRenameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if (event.key === "Enter") {
      event.preventDefault();
      onCommitRename();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onCancelRename();
    }
  }

  return (
    <div className="space-y-1">
      <p className="px-3 pt-3 text-xs font-medium text-zinc-500">{title}</p>
      {sessions.map((session) => {
        const active = session.id === activeId;
        const editing = session.id === editingId;

        return (
          <div key={session.id} className="group relative">
            <div
              className={
                active
                  ? "flex items-center gap-1 rounded-lg bg-study-100 px-3 text-study-900"
                  : "flex items-center gap-1 rounded-lg px-3 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
              }
            >
              {editing ? (
                <input
                  autoFocus
                  aria-label="Conversation title"
                  maxLength={160}
                  value={editingTitle}
                  onChange={(event) => onRenameTitleChange(event.target.value)}
                  onBlur={onCommitRename}
                  onKeyDown={handleRenameKeyDown}
                  className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm outline-none focus:border-zinc-500"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(session)}
                  title={session.title}
                  aria-current={active ? "true" : undefined}
                  className="min-h-10 min-w-0 flex-1 truncate text-left text-sm"
                  data-testid={`session-${session.id}`}
                >
                  {session.title}
                </button>
              )}

              {!editing ? (
                <Popover label="Conversation menu" trigger={<MoreHorizontal size={16} />} side="top" align="end" closeOnAction
                  triggerClassName="flex size-10 shrink-0 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-200/70 aria-expanded:bg-zinc-200/70 md:size-8"
                  panelClassName="w-36 !p-1.5">
                  <button type="button" onClick={() => onStartRename(session)} className="flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-zinc-100">
                    <Pencil size={14} />Rename
                  </button>
                  <button type="button" onClick={() => onDelete(session)} className="flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-red-800 hover:bg-red-50">
                    <Trash2 size={14} />Delete
                  </button>
                </Popover>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sessions, setSessions] = useState<StoredChatSession[]>([]);
  const [activeId, setActiveIdState] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [query, setQuery] = useState("");
  const grouped = useMemo(() => {
    const text = query.trim().toLocaleLowerCase();
    return groupSessionsByTime(text ? sessions.filter(session => session.title.toLocaleLowerCase().includes(text)) : sessions);
  }, [sessions, query]);
  const isChat = pathname === "/chat" || pathname === "/";

  useEffect(() => {
    if (!isChat) return;
    function refresh() {
      const activeSessionId = getActiveSessionId();
      const nextSessions = compactEmptyManualSessions(activeSessionId);
      setSessions(nextSessions);
      setActiveIdState(activeSessionId);
    }

    refresh();
    window.addEventListener("pla:sessions-changed", refresh);
    window.addEventListener("pla:active-session-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("pla:sessions-changed", refresh);
      window.removeEventListener("pla:active-session-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [isChat]);

  function openSession(session: StoredChatSession) {
    setActiveSessionId(session.id);
    window.dispatchEvent(new CustomEvent("pla:load-session", { detail: session.id }));
    if (pathname !== "/chat" && pathname !== "/") {
      router.push("/chat");
    }
    onNavigate?.();
  }

  function focusChatInput() {
    window.setTimeout(() => {
      window.dispatchEvent(new Event("pla:focus-chat-input"));
    }, 80);
  }

  function newSession() {
    setQuery("");
    const currentSessions = compactEmptyManualSessions(activeId);
    const currentSession = currentSessions.find((session) => session.id === activeId);

    if (isEmptySession(currentSession)) {
      if (pathname !== "/chat" && pathname !== "/") {
        router.push("/chat");
      }
      focusChatInput();
      onNavigate?.();
      return;
    }

    const reusableEmptySession = currentSessions.find(isEmptySession);

    if (reusableEmptySession) {
      openSession(reusableEmptySession);
      focusChatInput();
      return;
    }

    const session = createEmptySession();
    upsertStoredSession(session);
    openSession(session);
    focusChatInput();
  }

  function startRename(session: StoredChatSession) {
    setEditingId(session.id);
    setEditingTitle(session.title);
  }

  function commitRename() {
    if (!editingId) {
      return;
    }

    const original = sessions.find((session) => session.id === editingId);
    const title = editingTitle.trim();

    if (original && title) {
      renameStoredSession(editingId, title);
    }

    setEditingId("");
    setEditingTitle("");
  }

  function cancelRename() {
    setEditingId("");
    setEditingTitle("");
  }

  function deleteSession(session: StoredChatSession) {
    if (!window.confirm("Delete this conversation? This action cannot be undone.")) {
      return;
    }

    window.dispatchEvent(new CustomEvent("pla:delete-session", { detail: session.id }));
    const remaining = deleteStoredSession(session.id);

    if (session.id !== activeId) {
      return;
    }

    const nextSession = remaining[0] ?? createEmptySession();

    if (!remaining[0]) {
      upsertStoredSession(nextSession);
    }

    openSession(nextSession);
  }

  return (
    <aside className="flex h-full w-[min(17rem,calc(100vw-3rem))] shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 md:w-56" aria-label="Workspace navigation">
      <div className={`px-4 pb-3 pt-5 ${onNavigate ? "pr-14" : ""}`}>
        <Link href="/chat" onClick={onNavigate} className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white">
            <Image src="/logo.png" alt="Physics Learning Agent logo" width={24} height={24} className="object-contain" />
          </span>
          <span className="leading-5">Physics Learning<br />Agent</span>
        </Link>
      </div>

      <nav className="space-y-1 px-3 py-3" aria-label="Workspaces">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href === "/chat" && isChat);
          return <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${active ? "bg-study-100 font-medium text-study-900" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"}`}><Icon size={16} /><span>{item.label}</span></Link>;
        })}
      </nav>
      {isChat ? <>
        <button
          type="button"
          onClick={newSession}
          className="mx-3 mb-4 mt-2 flex min-h-11 items-center gap-2.5 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-study-800 hover:bg-study-50"
          data-testid="new-session"
        >
          <Plus size={16} />
          New conversation
        </button>

      <div className="mb-2 space-y-2 px-3">
        <p className="px-3 text-xs font-medium text-zinc-600">Conversations</p>
        {sessions.length > 1 ? <label className="block">
          <span className="sr-only">Search conversations</span>
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search conversations"
            className="min-h-10 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs text-zinc-800" />
        </label> : null}
      </div>
      <div className="conversation-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {grouped.today.length || grouped.recent.length || grouped.older.length ? (
          <>
            <SessionGroup
              title="Today"
              sessions={grouped.today}
              activeId={activeId}
              editingId={editingId}
              editingTitle={editingTitle}
              onSelect={openSession}
              onStartRename={startRename}
              onRenameTitleChange={setEditingTitle}
              onCommitRename={commitRename}
              onCancelRename={cancelRename}
              onDelete={deleteSession}
            />
            <SessionGroup
              title="Last 7 days"
              sessions={grouped.recent}
              activeId={activeId}
              editingId={editingId}
              editingTitle={editingTitle}
              onSelect={openSession}
              onStartRename={startRename}
              onRenameTitleChange={setEditingTitle}
              onCommitRename={commitRename}
              onCancelRename={cancelRename}
              onDelete={deleteSession}
            />
            <SessionGroup
              title="Older"
              sessions={grouped.older}
              activeId={activeId}
              editingId={editingId}
              editingTitle={editingTitle}
              onSelect={openSession}
              onStartRename={startRename}
              onRenameTitleChange={setEditingTitle}
              onCommitRename={commitRename}
              onCancelRename={cancelRename}
              onDelete={deleteSession}
            />
          </>
        ) : (
          <p className="px-3 py-3 text-sm leading-6 text-zinc-500">
            {sessions.length ? "No matching conversations." : "Your conversations will appear here."}
          </p>
        )}
      </div>
      </> : <div className="flex-1" />}
      <div className="border-t border-zinc-200 p-3">
        <Link href="/settings/api" onClick={onNavigate} aria-current={pathname === "/settings/api" ? "page" : undefined} className={`flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${pathname === "/settings/api" ? "bg-zinc-200/70 font-medium text-zinc-950" : "text-zinc-600 hover:bg-zinc-100"}`}><Settings size={16} />API Settings</Link>
      </div>
    </aside>
  );
}
