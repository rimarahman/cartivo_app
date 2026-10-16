// Builds the promotional (feature) video, about 55 s, 1920x1080, 30 fps, H.264 + AAC:
//   intro card → listing images (real UI captures) with slow zoom → two short real screen-recorded clips (storefront
//   add to cart from record-promo-clip.mjs, drawer looks from the review recording) → closing card, cross-fades.
// Screen recording stays under 25% of the runtime (Shopify's feature-media guidance). Music is synthesized here
// with ffmpeg (no third-party audio, so no licensing questions). Captions are burned in; nothing claims results.
//   node app-store-assets/source/video/build-promo.mjs <reviewRecordingDir> <promoClipRecordingDir>
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const FF = process.env.FFMPEG || "ffmpeg";
const MARK_SVG = (size) => readFileSync(new URL("../../brand/cartivo-mark.svg", import.meta.url), "utf8").replace(/<!--[\s\S]*?-->/g, "").replace("<svg ", `<svg width="${size}" height="${size}" style="display:block;filter:drop-shadow(0 10px 24px rgba(0,0,0,.25))" `);
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const recDir = resolve(process.argv[2]);
const clipDir = resolve(process.argv[3]);
const work = resolve(recDir, "promo-build");
const outDir = resolve(root, "promotional-video");
mkdirSync(work, { recursive: true });
mkdirSync(outDir, { recursive: true });
const ff = (args) => execFileSync(FF, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
const VF = "fps=30,format=yuv420p";
const X = 0.6; // cross-fade seconds

// Cards
const card = (title, sub, extra = "") => `<!doctype html><html><body style="margin:0;width:1920px;height:1080px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:30px;font-family:'Segoe UI',system-ui,sans-serif;color:#fff;background:radial-gradient(1200px 800px at 80% 0%,rgba(255,255,255,.18),transparent 60%),linear-gradient(115deg,#4f46e5,#db2777)">
<div style="display:flex;align-items:center;gap:22px;font-size:84px;font-weight:750;letter-spacing:-.02em">${MARK_SVG(112)}Cartivo</div>
<div style="font-size:46px;font-weight:600;max-width:1500px;text-align:center;line-height:1.3">${title}</div>${sub ? `<div style="font-size:32px;opacity:.92;max-width:1400px;text-align:center;line-height:1.45">${sub}</div>` : ""}${extra}</body></html>`;
const pills = (items) => `<div style="display:flex;gap:18px;margin-top:10px">${items.map((t) => `<span style="padding:14px 28px;border-radius:99px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.4);font-size:30px;font-weight:600">${t}</span>`).join("")}</div>`;
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const cards = {
  intro: card("A slide cart with rewards and offers built in", "For Shopify stores"),
  benefits: card("Show offers where shoppers decide: the cart", "", pills(["Free gift goals", "Buy X Get Y", "In-cart upsells", "Your own look"])),
  outro: card("Cartivo: Slide Cart & Upsells", "Find Cartivo on the Shopify App Store"),
};
for (const [n, html] of Object.entries(cards)) { await page.setContent(html); await page.screenshot({ path: `${work}/${n}.png` }); }
await browser.close();

// Clips from the review recording (the build-review intermediate main.mp4 has the recording's own timeline)
const tl = JSON.parse(readFileSync(resolve(recDir, "timeline.json"), "utf8"));
const main = resolve(recDir, "build/main.mp4");
if (!existsSync(main)) throw new Error("run build-review.mjs on this recording first (needs build/main.mp4)");
// build/main.mp4 may be sped up (build-review REVIEW_SPEED); step times are converted to its timeline.
const SPEED = existsSync(resolve(recDir, "build/speed.json")) ? JSON.parse(readFileSync(resolve(recDir, "build/speed.json"), "utf8")).speed : 1;
const at = (prefix) => { const s = tl.steps.find((x) => x.text.startsWith(prefix)); if (!s) throw new Error("step not found: " + prefix); return s.t / SPEED; };

// Storefront clip: the dedicated recording at 1.3x, from just before Add to cart to the picked gift.
const ctl = JSON.parse(readFileSync(resolve(clipDir, "timeline.json"), "utf8"));
const CLIP_SPEED = 1.3;
const fwd = (p) => p.replace(/\\/g, "/");
let clist = "ffconcat version 1.0\n";
ctl.frames.forEach((fr, i) => {
  const nx = i + 1 < ctl.frames.length ? ctl.frames[i + 1].t : ctl.duration;
  clist += `file '${fwd(resolve(clipDir, fr.file))}'\nduration ${Math.max(0.001, (nx - fr.t) / CLIP_SPEED).toFixed(4)}\n`;
});
clist += `file '${fwd(resolve(clipDir, ctl.frames.at(-1).file))}'\n`;
writeFileSync(`${work}/storefront.ffconcat`, clist);
ff(["-f", "concat", "-safe", "0", "-i", `${work}/storefront.ffconcat`, "-vf", `scale=1920:1080:flags=lanczos,${VF}`, "-c:v", "libx264", "-crf", "18", "-r", "30", `${work}/storefront-full.mp4`]);
const sfStart = Math.max(0, ctl.steps.find((s) => s.text === "add").t / CLIP_SPEED - 0.4);

// Segments: [kind, source, seconds, caption]
const S = [
  ["card", "intro", 4, ""],
  ["card", "benefits", 4.5, ""],
  ["still", "01-cart-drawer-offers.png", 5, ""],
  ["sfclip", sfStart, 6.5, "Add to cart: a free board is added and the shopper picks a gift"],
  ["still", "02-free-gift-goal.png", 5, ""],
  ["still", "03-buy-x-get-y.png", 5, ""],
  ["still", "04-in-cart-upsell.png", 5, ""],
  ["still", "05-drawer-design.png", 4.5, ""],
  ["clip", at("Style: pick a ready-made look") + 9 / SPEED, 6, "Pick a look, including Liquid glass, and preview it live"],
  ["still", "07-campaigns.png", 4.5, ""],
  ["still", "08-mobile.png", 4.5, ""],
  ["card", "outro", 4.5, ""],
];
const parts = [];
S.forEach(([kind, src, dur, _], i) => {
  const out = `${work}/seg${String(i).padStart(2, "0")}.mp4`;
  if (kind === "card") {
    ff(["-loop", "1", "-t", String(dur), "-i", `${work}/${src}.png`, "-vf", `scale=1920:1080,${VF}`, "-c:v", "libx264", "-crf", "18", "-r", "30", out]);
  } else if (kind === "still") {
    // slow 4% zoom toward the centre (Ken Burns); the image is a real capture composition from screenshots/
    const frames = Math.round(dur * 30);
    ff(["-loop", "1", "-i", resolve(root, "screenshots", src), "-vf",
      `scale=3840:2160:flags=lanczos,zoompan=z='1+0.04*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1920x1080:fps=30,${VF}`,
      "-frames:v", String(frames), "-c:v", "libx264", "-crf", "18", "-r", "30", out]);
  } else if (kind === "sfclip") {
    ff(["-ss", String(src), "-t", String(dur), "-i", `${work}/storefront-full.mp4`, "-vf", VF, "-c:v", "libx264", "-crf", "18", "-r", "30", out]);
  } else {
    ff(["-ss", String(src), "-t", String(dur), "-i", main, "-vf", VF, "-c:v", "libx264", "-crf", "18", "-r", "30", out]);
  }
  parts.push({ out, dur, caption: S[i][3] });
});

// Join with cross-fades
let filter = "", last = "[0:v]", offset = 0;
for (let i = 1; i < parts.length; i++) {
  offset += parts[i - 1].dur - X;
  const tag = i === parts.length - 1 ? "[v]" : `[x${i}]`;
  filter += `${last}[${i}:v]xfade=transition=fade:duration=${X}:offset=${offset.toFixed(3)}${tag};`;
  last = tag;
}
const total = parts.reduce((a, p) => a + p.dur, 0) - X * (parts.length - 1);

// Captions for the clip segments
const ts = (s) => { const m = Math.floor(s / 60), x = s % 60; return `0:${String(m).padStart(2, "0")}:${x.toFixed(2).padStart(5, "0")}`; };
let t = 0; const cues = [];
parts.forEach((p, i) => { if (p.caption) cues.push({ start: t + 0.5, end: t + p.dur - X - 0.2, text: p.caption }); t += p.dur - X; });
writeFileSync(`${work}/captions.ass`, `[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Cap,Segoe UI,44,&H00FFFFFF,&H00FFFFFF,&H00000000,&H28531A4F,-1,0,0,0,100,100,0,0,3,20,0,2,80,80,54,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n` + cues.map((c) => `Dialogue: 0,${ts(c.start)},${ts(c.end)},Cap,,0,0,0,,${c.text}`).join("\n") + "\n");
writeFileSync(resolve(outDir, "cartivo-promo.en.srt"), cues.map((c, i) => `${i + 1}\n${ts(c.start).replace(/^0:/, "00:").replace(".", ",")}0 --> ${ts(c.end).replace(/^0:/, "00:").replace(".", ",")}0\n${c.text}\n`).join("\n"));

// Music bed: soft synthesized pad (C – Am – F – G, 4 s per chord), generated here; fades in and out.
const n = (a, b, c, d) => `if(eq(k,0),${a},if(eq(k,1),${b},if(eq(k,2),${c},${d})))`;
const k = "floor(mod(t,16)/4)";
const env = "(min(1,mod(t,4)*1.5)*(1-0.25*mod(t,4)/4))";
const voice = (f) => `(sin(2*PI*${f}*t)+0.35*sin(4*PI*${f}*t)+0.12*sin(6*PI*${f}*t))`;
const expr = `0.11*${env}*(${[voice(n(261.63, 220, 174.61, 196)), voice(n(329.63, 261.63, 220, 246.94)), voice(n(392, 329.63, 261.63, 293.66)), "0.6*" + voice(n(130.81, 110, 87.31, 98))].join("+")})`.replaceAll("k", k);
ff(["-f", "lavfi", "-i", `aevalsrc='${expr}':s=48000:d=${total.toFixed(2)}`, "-af",
  `lowpass=f=2400,aecho=0.8:0.6:120|240:0.25|0.15,afade=t=in:d=1.5,afade=t=out:st=${(total - 2.5).toFixed(2)}:d=2.5,volume=1.8`,
  "-c:a", "pcm_s16le", `${work}/music.wav`]);

const assPath = `${work}/captions.ass`.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1\\:");
const inputs = parts.flatMap((p) => ["-i", p.out]);
ff([...inputs, "-i", `${work}/music.wav`, "-filter_complex", `${filter}[v]ass='${assPath}'[vo]`, "-map", "[vo]", "-map", `${parts.length}:a`,
  "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart",
  resolve(outDir, "cartivo-promo.mp4")]);
const clipSecs = parts.filter((_, i) => S[i][0] !== "card" && S[i][0] !== "still").reduce((a, p) => a + p.dur, 0);
writeFileSync(resolve(work, "summary.json"), JSON.stringify({ total, clipSecs, screencastShare: clipSecs / total, segments: S.map(([k, s, d, c]) => ({ kind: k, source: typeof s === "number" ? `review recording @ ${s.toFixed(1)}s` : s, seconds: d, caption: c })) }, null, 1));
console.log(`done: ${total.toFixed(1)} s, screen recording ${(100 * clipSecs / total).toFixed(0)}%`);
