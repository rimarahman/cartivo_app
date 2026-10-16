// Renders the Cartivo logo files from app-store-assets/brand/cartivo-mark.svg:
//   brand/cartivo-app-icon-1200.png  (App Store app icon, 1200x1200, no transparency)
//   brand/cartivo-mark-512.png        (mark for docs and slides)
//   brand/cartivo-logo-horizontal.png / .svg (mark + wordmark, 1600x400, transparent)
//   node app-store-assets/source/brand/render-brand.mjs
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const brand = resolve(here, "../../brand");
const mark = readFileSync(resolve(brand, "cartivo-mark.svg"), "utf8");
const inner = mark.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const horizontal = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100" role="img" aria-label="Cartivo"><g>${inner}</g><text x="118" y="70" font-family="Segoe UI, Inter, system-ui, sans-serif" font-size="58" font-weight="700" letter-spacing="-1.5" fill="#1f1d3a">Cartivo</text></svg>`;
writeFileSync(resolve(brand, "cartivo-logo-horizontal.svg"), horizontal);

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
const render = async (svg, w, h, out, bg = "transparent") => {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0;background:${bg}">${svg.replace("<svg ", `<svg width="${w}" height="${h}" `)}</body></html>`);
  await page.screenshot({ path: resolve(brand, out), omitBackground: bg === "transparent" });
  console.log("wrote", out);
};
// App icon: full-bleed square (Shopify rounds the corners itself), so the rounded rect becomes a square.
await render(mark.replace('rx="24"', 'rx="0"'), 1200, 1200, "cartivo-app-icon-1200.png", "#4f46e5");
await render(mark, 512, 512, "cartivo-mark-512.png");
await render(horizontal, 1600, 400, "cartivo-logo-horizontal.png");
await browser.close();
