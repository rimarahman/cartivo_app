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

test("only Starter (and 'no plan selected') lock the design looks", () => {
  for (const id of ["free", "choose"] as const) assert.equal(PLAN_FEATURES[id].designPresets, false, id);
  for (const id of ["trial", "basic", "grow", "pro"] as const) assert.equal(PLAN_FEATURES[id].designPresets, true, id);
});

test("Starter: a locked look is published as Minimal", () => {
  const aurora = { ...DEFAULT_SETTINGS.design, preset: "aurora" };
  const out = designForPlan(aurora, false);
  const minimal = DESIGN_PRESETS.find((p) => p.id === "minimal")!.design;
  assert.equal(out.preset, "minimal");
  assert.equal(out.accentColor, minimal.accentColor);
  assert.equal(out.checkoutStyle, minimal.checkoutStyle);
});

test("Starter keeps Minimal and fine-tuned ('custom') designs", () => {
  const custom = { ...DEFAULT_SETTINGS.design, preset: "custom", accentColor: "#123456" };
  assert.deepEqual(designForPlan(custom, false), custom);
  const minimal = { ...DEFAULT_SETTINGS.design, preset: "minimal" };
  assert.deepEqual(designForPlan(minimal, false), minimal);
});

test("paid plans and the trial keep every look", () => {
  const sunset = { ...DEFAULT_SETTINGS.design, preset: "sunset" };
  assert.deepEqual(designForPlan(sunset, true), sunset);
});
