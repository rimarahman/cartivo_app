// Theme compatibility: the drawer takes over cart icons and the theme's own cart drawer on themes we
// have no settings for. Each test adds a theme's markup and script to the harness page before Cartivo loads.
import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

// Runs before any page script, like a theme script in <head>; the markup is added to the header once parsed.
async function theme(page: Page, markup: string, script: () => void = () => {}) {
  await page.addInitScript(
    ({ markup, script }) => {
      new Function(script)();
      document.addEventListener("DOMContentLoaded", () => document.querySelector("header")!.insertAdjacentHTML("beforeend", markup));
    },
    { markup, script: `(${script.toString()})()` },
  );
}
const drawerOpen = (page: Page) => expect(page.locator(".ck-root")).toHaveClass(/ck-open/);

test.describe("Theme compatibility", () => {
  test("TC-01 Horizon: a theme click handler on document doesn't open its drawer as well @p1", async ({ shop, page }) => {
    await theme(
      page,
      `<cart-drawer-component><button type="button" class="header-actions__action" data-testid="horizon-cart">Bag</button><dialog id="horizon-dialog">Theme cart</dialog></cart-drawer-component>`,
      () => {
        // Horizon delegates on:click from a document capture listener registered before app scripts.
        document.addEventListener("click", (e) => {
          if ((e.target as Element).closest("cart-drawer-component > button")) (document.getElementById("horizon-dialog") as HTMLDialogElement).showModal();
        }, true);
      },
    );
    await shop.open("base");
    await page.getByTestId("horizon-cart").click();
    await drawerOpen(page);
    expect(await page.locator("#horizon-dialog").evaluate((d: HTMLDialogElement) => d.open)).toBe(false);
  });

  test("TC-02 a theme drawer opened from theme code is closed its own way and Cartivo's opens @p1", async ({ shop, page }) => {
    await theme(page, `<cart-drawer class="drawer"></cart-drawer>`, () => {
      customElements.define("cart-drawer", class extends HTMLElement {
        open() { this.classList.add("active"); document.body.classList.add("overflow-hidden"); }
        close() { this.classList.remove("active"); document.body.classList.remove("overflow-hidden"); }
      });
    });
    await shop.open("base");
    await page.evaluate(() => (document.querySelector("cart-drawer") as any).open());
    await drawerOpen(page);
    await expect(page.locator("cart-drawer")).not.toHaveClass(/active/);
    // The theme's scroll lock is released too, not left on an invisible drawer.
    await expect(page.locator("body")).not.toHaveClass(/overflow-hidden/);
  });

  test("TC-03 cart icons without a /cart link are recognised; buttons in a mini cart are not @p2", async ({ shop, page }) => {
    await theme(
      page,
      `<button type="button" aria-controls="theme-cart-panel" data-testid="aria-cart">Cart</button>
       <button type="button" class="site-header__cart-btn" data-testid="class-cart">Bag</button>
       <dialog open><button type="button" class="cart-remove" data-testid="mini-cart-btn">Remove</button></dialog>`,
    );
    await shop.open("base");
    for (const id of ["aria-cart", "class-cart"]) {
      await page.getByTestId(id).click();
      await drawerOpen(page);
      await page.evaluate(() => (window as any).Cartivo.close());
    }
    await page.getByTestId("mini-cart-btn").click();
    await expect(page.locator(".ck-root")).not.toHaveClass(/ck-open/);
  });
});
