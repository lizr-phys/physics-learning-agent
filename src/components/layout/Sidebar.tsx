"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  Database,
  FileText,
  Layers,
  MoreHorizontal,
  PenLine,
  Plus,
  Route,
  Settings,
  Shapes,
  Trash2,
  Pencil,
} from "lucide-react";
import { KeyboardEvent, useEffect, useMemo, useState } from "react";

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
  { href: "/map", label: "知识点导览", icon: Route },
  { href: "/practice", label: "练习题生成", icon: PenLine },
  { href: "/types", label: "题型梳理", icon: Shapes },
  { href: "/review", label: "板块复习", icon: Layers },
  { href: "/settings/api", label: "API 设置", icon: Settings },
  { href: "/settings/api#rag", label: "RAG 知识库", icon: Database, muted: true },
];

type SessionGroupProps = {
  title: string;
  sessions: StoredChatSession[];
  activeId: string;
  editingId: string;
  editingTitle: string;
  menuSessionId: string;
  onSelect: (session: StoredChatSession) => void;
  onStartRename: (session: StoredChatSession) => void;
  onRenameTitleChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDelete: (session: StoredChatSession) => void;
  onToggleMenu: (sessionId: string) => void;
};

function SessionGroup({
  title,
  sessions,
  activeId,
  editingId,
  editingTitle,
  menuSessionId,
  onSelect,
  onStartRename,
  onRenameTitleChange,
  onCommitRename,
  onCancelRename,
  onDelete,
  onToggleMenu,
}: SessionGroupProps) {
  if (!sessions.length) {
    return null;
  }

  function handleRenameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
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
      <p className="px-2 pt-3 text-xs font-medium text-zinc-400">{title}</p>
      {sessions.map((session) => {
        const active = session.id === activeId;
        const editing = session.id === editingId;
        const menuOpen = session.id === menuSessionId;

        return (
          <div key={session.id} className="group relative">
            <div
              className={
                active
                  ? "flex items-center gap-1 rounded-lg bg-zinc-200 px-2 py-1.5 text-zinc-950"
                  : "flex items-center gap-1 rounded-lg px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
              }
            >
              {editing ? (
                <input
                  autoFocus
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
                  className="min-w-0 flex-1 truncate py-1 text-left text-sm"
                  data-testid={`session-${session.id}`}
                >
                  {session.title}
                </button>
              )}

              {!editing ? (
                <button
                  type="button"
                  aria-label="会话菜单"
                  onClick={() => onToggleMenu(session.id)}
                  className={
                    menuOpen
                      ? "flex size-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-700"
                      : "flex size-7 shrink-0 items-center justify-center rounded-md text-zinc-500 opacity-0 hover:bg-zinc-100 group-hover:opacity-100"
                  }
                >
                  <MoreHorizontal size={16} />
                </button>
              ) : null}
            </div>

            {menuOpen ? (
              <div className="absolute right-1 top-9 z-50 w-32 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => onStartRename(session)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100"
                >
                  <Pencil size={14} />
                  重命名
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(session)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100"
                >
                  <Trash2 size={14} />
                  删除
                </button>
              </div>
            ) : null}
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
  const [menuSessionId, setMenuSessionId] = useState("");
  const grouped = useMemo(() => groupSessionsByTime(sessions), [sessions]);

  useEffect(() => {
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
  }, []);

  function openSession(session: StoredChatSession) {
    setActiveSessionId(session.id);
    window.dispatchEvent(new CustomEvent("pla:load-session", { detail: session.id }));
    if (pathname !== "/chat" && pathname !== "/") {
      router.push("/chat");
    }
    setMenuSessionId("");
    onNavigate?.();
  }

  function focusChatInput() {
    window.setTimeout(() => {
      window.dispatchEvent(new Event("pla:focus-chat-input"));
    }, 80);
  }

  function newSession() {
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
    setMenuSessionId("");
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
    setMenuSessionId("");

    if (!window.confirm("确定删除这个会话吗？此操作无法撤销。")) {
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

  function toggleMenu(sessionId: string) {
    setEditingId("");
    setMenuSessionId((current) => (current === sessionId ? "" : sessionId));
  }

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-zinc-200 bg-[#f7f7f8]">
      <div className="border-b border-zinc-200 p-4">
        <Link href="/chat" onClick={onNavigate} className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
          <BookOpen size={18} />
          Physics Learning Agent
        </Link>
        <p className="mt-1 text-xs text-zinc-500">大学物理学习助手</p>
        <button
          type="button"
          onClick={newSession}
          className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#111111] px-3 text-sm font-medium text-white hover:bg-zinc-800"
          data-testid="new-session"
        >
          <Plus size={16} />
          新建学习会话
        </button>
      </div>

      <nav className="space-y-1 border-b border-zinc-200 p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={
                active
                  ? "flex items-center gap-2 rounded-lg bg-zinc-200 px-3 py-2 text-sm text-zinc-950"
                  : "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
              }
            >
              <Icon size={16} />
              <span>{item.label}</span>
              {item.muted ? <span className="ml-auto text-xs text-zinc-400">预留</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="mb-2 flex items-center gap-2 px-2 text-xs font-medium text-zinc-500">
          <FileText size={14} />
          会话历史
        </div>
        {sessions.length ? (
          <>
            <SessionGroup
              title="今天"
              sessions={grouped.today}
              activeId={activeId}
              editingId={editingId}
              editingTitle={editingTitle}
              menuSessionId={menuSessionId}
              onSelect={openSession}
              onStartRename={startRename}
              onRenameTitleChange={setEditingTitle}
              onCommitRename={commitRename}
              onCancelRename={cancelRename}
              onDelete={deleteSession}
              onToggleMenu={toggleMenu}
            />
            <SessionGroup
              title="最近 7 天"
              sessions={grouped.recent}
              activeId={activeId}
              editingId={editingId}
              editingTitle={editingTitle}
              menuSessionId={menuSessionId}
              onSelect={openSession}
              onStartRename={startRename}
              onRenameTitleChange={setEditingTitle}
              onCommitRename={commitRename}
              onCancelRename={cancelRename}
              onDelete={deleteSession}
              onToggleMenu={toggleMenu}
            />
            <SessionGroup
              title="更早"
              sessions={grouped.older}
              activeId={activeId}
              editingId={editingId}
              editingTitle={editingTitle}
              menuSessionId={menuSessionId}
              onSelect={openSession}
              onStartRename={startRename}
              onRenameTitleChange={setEditingTitle}
              onCommitRename={commitRename}
              onCancelRename={cancelRename}
              onDelete={deleteSession}
              onToggleMenu={toggleMenu}
            />
          </>
        ) : (
          <p className="px-2 py-3 text-sm leading-6 text-zinc-500">
            暂无本地会话。点击“新建学习会话”或直接发送第一条问题后会自动保存。
          </p>
        )}
      </div>
    </aside>
  );
}
