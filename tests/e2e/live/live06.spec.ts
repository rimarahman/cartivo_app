// LIVE-06 on the real development store: items Cartivo adds as free (a gift, a BXGY item) are $0 in Shopify's own
// cart (/cart.js) and stay in the cart after Cartivo's price check; checkout is reached with the same cart.
// Runs only when started by hand (see tests/e2e/live/README.md); never places an order.
import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const STORE = process.env.CARTIVO_LIVE_STORE || "";
const PASSWORD = process.env.CARTIVO_STOREFRONT_PASSWORD || "";
const OUT = "tests/e2e/evidence/live";

type Line = { key: string; variant_id: number; product_id: number; product_title: string; quantity: number; final_line_price: number; original_line_price: number; properties: Record<string, string> | null };
type Cart = { total_price: number; total_discount: number; currency: string; items: Line[] };

test.describe.configure({ mode: "serial" });

const cartJs = (page: Page): Promise<Cart> => page.evaluate(() => fetch("/cart.js", { cache: "no-store" }).then((r) => r.json()));
const auto = (l: Line) => !!(l.properties?._cartkit_gift || l.properties?._cartkit_bxgy);
const summary = (cart: Cart) => cart.items.map((l) => ({ title: l.product_title, variant: l.variant_id, qty: l.quantity, price: l.final_line_price, was: l.original_line_price, cartivo: l.properties?._cartkit_gift ? "gift" : l.properties?._cartkit_bxgy ? "bxgy" : undefined }));

test.beforeAll(() => {
  // Development store only: refuse anything else, so this can never run against a merchant's store.
  if (STORE !== "cartivo-app-test.myshopify.com") throw new Error(`CARTIVO_LIVE_STORE must be cartivo-app-test.myshopify.com (got "${STORE}")`);
  mkdirSync(OUT, { recursive: true });
});

// Unlocks the password page, empties the cart, and returns the config Cartivo published to this store.
async function openStore(page: Page) {
  await page.goto("/");
  if (page.url().includes("/password")) {
    if (!PASSWORD) throw new Error("The storefront is password-protected: set CARTIVO_STOREFRONT_PASSWORD in your terminal.");
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.locator('input[type="password"]').press("Enter");
    await page.waitForURL((u) => !u.pathname.startsWith("/password"));
  }
  await page.evaluate(() => fetch("/cart/clear.js", { method: "POST" }));
  await page.evaluate(() => sessionStorage.clear());
  await page.goto("/");
  // Exactly one Cartivo embed (the dev app's): two enabled embeds would both act on the cart.
  expect(await page.locator("script#cartkit-config").count(), "Cartivo embeds on the page (turn off the production app's embed)").toBe(1);
  await page.waitForFunction(() => (window as any).Cartivo?.__loaded, null, { timeout: 20000 });
  return {
    config: JSON.parse((await page.locator("script#cartkit-config").textContent()) || "{}"),
    scriptSrc: await page.locator('script[src*="cartkit.js"]').first().getAttribute("src"),
  };
}

const products = async (page: Page): Promise<any[]> => (await page.evaluate(() => fetch("/products.json?limit=250").then((r) => r.json()))).products;

// Added through the page, like a theme's add-to-cart: Cartivo sees it and reacts.
async function add(page: Page, id: number, quantity: number) {
  await page.evaluate(({ id, quantity }) => fetch("/cart/add.js", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ id, quantity }] }) }), { id, quantity });
  await page.evaluate(() => (window as any).Cartivo.refresh());
}

// Items Cartivo took out because Shopify charged for them (a JSON list in sessionStorage).
const notFreeKeys = (page: Page): Promise<string[]> => page.evaluate(() => JSON.parse(sessionStorage.getItem("cartkit_not_free") || "[]"));

// Waits until the condition holds or Cartivo marked an item as not free, then lets any removal land.
async function settle(page: Page, done: (cart: Cart) => boolean) {
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(500);
    const cart = await cartJs(page);
    if (done(cart) || (await notFreeKeys(page)).length) break;
  }
  await page.waitForTimeout(2500);
  return { cart: await cartJs(page), notFree: await notFreeKeys(page) };
}

function record(name: string, data: unknown) {
  writeFileSync(`${OUT}/${name}.json`, JSON.stringify(data, null, 2));
}

