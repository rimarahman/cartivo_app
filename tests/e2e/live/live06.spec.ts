// LIVE-06 on the real development store: a free gift (and any auto-added BXGY item) is $0 in Shopify's own cart
// (/cart.js) and is still in the cart after Cartivo's checks, and checkout is reached with the same cart.
// Runs only when started by hand (see tests/e2e/live/README.md); never places an order.
import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const STORE = process.env.CARTIVO_LIVE_STORE || "";
const PASSWORD = process.env.CARTIVO_STOREFRONT_PASSWORD || "";
const OUT = "tests/e2e/evidence/live";

type Line = { key: string; variant_id: number; product_title: string; quantity: number; final_line_price: number; original_line_price: number; properties: Record<string, string> | null };
type Cart = { total_price: number; total_discount: number; currency: string; items: Line[] };

const cartJs = (page: Page): Promise<Cart> => page.evaluate(() => fetch("/cart.js", { cache: "no-store" }).then((r) => r.json()));
const auto = (l: Line) => !!(l.properties?._cartkit_gift || l.properties?._cartkit_bxgy);

test.beforeAll(() => {
  // Development store only: refuse anything else, so this can never run against a merchant's store.
  if (STORE !== "cartivo-app-test.myshopify.com") throw new Error(`CARTIVO_LIVE_STORE must be cartivo-app-test.myshopify.com (got "${STORE}")`);
  mkdirSync(OUT, { recursive: true });
});

async function enterStore(page: Page) {
  await page.goto("/");
  if (page.url().includes("/password")) {
    if (!PASSWORD) throw new Error("The storefront is password-protected: set CARTIVO_STOREFRONT_PASSWORD in your terminal.");
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.locator('input[type="password"]').press("Enter");
    await page.waitForURL((u) => !u.pathname.startsWith("/password"));
  }
}

test("LIVE-06 free gift is $0 in Shopify's cart and stays in the cart @live", async ({ page }, info) => {
  await enterStore(page);
  await page.evaluate(() => fetch("/cart/clear.js", { method: "POST" }));
  await page.goto("/");

  // Exactly one Cartivo embed (the dev app's): two enabled embeds would both act on the cart.
  const embeds = await page.locator("script#cartkit-config").count();
  expect(embeds, "Cartivo embeds on the page (turn off the production app's embed in the theme editor)").toBe(1);
  await page.waitForFunction(() => (window as any).Cartivo?.__loaded, null, { timeout: 20000 });
  const scriptSrc = await page.locator('script[src*="cartkit.js"]').first().getAttribute("src");

  // The live gift goal, from the config Cartivo published to this store.
  const config = JSON.parse((await page.locator("script#cartkit-config").textContent()) || "{}");
  const goal = (config.campaigns || [])
    .filter((c: any) => c.type === "rewards" && c.config?.basis !== "quantity")
    .flatMap((c: any) => (c.config.tiers || []).map((t: any) => ({ campaign: c.id, ...t })))
    .find((t: any) => t.type === "free_gift" && (t.gifts || []).length === 1 && t.gifts[0].variantId);
  expect(goal, "an active cart-value free-gift goal with one gift (create one in Cartivo Dev → Campaigns)").toBeTruthy();
  const giftVariant = Number(goal.gifts[0].variantId);

  // Any available product that isn't the gift, enough units to pass the goal.
  const products: any[] = (await page.evaluate(() => fetch("/products.json?limit=50").then((r) => r.json()))).products;
  const pick = products.flatMap((p) => p.variants.map((v: any) => ({ p, v })))
    .find(({ v }) => v.available && Number(v.id) !== giftVariant && Number(v.price) > 0);
  expect(pick, "an available paid product to add").toBeTruthy();
  const qty = Math.max(1, Math.ceil((Number(goal.threshold) + 1) / Number(pick!.v.price)));

  // Added through the page, like a theme's add-to-cart: Cartivo sees it and adds the gift.
  await page.evaluate(({ id, quantity }) => fetch("/cart/add.js", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ id, quantity }] }) }), { id: Number(pick!.v.id), quantity: qty });
  await page.evaluate(() => (window as any).Cartivo.refresh());

  // Wait until Cartivo has settled: the gift line is there, or Cartivo took it out as not free.
  let cart = await cartJs(page);
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(500);
    cart = await cartJs(page);
    const notFree = await page.evaluate(() => sessionStorage.getItem("cartkit_not_free"));
    if (cart.items.some((l) => Number(l.variant_id) === giftVariant && l.properties?._cartkit_gift) || notFree) break;
  }
  await page.waitForTimeout(2000); // let any removal by Cartivo's price check land
  cart = await cartJs(page);
  const notFree = await page.evaluate(() => sessionStorage.getItem("cartkit_not_free"));

  const evidence = { at: new Date().toISOString(), store: STORE, scriptSrc, goal: { threshold: goal.threshold, giftVariant }, added: { product: pick!.p.title, price: pick!.v.price, qty }, notFree, cart };
  writeFileSync(`${OUT}/live06-cart.json`, JSON.stringify(evidence, null, 2));
  await info.attach("live06-cart.json", { body: JSON.stringify(evidence, null, 2), contentType: "application/json" });

  const gift = cart.items.find((l) => Number(l.variant_id) === giftVariant && l.properties?._cartkit_gift);
  expect(notFree, "Cartivo removed the gift because Shopify charged for it: the discount isn't applied in /cart.js").toBeNull();
  expect(gift, "gift line in Shopify's cart").toBeTruthy();
  expect(gift!.quantity).toBe(1);
  expect(gift!.final_line_price, "gift price in /cart.js (cents)").toBe(0);
  expect(cart.items.filter((l) => auto(l) && l.final_line_price > 0), "auto-added lines with a price").toEqual([]);

  // Drawer agrees with Shopify.
  await page.evaluate(() => (window as any).Cartivo.open());
  await page.screenshot({ path: `${OUT}/live06-drawer.png` });

  // Checkout with the same cart: screenshot for the manual total comparison. No details are entered, no order is placed.
  await page.goto("/checkout");
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.screenshot({ path: `${OUT}/live06-checkout.png`, fullPage: true });
  writeFileSync(`${OUT}/live06-expected-total.txt`, `Cart total from /cart.js: ${(cart.total_price / 100).toFixed(2)} ${cart.currency} (shipping and taxes are added at checkout)\n`);
});
