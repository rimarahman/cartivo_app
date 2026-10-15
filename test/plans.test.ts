// Plan gating behind the campaign editor and Campaigns page (BFS 4.3.7: plan-gated types can't be created,
// saved or activated). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PLAN_FEATURES, canUse, planFor, type PlanId, type PlanInfo } from "../app/lib/plans.ts";

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
