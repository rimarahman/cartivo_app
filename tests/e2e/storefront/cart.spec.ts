// Customer storefront journeys, campaigns, failure handling, security and accessibility of the cart drawer.
import { test, expect, qtyOf, paidAutoLines } from "./fixtures";

test.describe("Cart drawer", () => {
  test("SF-01 variant selection adds the chosen variant @p1", async ({ shop }) => {
    await shop.open("base", "/products/shirt");
    await shop.addFromProductPage("shirt", { variant: 1002, qty: 2 });
    const cart = await shop.cart();
    expect(qtyOf(cart, 1002)).toBe(2);
    expect(qtyOf(cart, 1001)).toBe(0);
  });

  test("SF-02 increase, decrease and remove update the real cart and the subtotal @p1", async ({ shop, page }) => {
    await shop.open("base", "/products/shirt");
    await shop.addFromProductPage("shirt");
    await page.locator("[data-ck=inc]").click();
    await shop.settle();
    expect((await shop.cart()).total_price).toBe(6000);
    await expect(page.locator(".ck-subtotal")).toContainText("$60.00");
    await page.locator("[data-ck=dec]").click();
    await shop.settle();
    expect((await shop.cart()).total_price).toBe(3000);
    await page.locator("[data-ck=remove]").click();
    await shop.settle();
    expect((await shop.cart()).items).toEqual([]);
    await expect(page.locator(".ck-empty")).toBeVisible();
  });

  test("SF-03 sold-out variant shows Shopify's error and adds nothing @p1", async ({ shop, page }) => {
    await shop.open("base", "/products/soldout");
    await page.waitForFunction(() => (window as any).Cartivo?.__loaded);
    await page.getByTestId("add-to-cart").click();
    await expect(page.locator(".ck-error-text")).toContainText("sold out");
    expect((await shop.cart()).items).toEqual([]);
  });

  test("SF-04 cart survives refresh and navigation; header count matches @p1", async ({ shop, page }) => {
    await shop.open("base", "/products/shirt");
    await shop.addFromProductPage("shirt", { qty: 2 });
    await page.goto("/products/socks");
    await page.waitForFunction(() => (window as any).Cartivo?.__loaded);
    await shop.settle();
    await expect(page.locator(".cart-count").first()).toHaveText("2");
    await shop.openDrawer();
    await expect(shop.items()).toHaveCount(1);
  });

  test("SF-05 cart link opens the drawer instead of the cart page @p2", async ({ shop, page }) => {
    await shop.open("base", "/");
    await page.locator("#cart-icon-bubble").click();
    await expect(page.locator(".ck-root")).toHaveClass(/ck-open/);
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("SF-06 valid discount code applies; invalid one shows an error and is removed @p1", async ({ shop, page }) => {
    await shop.open("base", "/products/shirt");
    await shop.addFromProductPage("shirt");
    await page.locator("[data-ck=toggle-discount]").click();
    await page.locator(".ck-discount-input").fill("NOPE");
    await page.locator("[data-ck=apply-discount]").click();
    await shop.settle();
    await expect(page.locator(".ck-error-text")).toBeVisible();
    expect((await shop.cart()).discount_codes).toEqual([]);
    await page.locator(".ck-discount-input").fill("SAVE10");
    await page.locator(".ck-discount-input").press("Enter");
    await shop.settle();
    expect((await shop.cart()).total_price).toBe(2700);
    await expect(page.locator(".ck-code")).toContainText("SAVE10");
    await page.locator("[data-ck=remove-discount]").click();
    await shop.settle();
    expect((await shop.cart()).total_price).toBe(3000);
  });

  test("SF-07 order note is saved to the cart @p2", async ({ shop, page }) => {
    await shop.open("base", "/products/shirt");
    await shop.addFromProductPage("shirt");
    await page.locator("[data-ck=toggle-note]").click();
    await page.locator(".ck-note-input").fill("Leave at door");
    await page.locator("[data-ck=toggle-note]").click();
    await shop.settle();
    expect((await shop.cart()).note).toBe("Leave at door");
  });

  test("SF-08 terms checkbox blocks checkout until ticked @p1", async ({ shop, page }) => {
    await shop.open("terms", "/products/shirt");
    await shop.addFromProductPage("shirt");
    await page.locator("[data-ck=checkout]").click();
    await expect(page.locator(".ck-error-text")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/products/shirt");
    await page.locator(".ck-terms-input").check();
    await page.locator("[data-ck=checkout]").click();
    await expect(page.getByTestId("checkout")).toBeVisible();
  });

  test("SF-09 checkout continues to /checkout @p0", async ({ shop, page }) => {
    await shop.open("base", "/products/shirt");
    await shop.addFromProductPage("shirt");
    await page.locator("[data-ck=checkout]").click();
    await expect(page.getByTestId("checkout")).toBeVisible();
  });

  test("SF-10 failed add-to-cart (server error) shows an error and changes nothing @p1", async ({ shop, page }) => {
    await shop.open("base", "/products/shirt");
    await shop.fault("/cart/add", { status: 500 });
    await page.waitForFunction(() => (window as any).Cartivo?.__loaded);
    await page.getByTestId("add-to-cart").click();
    await expect(page.locator(".ck-error-text")).toBeVisible();
    expect((await shop.cart()).items).toEqual([]);
  });

  test("SF-11 failed quantity change keeps the real cart and the drawer in sync @p1", async ({ shop, page }) => {
    await shop.open("base", "/products/shirt");
    await shop.addFromProductPage("shirt");
    await shop.fault("/cart/change", { status: 500 });
    await page.locator("[data-ck=inc]").click();
    await shop.settle();
    expect((await shop.cart()).total_price).toBe(3000);
    await expect(page.locator(".ck-subtotal")).toContainText("$30.00");
    await expect(page.locator(".ck-qty span")).toHaveText("1");
  });

  test("SF-12 gift that can't be added (failed request) isn't retried in a loop @p1", async ({ shop, page }) => {
    await shop.open("gift", "/products/shirt");
    await shop.addFromProductPage("shirt");
    await shop.fault("/cart/add", { status: 500 });
    await page.locator("[data-ck=inc]").click();
    await shop.settle();
    await page.waitForTimeout(500);
    const { log } = await shop.state();
    expect(log.filter((l) => l.op === "/cart/add" && l.failed).length).toBeLessThanOrEqual(1);
  });

  test("SF-13 slow network: drawer shows busy state and ends consistent @p2", async ({ shop, page }) => {
    await shop.open("gift", "/products/shirt");
    await shop.fault("/cart/add", { delay: 1500 });
    await page.waitForFunction(() => (window as any).Cartivo?.__loaded);
    await page.getByTestId("qty").fill("2");
    await page.getByTestId("add-to-cart").click();
    await expect(page.getByTestId("add-to-cart")).toHaveAttribute("aria-busy", "true");
    await expect(page.locator(".ck-root")).toHaveClass(/ck-open/, { timeout: 10000 });
    await shop.settle();
    const cart = await shop.cart();
    expect(qtyOf(cart, 1001)).toBe(2);
    expect(qtyOf(cart, 4001)).toBe(1);
    await expect(page.locator(".ck-item")).toHaveCount(2);
  });

  test("SF-14 large cart (40 lines) renders with correct totals @p2", async ({ shop, page }) => {
    await shop.open("base", "/");
    const items = Array.from({ length: 40 }, (_, i) => ({ id: 1001, quantity: 1, properties: { Engraving: `Name ${i}` } }));
    await shop.seed(items);
    await shop.openDrawer();
    await expect(shop.items()).toHaveCount(40);
    await expect(page.locator(".ck-subtotal")).toContainText("$1,200.00");
  });
});

test.describe("Campaigns on the storefront", () => {
  test("CMP-01 reward tiers: progress message, free shipping, gift and order discount @p1", async ({ shop, page }) => {
    await shop.open("tiers", "/products/shirt");
    await shop.addFromProductPage("shirt"); // $30
    await expect(page.locator(".ck-goal-message")).toContainText("$10.00");
    await page.locator(".ck-item:not(.ck-item-gift) [data-ck=inc]").click(); // $60
    await shop.settle();
    expect(qtyOf(await shop.cart(), 4001)).toBe(0); // gift at $80
    await page.locator(".ck-item:not(.ck-item-gift) [data-ck=inc]").click(); // $90
    await shop.settle();
    expect(qtyOf(await shop.cart(), 4001)).toBe(1);
    await page.locator(".ck-item:not(.ck-item-gift) [data-ck=inc]").click(); // $120 → 10% off
    await shop.settle();
    const cart = await shop.cart();
    expect(cart.total_price).toBe(12000 - 1200);
    expect(paidAutoLines(cart)).toEqual([]);
    await expect(page.locator(".ck-goal-message")).toContainText("unlocked");
  });

  test("CMP-02 gift picker: nothing added until the shopper picks; one gift only @p1", async ({ shop, page }) => {
    await shop.open("giftPicker", "/products/shirt");
    await shop.addFromProductPage("shirt", { qty: 2 });
    expect(qtyOf(await shop.cart(), 4001) + qtyOf(await shop.cart(), 4021)).toBe(0);
    await page.locator(".ck-gift-option").last().click();
    await shop.settle();
    const cart = await shop.cart();
    expect(qtyOf(cart, 4021)).toBe(1);
    expect(qtyOf(cart, 4001)).toBe(0);
    expect(paidAutoLines(cart)).toEqual([]);
    await expect(page.locator(".ck-gift-picker")).toHaveCount(0);
  });

  test("CMP-03 BXGY same product (buy 2 get 1): free unit discounted by the function, nothing auto-added @p1", async ({ shop }) => {
    await shop.open("bxgySame", "/products/shirt");
    await shop.addFromProductPage("shirt", { qty: 3 });
    const cart = await shop.cart();
    expect(qtyOf(cart, 1001)).toBe(3);
    expect(cart.total_price).toBe(6000);
  });

  test("CMP-04 volume discount tiers price correctly and show the next-tier hint @p1", async ({ shop, page }) => {
    await shop.open("volume", "/products/shirt");
    await shop.addFromProductPage("shirt");
    await expect(page.locator(".ck-hint")).toContainText("Add 1 more to save 10%");
    await page.locator("[data-ck=inc]").click();
    await shop.settle();
    expect((await shop.cart()).total_price).toBe(5400);
    await page.locator("[data-ck=inc]").click();
    await shop.settle();
    expect((await shop.cart()).total_price).toBe(7650);
  });

  test("CMP-05 several campaigns at once: no duplicate gifts, no negative total @p1", async ({ shop, page }) => {
    await shop.open("everything", "/products/shirt");
    await shop.addFromProductPage("shirt", { qty: 2 }); // $60 → gift; BXGY socks
    await shop.addFromProductPage("cap", { qty: 2 }); // volume 10% on caps
    await page.locator("[data-ck=toggle-discount]").click();
    await page.locator(".ck-discount-input").fill("SAVE10");
    await page.locator("[data-ck=apply-discount]").click();
    await shop.settle();
    const cart = await shop.cart();
    expect(qtyOf(cart, 4001)).toBe(1);
    expect(qtyOf(cart, 2001)).toBe(2);
    expect(paidAutoLines(cart)).toEqual([]);
    expect(cart.total_price).toBeGreaterThan(0);
    expect(cart.total_price).toBe(Math.round((6000 + 2700) * 0.9));
  });

  test("CMP-06 per-visitor (evergreen) countdown is never shown @p1", async ({ shop, page }) => {
    await shop.open("evergreen", "/products/shirt");
    await shop.addFromProductPage("shirt");
    await expect(page.locator(".ck-timer")).toHaveCount(0);
  });
});

test.describe("Storefront security", () => {
  test("SEC-SF-01 product, variant, property, note and code values are escaped @p0", async ({ shop, page }) => {
    await shop.open("base", "/");
    await shop.seed([{ id: 8001, quantity: 1, properties: { '<img src=x onerror="window.__xss=2">': '<svg onload="window.__xss=3">' } }]);
    await page.request.post("/cart/update.js", { data: { note: '<img src=x onerror="window.__xss=4">' } });
    await shop.openDrawer();
    await page.locator("[data-ck=toggle-discount]").click();
    await page.locator(".ck-discount-input").fill('"><img src=x onerror="window.__xss=5">');
    await page.locator("[data-ck=apply-discount]").click();
    await shop.settle();
    await page.locator(".ck-item").hover();
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
    await expect(page.locator(".ck-item-title")).toContainText("<img");
  });
});

test.describe("Accessibility & keyboard", () => {
  test("A11Y-01 drawer is a labelled modal dialog; focus moves in; Escape closes @p1", async ({ shop, page }) => {
    await shop.open("base", "/products/shirt");
    await shop.addFromProductPage("shirt");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog).toHaveAttribute("aria-label", /cart/i);
    await expect(dialog).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator(".ck-root.ck-open")).toHaveCount(0);
  });

  test("A11Y-02 all drawer buttons have accessible names @p2", async ({ shop, page }) => {
    await shop.open("everything", "/products/shirt");
    await shop.addFromProductPage("shirt", { qty: 2 });
    const unnamed = await page.locator(".ck-drawer button").evaluateAll((els) =>
      els.filter((b) => !(b.getAttribute("aria-label") || b.textContent || "").trim()).map((b) => b.outerHTML.slice(0, 80)));
    expect(unnamed).toEqual([]);
  });

  test("A11Y-03 Tab keeps focus inside the open modal drawer @p2", async ({ shop, page, browserName }) => {
    test.skip(browserName === "webkit", "WebKit doesn't Tab to buttons by default (macOS setting)");
    await shop.open("base", "/products/shirt");
    await shop.addFromProductPage("shirt");
    const escaped: string[] = [];
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(() => !!document.activeElement?.closest(".ck-drawer"));
      if (!inside) escaped.push(await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 60) || "body"));
    }
    expect(escaped, "focus left the aria-modal dialog").toEqual([]);
  });
});
