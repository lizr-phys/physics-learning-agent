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
    <div className="mx-auto flex min-h-[56dvh] max-w-2xl flex-col items-center justify-center px-5 py-8 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">What are you working on?</h1>
      <p className="mt-3 text-sm leading-6 text-zinc-500">Ask a question or attach a problem.</p>
      <details className="mt-6 w-full max-w-lg text-sm text-zinc-600">
        <summary className="mx-auto w-fit cursor-pointer rounded-lg px-3 py-2 hover:bg-zinc-50">Try an example</summary>
        <div className="mt-3 space-y-1 text-left">
          {recommendations.map(item => <button key={item.id} type="button" onClick={() => onPick(item.prompt)} className="w-full rounded-lg px-3 py-2 text-xs leading-5 hover:bg-zinc-100">{item.title}</button>)}
        <button
          type="button"
          onClick={() => setRecommendations(buildRecommendations())}
          className="mx-3 mt-2 inline-flex min-h-8 items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-950"
        >
          <RefreshCw size={13} />
          More examples
        </button>
        </div>
      </details>
    </div>
  );
}
