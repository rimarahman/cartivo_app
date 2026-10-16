// Checks every delivered asset and writes reports/asset-validation.json (used by the validation report).
// Images: format and exact size. Videos: codec, size, fps, duration, audio, full decode with zero errors.
//   FFMPEG=... FFPROBE=... node app-store-assets/source/validate.mjs
import { readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FF = process.env.FFMPEG || "ffmpeg", FP = process.env.FFPROBE || "ffprobe";
const probe = (f) => JSON.parse(execFileSync(FP, ["-v", "error", "-show_streams", "-show_format", "-of", "json", f]).toString());
const results = [];
const check = (file, expect) => {
  const p = probe(file);
  const v = p.streams.find((s) => s.codec_type === "video");
  const a = p.streams.find((s) => s.codec_type === "audio");
  const r = { file: relative(root, file).replace(/\\/g, "/"), bytes: statSync(file).size, width: v?.width, height: v?.height, codec: v?.codec_name, issues: [] };
  if (expect.w && (r.width !== expect.w || r.height !== expect.h)) r.issues.push(`size ${r.width}x${r.height}, expected ${expect.w}x${expect.h}`);
  if (expect.video) {
    r.fps = v.r_frame_rate; r.pix_fmt = v.pix_fmt; r.duration = +(+p.format.duration).toFixed(2);
    r.audio = a ? `${a.codec_name} ${a.sample_rate} Hz ${a.channels} ch` : "none";
    if (v.codec_name !== "h264") r.issues.push("not H.264");
    if (v.pix_fmt !== "yuv420p") r.issues.push("not yuv420p");
    if (expect.audio && !a) r.issues.push("no audio track");
    if (a) r.av_offset_s = +((+a.start_time || 0) - (+v.start_time || 0)).toFixed(3), r.audio_duration = +(+a.duration).toFixed(2);
    const d = spawnSync(FF, ["-v", "error", "-i", file, "-f", "null", "-"], { encoding: "utf8" });
    r.decode_errors = (d.stderr || "").trim().split("\n").filter(Boolean).length;
    if (r.decode_errors) r.issues.push(`${r.decode_errors} decode error lines`);
  }
  results.push(r);
};
const list = (dir, ext) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(ext)).map((f) => resolve(dir, f)) : []);

for (const f of list(resolve(root, "screenshots"), ".png")) check(f, { w: 1600, h: 900 });
for (const f of list(resolve(root, "screenshots/feature"), ".png")) check(f, { w: 1600, h: 900 });
check(resolve(root, "brand/cartivo-app-icon-1200.png"), { w: 1200, h: 1200 });
for (const f of list(resolve(root, "review-demo"), ".mp4")) check(f, { w: 1920, h: 1080, video: true });
for (const f of list(resolve(root, "promotional-video"), ".mp4")) check(f, { w: 1920, h: 1080, video: true, audio: true });
writeFileSync(resolve(root, "reports/asset-validation.json"), JSON.stringify({ at: new Date().toISOString(), results }, null, 1));
for (const r of results) console.log(r.issues.length ? "FAIL" : "ok  ", r.file, r.width + "x" + r.height, r.duration ? `${r.duration}s ${r.fps} audio:${r.audio}` : "", r.issues.join("; "));
