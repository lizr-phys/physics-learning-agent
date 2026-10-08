import { test as base } from "@playwright/test";
export { expect } from "@playwright/test";
export type { Locator, Page } from "@playwright/test";

// Synthetic clients have independent rate-limit buckets, as real testers do.
// Application rate limits stay enabled; only test request identities differ.
export const test = base.extend({
  context: async ({ context }, provideContext, testInfo) => {
    let hash = 0;
    for (const character of `${testInfo.project.name}:${testInfo.titlePath.join(":")}`) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    await context.setExtraHTTPHeaders({ "x-forwarded-for": `198.18.${(hash >>> 8) % 254 + 1}.${hash % 254 + 1}` });
    await provideContext(context);
  },
});
