import { defineConfig, devices } from "@playwright/test";

const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: isCi ? 1 : 0,
  // A second live Chromium WebGL context can starve requestAnimationFrame and
  // skip semantic machine phases on both hosted and software-rendered local
  // environments. Visual correctness is more important than parallel speed.
  workers: 1,
  // Stop an unhealthy renderer after its first retried failure. This preserves
  // the full suite on green runs while keeping the first trace and screenshot
  // legible instead of creating a long cascade of secondary timeouts.
  maxFailures: isCi ? 1 : undefined,
  reporter: isCi ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bun run preview",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});
