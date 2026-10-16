// Builds the review screencast MP4 from a recording made by source/capture/record-review.mjs:
// title card → the real recording (frames at their real timing, 30 fps) → end card, with burned-in English
// captions, plus a separate .srt. Needs ffmpeg (FFMPEG env var, default: ffmpeg on PATH).
//   node app-store-assets/source/video/build-review.mjs <recordingDir>
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const FF = process.env.FFMPEG || "ffmpeg";
const MARK_SVG = (size) => readFileSync(new URL("../../brand/cartivo-mark.svg", import.meta.url), "utf8").replace(/<!--[\s\S]*?-->/g, "").replace("<svg ", `<svg width="${size}" height="${size}" style="display:block;filter:drop-shadow(0 10px 24px rgba(0,0,0,.25))" `);
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const recDir = resolve(process.argv[2]);
const outDir = resolve(root, "review-demo");
const work = resolve(recDir, "build");
mkdirSync(outDir, { recursive: true });
mkdirSync(work, { recursive: true });
const tl = JSON.parse(readFileSync(resolve(recDir, "timeline.json"), "utf8"));
const CARD = 4; // seconds for title and end cards
// Playback speed of the recording (1.5 = 50% faster). Every frame is kept; only the timing is compressed.
const SPEED = Number(process.env.REVIEW_SPEED || 1.5);
const ff = (args) => execFileSync(FF, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });

// 1. Title and end cards (HTML → PNG, same brand colours as the listing images)
const card = (title, sub) => `<!doctype html><html><body style="margin:0;width:1920px;height:1080px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:26px;font-family:'Segoe UI',system-ui,sans-serif;color:#fff;background:linear-gradient(115deg,#4f46e5,#db2777)">
<div style="display:flex;align-items:center;gap:18px;font-size:44px;font-weight:700">${MARK_SVG(64)}Cartivo</div>
<div style="font-size:64px;font-weight:750;letter-spacing:-.02em">${title}</div><div style="font-size:30px;opacity:.92;max-width:1400px;text-align:center;line-height:1.45">${sub}</div></body></html>`;
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.setContent(card("App review demo", "Setup and core features on a Shopify development store.<br>Every step is a real screen recording; nothing is simulated."));
await page.screenshot({ path: `${work}/title.png` });
await page.setContent(card("Thanks for reviewing Cartivo", "Shown: dashboard, cart drawer settings, in-cart upsell, Buy X Get Y,<br>free gift goal, and the storefront cart drawer with Shopify's cart page."));
await page.screenshot({ path: `${work}/end.png` });
await browser.close();

// 2. The recording at its real timing (concat demuxer with per-frame durations)
const frames = tl.frames;
let list = "ffconcat version 1.0\n";
frames.forEach((f, i) => {
  const next = i + 1 < frames.length ? frames[i + 1].t : tl.duration;
  list += `file '${resolve(recDir, f.file).replace(/\\/g, "/")}'\nduration ${Math.max(0.001, (next - f.t) / SPEED).toFixed(4)}\n`;
});
list += `file '${resolve(recDir, frames.at(-1).file).replace(/\\/g, "/")}'\n`;
writeFileSync(`${work}/frames.ffconcat`, list);
const vf = "scale=1920:1080:flags=lanczos,fps=30,format=yuv420p";
writeFileSync(`${work}/speed.json`, JSON.stringify({ speed: SPEED }));
ff(["-f", "concat", "-safe", "0", "-i", `${work}/frames.ffconcat`, "-vf", vf, "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-r", "30", `${work}/main.mp4`]);
for (const n of ["title", "end"]) ff(["-loop", "1", "-t", String(CARD), "-i", `${work}/${n}.png`, "-vf", vf, "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-r", "30", `${work}/${n}.mp4`]);

// 3. Captions (timed against the final video: title card first)
const ts = (s, sep) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return sep === "," ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${x.toFixed(3).padStart(6, "0").replace(".", ",")}` : `${h}:${String(m).padStart(2, "0")}:${x.toFixed(2).padStart(5, "0")}`; };
const steps = tl.steps.filter((s) => s.text !== "End of demo");
const cues = steps.map((s, i) => ({ start: CARD + s.t / SPEED + 0.15, end: CARD + (i + 1 < steps.length ? steps[i + 1].t : tl.duration) / SPEED - 0.1, text: s.text }));
writeFileSync(resolve(outDir, "cartivo-review-demo.en.srt"), cues.map((c, i) => `${i + 1}\n${ts(c.start, ",")} --> ${ts(c.end, ",")}\n${c.text}\n`).join("\n"));
const ass = `[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Cap,Segoe UI,40,&H00FFFFFF,&H00FFFFFF,&H00000000,&H3C1D1A1F,-1,0,0,0,100,100,0,0,3,18,0,2,80,80,46,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n` +
  cues.map((c) => `Dialogue: 0,${ts(c.start)},${ts(c.end)},Cap,,0,0,0,,${c.text}`).join("\n") + "\n";
writeFileSync(`${work}/captions.ass`, ass);

// 4. Join and burn captions
writeFileSync(`${work}/parts.txt`, ["title", "main", "end"].map((n) => `file '${work.replace(/\\/g, "/")}/${n}.mp4'`).join("\n"));
ff(["-f", "concat", "-safe", "0", "-i", `${work}/parts.txt`, "-c", "copy", `${work}/joined.mp4`]);
const assPath = `${work}/captions.ass`.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1\\:");
ff(["-i", `${work}/joined.mp4`, "-vf", `ass='${assPath}'`, "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p", "-movflags", "+faststart", resolve(outDir, "cartivo-review-demo.mp4")]);
// Same video without burned captions (use with the .srt, e.g. on YouTube)
ff(["-i", `${work}/joined.mp4`, "-c", "copy", "-movflags", "+faststart", resolve(outDir, "cartivo-review-demo-no-captions.mp4")]);
console.log("done:", resolve(outDir, "cartivo-review-demo.mp4"));
