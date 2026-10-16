// Before recording: deactivates (never deletes) the dev store's older test campaigns through the app's own
// Campaigns page, so the demo shows only the campaigns it creates. Reversible from the same page (Activate),
// and the full config is in the dev-backup taken first (source/capture/dev-backup.mjs).
import { attach, APP_URL, appFrame } from "./browser.mjs";

const { page, close } = await attach({ width: 1600, height: 900, scale: 1 });
try {
  await page.goto(`${APP_URL}/campaigns`, { waitUntil: "domcontentloaded" });
  const { frame } = await appFrame(page);
  await frame.waitForSelector("s-table", { timeout: 60000 });
  await page.waitForTimeout(5000); // hydration
  for (let i = 0; i < 20; i++) {
    const btn = frame.getByRole("button", { name: "Deactivate", exact: true });
    const n = await btn.count();
    if (!n) break;
    await btn.first().click();
    await frame.waitForFunction((n) => {
      const all = [...document.querySelectorAll("s-button")].filter((b) => b.textContent.trim() === "Deactivate");
      return all.length < n;
    }, n, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(800);
    console.log("active left:", n - 1);
  }
} finally { await close(); }
