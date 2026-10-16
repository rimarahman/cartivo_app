import { test, expect } from "./fixtures";

// SF-SMOKE-01: harness serves the real theme extension, Cartivo boots without errors, add to cart opens the drawer.
test("SF-SMOKE-01 drawer boots and add-to-cart opens it @smoke", async ({ shop, page, errors }) => {
  await shop.open("base", "/products/shirt");
  await expect(page.locator(".ck-root")).toHaveCount(1);
  await shop.addFromProductPage("shirt");
  await expect(shop.items()).toHaveCount(1);
  await expect(shop.items().first()).toContainText("Shirt");
  const cart = await shop.cart();
  expect(cart.item_count).toBe(1);
  expect(cart.total_price).toBe(3000);
  await expect(page.locator(".ck-subtotal")).toContainText("$30.00");
  expect(errors).toEqual([]);
});
