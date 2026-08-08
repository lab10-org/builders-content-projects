import { defineConfig, devices } from '@playwright/test'

// E2E suite written by the `generate-tests` subagent and executed by `healer`
// (see .claude/skills/verify-implementation). Unit tests stay in Vitest.
export default defineConfig({
  testDir: './e2e',
  // A run writes into a shared temp directory and a shared LibSQL store, so
  // specs run one at a time.
  fullyParallel: false,
  workers: 1,
  // A retry would mask a flaky app; the healer needs the raw first result.
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e-results.json' }]],
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --port 3001',
    url: 'http://localhost:3001',
    reuseExistingServer: true,
    // A real run calls Instagram and OpenRouter; the first page load also has
    // to compile.
    timeout: 120_000,
  },
})
