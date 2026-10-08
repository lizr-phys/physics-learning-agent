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
    count: 3,
    sessions: getStoredSessions(),
    profile: getStoredLearningProfile(),
  });
}

export function WelcomePrompts({ onPick }: WelcomePromptsProps) {
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setRecommendations(buildRecommendations());
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="mx-auto flex min-h-[42vh] max-w-3xl flex-col justify-center px-4 py-8 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">What would you like to understand?</h1>
      <div className="mt-3 flex items-center justify-center gap-3 text-sm text-zinc-500">
        <span>Ask, attach a problem, or choose a topic.</span>
        <button
          type="button"
          onClick={() => setRecommendations(buildRecommendations())}
          className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {recommendations.length ? (
          recommendations.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onPick(item.prompt)}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-left text-xs leading-5 text-zinc-600 hover:bg-zinc-50"
            >
              {item.title}
            </button>
          ))
        ) : (
          <div className="col-span-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-500">
            Loading recommendations...
          </div>
        )}
      </div>
    </div>
  );
}
