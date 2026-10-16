// P0 buyer-consent tests (App Store requirement 1.1.9): Cartivo must never put an item the shopper pays for
// into the cart without the shopper asking for it. Assertions read the server-side cart priced by the real
// discount Function, not the drawer's display.
import { test, expect, paidAutoLines, qtyOf } from "./fixtures";

test.describe("Buyer consent", () => {
  test("CON-01 free gift is auto-added only when unlocked, and is free @p0", async ({ shop, errors }) => {
    await shop.open("gift", "/products/shirt");
    await shop.addFromProductPage("shirt"); // $30 < $50
    expect(qtyOf(await shop.cart(), 4001)).toBe(0);
    await shop.page.locator(".ck-item:not(.ck-item-gift) [data-ck=inc]").click(); // $60
    await shop.settle();
    const cart = await shop.cart();
    expect(qtyOf(cart, 4001)).toBe(1);
    expect(paidAutoLines(cart)).toEqual([]);
    await expect(shop.page.locator(".ck-item-gift .ck-price-free")).toHaveText("FREE");
    expect(errors).toEqual([]);
  });

  test("CON-02 gift is removed when the cart drops below the goal @p0", async ({ shop }) => {
    await shop.open("gift", "/products/shirt");
    await shop.addFromProductPage("shirt", { qty: 2 });
    expect(qtyOf(await shop.cart(), 4001)).toBe(1);
    await shop.page.locator(".ck-item:not(.ck-item-gift) [data-ck=dec]").click();
    await shop.settle();
    expect(qtyOf(await shop.cart(), 4001)).toBe(0);
  });

  test("CON-03 a removed gift stays removed after refresh and navigation @p0", async ({ shop, page }) => {
    await shop.open("gift", "/products/shirt");
    await shop.addFromProductPage("shirt", { qty: 2 });
    await page.locator(".ck-item-gift [data-ck=remove]").click();
    await shop.settle();
    expect(qtyOf(await shop.cart(), 4001)).toBe(0);
    await shop.reload();
    await page.goto("/products/socks");
    await page.waitForFunction(() => (window as any).Cartivo?.__loaded);
    await shop.settle();
    expect(qtyOf(await shop.cart(), 4001)).toBe(0);
  });

  test("CON-04 rapid quantity clicks never duplicate the gift @p0", async ({ shop, page }) => {
    await shop.open("gift", "/products/shirt");
    await shop.addFromProductPage("shirt");
    const inc = page.locator(".ck-item:not(.ck-item-gift) [data-ck=inc]");
    for (let i = 0; i < 5; i++) await inc.click({ force: true, delay: 0 }).catch(() => {});
    await shop.settle();
    const cart = await shop.cart();
    expect(qtyOf(cart, 4001)).toBe(1);
    expect(paidAutoLines(cart)).toEqual([]);
  });

  test("CON-05 Buy X Get Y (100% off) adds the free item, free @p0", async ({ shop }) => {
    await shop.open("bxgyFree", "/products/shirt");
    await shop.addFromProductPage("shirt");
    const cart = await shop.cart();
    expect(qtyOf(cart, 2001)).toBe(1);
    expect(paidAutoLines(cart)).toEqual([]);
    expect(cart.total_price).toBe(3000);
  });

  test("CON-06 BXGY never adds a paid unit when the shopper already has the get product @p0", async ({ shop }) => {
    await shop.open("bxgyFree", "/products/socks");
    await shop.addFromProductPage("socks"); // shopper's own socks, $10
    const before = (await shop.cart()).total_price;
    await shop.addFromProductPage("shirt"); // +$30 shirt; one sock becomes free
    const cart = await shop.cart();
    expect(paidAutoLines(cart), "auto-added BXGY line is charged").toEqual([]);
    // The shopper asked for 1 shirt and 1 sock; with 1 sock free they owe $30 at most.
    expect(cart.total_price).toBeLessThanOrEqual(before + 3000);
    expect(cart.total_price).toBe(3000);
  });

  test("CON-07 BXGY with several get products never adds a paid unit @p0", async ({ shop }) => {
    await shop.open("bxgyMultiGet", "/products/pin");
    await shop.addFromProductPage("pin"); // pin ($8) is also a "get" product, cheaper than socks
    await shop.addFromProductPage("shirt");
    const cart = await shop.cart();
    expect(paidAutoLines(cart), "auto-added BXGY line is charged").toEqual([]);
    expect(cart.total_price).toBe(3000);
  });

  test("CON-08 partly discounted BXGY item is never auto-added @p0", async ({ shop }) => {
    await shop.open("bxgyHalf", "/products/shirt");
    await shop.addFromProductPage("shirt");
    const cart = await shop.cart();
    expect(qtyOf(cart, 2001)).toBe(0);
    expect(cart.total_price).toBe(3000);
  });

  test("CON-09 removed BXGY free item stays removed after reload @p0", async ({ shop, page }) => {
    await shop.open("bxgyFree", "/products/shirt");
    await shop.addFromProductPage("shirt");
    await page.locator(".ck-item", { hasText: "Socks" }).locator("[data-ck=remove]").click();
    await shop.settle();
    await shop.reload();
    expect(qtyOf(await shop.cart(), 2001)).toBe(0);
  });

  test("CON-10 increasing the BXGY free line can't add paid units @p0", async ({ shop, page }) => {
    await shop.open("bxgyFree", "/products/shirt");
    await shop.addFromProductPage("shirt");
    await page.locator(".ck-item", { hasText: "Socks" }).locator("[data-ck=inc]").click();
    await shop.settle();
    const cart = await shop.cart();
    expect(paidAutoLines(cart)).toEqual([]);
    expect(cart.total_price).toBe(3000);
  });

  test("CON-11 gift is not left in the cart at full price when the discount isn't active @p0", async ({ shop }) => {
    await shop.open("giftDiscountInactive", "/products/shirt");
    await shop.addFromProductPage("shirt", { qty: 2 });
    const cart = await shop.cart();
    expect(paidAutoLines(cart), "gift charged at full price").toEqual([]);
    expect(cart.total_price).toBe(6000);
  });

  test("CON-12 gift is not left at full price when a non-combinable code wins @p0", async ({ shop, page }) => {
    await shop.open("giftNonCombinable", "/products/shirt");
    await shop.addFromProductPage("shirt", { qty: 2 });
    expect(qtyOf(await shop.cart(), 4001)).toBe(1);
    await page.locator("[data-ck=toggle-discount]").click();
    await page.locator(".ck-discount-input").fill("BIG25");
    await page.locator("[data-ck=apply-discount]").click();
    await shop.settle();
    expect(paidAutoLines(await shop.cart()), "gift charged at full price").toEqual([]);
  });

  test("CON-13 paid add-on is never pre-selected, even with an old defaultChecked config @p0", async ({ shop, page }) => {
    await shop.open("addonPrechecked", "/products/shirt");
    await shop.addFromProductPage("shirt");
    await expect(page.locator("[data-ck-addon]")).not.toBeChecked();
    expect(qtyOf(await shop.cart(), 5001)).toBe(0);
  });

  test("CON-14 ticking the add-on adds exactly one; unticking removes it and it stays removed @p0", async ({ shop, page }) => {
    await shop.open("addon", "/products/shirt");
    await shop.addFromProductPage("shirt");
    await page.locator("[data-ck-addon]").check();
    await shop.settle();
    expect(qtyOf(await shop.cart(), 5001)).toBe(1);
    await page.locator("[data-ck-addon]").uncheck();
    await shop.settle();
    expect(qtyOf(await shop.cart(), 5001)).toBe(0);
    await shop.reload();
    await shop.openDrawer();
    expect(qtyOf(await shop.cart(), 5001)).toBe(0);
    await expect(page.locator("[data-ck-addon]")).not.toBeChecked();
  });

  test("CON-15 rapid add-on toggling ends in the state the checkbox shows @p0", async ({ shop, page }) => {
    await shop.open("addon", "/products/shirt");
    await shop.addFromProductPage("shirt");
    await shop.fault("/cart/add", { delay: 400 });
    const box = page.locator("[data-ck-addon]");
    await box.click(); // tick
    await expect(box, "box shows the shopper's choice while the add is on its way").toBeChecked();
    // Mouse clicks are blocked while the drawer is busy (pointer-events: none); the keyboard isn't.
    await box.focus();
    await page.keyboard.press("Space"); // untick before the add finishes
    await shop.settle();
    const checked = await page.locator("[data-ck-addon]").isChecked();
    const qty = qtyOf(await shop.cart(), 5001);
    expect({ checked, qty }, "shopper unticked the add-on").toEqual({ checked: false, qty: 0 });
  });

  test("CON-15b double-ticking the add-on while it's being added never adds two @p0", async ({ shop, page }) => {
    await shop.open("addon", "/products/shirt");
    await shop.addFromProductPage("shirt");
    await shop.fault("/cart/add", { delay: 400 });
    const box = page.locator("[data-ck-addon]");
    await box.click();
    await box.click({ force: true });
    await box.click({ force: true });
    await shop.settle();
    const checked = await box.isChecked();
    const qty = qtyOf(await shop.cart(), 5001);
    expect(qty).toBeLessThanOrEqual(1);
    expect(qty, "cart matches the checkbox").toBe(checked ? 1 : 0);
  });

  test("CON-16 add-on is removed when the last real item is removed @p0", async ({ shop, page }) => {
    await shop.open("addon", "/products/shirt");
    await shop.addFromProductPage("shirt");
    await page.locator("[data-ck-addon]").check();
    await shop.settle();
    await page.locator(".ck-item", { hasText: "Shirt" }).locator("[data-ck=remove]").click();
    await shop.settle();
    expect((await shop.cart()).items).toEqual([]);
  });

  // 1.1.9: the shopper must see what the add-on costs before they can agree to it.
  test("CON-21 add-on shows its price even when the merchant's label has no {{price}} @p0", async ({ shop, page }) => {
    await shop.open("addonNoPriceLabel", "/products/shirt");
    await shop.addFromProductPage("shirt");
    await expect(page.locator(".ck-addon")).toContainText("Protect my order");
    await expect(page.locator(".ck-addon")).toContainText("2.99");
  });

  test("CON-22 add-on isn't offered while its price is unknown (slow price lookup) @p0", async ({ shop, page }) => {
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    await page.route("**/products/protection.js*", async (route) => { await held; await route.continue(); });
    await shop.open("addon", "/products/shirt");
    await shop.addFromProductPage("shirt");
    await expect(page.locator(".ck-item", { hasText: "Shirt" })).toBeVisible();
    await expect(page.locator("[data-ck-addon]"), "no checkbox before the price is shown").toHaveCount(0);
    release();
    await expect(page.locator(".ck-addon")).toContainText("2.99");
  });

  test("CON-23 add-on isn't offered when its price can't be loaded @p0", async ({ shop, page }) => {
    await page.route("**/products/protection.js*", (route) => route.fulfill({ status: 404, body: "{}" }));
    await shop.open("addon", "/products/shirt");
    await shop.addFromProductPage("shirt");
    await expect(page.locator(".ck-item", { hasText: "Shirt" })).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page.locator("[data-ck-addon]")).toHaveCount(0);
    expect(qtyOf(await shop.cart(), 5001)).toBe(0);
  });

  test("CON-17 upsells add nothing unless clicked; one click adds one unit @p0", async ({ shop, page }) => {
    await shop.open("upsell", "/products/shirt");
    await shop.addFromProductPage("shirt");
    await expect(page.locator(".ck-upsell")).toHaveCount(2);
    expect((await shop.cart()).item_count).toBe(1);
    await page.locator(".ck-upsell", { hasText: "Bottle" }).locator("select").selectOption("6002");
    await page.locator(".ck-upsell", { hasText: "Bottle" }).locator("[data-ck=upsell-add]").click();
    await shop.settle();
    const cart = await shop.cart();
    expect(qtyOf(cart, 6002)).toBe(1);
    expect(qtyOf(cart, 6001)).toBe(0);
  });

  test("CON-18 double-clicking an upsell button adds a single unit @p0", async ({ shop, page }) => {
    await shop.open("upsell", "/products/shirt");
    await shop.addFromProductPage("shirt");
    await shop.fault("/cart/add", { delay: 300 });
    await page.locator(".ck-upsell", { hasText: "Cap" }).locator("[data-ck=upsell-add]").dblclick();
    await shop.settle();
    expect(qtyOf(await shop.cart(), 3001)).toBe(1);
  });

  test("CON-19 concurrent theme cart updates don't bypass consent @p0", async ({ shop, page }) => {
    await shop.open("everything", "/products/shirt");
    await shop.addFromProductPage("shirt");
    // Another app/theme script changes the cart several times in parallel.
    await page.evaluate(() => Promise.all([
      fetch("/cart/add.js", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: 1001, quantity: 1 }) }),
      fetch("/cart/add.js", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: 3001, quantity: 1 }) }),
      fetch("/cart/change.js", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: "2001", quantity: 3 }) }).catch(() => null),
    ]));
    await page.waitForTimeout(300);
    await shop.settle();
    const cart = await shop.cart();
    expect(paidAutoLines(cart)).toEqual([]);
    expect(qtyOf(cart, 5001), "add-on was never ticked").toBe(0);
    expect(qtyOf(cart, 4001)).toBeLessThanOrEqual(1);
  });

  test("CON-20 expired and not-yet-started campaigns add nothing @p0", async ({ shop }) => {
    for (const sc of ["expired", "scheduled"]) {
      await shop.open(sc, "/products/shirt");
      await shop.addFromProductPage("shirt", { qty: 3 });
      expect(qtyOf(await shop.cart(), 4001), sc).toBe(0);
    }
  });
});
