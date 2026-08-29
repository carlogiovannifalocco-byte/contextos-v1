import { defineConfig, devices } from "@playwright/test";

const web = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173";
const api = process.env.CONTEXTOS_API_ORIGIN ?? "http://127.0.0.1:3001";
const webPort = new URL(web).port || "5173";
const apiPort = new URL(api).port || "3001";

export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: web,
    trace: "on-first-retry",
    locale: "en-US",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run dev:api",
      url: `${api}/api/health`,
      reuseExistingServer: true,
      timeout: 120_000,
      cwd: "..",
      env: { ...process.env, PORT: apiPort, NODE_ENV: process.env.NODE_ENV || "development" },
    },
    {
      command: "npm run dev:web",
      url: web,
      reuseExistingServer: true,
      timeout: 120_000,
      cwd: "..",
      env: {
        ...process.env,
        CONTEXTOS_API_ORIGIN: api,
        WEB_PORT: webPort,
      },
    },
  ],
});
