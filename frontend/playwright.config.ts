import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./e2e/tests",
  timeout: 30 * 1000,
  expect: { timeout: 5000 },
  reporter: "list",
  use: {
    baseURL,
    headless: true,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: "tablet",
      testMatch: /.*smoke-matrix\.spec\.ts/,
      use: {
        viewport: { width: 1024, height: 1366 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "mobile",
      testMatch: /.*smoke-matrix\.spec\.ts/,
      use: {
        ...devices["iPhone 12"],
      },
    },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 60 * 1000,
  },
});
