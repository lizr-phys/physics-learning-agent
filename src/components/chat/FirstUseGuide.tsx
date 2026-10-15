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
    <details className="border-t border-zinc-200 pt-3 text-xs text-zinc-600">
      <summary className="cursor-pointer py-1">Quick guide</summary>
      <div className="relative mt-2 pr-8">
        <button
          type="button"
          onClick={close}
          className="absolute right-0 top-0 rounded p-1 text-zinc-500 hover:text-zinc-950"
          aria-label="Close guide"
        >
          <X size={15} />
        </button>
        <p className="leading-5">Ask a question, paste a screenshot, or use the image and camera controls. Enter sends; Shift + Enter starts a new line.</p>
      </div>
    </details>
  );
}
