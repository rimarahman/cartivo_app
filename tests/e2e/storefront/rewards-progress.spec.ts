// Rewards goal progress "after discounts" (campaign config.afterDiscounts, default on): subtotal goals count what the
// shopper pays (line and order discounts taken off); percent/fixed-off tiers always count the cart before discounts;
// quantity goals ignore the setting. Mug and Candle are $24.95 each; the Candle has a 20% line discount ($19.96).
import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

const MUG = 9001;
const CANDLE = 9021;
const message = (page: Page) => page.locator(".ck-goal-message");
const label = (page: Page, text: string) => page.locator(".ck-milestone-labels span", { hasText: text });
const dots = (page: Page) => page.locator(".ck-milestone");

test.describe("Rewards progress after discounts", () => {
  test("RWD-01 reported cart: after discounts, $45 goal is not unlocked and $0.09 remains @p1", async ({ shop, page, errors }) => {
    await shop.open("afterLine", "/");
    await shop.seed([{ id: MUG }, { id: CANDLE }]);
    await shop.openDrawer();
    const cart = await shop.cart();
    expect(cart.items.find((i) => i.variant_id === CANDLE)!.final_line_price).toBe(1996);
    expect(cart.total_price).toBe(4491); // what the shopper pays
    await expect(label(page, "Free shipping")).not.toHaveClass(/ck-done/);
    await expect(label(page, "Free express")).not.toHaveClass(/ck-done/);
    await expect(page.locator(".ck-milestone.ck-done")).toHaveCount(0);
    await expect(message(page)).toContainText("Free shipping");
    expect(errors).toEqual([]);
    await expect(message(page)).toContainText("$0.09"); // 45 - 44.91
  });

  test("RWD-02 reported cart, $50 goal only: $5.09 remaining after discounts @p1", async ({ shop, page }) => {
    await shop.open("afterLine50", "/");
    await shop.seed([{ id: MUG }, { id: CANDLE }]);
    await shop.openDrawer();
    await expect(dots(page).nth(0)).not.toHaveClass(/ck-done/);
    await expect(message(page)).toContainText("$5.09");
  });

  test("RWD-02b config without the afterDiscounts key counts after discounts (missing = true) @p1", async ({ shop, page }) => {
    await shop.open("afterLineMissing", "/");
    await shop.seed([{ id: MUG }, { id: CANDLE }]);
    await shop.openDrawer();
    // A config published without afterDiscounts behaves like "after discounts" (missing = true).
    await expect(label(page, "Free shipping")).not.toHaveClass(/ck-done/);
    await expect(message(page)).toContainText("$0.09");
  });

  test("RWD-03 afterDiscounts:false counts the pre-discount subtotal: $45 unlocked, $0.10 left to $50 @p1", async ({ shop, page }) => {
    await shop.open("beforeLine", "/");
    await shop.seed([{ id: MUG }, { id: CANDLE }]);
    await shop.openDrawer();
    expect((await shop.cart()).total_price).toBe(4491);
    await expect(label(page, "Free shipping")).toHaveClass(/ck-done/);
    await expect(label(page, "Free express")).not.toHaveClass(/ck-done/);
    await expect(dots(page).nth(0)).toHaveClass(/ck-done/);
    await expect(message(page)).toContainText("Free express");
    await expect(message(page)).toContainText("$0.10");
  });

  test("RWD-04 after discounts, an order-level discount (code) is subtracted from progress @p1", async ({ shop, page }) => {
    await shop.open("afterOrderCode", "/");
    await shop.seed([{ id: MUG }, { id: MUG }]); // $49.90
    await shop.openDrawer();
    await expect(dots(page).nth(0)).toHaveClass(/ck-done/); // single goal: no labels row
    await page.request.post("/cart/update.js", { data: { discount: "SAVE10" } });
    await shop.openDrawer();
    const cart = await shop.cart();
    expect(cart.cart_level_discount_applications).toEqual([{ title: "SAVE10", total_allocated_amount: 499 }]);
    expect(cart.total_price).toBe(4491);
    await expect(dots(page).nth(0)).not.toHaveClass(/ck-done/);
    await expect(message(page)).toContainText("$0.09");
  });

  test("RWD-05 afterDiscounts:false ignores the order-level discount @p2", async ({ shop, page }) => {
    await shop.open("beforeOrderCode", "/");
    await shop.seed([{ id: MUG }, { id: MUG }]);
    await page.request.post("/cart/update.js", { data: { discount: "SAVE10" } });
    await shop.openDrawer();
    expect((await shop.cart()).total_price).toBe(4491);
    await expect(dots(page).nth(0)).toHaveClass(/ck-done/);
    await expect(message(page)).not.toContainText("away");
  });

  test("RWD-06 a percent_off tier unlocks on the pre-discount value; free shipping counts after it @p1", async ({ shop, page, errors }) => {
    await shop.open("afterPercentTier", "/");
    await shop.seed([{ id: MUG }, { id: MUG }]); // $49.90 before, 10% off → $44.91 paid
    await shop.openDrawer();
    const cart = await shop.cart();
    expect(cart.total_price).toBe(4491); // the Function applied the 10% order reward
    expect(cart.cart_level_discount_applications.map((d) => d.total_allocated_amount)).toEqual([499]);
    await expect(label(page, "10% off")).toHaveClass(/ck-done/); // 44.91 < 45, but measured before discounts
    await expect(label(page, "Free shipping")).not.toHaveClass(/ck-done/); // 44.91 < 48
    await expect(message(page)).toContainText("Free shipping");
    // Stays unlocked after a re-render (no unlock / re-lock flip-flop).
    await shop.reload();
    await shop.openDrawer();
    await expect(label(page, "10% off")).toHaveClass(/ck-done/);
    expect((await shop.cart()).total_price).toBe(4491);
    expect(errors).toEqual([]);
    await expect(message(page)).toContainText("$3.09"); // 48 - 44.91
  });

  test("RWD-07 a percent_off tier below its threshold shows the pre-discount remaining @p2", async ({ shop, page }) => {
    await shop.open("afterPercentTier", "/");
    await shop.seed([{ id: MUG }]); // $24.95
    await shop.openDrawer();
    await expect(label(page, "10% off")).not.toHaveClass(/ck-done/);
    await expect(message(page)).toContainText("$20.05");
  });

  test("RWD-08 quantity basis ignores discounts @p1", async ({ shop, page }) => {
    await shop.open("afterQuantity", "/");
    await shop.seed([{ id: CANDLE }]);
    await shop.openDrawer();
    expect((await shop.cart()).total_price).toBe(1996);
    await expect(dots(page).nth(0)).not.toHaveClass(/ck-done/);
    await expect(message(page)).toContainText("1 item");
    await shop.seed([{ id: MUG }]);
    await shop.openDrawer();
    expect((await shop.cart()).total_price).toBe(4491);
    await expect(dots(page).nth(0)).toHaveClass(/ck-done/);
  });
});
