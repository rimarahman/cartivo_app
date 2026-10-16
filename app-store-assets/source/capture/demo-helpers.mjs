// Helpers for the recorded review demo (real clicks in the real admin and storefront).
import { appFrame } from "./browser.mjs";

// Hides Shopify admin overlays that aren't part of the app and could show account details (Sidekick bar,
// dev previews pill, Dev Console). App UI is never touched.
export async function hideAdminOverlays(page) {
  await page.evaluate(() => {
    const hide = () => {
      for (const el of document.querySelectorAll("body *")) {
        if (el.children.length > 40) continue;
        const t = el.textContent || "";
        if (!/Work with Sidekick|dev previews|Dev Console|Clean dev preview/.test(t)) continue;
        // climb to the fixed-position container
        let n = el;
        while (n && n !== document.body && getComputedStyle(n).position !== "fixed") n = n.parentElement;
        if (!n || n === document.body || n.querySelector("iframe")) continue;
        const r = n.getBoundingClientRect();
        if (r.width * r.height > innerWidth * innerHeight * 0.4) continue; // never a page-sized container
        n.style.setProperty("display", "none", "important");
      }
    };
    hide();
    if (!window.__ckHide) window.__ckHide = setInterval(hide, 700);
  }).catch(() => {});
}

export async function frameReady(page) {
  const { frame } = await appFrame(page);
  await frame.waitForSelector("s-page", { timeout: 60000 });
  await page.waitForTimeout(3500); // hydration: handlers attach after the server-rendered markup
  return frame;
}

// Shopify's product picker (App Bridge resource picker, in the admin page): search, tick, Select.
export async function pickProduct(rec, page, frame, button, query, title) {
  for (let i = 0; i < 3; i++) {
    await rec.click(button, { pauseAfter: 2500 });
    if (await page.getByRole("dialog", { name: "Select products" }).count()) break;
  }
  const dlg = page.getByRole("dialog", { name: "Select products" });
  await dlg.waitFor({ timeout: 20000 });
  const search = dlg.getByRole("textbox", { name: "Search products" });
  await rec.click(search, { pauseAfter: 200 });
  await page.keyboard.type(query, { delay: 60 });
  const box = dlg.getByRole("checkbox", { name: title, exact: true });
  await box.waitFor({ timeout: 20000 });
  await rec.pause(900);
  // The row is the click target a merchant uses (the checkbox input itself is covered by its styled circle).
  await rec.moveTo(box);
  await page.evaluate(() => window.__ckClick?.()).catch(() => {});
  await page.mouse.click(rec.mouse.x, rec.mouse.y); // a real mouse click at that point on screen
  await rec.pause(700);
  if (!(await box.isChecked().catch(() => false))) await box.check({ force: true });
  if (!(await box.isChecked().catch(() => false))) throw new Error(`could not select "${title}" in the picker`);
  await rec.click(dlg.getByRole("button", { name: "Select", exact: true }), { pauseAfter: 1500 });
  await dlg.waitFor({ state: "detached", timeout: 15000 }).catch(() => {});
}

export const visible = (loc) => loc.filter({ visible: true }).first();

// Saves the campaign/settings with the app's own Save button and waits for "All changes saved".
export async function save(rec, frame) {
  const btn = visible(frame.getByRole("button", { name: "Save", exact: true }));
  await rec.moveTo(btn);
  if (await frame.getByText("All changes saved").first().isVisible().catch(() => false) && (await btn.isDisabled().catch(() => false))) {
    await rec.pause(800); // already saved (e.g. a re-run): nothing to click
    return;
  }
  await rec.click(btn, { pauseAfter: 600 });
  await frame.getByText("All changes saved").first().waitFor({ timeout: 30000 });
  await rec.pause(1500);
}

export async function scrollFrame(rec, page, dy, steps = 6) {
  const box = await page.locator("iframe").first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, dy / steps); await rec.pause(60); }
  await rec.pause(700);
}
