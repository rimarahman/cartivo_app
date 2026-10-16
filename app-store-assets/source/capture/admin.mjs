// Real admin captures for the listing: only the app's own frame (no Shopify admin chrome or logo), at 2x.
// Uses the campaigns created by record-review.mjs. Read-only: opens pages and editors, never saves.
//   node app-store-assets/source/capture/admin.mjs
import { mkdirSync } from "node:fs";
import { attach, APP_URL } from "./browser.mjs";
import { hideAdminOverlays, frameReady } from "./demo-helpers.mjs";

const RAW = "app-store-assets/source/raw";
mkdirSync(RAW, { recursive: true });
const { page, close } = await attach({ width: 1600, height: 1000, scale: 2 });
page.on("dialog", (d) => d.accept().catch(() => {}));
const iframe = () => page.locator("iframe[name='app-iframe']").first();

async function open(path) {
  await page.goto(`${APP_URL}${path}`, { waitUntil: "domcontentloaded" });
  const frame = await frameReady(page);
  await hideAdminOverlays(page);
  await page.mouse.move(5, 995); // keep the pointer out of the shot
  return frame;
}
async function shot(name, frame, scrollTo) {
  if (scrollTo) {
    await frame.getByText(scrollTo, { exact: true }).first().evaluate((el) => el.scrollIntoView({ block: "start" }));
    await frame.evaluate(() => window.scrollBy(0, -24));
  }
  await page.waitForTimeout(1200);
  await iframe().screenshot({ path: `${RAW}/${name}.png` });
  console.log("captured", name);
}

try {
  let f = await open("");
  await shot("admin-dashboard", f);
  await f.evaluate(() => window.scrollBy(0, 760));
  await shot("admin-dashboard-types", f, "Campaign types");

  f = await open("/campaigns");
  await shot("admin-campaigns", f);
  const ids = {};
  for (const name of ["Oxygen board upsell", "Buy Oxygen, get a board free", "Free ski wax over $100"]) {
    ids[name] = (await f.getByRole("link", { name, exact: true }).first().getAttribute("href")).split("/").pop();
  }

  f = await open(`/campaigns/${ids["Oxygen board upsell"]}`);
  await shot("admin-upsell-editor", f);
  f = await open(`/campaigns/${ids["Buy Oxygen, get a board free"]}`);
  await shot("admin-bxgy-editor", f, "Buy X Get Y");
  f = await open(`/campaigns/${ids["Free ski wax over $100"]}`);
  await shot("admin-gift-editor", f, "Reward tiers");
  await shot("admin-gift-editor-top", f, "Goal settings");

  f = await open("/drawer");
  await shot("admin-drawer", f);
  await f.getByText("Style", { exact: true }).first().click();
  await page.waitForTimeout(1200);
  await shot("admin-drawer-style", f);
  await f.getByText("Style", { exact: true }).first().click();
  await page.waitForTimeout(800);
  await f.getByText("Upsells & recommendations", { exact: true }).first().click();
  await page.waitForTimeout(1000);
  await shot("admin-drawer-upsells", f, "Upsells & recommendations");
  f = await open("/sticky");
  await shot("admin-sticky", f);
} finally { await close(); }
