/** Render cadence is independent of durable checkpoints. Flush on stop/leave. */
export function createDraftCheckpoint<T>(save: (value: T) => void, isCurrent: () => boolean, intervalMs = 1000) {
  let latest: T | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function flush() {
    clearTimeout(timer); timer = undefined;
    if (latest !== undefined && isCurrent()) { const value = latest; latest = undefined; save(value); }
    else latest = undefined;
  }
  return {
    update(value: T) {
      latest = value;
      timer ??= setTimeout(flush, intervalMs);
    },
    flush,
    discard() { clearTimeout(timer); timer = undefined; latest = undefined; },
  };
}
