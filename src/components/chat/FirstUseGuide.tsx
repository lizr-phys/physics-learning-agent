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
      <div className="relative rounded-xl border border-zinc-200 bg-zinc-50 p-4 pr-10">
        <button
          type="button"
          onClick={close}
          className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-950"
          aria-label="关闭使用引导"
        >
          <X size={15} />
        </button>
        <p className="text-sm font-medium text-zinc-950">直接提问，或使用左侧学习工具。</p>
        <p className="mt-1 text-xs leading-5 text-zinc-600">
          例如：解释 Green 函数的物理意义、生成 5 道谐振子练习题、梳理静电边值问题题型。
        </p>
      </div>
    </div>
  );
}
