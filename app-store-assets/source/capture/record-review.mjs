// Records the Shopify review demo on the development store, end to end, with real clicks:
// admin (open app, dashboard, cart drawer upsell source, create upsell → activate, BXGY, free gift) and then the
// storefront (product page you shared → add to cart → drawer offers → gift → upsell → Shopify cart page).
// Writes frames + timeline to <outDir>; source/video/build-review.mjs turns them into the MP4 with captions.
//   node app-store-assets/source/capture/record-review.mjs <outDir>
// Creates three campaigns (named below) on the dev store; nothing else is changed. Never opens checkout.
import { attach, ADMIN, APP_URL, SHOP, assertDevStore } from "./browser.mjs";
import { Recorder } from "./recorder.mjs";
import { hideAdminOverlays, frameReady, pickProduct, save, scrollFrame, visible } from "./demo-helpers.mjs";

const OUT = process.argv[2];
const PRODUCT_URL = `${SHOP}/products/the-collection-snowboard-oxygen`; // the product page provided for the demo
const NAMES = { upsell: "Oxygen board upsell", bxgy: "Buy Oxygen, get a board free", gift: "Free ski wax over $100" };

const { page, cdp, close } = await attach({ width: 1600, height: 900, scale: 1.2 });
const rec = new Recorder(page, cdp, OUT, { width: 1920, height: 1080 });
const nav = (name) => page.getByRole("navigation").getByRole("link", { name, exact: true }).first();

