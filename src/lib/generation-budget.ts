/** Single-process pilot admission control. Daily default-key output pools reset at 00:00 UTC. */
type Environment = Record<string, string | undefined>;
type DailyPool = { global: number; users: Map<string, number>; active: number };
export type GenerationLease = { release: (usage?: { outputTokens?: number }) => void };
export class GenerationBudgetError extends Error {
  constructor(message: string, public code: string, public status: number, public retryAfterSeconds?: number) {
    super(message);
    this.name = "GenerationBudgetError";
  }
}
export type GenerationAdmission = { serverDefault: boolean; reservedOutputTokens: number; now?: number };

function positiveLimit(environment: Environment, name: string, fallback: number, maximum: number) {
  const raw = environment[name];
  if (raw === undefined || raw === "") return fallback;
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) < 1 || Number(raw) > maximum) {
    throw new GenerationBudgetError(`Invalid ${name} configuration. Set a positive integer within the supported range.`, "GENERATION_CONFIG_INVALID", 503);
  }
  return Number(raw);
}

function limits(environment: Environment) {
  const enabled = environment.PLA_GENERATION_ENABLED?.trim().toLowerCase();
  if (enabled === "false" || enabled === "0") throw new GenerationBudgetError("Model generation is temporarily disabled.", "GENERATION_DISABLED", 503);
  if (enabled && enabled !== "true" && enabled !== "1") throw new GenerationBudgetError("Invalid PLA_GENERATION_ENABLED configuration.", "GENERATION_CONFIG_INVALID", 503);
  return {
    userConcurrent: positiveLimit(environment, "PLA_GENERATION_MAX_CONCURRENT_PER_USER", 2, 256),
    globalConcurrent: positiveLimit(environment, "PLA_GENERATION_MAX_CONCURRENT_GLOBAL", 8, 256),
    userDaily: positiveLimit(environment, "PLA_GENERATION_DAILY_OUTPUT_TOKENS_PER_USER", 100_000, 1_000_000_000),
    globalDaily: positiveLimit(environment, "PLA_GENERATION_DAILY_OUTPUT_TOKENS_GLOBAL", 500_000, 1_000_000_000),
  };
}

export function createGenerationBudgetManager(readEnvironment: () => Environment = () => process.env) {
  let activeGlobal = 0;
  const activeUsers = new Map<string, number>();
  const days = new Map<number, DailyPool>();
  const dayLength = 24 * 60 * 60 * 1000;
  function acquire(ownerKey: string, admission: GenerationAdmission): GenerationLease {
    const config = limits(readEnvironment());
    if (!ownerKey || !Number.isSafeInteger(admission.reservedOutputTokens) || admission.reservedOutputTokens <= 0 || admission.reservedOutputTokens > 1_000_000) {
      throw new GenerationBudgetError("A valid owner and bounded output reservation are required.", "GENERATION_ADMISSION_INVALID", 400);
    }
    const now = admission.now ?? Date.now();
    if (!Number.isFinite(now) || now < 0) throw new GenerationBudgetError("The generation budget clock is invalid.", "GENERATION_ADMISSION_INVALID", 400);
    if ((activeUsers.get(ownerKey) ?? 0) >= config.userConcurrent) {
      throw new GenerationBudgetError("Your account already has the maximum number of active generations. Stop one or wait for it to finish.", "GENERATION_USER_BUSY", 429, 5);
    }
    if (activeGlobal >= config.globalConcurrent) {
      throw new GenerationBudgetError("All generation slots are busy. Please try again shortly.", "GENERATION_GLOBAL_BUSY", 429, 5);
    }
    const day = Math.floor(now / dayLength);
    for (const [previousDay, pool] of days) if (previousDay !== day && pool.active === 0) days.delete(previousDay);
    const pool = days.get(day) ?? { global: 0, users: new Map<string, number>(), active: 0 };
    const reserved = admission.serverDefault ? admission.reservedOutputTokens : 0;
    const retryAfterSeconds = Math.max(1, Math.ceil(((day + 1) * dayLength - now) / 1000));
    if (reserved && (pool.users.get(ownerKey) ?? 0) + reserved > config.userDaily) {
      throw new GenerationBudgetError("Your daily server-model output budget is exhausted. Try after the daily reset or use your own provider key.", "GENERATION_USER_DAILY_LIMIT", 429, retryAfterSeconds);
    }
    if (reserved && pool.global + reserved > config.globalDaily) {
      throw new GenerationBudgetError("The shared daily server-model output budget is exhausted. Try after the daily reset or use your own provider key.", "GENERATION_GLOBAL_DAILY_LIMIT", 429, retryAfterSeconds);
    }
    activeGlobal++;
    activeUsers.set(ownerKey, (activeUsers.get(ownerKey) ?? 0) + 1);
    if (reserved) {
      pool.global += reserved;
      pool.users.set(ownerKey, (pool.users.get(ownerKey) ?? 0) + reserved);
      pool.active++;
      days.set(day, pool);
    }
    let released = false;
    return { release(usage) {
      if (released) return;
      released = true;
      activeGlobal = Math.max(0, activeGlobal - 1);
      const remaining = Math.max(0, (activeUsers.get(ownerKey) ?? 0) - 1);
      if (remaining) activeUsers.set(ownerKey, remaining); else activeUsers.delete(ownerKey);
      if (reserved) {
        pool.active = Math.max(0, pool.active - 1);
        const outputTokens = usage?.outputTokens;
        // Missing usage keeps the reservation spent, including cancelled or interrupted calls.
        const actual = typeof outputTokens === "number" && Number.isFinite(outputTokens) && outputTokens >= 0 ? Math.ceil(outputTokens) : reserved;
        pool.global = Math.max(0, pool.global + actual - reserved);
        pool.users.set(ownerKey, Math.max(0, (pool.users.get(ownerKey) ?? 0) + actual - reserved));
      }
    } };
  }
  return { acquire };
}

const generationBudget = createGenerationBudgetManager();
export const acquireGenerationLease = generationBudget.acquire;
