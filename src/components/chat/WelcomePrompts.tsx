"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { getStoredLearningProfile, getStoredSessions } from "@/lib/storage";
import { getPersonalizedRecommendations } from "@/lib/recommendations";
import type { RecommendationItem } from "@/data/recommendations";

type WelcomePromptsProps = {
  onPick: (prompt: string) => void;
};

function buildRecommendations() {
  return getPersonalizedRecommendations({
    type: "chat",
    count: 4,
    sessions: getStoredSessions(),
    profile: getStoredLearningProfile(),
  });
}

export function WelcomePrompts({ onPick }: WelcomePromptsProps) {
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRecommendations(buildRecommendations());
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="mx-auto flex min-h-[52vh] max-w-3xl flex-col justify-center px-4 py-10 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">Physics Learning Agent</h1>
      <div className="mt-3 flex items-center justify-center gap-3 text-sm text-zinc-500">
        <span>选择一个方向开始学习</span>
        <button
          type="button"
          onClick={() => setRecommendations(buildRecommendations())}
          className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
        >
          <RefreshCw size={13} />
          换一批
        </button>
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {recommendations.length ? (
          recommendations.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onPick(item.prompt)}
              className="rounded-xl border border-zinc-200 px-4 py-3 text-left text-sm leading-6 text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50"
            >
              {item.title}
            </button>
          ))
        ) : (
          <div className="col-span-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-500">
            正在生成推荐问题...
          </div>
        )}
      </div>
    </div>
  );
}
