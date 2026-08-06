import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig.json uses jsx: "preserve" for Next.js, which esbuild cannot run.
  esbuild: { jsx: "automatic" },
  test: {
    // UI test files opt into jsdom with a per-file `@vitest-environment` docblock.
    environment: "node",
    // Enables React Testing Library's automatic cleanup between tests.
    globals: true,
    // e2e/ holds Playwright specs (npm run test:e2e), not Vitest suites.
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
  },
});
