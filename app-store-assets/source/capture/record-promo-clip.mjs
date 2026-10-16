// Short real storefront recording for the promo video: Oxygen product page (top, no footer in view) → theme Add to
// cart → Cartivo drawer opens (BXGY item added) → shopper picks the free gift. Empties the cart afterwards.
//   node app-store-assets/source/capture/record-promo-clip.mjs <outDir>
import { attach, SHOP, assertDevStore } from "./browser.mjs";
import { Recorder } from "./recorder.mjs";

const OUT = process.argv[2];
const URL_ = `${SHOP}/products/the-collection-snowboard-oxygen`;
assertDevStore(URL_);
const { page, cdp, close } = await attach({ width: 1600, height: 900, scale: 1.2 });
const rec = new Recorder(page, cdp, OUT, { width: 1920, height: 1080 });
const cartHas = (prop) => page.waitForFunction((p) => fetch("/cart.js").then((r) => r.json()).then((c) => c.items.some((l) => l.properties?.[p])), prop, { timeout: 30000, polling: 600 });
try {
  await page.goto(SHOP + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => fetch("/cart/clear.js", { method: "POST" }).then(() => sessionStorage.clear()));
  await page.goto(URL_, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.Cartivo?.__loaded, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await rec.start();
  rec.step("product");
  await rec.pause(1500);
  rec.step("add");
  await rec.click(page.locator('form[action*="/cart/add"] [name="add"]').first(), { pauseAfter: 300 });
  await page.waitForSelector(".ck-root.ck-open .ck-drawer", { timeout: 20000 });
  await cartHas("_cartkit_bxgy");
  await rec.pause(2200);
  rec.step("gift");
  const gift = page.locator('.ck-root.ck-open [data-ck="pick-gift"]').first();
  await gift.waitFor({ timeout: 20000 });
  await rec.moveTo(gift);
  await rec.pause(700);
  await rec.click(gift, { pauseAfter: 300 });
  await cartHas("_cartkit_gift");
  await page.locator(".ck-root.ck-open .ck-body").evaluate((b) => b.scrollTo({ top: 0, behavior: "smooth" })).catch(() => {});
  rec.step("done");
  await rec.pause(2500);
  await rec.stop();
} finally {
  await page.evaluate(() => fetch("/cart/clear.js", { method: "POST" })).catch(() => {});
  await close();
}
