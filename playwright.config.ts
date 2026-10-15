import { defineConfig, devices } from "@playwright/test";

// Storefront specs run against the local storefront harness (tests/e2e/harness), which serves the real theme
// extension and prices carts with the real discount Function. Server specs need no browser.
const HARNESS = "http://localhost:4599";
const storefront = "storefront/**/*.spec.ts";
// PW_CHROMIUM_CHANNEL=chrome|msedge runs the Chromium projects on an installed browser instead of the bundled one.
const channel = process.env.PW_CHROMIUM_CHANNEL ? { channel: process.env.PW_CHROMIUM_CHANNEL } : {};

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./tests/e2e/.results",
  fullyParallel: true,
  retries: 1, // a test that only passes on retry is reported as flaky, never as passed
  reporter: [["list"], ["html", { outputFolder: "tests/e2e/.report", open: "never" }], ["json", { outputFile: "tests/e2e/.results/results.json" }]],
  use: {
    baseURL: HARNESS,
    screenshot: "only-on-failure",
    video: process.env.PW_NO_VIDEO ? "off" : "retain-on-failure", // needs the ffmpeg download
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node tests/e2e/harness/server.mjs",
      url: `${HARNESS}/__setup`,
      reuseExistingServer: !process.env.CI,
      stdout: "ignore",
    },
    // The built app (run `npm run build` first) with throwaway credentials and the isolated dev database only.
    ...(process.env.SKIP_APP_SERVER
      ? []
      : [{ command: "node tests/e2e/server/start-app.mjs", url: "http://localhost:4600/healthz", reuseExistingServer: false, stdout: "ignore" as const }]),
  ],
  projects: [
    { name: "chromium-desktop", testMatch: storefront, use: { ...devices["Desktop Chrome"], ...channel } },
    { name: "firefox-desktop", testMatch: storefront, use: { ...devices["Desktop Firefox"] } },
    { name: "webkit-desktop", testMatch: storefront, use: { ...devices["Desktop Safari"] } },
    { name: "mobile-chrome", testMatch: storefront, use: { ...devices["Pixel 7"], ...channel } },
    { name: "mobile-safari", testMatch: storefront, use: { ...devices["iPhone 14"] } },
    { name: "tablet", testMatch: storefront, use: { ...devices["iPad (gen 7)"] } },
    { name: "server", testMatch: "server/**/*.spec.ts", fullyParallel: false },
    // Real development store (tests/e2e/live/README.md): only when started by hand with CARTIVO_LIVE_STORE set.
    ...(process.env.CARTIVO_LIVE_STORE
      ? [{
          name: "live",
          testMatch: "live/**/*.spec.ts",
          retries: 0,
          use: { ...devices["Desktop Chrome"], channel: "chrome", baseURL: `https://${process.env.CARTIVO_LIVE_STORE}`, screenshot: "on" as const, trace: "on" as const, video: "off" as const },
        }]
      : []),
  ],
});
