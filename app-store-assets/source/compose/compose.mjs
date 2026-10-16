// Builds the 1600x900 App Store listing images from real captures (app-store-assets/source/raw/*.png).
// Each capture is placed unmodified (only cropped and scaled) on a plain branded canvas with a short caption;
// nothing in the UI is drawn, retouched or invented. Edit listing.json and re-run:
//   node app-store-assets/source/compose/compose.mjs [file ...]
// listing.json: { images: [{ file, layout: "left"|"top", title, sub, alt, shots: [{ src, crop: [x,y,w,h], x, y, w }] }] }
// crop is in source pixels; x/y/w place the shot on the canvas (height follows the crop's aspect ratio).
import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync, existsSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const spec = JSON.parse(readFileSync(resolve(here, "listing.json"), "utf8"));
const MARK = readFileSync(resolve(root, "brand/cartivo-mark.svg"), "utf8").replace(/<!--[\s\S]*?-->/g, "");
const template = readFileSync(resolve(here, "template.html"), "utf8").replace("{{MARK}}", MARK);
const only = process.argv.slice(2);

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const report = [];
for (const item of spec.images) {
  if (only.length && !only.includes(item.file)) continue;
  const shots = [];
  for (const s of item.shots) {
    const p = resolve(root, "source/raw", s.src);
    if (!existsSync(p)) throw new Error(`missing capture ${s.src}`);
    const [cx, cy, cw, ch] = s.crop;
    const scale = s.w / cw;
    const h = Math.round(ch * scale);
    const cls = s.phone ? "shot phone" : "shot";
    shots.push(`<div class="${cls}" style="left:${s.x}px;top:${s.y}px;width:${s.w}px;height:${h}px"><img src="${pathToFileURL(p).href}" style="left:${-cx * scale}px;top:${-cy * scale}px;width:${s.srcW * scale}px" alt=""></div>`);
    report.push({ file: item.file, src: s.src, scale: +scale.toFixed(3), placed: [s.x, s.y, s.w, h], bottom: s.y + h, right: s.x + s.w });
  }
  const html = template
    .replace("{{LAYOUT}}", item.layout)
    .replace("{{TITLE}}", item.title)
    .replace("{{SUB}}", item.sub)
    .replace("{{SHOTS}}", shots.join(""));
  // Loaded from a file (not setContent) so Chrome lets the page read the local captures.
  const tmp = resolve(here, ".render.html");
  writeFileSync(tmp, html);
  await page.goto(pathToFileURL(tmp).href, { waitUntil: "load" });
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  await page.evaluate(() => document.fonts.ready);
  const out = resolve(root, item.dir || "screenshots", item.file);
  mkdirSync(dirname(out), { recursive: true });
  await page.screenshot({ path: out, type: "png" });
  console.log("wrote", item.file);
}
writeFileSync(resolve(here, "placement-report.json"), JSON.stringify(report, null, 1));
await browser.close();
