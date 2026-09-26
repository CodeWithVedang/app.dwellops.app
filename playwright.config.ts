import { defineConfig } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.local" });

const PORT = 3200;
const TEST_DB = process.env.TEST_DATABASE_URL ?? "";

if (!TEST_DB.includes("_test")) throw new Error("E2E needs TEST_DATABASE_URL pointing at a *_test database.");

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Uses the locally installed Chrome; no Playwright browser download needed.
    channel: "chrome",
    trace: "retain-on-failure",
  },
  webServer: {
    // Production build against the test database.
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DATABASE_URL: TEST_DB, NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`, EMAIL_PROVIDER: "console" },
  },
});
