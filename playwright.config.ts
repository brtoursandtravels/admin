import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5174/admin/",
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command:
        "npm --prefix ../tours_and_travels_api run build && npm --prefix ../tours_and_travels_api run test:e2e:seed && npm --prefix ../tours_and_travels_api run start:test",
      url: "http://127.0.0.1:4100/api/v1/health",
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --mode test --port 5174",
      url: "http://localhost:5174/admin/login",
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
