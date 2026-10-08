"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { dismissOnboarding, isOnboardingDismissed } from "@/lib/preferences";

export function FirstUseGuide() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(!isOnboardingDismissed());
    }, 0);

    function reopen() {
      setVisible(true);
    }

    window.addEventListener("pla:show-onboarding", reopen);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pla:show-onboarding", reopen);
    };
  }, []);

  if (!visible) {
    return null;
  }

  function close() {
    dismissOnboarding();
    setVisible(false);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-5">
      <div className="relative border-b border-zinc-100 py-3 pr-10">
        <button
          type="button"
          onClick={close}
          className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-950"
          aria-label="Close guide"
        >
          <X size={15} />
        </button>
        <p className="text-xs text-zinc-500">Paste a screenshot or attach a photo to ask about diagrams and handwritten work.</p>
      </div>
    </div>
  );
}
