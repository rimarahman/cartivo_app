// Plan resolution from Shopify's subscription list (billing approve / decline / cancel / upgrade / downgrade, and
// the app's 7-day trial). The Shopify side of these flows (charge approval page) needs a live store; this checks
// what the app does with each answer. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BILLING_PLAN_NAMES, PAID_PLANS, PLAN_ORDER, TRIAL_DAYS, billingPlanName, resolvePlan, trialState } from "../app/lib/plans.ts";

const DAY = 864e5;
const NOW = Date.UTC(2026, 9, 16, 12);
const activeTrial = trialState(new Date(NOW - 2 * DAY), NOW);
const endedTrial = trialState(new Date(NOW - (TRIAL_DAYS + 1) * DAY), NOW);
const sub = (name: string, status = "ACTIVE", id = `gid://shopify/AppSubscription/${name}`) => ({ id, name, status });

test("trial: active for 7 days from the first visit, then over", () => {
  assert.equal(activeTrial.active, true);
  assert.equal(activeTrial.daysLeft, 5);
  assert.equal(endedTrial.active, false);
  assert.equal(endedTrial.daysLeft, 0);
  const edge = trialState(new Date(NOW - TRIAL_DAYS * DAY), NOW);
  assert.equal(edge.active, false, "the trial ends exactly 7 days after it started");
});

test("approved charge: the active subscription's plan applies, with its id (needed to cancel it)", () => {
  const plan = resolvePlan([sub("Growth")], endedTrial, {}, false);
  assert.equal(plan.id, "grow");
  assert.equal(plan.subscriptionId, "gid://shopify/AppSubscription/Growth");
  assert.equal(plan.features.liveChat, true);
});

test("approved charge during the trial: the paid plan wins and the trial end is still shown", () => {
  const plan = resolvePlan([sub("Essential")], activeTrial, { trialEndsAt: "x", trialDaysLeft: 5 }, false);
  assert.equal(plan.id, "basic");
  assert.equal(plan.trialDaysLeft, 5);
});

test("declined or pending charge: not a paid plan (trial, then 'choose')", () => {
  for (const status of ["DECLINED", "PENDING", "EXPIRED", "FROZEN", "CANCELLED"]) {
    assert.equal(resolvePlan([sub("Premium", status)], activeTrial, {}, false).id, "trial", status);
    assert.equal(resolvePlan([sub("Premium", status)], endedTrial, {}, false).id, "choose", status);
  }
});

test("cancelled to Starter: free after the trial, never 'choose' again", () => {
  const plan = resolvePlan([], endedTrial, {}, true);
  assert.equal(plan.id, "free");
  assert.equal(plan.subscriptionId, null);
  assert.deepEqual(plan.features.campaignTypes, []);
});

test("trial over and no plan picked: 'choose' (nothing unlocked)", () => {
  const plan = resolvePlan([], endedTrial, {}, false);
  assert.equal(plan.id, "choose");
  assert.equal(plan.features.maxActiveCampaigns, 0);
});

test("upgrade/downgrade: the ACTIVE subscription decides, a replaced one is ignored", () => {
  // Shopify keeps the old subscription CANCELLED and the new one ACTIVE after a plan change.
  assert.equal(resolvePlan([sub("Essential", "CANCELLED"), sub("Premium")], endedTrial, {}, false).id, "pro");
  assert.equal(resolvePlan([sub("Premium", "CANCELLED"), sub("Essential")], endedTrial, {}, false).id, "basic");
});

test("a subscription with an unknown name (another app's or an old plan) unlocks nothing", () => {
  assert.equal(resolvePlan([sub("Pro Max")], endedTrial, {}, false).id, "choose");
});

test("unlimited campaigns serialise as null (JSON-safe), and the plan table can't be mutated through a result", () => {
  const plan = resolvePlan([sub("Premium")], endedTrial, {}, false);
  assert.equal(plan.features.maxActiveCampaigns, null);
  plan.features.campaignTypes.length = 0;
  assert.ok(resolvePlan([sub("Premium")], endedTrial, {}, false).features.campaignTypes.length > 0);
});

test("live chat by plan: open in the trial, Growth and Premium; locked on Essential, Starter and after the trial", () => {
  const chat = (subs: ReturnType<typeof sub>[], trial: typeof activeTrial, freeChosen = false) =>
    resolvePlan(subs, trial, {}, freeChosen).features.liveChat;
  assert.equal(chat([], activeTrial), true, "trial");
  assert.equal(chat([sub("Growth")], endedTrial), true, "Growth");
  assert.equal(chat([sub("Premium")], endedTrial), true, "Premium");
  assert.equal(chat([sub("Essential")], endedTrial), false, "Essential");
  assert.equal(chat([sub("Essential")], activeTrial), false, "Essential bought during the trial: the paid plan decides");
  assert.equal(chat([], endedTrial, true), false, "Starter (free)");
  assert.equal(chat([], endedTrial), false, "trial over, no plan picked");
});

test("yearly plans: same features as monthly, and the billing cycle comes from the subscription name", () => {
  for (const [name, id] of [["Essential", "basic"], ["Growth", "grow"], ["Premium", "pro"]] as const) {
    const monthly = resolvePlan([sub(name)], endedTrial, {}, false);
    const yearly = resolvePlan([sub(`${name} Yearly`)], endedTrial, {}, false);
    assert.equal(yearly.id, id, name);
    assert.equal(monthly.cycle, "monthly", name);
    assert.equal(yearly.cycle, "yearly", name);
    assert.deepEqual(yearly.features, monthly.features, name);
    assert.equal(yearly.subscriptionId, `gid://shopify/AppSubscription/${name} Yearly`, "needed to cancel it");
  }
  assert.equal(resolvePlan([], activeTrial, {}, false).cycle, null, "no subscription, no cycle");
});

test("monthly to yearly: the ACTIVE subscription decides while the old one is replaced", () => {
  const plan = resolvePlan([sub("Growth", "CANCELLED"), sub("Growth Yearly")], endedTrial, {}, false);
  assert.equal(plan.id, "grow");
  assert.equal(plan.cycle, "yearly");
  // Yearly to monthly is deferred by Shopify: the yearly plan stays ACTIVE until its year ends.
  const deferred = resolvePlan([sub("Growth Yearly"), sub("Growth", "ACCEPTED")], endedTrial, {}, false);
  assert.equal(deferred.cycle, "yearly");
});

test("billing plan names match the plans configured in shopify.server.ts", () => {
  assert.deepEqual(BILLING_PLAN_NAMES, ["Essential", "Essential Yearly", "Growth", "Growth Yearly", "Premium", "Premium Yearly"]);
  assert.equal(billingPlanName("pro", "yearly"), "Premium Yearly");
  assert.equal(billingPlanName("basic"), "Essential");
  for (const p of PLAN_ORDER) assert.equal(PAID_PLANS[p].yearlyPrice, PAID_PLANS[p].price * 10, "2 months free");
});
