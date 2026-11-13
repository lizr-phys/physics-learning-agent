"use client";

import { ArrowUpRight, RefreshCw } from "lucide-react";
import { useState } from "react";
import type { RecommendationItem } from "@/data/recommendations";

type WelcomePromptsProps = {
  onPick: (prompt: string) => void;
};

const examples = [
  { id: "intuition", title: "Build intuition", prompt: "Explain why boundary conditions matter for a particle in a box, with a physical picture and the key equations." },
  { id: "derivation", title: "Walk through a derivation", prompt: "Derive the period of a small-angle pendulum step by step. State the assumptions." },
  { id: "check", title: "Check my reasoning", prompt: "I think a magnetic field can change the kinetic energy of a charged particle. Where does this reasoning go wrong?" },
];

export function WelcomePrompts({ onPick }: WelcomePromptsProps) {
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function moreExamples() {
    setLoading(true);
    setError("");
    try {
      const [{ getPersonalizedRecommendations }, { getStoredSessions, getStoredLearningProfile }] = await Promise.all([
        import("@/lib/recommendations"), import("@/lib/storage"),
      ]);
      setRecommendations(getPersonalizedRecommendations({
        type: "chat", count: 3, sessions: getStoredSessions(), profile: getStoredLearningProfile(),
      }));
    } catch {
      setError("More examples are unavailable. You can still use the examples above.");
    } finally { setLoading(false); }
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-8 sm:px-12 sm:py-12">
      <div className="max-w-xl">
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">What are you working on?</h1>
        <p className="mt-3 max-w-md text-base leading-7 text-zinc-600">Ask a physics question, work through a derivation, or attach a photo of a problem.</p>
        <div className="mt-6 flex items-center justify-between gap-3 border-b border-zinc-200">
          <h2 className="text-sm font-medium text-zinc-800">Try an example</h2>
          <button type="button" disabled={loading} onClick={() => void moreExamples()} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-study-700 hover:bg-study-50 disabled:opacity-50">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            More examples
          </button>
        </div>
        <ul className="divide-y divide-zinc-200">
          {(recommendations.length ? recommendations : examples).map(item => (
            <li key={item.id}>
              <button type="button" onClick={() => onPick(item.prompt)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm font-medium text-zinc-800 hover:bg-study-50 hover:text-study-800">
                <span>{item.title}</span>
                <ArrowUpRight size={16} aria-hidden="true" className="text-study-700" />
              </button>
            </li>
          ))}
        </ul>
        {error ? <p role="status" className="mt-2 text-sm text-zinc-600">{error}</p> : null}
      </div>
    </section>
  );
}
