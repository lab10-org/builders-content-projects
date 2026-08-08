import { defaultExclude, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // UI suites opt into jsdom per file with `// @vitest-environment jsdom`.
    // e2e/ belongs to Playwright, driven by the verify-implementation loop —
    // Vitest must never try to run those specs.
    exclude: [...defaultExclude, 'e2e/**', 'docs/**'],
  },
  // Next needs jsx: "preserve", which esbuild cannot run, so transform JSX here.
  esbuild: { jsx: 'automatic' },
})
