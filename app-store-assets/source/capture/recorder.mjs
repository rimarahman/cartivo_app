// Screen recorder for real browser sessions: CDP screencast frames (what Chrome actually painted) with their
// timestamps, a visible cursor overlay so viewers can follow each click, and a step log used for captions.
// The frames are turned into a constant-frame-rate MP4 by source/video/build-review.mjs.
import { mkdirSync, writeFileSync } from "node:fs";

// A dot that follows the real mouse in every frame (main page and app iframe); clicks pulse. Visual only.
export const CURSOR_SCRIPT = `(() => {
  if (window.__ckCursor || window.top !== window) return; window.__ckCursor = true;
  const add = () => {
    const c = document.createElement('div');
    c.id = '__ck_cursor';
    c.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(79,70,229,.35);border:2px solid rgba(79,70,229,.95);box-shadow:0 0 0 3px rgba(255,255,255,.7);z-index:2147483647;pointer-events:none;transition:transform .12s;transform:translate(-100px,-100px)';
    document.documentElement.appendChild(c);
    window.__ckMove = (x, y) => { c.style.transform = 'translate(' + x + 'px,' + y + 'px)'; };
    window.__ckClick = () => { c.animate([{ boxShadow: '0 0 0 3px rgba(255,255,255,.7)' }, { boxShadow: '0 0 0 16px rgba(79,70,229,0)' }], { duration: 450 }); };
    addEventListener('mousemove', (e) => window.__ckMove(e.clientX, e.clientY), true);
  };
  if (document.documentElement) add(); else addEventListener('DOMContentLoaded', add);
})();`;

export class Recorder {
  constructor(page, cdp, dir, { width, height }) {
    this.page = page; this.cdp = cdp; this.dir = dir; this.size = { width, height };
    this.frames = []; this.steps = []; this.t0 = null; this.mouse = { x: width / 2, y: height / 2 };
    mkdirSync(`${dir}/frames`, { recursive: true });
  }
  async start() {
    await this.page.context().addInitScript(CURSOR_SCRIPT);
    await this.page.evaluate(CURSOR_SCRIPT).catch(() => {});
    this.cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
      const t = metadata.timestamp;
      if (this.t0 === null) this.t0 = t;
      const file = `frames/${String(this.frames.length).padStart(6, "0")}.jpg`;
      writeFileSync(`${this.dir}/${file}`, Buffer.from(data, "base64"));
      this.frames.push({ file, t: t - this.t0 });
      await this.cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    });
    await this.cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: this.size.width * 2, maxHeight: this.size.height * 2, everyNthFrame: 1 });
    this.wall0 = Date.now();
  }
  now() { return (Date.now() - this.wall0) / 1000; }
  // A caption from now until the next step.
  step(text) { this.steps.push({ t: this.now(), text }); console.log(`[${this.now().toFixed(1)}s] ${text}`); }
  async pause(ms) { await this.page.waitForTimeout(ms); }
  // Smooth, visible mouse movement to a locator, then a real click.
  async moveTo(locator) {
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    const box = await locator.boundingBox();
    if (!box) throw new Error("element has no box: " + locator);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    // Step by step so the overlay also moves over the cross-origin app iframe (which swallows mousemove).
    const from = this.mouse, n = 16;
    for (let i = 1; i <= n; i++) {
      const e = 1 - Math.pow(1 - i / n, 3);
      const px = from.x + (x - from.x) * e, py = from.y + (y - from.y) * e;
      await this.page.mouse.move(px, py);
      await this.page.evaluate(([a, b]) => window.__ckMove?.(a, b), [px, py]).catch(() => {});
      await this.page.waitForTimeout(16);
    }
    this.mouse = { x, y };
    await this.pause(250);
  }
  async click(locator, { pauseAfter = 900 } = {}) {
    await this.moveTo(locator);
    await this.page.evaluate(() => window.__ckClick?.()).catch(() => {});
    await locator.click();
    await this.pause(pauseAfter);
  }
  async type(locator, text, { clear = true } = {}) {
    await this.click(locator, { pauseAfter: 200 });
    if (clear) { await this.page.keyboard.press("Control+A"); await this.page.keyboard.press("Backspace"); }
    await this.page.keyboard.type(text, { delay: 45 });
    await this.pause(400);
  }
  async stop() {
    await this.pause(800);
    await this.cdp.send("Page.stopScreencast").catch(() => {});
    // Screencast timestamps and wall-clock steps share the same start within a frame or two.
    writeFileSync(`${this.dir}/timeline.json`, JSON.stringify({ size: this.size, duration: this.now(), frames: this.frames, steps: this.steps }, null, 1));
  }
}
