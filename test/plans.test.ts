// Plan gating behind the campaign editor and Campaigns page (BFS 4.3.7: plan-gated types can't be created,
// saved or activated). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PLAN_FEATURES, canUse, planFor, type PlanId, type PlanInfo } from "../app/lib/plans.ts";
import { DEFAULT_SETTINGS, DESIGN_PRESETS, designForPlan } from "../app/lib/defaults.ts";

const plan = (id: PlanId): PlanInfo => ({
  id,
  name: id,
  trialEndsAt: null,
  trialDaysLeft: 0,
  subscriptionId: null,
  features: { ...PLAN_FEATURES[id], maxActiveCampaigns: null },
});

test("Starter and 'no plan selected' include no campaign type", () => {
  for (const id of ["free", "choose"] as const) {
    for (const type of ["rewards", "announcement", "upsell", "addon", "bxgy", "volume"] as const) {
      assert.equal(canUse(plan(id), type), false, `${id} / ${type}`);
    }
  }
});

test("each campaign type unlocks on the cheapest plan that includes it", () => {
  assert.equal(planFor("rewards"), "basic");
  assert.equal(planFor("announcement"), "basic");
  assert.equal(planFor("upsell"), "grow");
  assert.equal(planFor("addon"), "grow");
  assert.equal(planFor("bxgy"), "grow");
  assert.equal(planFor("volume"), "pro");
});

test("Essential locks Growth and Premium types", () => {
  assert.equal(canUse(plan("basic"), "rewards"), true);
  assert.equal(canUse(plan("basic"), "bxgy"), false);
  assert.equal(canUse(plan("basic"), "volume"), false);
});

test("trial and Premium unlock every type", () => {
  for (const id of ["trial", "pro"] as const) {
    for (const type of ["rewards", "announcement", "upsell", "addon", "bxgy", "volume"] as const) {
      assert.equal(canUse(plan(id), type), true, `${id} / ${type}`);
    }
  }
});

// The plan cards say "3 cart designs", "5 cart designs" and "All 7 cart designs".
test("each plan unlocks more design looks: Starter 1, Essential 3, Growth 5, Premium and trial all", () => {
  const count = (id: keyof typeof PLAN_FEATURES) => DESIGN_PRESETS.filter((p) => p.tier <= PLAN_FEATURES[id].designTier).length;
  assert.equal(count("free"), 1);
  assert.equal(count("choose"), 1);
  assert.equal(count("basic"), 3);
  assert.equal(count("grow"), 5);
  assert.equal(count("pro"), 7);
  assert.equal(DESIGN_PRESETS.length, 7);
  assert.equal(count("trial"), DESIGN_PRESETS.length);
});

test("a look above the plan is published as Minimal", () => {
  const aurora = { ...DEFAULT_SETTINGS.design, preset: "aurora" };
  const minimal = DESIGN_PRESETS.find((p) => p.id === "minimal")!.design;
  for (const tier of [0, 1, 2] as const) {
    const out = designForPlan(aurora, tier);
    assert.equal(out.preset, "minimal");
    assert.equal(out.accentColor, minimal.accentColor);
    assert.equal(out.checkoutStyle, minimal.checkoutStyle);
  }
  assert.equal(designForPlan({ ...DEFAULT_SETTINGS.design, preset: "sunset" }, 1).preset, "minimal");
});

test("a look within the plan is kept", () => {
  const ocean = { ...DEFAULT_SETTINGS.design, preset: "ocean", glass: false };
  assert.deepEqual(designForPlan(ocean, 1), ocean);
  const sunset = { ...DEFAULT_SETTINGS.design, preset: "sunset", glass: false };
  assert.deepEqual(designForPlan(sunset, 2), sunset);
  const glass = { ...DEFAULT_SETTINGS.design, preset: "glass", glass: true };
  assert.deepEqual(designForPlan(glass, 3), glass);
});

test("fine-tuned ('custom') designs are kept, without liquid glass below Premium", () => {
  const custom = { ...DEFAULT_SETTINGS.design, preset: "custom", accentColor: "#123456", glass: true };
  assert.deepEqual(designForPlan(custom, 0), { ...custom, glass: false });
  assert.deepEqual(designForPlan(custom, 2), { ...custom, glass: false });
  assert.deepEqual(designForPlan(custom, 3), custom);
});

test("the glass effect layers on any look, only on Premium", () => {
  const sunsetGlass = { ...DEFAULT_SETTINGS.design, preset: "sunset", glass: true };
  assert.deepEqual(designForPlan(sunsetGlass, 3), sunsetGlass);
  assert.deepEqual(designForPlan(sunsetGlass, 2), { ...sunsetGlass, glass: false });
  const fallback = designForPlan(sunsetGlass, 1);
  assert.equal(fallback.preset, "minimal");
  assert.equal(fallback.glass, false);
  assert.ok(DESIGN_PRESETS.every((p) => p.id === "glass" || !("glass" in p.design)));
});
