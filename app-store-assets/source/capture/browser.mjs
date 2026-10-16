// Shared browser setup for the App Store media captures.
// Attaches to a normal Chrome you signed in to yourself (own profile outside the repo, --remote-debugging-port=9222),
// so no Shopify credential or storefront password is ever typed, stored or logged by these scripts.
import { chromium } from "@playwright/test";

export const STORE = "cartivo-app-test"; // development store only
export const STORE_DOMAIN = `${STORE}.myshopify.com`;
export const CLIENT_ID = "ab4953ce279b779f3631932ee66569e8"; // Cartivo Dev (shopify.app.cartivo-dev.toml)
export const ADMIN = `https://admin.shopify.com/store/${STORE}`;
export const APP_URL = `${ADMIN}/apps/cartivo-dev/app`; // Cartivo Dev handle; deep links work under /app
export const SHOP = `https://${STORE_DOMAIN}`;

// Preferred: a normal Chrome you signed in to yourself, started with its own profile and
// --remote-debugging-port=9222 (see app-store-assets/README.md). Scripts attach to it and never see a credential.
export const CDP = process.env.CARTIVO_CDP || "http://127.0.0.1:9222";

// Attaches to the signed-in Chrome, reuses its open admin/storefront tab and sizes it for capture; close() restores it.
export async function attach({ width = 1600, height = 900, scale = 2 } = {}) {
  const browser = await chromium.connectOverCDP(CDP);
  const context = browser.contexts()[0];
  // Reuse the tab already open in that window (the signed-in admin tab first); no new tabs or windows.
  const pages = context.pages().filter((p) => /^https:\/\/(admin\.shopify\.com|cartivo-app-test\.myshopify\.com)/.test(p.url()));
  const page = pages.find((p) => p.url().startsWith("https://admin.shopify.com")) || pages[0] || context.pages()[0];
  await page.bringToFront().catch(() => {});
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile: false });
  const close = async () => {
    // Give the tab back as it was (normal size, desktop), leave it open, and only disconnect.
    await cdp.send("Emulation.clearDeviceMetricsOverride").catch(() => {});
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false }).catch(() => {});
    await cdp.send("Emulation.setUserAgentOverride", { userAgent: "" }).catch(() => {});
    await cdp.detach().catch(() => {});
    await browser.close().catch(() => {}); // over CDP this only disconnects; the window and tabs stay open
  };
  return { browser, context, page, cdp, close };
}

// Any URL outside the development store is refused, so a capture can never touch another shop.
export function assertDevStore(url) {
  const u = new URL(url);
  const ok = u.hostname === STORE_DOMAIN || (u.hostname === "admin.shopify.com" && u.pathname.startsWith(`/store/${STORE}`));
  if (!ok) throw new Error(`Refusing to open ${u.hostname}${u.pathname}: development store only`);
}

// The embedded app's iframe inside the admin.
export async function appFrame(page, timeout = 60000) {
  const handle = await page.waitForSelector('iframe[name="app-iframe"], iframe[title="Cartivo Dev"], main iframe', { timeout });
  const frame = await handle.contentFrame();
  await frame.waitForLoadState("domcontentloaded");
  return { frame, handle };
}