try {
  // Off camera: leave any unsaved editor, put the upsell source back to automatic (so the demo shows the real
  // change and save), and start with an empty storefront cart.
  page.on("dialog", (d) => d.accept().catch(() => {}));
  await page.goto(`${APP_URL}/drawer`, { waitUntil: "domcontentloaded" });
  {
    const f = await frameReady(page);
    await f.getByText("Upsells & recommendations", { exact: true }).first().click();
    await page.waitForTimeout(800);
    if ((await f.getByLabel("Source").inputValue()) !== "auto") await f.getByLabel("Source").selectOption("auto");
    // The store's previous look (Forest), so the take shows a real change to Liquid glass.
    await f.getByText("Style", { exact: true }).first().click();
    await page.waitForTimeout(800);
    await f.getByRole("button", { name: /^Forest/ }).first().click();
    await page.waitForTimeout(800);
    const s = visible(f.getByRole("button", { name: "Save", exact: true }));
    if (!(await s.isDisabled().catch(() => true))) {
      await s.click();
      await f.getByText("All changes saved").first().waitFor({ timeout: 30000 });
    }
  }
  // Remove the demo campaigns from an earlier take (only these three names), so the take creates them fresh.
  await page.goto(`${APP_URL}/campaigns`, { waitUntil: "domcontentloaded" });
  {
    const f = await frameReady(page);
    for (const name of Object.values(NAMES)) {
      for (let i = 0; i < 5; i++) {
        const row = f.locator("s-table-row", { has: f.getByRole("link", { name, exact: true }) });
        if (!(await row.count())) break;
        await row.first().getByRole("button", { name: "Delete", exact: true }).click();
        await page.waitForTimeout(1200);
        await f.getByRole("button", { name: "Delete campaign", exact: true }).click();
        await page.waitForTimeout(2500);
        console.log("removed earlier take:", name);
      }
    }
  }
  await page.goto(SHOP + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => fetch("/cart/clear.js", { method: "POST" }).then(() => sessionStorage.clear()));
  await page.goto(ADMIN, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  await hideAdminOverlays(page);
  await rec.start();

  // 1. Open Cartivo from the Shopify admin
  rec.step("Shopify admin → Apps → Cartivo");
  await rec.pause(1500);
  await rec.click(nav("Cartivo Dev"), { pauseAfter: 500 });
  let frame = await frameReady(page);
  await hideAdminOverlays(page);

  // 2. Dashboard
  rec.step("Dashboard: live status of the cart drawer and a setup guide");
  await rec.pause(2500);
  await scrollFrame(rec, page, 420);
  rec.step("Campaign types you can create");
  await scrollFrame(rec, page, 520);
  await rec.pause(1500);

  // 3. Cart drawer page: upsell source
  rec.step("Cart drawer: looks, texts and a live preview");
  await rec.click(nav("Cart drawer"), { pauseAfter: 500 });
  frame = await frameReady(page);
  await rec.pause(1500);
  // Styles: click through the ready-made looks (the live preview updates), then keep Liquid glass and save.
  rec.step("Style: pick a ready-made look, the preview updates live");
  await rec.click(frame.getByText("Style", { exact: true }).first(), { pauseAfter: 1200 });
  for (const look of ["Aurora", "Sunset", "Ocean", "Midnight", "Liquid glass"]) {
    const b = frame.getByRole("button", { name: new RegExp(`^${look}`) }).first();
    if (!(await b.count())) { console.log("look not selectable on this plan:", look); continue; }
    await rec.click(b, { pauseAfter: 2000 });
  }
  rec.step("Keep Liquid glass and save");
  await save(rec, frame);
  await rec.click(frame.getByText("Style", { exact: true }).first(), { pauseAfter: 800 });
  rec.step("Upsells: use your upsell campaigns first, then Shopify recommendations");
  await rec.click(frame.getByText("Upsells & recommendations", { exact: true }).first(), { pauseAfter: 1200 });
  const source = frame.getByLabel("Source");
  await rec.moveTo(source);
  await source.selectOption("both");
  await rec.pause(1200);
  await save(rec, frame);

  // Sticky add-to-cart and floating cart button settings (already on for this store; shown, not changed)
  rec.step("Sticky add-to-cart bar and floating cart button");
  await rec.click(nav("Sticky & floating cart"), { pauseAfter: 500 });
  frame = await frameReady(page);
  await rec.pause(2500);
  await scrollFrame(rec, page, 450);
  await rec.pause(2000);

  // 4. Campaigns list → create an upsell (as a draft)
  rec.step("Campaigns: every offer in one list (older test campaigns are drafts)");
  await rec.click(nav("Campaigns"), { pauseAfter: 500 });
  frame = await frameReady(page);
  await rec.pause(1500);
  await scrollFrame(rec, page, 700);
  rec.step("Create an in-cart upsell");
  await rec.click(frame.getByRole("link", { name: /^In-cart upsell/ }).first(), { pauseAfter: 500 });
  frame = await frameReady(page);
  await rec.type(frame.getByLabel("Name (internal)"), NAMES.upsell);
  const status = frame.getByLabel("Status");
  await rec.moveTo(status);
  await status.selectOption("draft");
  await rec.pause(800);
  rec.step("When The Collection Snowboard: Oxygen is in the cart…");
  await pickProduct(rec, page, frame, frame.getByRole("button", { name: "Select products" }).first(), "Oxygen", "The Collection Snowboard: Oxygen");
  rec.step("…recommend The Collection Snowboard: Liquid");
  await pickProduct(rec, page, frame, frame.getByRole("button", { name: "Select products" }).first(), "Liquid", "The Collection Snowboard: Liquid");
  await rec.pause(1200);
  rec.step("Save the upsell (saved as a draft)");
  await save(rec, frame);

  // 5. Activate it from the list
  rec.step("Activate the campaign: it goes live on the storefront");
  await rec.click(nav("Campaigns"), { pauseAfter: 500 });
  frame = await frameReady(page);
  const row = frame.locator("s-table-row", { hasText: NAMES.upsell });
  await rec.pause(1200);
  await rec.click(row.getByRole("button", { name: "Activate", exact: true }), { pauseAfter: 600 });
  await row.getByText("Live", { exact: true }).waitFor({ timeout: 20000 });
  await rec.pause(2200);

  // 6. Buy X Get Y
  rec.step("Create a Buy X Get Y offer");
  await scrollFrame(rec, page, 900);
  await rec.click(frame.getByRole("link", { name: /^Buy X Get Y/ }).first(), { pauseAfter: 500 });
  frame = await frameReady(page);
  await rec.type(frame.getByLabel("Name (internal)"), NAMES.bxgy);
  rec.step("Customer buys The Collection Snowboard: Oxygen…");
  await pickProduct(rec, page, frame, frame.getByRole("button", { name: "Select products" }).first(), "Oxygen", "The Collection Snowboard: Oxygen");
  rec.step("…and gets The Complete Snowboard at 100% off, added automatically");
  await pickProduct(rec, page, frame, frame.getByRole("button", { name: "Select products" }).first(), "Complete", "The Complete Snowboard");
  await scrollFrame(rec, page, 300);
  await rec.pause(1500);
  await save(rec, frame);

  // 7. Free gift goal
  rec.step("Create a free gift goal");
  await rec.click(nav("Campaigns"), { pauseAfter: 500 });
  frame = await frameReady(page);
  await scrollFrame(rec, page, 1100);
  await rec.click(frame.getByRole("link", { name: /^Cart goals & free gifts/ }).first(), { pauseAfter: 500 });
  frame = await frameReady(page);
  await rec.type(frame.getByLabel("Name (internal)"), NAMES.gift);
  await scrollFrame(rec, page, 480);
  rec.step("Tier 1: carts of $100 or more get a free gift");
  await rec.type(frame.getByLabel("Minimum cart value"), "100");
  const reward = frame.getByLabel("Reward", { exact: true });
  await rec.moveTo(reward);
  await reward.selectOption("free_gift");
  await rec.pause(1000);
  await rec.type(frame.getByLabel("Reward name shown to customers"), "Free ski wax");
  rec.step("Gift options: the shopper picks one Ski Wax");
  await pickProduct(rec, page, frame, visible(frame.getByRole("button", { name: "Select products" })), "Ski Wax", "Selling Plans Ski Wax");
  await rec.pause(1200);
  await save(rec, frame);

  rec.step("Three campaigns live: upsell, Buy X Get Y and the free gift goal");
  await rec.click(nav("Campaigns"), { pauseAfter: 500 });
  frame = await frameReady(page);
  await rec.pause(3500);

  // 8. Storefront (the product page provided for the demo)
  rec.step("Storefront: The Collection Snowboard: Oxygen");
  assertDevStore(PRODUCT_URL);
  await page.goto(`${PRODUCT_URL}?_pos=1&_psq=The+Collection+Snowboard%3A+Oxygen&_ss=e`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.Cartivo?.__loaded, null, { timeout: 30000 });
  await rec.pause(2500);
  rec.step("Floating cart button (bottom right) on every page");
  await rec.moveTo(page.locator(".ck-float").first());
  await rec.pause(2200);
  rec.step("Scroll down: the sticky add-to-cart bar follows the shopper");
  for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 110); await rec.pause(70); }
  const stickyBtn = page.locator(".ck-sticky.ck-visible .ck-sticky-btn").first();
  await stickyBtn.waitFor({ timeout: 15000 });
  await rec.pause(2200);
  rec.step("Add to cart from the sticky bar: the Cartivo cart drawer opens");
  await rec.click(stickyBtn, { pauseAfter: 500 });
  await page.waitForSelector(".ck-root.ck-open .ck-drawer", { timeout: 20000 });
  // BXGY adds its free board; wait for Shopify's cart to have it.
  await page.waitForFunction(() => fetch("/cart.js").then((r) => r.json()).then((c) => c.items.some((l) => l.properties?._cartkit_bxgy)), null, { timeout: 30000, polling: 700 });
  await rec.pause(2500);
  rec.step("Buy X Get Y: The Complete Snowboard was added at $0");
  await rec.pause(3500);
  rec.step("Goal reached: choose a free gift");
  const gift = page.locator('.ck-root.ck-open [data-ck="pick-gift"]').first();
  await gift.waitFor({ timeout: 20000 });
  await rec.moveTo(gift);
  await rec.pause(1500);
  await rec.click(gift, { pauseAfter: 500 });
  await page.waitForFunction(() => fetch("/cart.js").then((r) => r.json()).then((c) => c.items.some((l) => l.properties?._cartkit_gift)), null, { timeout: 30000, polling: 700 });
  await rec.pause(2500);
  rec.step("The gift is in the cart for free");
  await page.locator(".ck-root.ck-open .ck-body").evaluate((b) => b.scrollTo({ top: 0, behavior: "smooth" })).catch(() => {});
  await rec.pause(3000);
  rec.step("Upsell: one click adds the recommended board");
  const upAdd = page.locator('.ck-root.ck-open [data-ck="upsell-add"]').first();
  await upAdd.waitFor({ timeout: 20000 });
  await rec.moveTo(upAdd);
  await rec.pause(1500);
  await rec.click(upAdd, { pauseAfter: 3500 });
  rec.step("Close the drawer: the floating button shows the item count");
  await rec.click(page.locator(".ck-root.ck-open [data-ck='close']").first(), { pauseAfter: 1500 });
  await rec.moveTo(page.locator(".ck-float").first());
  await rec.pause(2000);
  rec.step("Open the cart again from the floating button");
  await rec.click(page.locator(".ck-float").first(), { pauseAfter: 500 });
  await page.waitForSelector(".ck-root.ck-open .ck-drawer", { timeout: 20000 });
  await rec.pause(2500);
  rec.step("Shopify's cart page: the free board and the gift are $0");
  await rec.click(page.locator(".ck-root.ck-open").getByRole("link", { name: "View cart" }), { pauseAfter: 500 });
  await page.waitForURL(/\/cart/, { timeout: 20000 });
  await page.waitForLoadState("load").catch(() => {});
  await rec.pause(3000);
  await page.mouse.wheel(0, 260);
  await rec.pause(4000);
  rec.step("End of demo");
  await rec.pause(1500);
  await rec.stop();
  const cart = await page.evaluate(() => fetch("/cart.js").then((r) => r.json()));
  console.log("FINAL CART", JSON.stringify(cart.items.map((l) => ({ title: l.product_title, variant: l.variant_title, price: l.final_line_price / 100, cartivo: l.properties?._cartkit_gift ? "gift" : l.properties?._cartkit_bxgy ? "bxgy" : undefined })), null, 0), "total", cart.total_price / 100);
} catch (e) {
  await rec.stop().catch(() => {});
  await page.screenshot({ path: `${OUT}/failure.png` }).catch(() => {});
  console.error("FAILED:", e.message.split("\n")[0]);
  process.exitCode = 1;
} finally { await close(); }
