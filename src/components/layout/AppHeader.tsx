import Link from "next/link";
import { BookOpen, Bot, Layers, PenLine, Route, Shapes } from "lucide-react";

const navItems = [
  { href: "/chat", label: "学习 Agent", icon: Bot },
  { href: "/map", label: "知识图谱", icon: Route },
  { href: "/practice", label: "练习题", icon: PenLine },
  { href: "/types", label: "题型梳理", icon: Shapes },
  { href: "/review", label: "板块复习", icon: Layers },
];

export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
          <BookOpen size={18} strokeWidth={1.8} />
          <span>Physics Learning Agent</span>
        </Link>
        <nav className="flex gap-1 overflow-x-auto text-sm text-zinc-600">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 hover:bg-zinc-100 hover:text-zinc-950"
              >
                <Icon size={15} strokeWidth={1.8} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
