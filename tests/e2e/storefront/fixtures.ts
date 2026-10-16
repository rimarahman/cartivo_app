/* eslint-disable react-hooks/rules-of-hooks -- Playwright fixtures call use(), not a React hook */
import { test as base, expect, type Page } from "@playwright/test";

export type Line = {
  key: string; variant_id: number; product_id: number; quantity: number; properties: Record<string, string>;
  original_line_price: number; final_line_price: number;
};
export type ServerCart = { items: Line[]; total_price: number; item_count: number; note: string; discount_codes: { code: string }[] };
export type ServerState = { cart: ServerCart; log: any[]; track: any[] };

// Every test gets its own cart (cookie session) and collects page errors, so a JS exception fails the test.
export const test = base.extend<{ shop: Shop; errors: string[] }>({
  errors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await use(errors);
  },
  shop: async ({ page }, use) => use(new Shop(page)),
});
export { expect };

export class Shop {
  constructor(readonly page: Page) {}
  drawer = () => this.page.locator(".ck-drawer");
  items = () => this.page.locator(".ck-item");

  async open(scenario: string, to = "/") {
    await this.page.goto(`/__setup?scenario=${scenario}&to=${encodeURIComponent(to)}`);
    await this.page.waitForFunction(() => (window as any).Cartivo?.__loaded);
    await this.settle();
  }
  // Server-side cart: what Shopify would actually charge.
  async state(): Promise<ServerState> {
    return (await this.page.request.get("/__state")).json();
  }
  async cart() { return (await this.state()).cart; }
  async seed(items: { id: number; quantity?: number; properties?: Record<string, string> }[]) {
    await this.page.request.post("/__seed", { data: { items } });
  }
  async fault(path: string, f: { status?: number; delay?: number } | null) {
    await this.page.request.post("/__fault", { data: { [path]: f } });
  }
  // Waits until the drawer isn't busy and no cart request is in flight.
  async settle() {
    await this.page.waitForLoadState("networkidle");
    await expect(this.page.locator(".ck-root.ck-busy")).toHaveCount(0);
    await this.page.waitForLoadState("networkidle");
  }
  async addFromProductPage(handle: string, opts: { variant?: number; qty?: number } = {}) {
    if (!this.page.url().includes(`/products/${handle}`)) await this.page.goto(`/products/${handle}`);
    await this.page.waitForFunction(() => (window as any).Cartivo?.__loaded);
    // Same page as the last add: the open drawer's overlay covers the product form.
    await this.page.evaluate(() => (window as any).Cartivo.close());
    if (opts.variant) await this.page.getByTestId("variant").selectOption(String(opts.variant));
    if (opts.qty) await this.page.getByTestId("qty").fill(String(opts.qty));
    await this.page.getByTestId("add-to-cart").click();
    await expect(this.page.locator(".ck-root")).toHaveClass(/ck-open/);
    await this.settle();
  }
  async openDrawer() {
    // Refresh first: the cart may have been changed server-side (seed) since the page loaded.
    await this.page.evaluate(() => (window as any).Cartivo.refresh().then(() => (window as any).Cartivo.open()));
    await expect(this.page.locator(".ck-root")).toHaveClass(/ck-open/);
    await this.settle();
  }
  async reload() {
    await this.page.reload();
    await this.page.waitForFunction(() => (window as any).Cartivo?.__loaded);
    await this.settle();
  }
}

// Lines added by Cartivo for the shopper (gifts, auto-added Buy X Get Y items) that the shopper would pay for.
export const paidAutoLines = (cart: ServerCart) =>
  cart.items.filter((i) => (i.properties._cartkit_gift || i.properties._cartkit_bxgy) && i.final_line_price > 0);
export const qtyOf = (cart: ServerCart, variant: number) =>
  cart.items.filter((i) => i.variant_id === variant).reduce((s, i) => s + i.quantity, 0);
