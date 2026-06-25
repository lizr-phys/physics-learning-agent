"use client";

const lastErrorKey = "pla.api.lastError.v1";

export type StoredApiError = {
  message: string;
  status?: string;
  occurredAt: number;
  source?: "chat" | "practice" | "settings";
};

export function saveLastApiError(error: StoredApiError) {
  window.localStorage.setItem(lastErrorKey, JSON.stringify(error));
}

export function clearLastApiError() {
  window.localStorage.removeItem(lastErrorKey);
}

export function getLastApiError(): StoredApiError | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(lastErrorKey);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as StoredApiError & { at?: number };
    return {
      ...parsed,
      occurredAt: parsed.occurredAt ?? parsed.at ?? Date.now(),
    };
  } catch {
    return null;
  }
}
