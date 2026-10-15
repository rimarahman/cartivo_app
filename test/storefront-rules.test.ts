// Run with `npm test` (node --test; Node strips the TypeScript types).
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyBuyerProtection } from "../app/lib/storefront-rules.ts";

test("bxgy: free items keep auto-add", () => {
  assert.equal(applyBuyerProtection("bxgy", { percent: 100, autoAdd: true }).autoAdd, true);
});

test("bxgy: partly discounted items are never auto-added", () => {
  assert.equal(applyBuyerProtection("bxgy", { percent: 50, autoAdd: true }).autoAdd, false);
  assert.equal(applyBuyerProtection("bxgy", { percent: "99", autoAdd: true }).autoAdd, false);
});

test("bxgy: auto-add stays off when the merchant turned it off", () => {
  assert.equal(applyBuyerProtection("bxgy", { percent: 100, autoAdd: false }).autoAdd, false);
});

test("addon: defaultChecked is never published", () => {
  const cfg = applyBuyerProtection("addon", { label: "Gift wrap", defaultChecked: true });
  assert.equal("defaultChecked" in cfg, false);
  assert.equal(cfg.label, "Gift wrap");
});

test("announcement: per-visitor timer settings are dropped, the real deadline is kept", () => {
  const cfg = applyBuyerProtection("announcement", {
    timerEnabled: true,
    timerType: "evergreen",
    evergreenMinutes: 15,
    timerEnd: "2026-12-01T00:00:00.000Z",
  });
  assert.equal("timerType" in cfg, false);
  assert.equal("evergreenMinutes" in cfg, false);
  assert.equal(cfg.timerEnabled, true);
  assert.equal(cfg.timerEnd, "2026-12-01T00:00:00.000Z");
});

test("the stored config is not mutated", () => {
  const stored = { percent: 50, autoAdd: true };
  applyBuyerProtection("bxgy", stored);
  assert.deepEqual(stored, { percent: 50, autoAdd: true });
});

test("other campaign types pass through unchanged", () => {
  const cfg = { tiers: [{ id: "t1", threshold: 50 }] };
  assert.deepEqual(applyBuyerProtection("rewards", cfg), cfg);
});
