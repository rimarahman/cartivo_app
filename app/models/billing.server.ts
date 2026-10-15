import db from "../db.server";
import {
  PAID_PLANS,
  PLAN_FEATURES,
  TRIAL_DAYS,
  paidPlanByName,
  planName,
  type PaidPlanId,
  type PlanId,
  type PlanInfo,
} from "../lib/plans";

// Set BILLING_DISABLED=true in .env to unlock every feature while developing.
export const billingDisabled = () => process.env.BILLING_DISABLED === "true";
export const isTestBilling = () => process.env.NODE_ENV !== "production" || process.env.BILLING_TEST === "true";

const DAY = 864e5;
const PLAN_NAMES = Object.values(PAID_PLANS).map((p) => p.name);

// The 7-day all-features trial starts the first time the shop opens the app. The row survives
// uninstall/reinstall (so the trial can't be restarted) and is removed only by shop/redact.
async function trialRow(shop: string) {
  try {
    return await db.shopTrial.upsert({ where: { shop }, create: { shop, startedAt: new Date() }, update: {} });
  } catch (e) {
    // e.g. a dev server still running the Prisma client from before the ShopTrial migration.
    // Don't take the admin down: treat the trial as just started until the DB is reachable.
    console.error("Couldn't read the shop trial", e);
    return { shop, startedAt: new Date(), freeChosenAt: null };
  }
}

export async function trialStart(shop: string) {
  return (await trialRow(shop)).startedAt;
}

// The merchant picked Free on the Plans page (after the trial, or when cancelling a paid plan).
export async function chooseFree(shop: string) {
  await db.shopTrial.upsert({
    where: { shop },
    create: { shop, startedAt: new Date(0), freeChosenAt: new Date() },
    update: { freeChosenAt: new Date() },
  });
}

export function trialState(startedAt: Date, now = Date.now()) {
  const endsAt = new Date(+startedAt + TRIAL_DAYS * DAY);
  const left = Math.max(0, Math.ceil((+endsAt - now) / DAY));
  return { endsAt, daysLeft: left, active: +endsAt > now };
}

function info(id: PlanId, extra: Partial<PlanInfo> = {}): PlanInfo {
  const f = PLAN_FEATURES[id];
  return {
    id,
    name: planName(id),
    trialEndsAt: null,
    trialDaysLeft: 0,
    subscriptionId: null,
    ...extra,
    // Copy the array: callers must never be able to mutate the shared plan table.
    features: { ...f, campaignTypes: [...f.campaignTypes], maxActiveCampaigns: Number.isFinite(f.maxActiveCampaigns) ? f.maxActiveCampaigns : null },
  };
}

// Current plan: an active Shopify subscription wins, then the app trial, then Free if picked, else "choose".
export async function getPlan(billing: any, shop: string): Promise<PlanInfo> {
  const row = await trialRow(shop);
  const trial = trialState(row.startedAt);
  const trialExtra = trial.active ? { trialEndsAt: trial.endsAt.toISOString(), trialDaysLeft: trial.daysLeft } : {};
  if (billingDisabled()) return info("pro", trialExtra);

  const { appSubscriptions } = await billing.check({ plans: PLAN_NAMES, isTest: isTestBilling() });
  return resolvePlan(appSubscriptions || [], trial, trialExtra, !!row.freeChosenAt);
}

function resolvePlan(
  subs: { id: string; name: string; status: string }[],
  trial: ReturnType<typeof trialState>,
  trialExtra: Partial<PlanInfo>,
  freeChosen: boolean,
) {
  const sub = subs.find((s) => s.status === "ACTIVE" && paidPlanByName(s.name));
  if (sub) return info(paidPlanByName(sub.name)!, { subscriptionId: sub.id, ...trialExtra });
  if (trial.active) return info("trial", trialExtra);
  return info(freeChosen ? "free" : "choose");
}

// Same as getPlan, for webhooks (no billing helper there): reads the subscriptions with the Admin API.
export async function getPlanFromAdmin(admin: { graphql: (q: string) => Promise<Response> }, shop: string): Promise<PlanInfo> {
  const row = await trialRow(shop);
  const trial = trialState(row.startedAt);
  const trialExtra = trial.active ? { trialEndsAt: trial.endsAt.toISOString(), trialDaysLeft: trial.daysLeft } : {};
  if (billingDisabled()) return info("pro", trialExtra);
  const json: any = await (await admin.graphql(`#graphql
    query { currentAppInstallation { activeSubscriptions { id name status test } } }`)).json();
  const subs = (json.data?.currentAppInstallation?.activeSubscriptions || []).filter((s: any) => isTestBilling() || !s.test);
  return resolvePlan(subs, trial, trialExtra, !!row.freeChosenAt);
}


export const paidPlanName = (id: PaidPlanId) => PAID_PLANS[id].name;
