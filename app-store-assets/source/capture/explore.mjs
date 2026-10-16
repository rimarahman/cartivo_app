// Opens each Cartivo admin page in the signed-in Chrome and saves a screenshot plus the accessibility tree of
// the app frame, so capture and recording scripts target real UI (nothing is clicked or saved).
//   node app-store-assets/source/capture/explore.mjs <outDir> [path ...]
import { mkdirSync, writeFileSync } from "node:fs";
import { attach, APP_URL, appFrame, assertDevStore } from "./browser.mjs";

const out = process.argv[2];
const paths = process.argv.slice(3).length ? process.argv.slice(3) : ["", "/campaigns", "/drawer"];
mkdirSync(out, { recursive: true });
const { page, close } = await attach({ width: 1600, height: 900, scale: 1 });
try {
  for (const p of paths) {
    const url = `${APP_URL}${p}`;
    assertDevStore(url);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const { frame, handle } = await appFrame(page);
    await frame.waitForSelector("s-page", { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(5000);
    const name = p.replace(/\W+/g, "_") || "_dashboard";
    await page.screenshot({ path: `${out}/${name}.png` });
    writeFileSync(`${out}/${name}.txt`, `${page.url()}\nframe box: ${JSON.stringify(await handle.boundingBox())}\n\n` + (await frame.locator("body").ariaSnapshot().catch((e) => String(e))));
    console.log("saved", name);
  }
} finally { await close(); }
