import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Local settings such as E2E_PASSWORD live in .env.local, which is never committed.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: the settings come from the environment instead.
}

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

/** End-to-end tests (ADR 0018). Reuses the dev server on :3000 when one is running. */
export default defineConfig({
  testDir: "e2e",
  // Traces and screenshots go outside the repository, which may sit in a synced folder.
  outputDir: join(tmpdir(), "tradelink-ai-playwright"),
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  // The dev server compiles on first request; a few workers keep it responsive.
  workers: process.env.CI ? 2 : 4,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    locale: "en-SG",
    timezoneId: "Asia/Singapore",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: `${baseURL}/sign-in`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
