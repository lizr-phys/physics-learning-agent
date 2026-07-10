type LockTask<T> = () => Promise<T> | T;

const lockTails = new Map<string, Promise<void>>();

/**
 * Serializes in-process read-modify-write operations for a logical resource.
 * This protects the local JSON stores from lost updates in a single Node process.
 */
export async function withKeyedLock<T>(key: string, task: LockTask<T>): Promise<T> {
  const previous = lockTails.get(key) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => gate, () => gate);

  lockTails.set(key, tail);
  await previous.catch(() => undefined);

  try {
    return await task();
  } finally {
    release();

    if (lockTails.get(key) === tail) {
      lockTails.delete(key);
    }
  }
}
