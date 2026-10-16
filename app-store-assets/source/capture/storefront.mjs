// Real storefront captures on the development store (Cartivo Dev embed), desktop and mobile.
// Uses the theme's own Add to cart buttons and the drawer's own controls; records Shopify's /cart.js after each
// step as evidence that what the drawer shows is what Shopify charges. Never opens checkout or places an order.
//   node app-store-assets/source/capture/storefront.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { attach, SHOP, assertDevStore } from "./browser.mjs";

const RAW = "app-store-assets/source/raw";
const EVID = "app-store-assets/reports/evidence";
mkdirSync(RAW, { recursive: true });
mkdirSync(EVID, { recursive: true });
const evidence = [];

const cartJs = (page) => page.evaluate(() => fetch("/cart.js", { cache: "no-store" }).then((r) => r.json()));
const lines = (c) => c.items.map((l) => ({ title: l.product_title, variant: l.variant_title, qty: l.quantity, price: l.final_line_price / 100, was: l.original_line_price / 100, cartivo: l.properties?._cartkit_gift ? "gift" : l.properties?._cartkit_bxgy ? "bxgy" : undefined }));

async function go(page, path) {
  const url = `${SHOP}${path}`;
  assertDevStore(url);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  if (new URL(page.url()).pathname.startsWith("/password")) throw new Error("Storefront is locked: unlock it in the signed-in Chrome first.");
  await page.waitForFunction(() => window.Cartivo?.__loaded, null, { timeout: 30000 });
  await page.waitForLoadState("load").catch(() => {});
}

async function emptyCart(page) {
  await go(page, "/");
  await page.evaluate(() => fetch("/cart/clear.js", { method: "POST" }));
  await page.evaluate(() => sessionStorage.clear());
}

// The theme's Add to cart button; Cartivo intercepts the add and opens its drawer.
async function addFromProductPage(page, handle) {
  await go(page, `/products/${handle}`);
  const before = (await cartJs(page)).item_count;
  await page.locator('form[action*="/cart/add"] [name="add"]').first().click();
  await page.waitForFunction((n) => fetch("/cart.js").then((r) => r.json()).then((c) => c.item_count > n), before, { timeout: 20000, polling: 500 });
  await page.waitForSelector(".ck-root.ck-open .ck-drawer", { timeout: 15000 });
}

// Lets Cartivo finish reacting (auto-added BXGY item, gift, discount re-pricing) before a capture.
async function settle(page, done = () => true, ms = 2500) {
  for (let i = 0; i < 30; i++) {
    if (await done(await cartJs(page))) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(ms);
}

async function shot(page, name, step) {
  await page.screenshot({ path: `${RAW}/${name}.png` });
  const drawer = page.locator(".ck-root.ck-open .ck-drawer");
  if (await drawer.count()) await drawer.screenshot({ path: `${RAW}/${name}-panel.png` });
  const cart = await cartJs(page);
  evidence.push({ name, step, at: new Date().toISOString(), total: cart.total_price / 100, currency: cart.currency, lines: lines(cart) });
  console.log("captured", name, "| total", cart.total_price / 100, "|", lines(cart).map((l) => `${l.title}${l.cartivo ? ` [${l.cartivo}]` : ""} $${l.price}`).join(", "));
}

async function run(page, prefix) {
  // A: goal in progress — a $24.95 ski wax leaves the shopper short of the $100 free gift goal.
  await emptyCart(page);
  await addFromProductPage(page, "selling-plans-ski-wax");
  await settle(page);
  await shot(page, `${prefix}-a-progress`, "Ski wax added; progress bar shows the distance to the free gift");
  // B: the product page provided for the demo — Oxygen triggers BXGY, the gift goal and the upsell.
  await emptyCart(page);
  await addFromProductPage(page, "the-collection-snowboard-oxygen");
  await settle(page, (c) => c.items.some((l) => l.properties?._cartkit_bxgy));
  await shot(page, `${prefix}-b-bxgy`, "Oxygen added; BXGY board auto-added at $0");
  const pick = page.locator('.ck-root.ck-open [data-ck="pick-gift"]').first();
  await pick.scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await shot(page, `${prefix}-c-gift-picker`, "Free gift goal reached; gift picker");
  await pick.click();
  await settle(page, (c) => c.items.some((l) => l.properties?._cartkit_gift));
  await page.locator(".ck-root.ck-open .ck-body").evaluate((b) => b.scrollTo(0, 0)).catch(() => {});
  await page.waitForTimeout(700);
  await shot(page, `${prefix}-d-gift-added`, "Gift added at $0");
  const up = page.locator(".ck-root.ck-open [data-ck='upsell-add']").first();
  await up.scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await shot(page, `${prefix}-e-upsell`, "Upsell recommendation (Frequently bought together)");
}

const desktop = await attach({ width: 1600, height: 900, scale: 2 });
try {
  // The product page you shared, as the shopper first sees it.
  await emptyCart(desktop.page);
  await go(desktop.page, "/products/the-collection-snowboard-oxygen");
  await desktop.page.waitForTimeout(2500);
  await shot(desktop.page, "sf-desktop-0-product", "Oxygen product page (no cart yet)");
  await run(desktop.page, "sf-desktop");
} finally { await desktop.close(); }

const mobile = await attach({ width: 390, height: 844, scale: 3 });
try {
  await mobile.cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await mobile.cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await mobile.cdp.send("Emulation.setUserAgentOverride", { userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36" });
  await emptyCart(mobile.page);
  await go(mobile.page, "/products/the-collection-snowboard-oxygen");
  await mobile.page.waitForTimeout(2500);
  await shot(mobile.page, "sf-mobile-0-product", "Oxygen product page on mobile");
  await run(mobile.page, "sf-mobile");
  await emptyCart(mobile.page);
} finally { await mobile.close(); }

writeFileSync(`${EVID}/storefront-cart-evidence.json`, JSON.stringify(evidence, null, 2));
console.log("done");
