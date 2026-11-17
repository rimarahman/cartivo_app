// Subscriptions (selling plans): the purchase option the shopper picks must reach the cart, whichever way the
// subscription widget stores it, through both the theme's add-to-cart button and Cartivo's sticky bar.
// Regression for the App Store review: a $21.21 subscription of "Selling Plans Ski Wax" arrived as a $24.95 one-time item.
import { test, expect, type ServerCart } from "./fixtures";

const WAX = 11001;
const PLAN = 7001;
const line = (cart: ServerCart) => cart.items.find((i) => i.variant_id === WAX) as any;

async function pick(page: import("@playwright/test").Page, plan: number | "once") {
  await page.getByTestId(`plan-${plan}`).check();
}

test.describe("Subscriptions", () => {
  for (const widget of ["inside", "outside"]) {
    test(`SUB-01 subscription picked in a widget ${widget} the form is kept, also when added twice @p1`, async ({ shop, page, errors }) => {
      await shop.open("base", `/products/ski-wax?widget=${widget}`);
      await pick(page, PLAN);
      await shop.addFromProductPage("ski-wax");
      await pick(page, PLAN);
      await shop.addFromProductPage("ski-wax");
      const cart = await shop.cart();
      expect(cart.items).toHaveLength(1);
      expect(line(cart).quantity).toBe(2);
      expect(line(cart).selling_plan_allocation?.selling_plan.id).toBe(PLAN);
      expect(cart.total_price).toBe(2121 * 2);
      await expect(page.locator(".ck-item")).toContainText("Delivery every week");
      expect(errors).toEqual([]);
    });

    test(`SUB-02 one-time purchase picked in a widget ${widget} the form adds no plan @p1`, async ({ shop, page }) => {
      await shop.open("base", `/products/ski-wax?widget=${widget}`);
      await pick(page, "once");
      await shop.addFromProductPage("ski-wax");
      const cart = await shop.cart();
      expect(line(cart).selling_plan_allocation).toBeNull();
      expect(cart.total_price).toBe(2495);
    });
  }

  // Real store (Dawn + <product-subscriptions>): the plan lives in the installment form, one-time is "onetime".
  for (const [plan, price] of [[PLAN, 2121], ["once", 2495]] as const) {
    test(`SUB-09 Dawn installment-form widget: ${plan} reaches the cart, from the theme button and the sticky bar @p0`, async ({ shop, page, errors }) => {
      await shop.open("base", "/products/ski-wax?widget=installment");
      await pick(page, plan);
      await shop.addFromProductPage("ski-wax");
      await page.evaluate(() => { (window as any).Cartivo.close(); window.scrollTo(0, 1500); });
      const bar = page.locator(".ck-sticky.ck-visible");
      await expect(bar.locator(".ck-sticky-price")).toContainText(plan === "once" ? "$24.95" : "$21.21");
      await bar.locator(".ck-sticky-btn").click();
      await expect(page.locator(".ck-root")).toHaveClass(/ck-open/);
      await shop.settle();
      const cart = await shop.cart();
      expect(cart.items).toHaveLength(1);
      expect(line(cart).quantity).toBe(2);
      expect(line(cart).selling_plan_allocation?.selling_plan.id ?? null).toBe(plan === "once" ? null : PLAN);
      expect(cart.total_price).toBe(price * 2);
      expect(errors).toEqual([]);
    });
  }

  test("SUB-03 subscription kept in the URL only (selling_plan parameter) is kept @p1", async ({ shop }) => {
    await shop.open("base", `/products/ski-wax?widget=url&selling_plan=${PLAN}`);
    await shop.addFromProductPage("ski-wax");
    const cart = await shop.cart();
    expect(line(cart).selling_plan_allocation?.selling_plan.id).toBe(PLAN);
    expect(cart.total_price).toBe(2121);
  });

  for (const bad of ["999", "constructor"]) {
    test(`SUB-04 a selling_plan URL parameter the variant doesn't have (${bad}) is ignored @p2`, async ({ shop }) => {
      await shop.open("base", `/products/ski-wax?widget=url&selling_plan=${bad}`);
      await shop.addFromProductPage("ski-wax");
      const cart = await shop.cart();
      expect(line(cart).selling_plan_allocation).toBeNull();
      expect(cart.total_price).toBe(2495);
    });
  }

  test("SUB-07 a widget that disables its field for one-time purchase wins over a plan in the URL @p1", async ({ shop }) => {
    await shop.open("base", `/products/ski-wax?widget=disabled&selling_plan=${PLAN}`);
    await shop.addFromProductPage("ski-wax");
    const cart = await shop.cart();
    expect(line(cart).selling_plan_allocation).toBeNull();
    expect(cart.total_price).toBe(2495);
  });

  test("SUB-08 a quick-add form for another product in the section doesn't get the picked plan @p1", async ({ shop, page }) => {
    await shop.open("base", "/products/ski-wax?widget=outside");
    await pick(page, PLAN);
    await page.getByTestId("quick-add").click();
    await expect(page.locator(".ck-root")).toHaveClass(/ck-open/);
    await shop.settle();
    const cart = await shop.cart();
    expect(cart.items.map((i) => i.variant_id)).toEqual([2001]);
    await expect(page.locator(".ck-error-text")).toHaveCount(0);
  });

  for (const [plan, price, text] of [[PLAN, 2121, "$21.21"], ["once", 2495, "$24.95"]] as const) {
    test(`SUB-05 sticky add to cart shows and adds the purchase option picked (${plan}) @p1`, async ({ shop, page, errors }) => {
      await shop.open("base", "/products/ski-wax?widget=outside");
      await pick(page, plan);
      await page.evaluate(() => window.scrollTo(0, 1500));
      const bar = page.locator(".ck-sticky.ck-visible");
      await expect(bar).toBeVisible();
      await expect(bar.locator(".ck-sticky-price")).toContainText(text);
      await bar.locator(".ck-sticky-btn").click();
      await expect(page.locator(".ck-root")).toHaveClass(/ck-open/);
      await shop.settle();
      const cart = await shop.cart();
      expect(line(cart).selling_plan_allocation?.selling_plan.id ?? null).toBe(plan === "once" ? null : PLAN);
      expect(cart.total_price).toBe(price);
      expect(errors).toEqual([]);
    });
  }

  test("SUB-06 sticky price follows a purchase option change @p2", async ({ shop, page }) => {
    await shop.open("base", "/products/ski-wax?widget=inside");
    await pick(page, "once");
    await page.evaluate(() => window.scrollTo(0, 1500));
    const price = page.locator(".ck-sticky.ck-visible .ck-sticky-price");
    await expect(price).toContainText("$24.95");
    await page.evaluate(() => window.scrollTo(0, 0));
    await pick(page, PLAN);
    await page.evaluate(() => window.scrollTo(0, 1500));
    await expect(price).toContainText("$21.21");
  });
});
