import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Bound parallel parser and graph imports on developer machines and CI.
    maxWorkers: 4,
    include: ["src/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
