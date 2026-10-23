import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    coverage: {
      include: ["lib/**/*.ts"],
      exclude: ["lib/anchors/**", "lib/bills/**"],
    },
  },
});
