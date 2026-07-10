"use client";

import { useEffect, useRef } from "react";

import {
  applyClientUserDataSnapshot,
  collectClientUserDataSnapshot,
  type ClientUserDataSnapshot,
} from "@/lib/user-data-client";

type AuthResponse = {
  user: {
    id: string;
    email: string;
    name: string;
    createdAt: number;
  } | null;
};

type UserDataResponse = {
  data: ClientUserDataSnapshot;
};

type UserDataSaveResponse = {
  ok: true;
  updatedAt: number;
};

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

export function UserDataSync() {
  const userIdRef = useRef<string | null>(null);
  const suppressEventsRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);

  useEffect(() => {
    async function saveSnapshot() {
      if (!userIdRef.current || suppressEventsRef.current) {
        return;
      }

      if (isSavingRef.current) {
        pendingSaveRef.current = true;
        return;
      }

      isSavingRef.current = true;

      try {
        await readJson<UserDataSaveResponse>(
          await fetch("/api/user-data", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(collectClientUserDataSnapshot()),
          }),
        );
      } catch {
        pendingSaveRef.current = true;

        if (!retryTimerRef.current && userIdRef.current) {
          retryTimerRef.current = window.setTimeout(() => {
            retryTimerRef.current = null;
            pendingSaveRef.current = false;
            scheduleSave();
          }, 5000);
        }
      } finally {
        isSavingRef.current = false;

        if (pendingSaveRef.current && !retryTimerRef.current) {
          pendingSaveRef.current = false;
          scheduleSave();
        }
      }
    }

    function scheduleSave() {
      if (!userIdRef.current || suppressEventsRef.current) {
        return;
      }

      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = window.setTimeout(() => {
        void saveSnapshot();
      }, 900);
    }

    async function bootstrap() {
      let auth: AuthResponse;

      try {
        auth = await readJson<AuthResponse>(
          await fetch("/api/auth/me", { cache: "no-store" }),
        );
      } catch {
        userIdRef.current = null;
        return;
      }

      userIdRef.current = auth.user?.id ?? null;

      if (!auth.user) {
        return;
      }

      try {
        const remote = await readJson<UserDataResponse>(
          await fetch("/api/user-data", { cache: "no-store" }),
        );

        suppressEventsRef.current = true;
        applyClientUserDataSnapshot(remote.data);
        suppressEventsRef.current = false;
        await saveSnapshot();
      } catch {
        suppressEventsRef.current = false;

        if (!retryTimerRef.current) {
          retryTimerRef.current = window.setTimeout(() => {
            retryTimerRef.current = null;
            void bootstrap();
          }, 5000);
        }
      }
    }

    function handleAuthChanged() {
      pendingSaveRef.current = false;
      void bootstrap();
    }

    function handleBeforeUnload() {
      if (!userIdRef.current || suppressEventsRef.current) {
        return;
      }

      const body = JSON.stringify(collectClientUserDataSnapshot());
      navigator.sendBeacon?.("/api/user-data", new Blob([body], { type: "application/json" }));
    }

    void bootstrap();
    window.addEventListener("pla:user-data-changed", scheduleSave);
    window.addEventListener("pla:sessions-changed", scheduleSave);
    window.addEventListener("pla:active-session-changed", scheduleSave);
    window.addEventListener("pla:practice-history-changed", scheduleSave);
    window.addEventListener("pla:auth-changed", handleAuthChanged);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
      }

      window.removeEventListener("pla:user-data-changed", scheduleSave);
      window.removeEventListener("pla:sessions-changed", scheduleSave);
      window.removeEventListener("pla:active-session-changed", scheduleSave);
      window.removeEventListener("pla:practice-history-changed", scheduleSave);
      window.removeEventListener("pla:auth-changed", handleAuthChanged);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  return null;
}