test("LIVE-06a free gift is $0 in Shopify's cart and stays in the cart @live", async ({ page }) => {
  const { config, scriptSrc } = await openStore(page);
  const goal = (config.campaigns || [])
    .filter((c: any) => c.type === "rewards" && c.config?.basis !== "quantity")
    .flatMap((c: any) => (c.config.tiers || []).map((t: any) => ({ campaign: c.id, ...t })))
    .find((t: any) => t.type === "free_gift" && (t.gifts || []).some((g: any) => g.variantId));
  expect(goal, "an active cart-value free-gift goal (Cartivo Dev → Campaigns)").toBeTruthy();
  const giftIds = goal.gifts.map((g: any) => Number(g.variantId));

  const pick = (await products(page)).flatMap((p) => p.variants.map((v: any) => ({ p, v })))
    .find(({ v }) => v.available && !giftIds.includes(Number(v.id)) && Number(v.price) > 0);
  expect(pick, "an available paid product to add").toBeTruthy();
  const qty = Math.max(1, Math.ceil((Number(goal.threshold) + 1) / Number(pick!.v.price)));
  await add(page, Number(pick!.v.id), qty);

  // One gift: Cartivo adds it. Several: the shopper picks one in the drawer.
  let picked: number | null = null;
  if (giftIds.length > 1) {
    await page.evaluate(() => (window as any).Cartivo.open());
    const option = page.locator('[data-ck="pick-gift"]').first();
    await expect(option, "gift picker in the drawer once the goal is reached").toBeVisible({ timeout: 15000 });
    picked = Number(await option.getAttribute("data-variant"));
    await option.click();
  }
  const isGift = (l: Line) => !!l.properties?._cartkit_gift && giftIds.includes(Number(l.variant_id));
  const { cart, notFree } = await settle(page, (c) => c.items.some(isGift));
  record("live06a-cart", { at: new Date().toISOString(), store: STORE, scriptSrc, goal: { threshold: goal.threshold, gifts: giftIds, picked }, added: { product: pick!.p.title, price: pick!.v.price, qty }, notFree, total: cart.total_price, currency: cart.currency, lines: summary(cart) });

  await page.evaluate(() => (window as any).Cartivo.open());
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/live06a-drawer.png` });

  const gift = cart.items.find(isGift);
  expect(notFree, "items Cartivo removed because Shopify charged for them (discount not applied in /cart.js)").toEqual([]);
  expect(gift, "gift line in Shopify's cart").toBeTruthy();
  expect(gift!.quantity).toBe(1);
  expect(gift!.final_line_price, "gift price in /cart.js (cents)").toBe(0);
  expect(cart.items.filter((l) => auto(l) && l.final_line_price > 0), "Cartivo-added lines with a price").toEqual([]);

  // Checkout with the same cart, for the manual total comparison. No details are entered, no order is placed.
  await page.goto("/checkout");
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.screenshot({ path: `${OUT}/live06a-checkout.png`, fullPage: true });
});

test("LIVE-06b auto-added BXGY item is $0 in Shopify's cart and stays in the cart @live", async ({ page }) => {
  const { config, scriptSrc } = await openStore(page);
  const bxgy = (config.campaigns || []).find((c: any) => c.type === "bxgy" && c.config?.autoAdd && Number(c.config.percent) === 100 && (c.config.getProducts || []).some((p: any) => p.variantId));
  test.skip(!bxgy, "no active BXGY campaign with 100% off and auto-add");
  const buyIds = (bxgy.config.buyProducts || []).map((p: any) => String(p.productId));
  const getIds = (bxgy.config.getProducts || []).map((p: any) => String(p.productId));
  expect(buyIds.some((id: string) => getIds.includes(id)), "buy and get products overlap (auto-add is off then)").toBe(false);

  const buy = (await products(page)).filter((p) => buyIds.includes(String(p.id)))
    .flatMap((p) => p.variants.map((v: any) => ({ p, v }))).find(({ v }) => v.available);
  expect(buy, "an available 'buy' product").toBeTruthy();
  await add(page, Number(buy!.v.id), Math.max(1, Number(bxgy.config.buyQuantity) || 1));

  const isFree = (l: Line) => l.properties?._cartkit_bxgy === bxgy.id;
  const { cart, notFree } = await settle(page, (c) => c.items.some(isFree));
  record("live06b-cart", { at: new Date().toISOString(), store: STORE, scriptSrc, campaign: bxgy.id, added: { product: buy!.p.title, price: buy!.v.price }, notFree, total: cart.total_price, currency: cart.currency, lines: summary(cart) });

  await page.evaluate(() => (window as any).Cartivo.open());
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/live06b-drawer.png` });

  expect(notFree, "items Cartivo removed because Shopify charged for them").toEqual([]);
  const free = cart.items.filter(isFree);
  expect(free.length, "auto-added BXGY line in Shopify's cart").toBeGreaterThan(0);
  expect(free.every((l) => l.final_line_price === 0), "BXGY item price in /cart.js").toBe(true);
  expect(cart.items.filter((l) => auto(l) && l.final_line_price > 0), "Cartivo-added lines with a price").toEqual([]);

  await page.goto("/checkout");
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.screenshot({ path: `${OUT}/live06b-checkout.png`, fullPage: true });
});
