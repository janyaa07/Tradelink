import os from "node:os";
import path from "node:path";
import { defineConfig } from "@playwright/test";

// Settings for scripts/capture-docs-screenshots.ts. The demo accounts' password comes from E2E_PASSWORD in .env.local.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: E2E_PASSWORD must come from the environment instead.
}

export default defineConfig({
  testDir: ".",
  testMatch: "capture-docs-screenshots.ts",
  // Outside the project, so a synced folder (such as OneDrive) cannot lock it.
  outputDir: path.join(os.tmpdir(), "tradelink-docs-capture"),
  timeout: 15 * 60_000,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.DOCS_BASE_URL ?? "http://localhost:3000",
    locale: "en-SG",
    timezoneId: "Asia/Singapore",
    browserName: "chromium",
    actionTimeout: 10_000,
    navigationTimeout: 45_000,
  },
});
