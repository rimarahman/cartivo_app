// Captures drawer screenshots from the local storefront harness for the readiness report.
// Run: node tests/e2e/harness/server.mjs (separately), then node tests/e2e/evidence/capture.mjs
import { chromium, devices } from "@playwright/test";

const BASE = "http://localhost:4599";
const OUT = "tests/e2e/evidence/screenshots";
const shots = [
  ["everything", "desktop", devices["Desktop Chrome"]],
  ["everything", "mobile", devices["Pixel 7"]],
  ["addonNoPriceLabel", "desktop", devices["Desktop Chrome"]],
];
const browser = await chromium.launch({ channel: "chrome" });
for (const [scenario, name, device] of shots) {
  const ctx = await browser.newContext({ ...device, baseURL: BASE });
  const page = await ctx.newPage();
  await page.goto(`/__setup?scenario=${scenario}&to=${encodeURIComponent("/products/shirt")}`);
  await page.waitForFunction(() => window.Cartivo?.__loaded);
  await page.getByTestId("add-to-cart").click();
  await page.locator(".ck-root.ck-open").waitFor({ state: "attached" });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${scenario}-${name}.png` });
  await ctx.close();
}
await browser.close();
