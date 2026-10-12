import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// The tests log in as the test user from .env.local (TEST_USER_EMAIL,
// TEST_USER_PASSWORD). The values stay in this process and are never printed.
// No .env.local (e.g. in CI): the variables must come from the environment.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const baseURL = "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  // The tests call the real OpenAI API and wait for real ingestion.
  // 90 s per test leaves room for a slow answer.
  timeout: 90_000,
  // One test at a time: all tests share one test user and its rate limit.
  workers: 1,
  fullyParallel: false,
  // On CI: no test.only by mistake, and one retry for network hiccups.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL,
    locale: "de-DE",
    // A click that cannot happen (element hidden) fails after 15 s with the
    // line number, instead of waiting for the test timeout.
    actionTimeout: 15_000,
    // On a failure: keep a trace to replay it with `npx playwright show-trace`.
    trace: "retain-on-failure",
  },
  projects: [
    // Logs in once and saves the session cookies for all other tests.
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Wide enough for the three-column layout (lg breakpoint).
        viewport: { width: 1440, height: 900 },
        storageState: "playwright/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
  // Starts the dev server, or uses the one that already runs on port 3000.
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
