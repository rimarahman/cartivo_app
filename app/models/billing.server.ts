import db from "../db.server";
import {
  BILLING_PLAN_NAMES,
  billingPlanName,
  planInfo as info,
  resolvePlan,
  trialState,
  type BillingCycle,
  type PaidPlanId,
  type PlanId,
  type PlanInfo,
} from "../lib/plans";

export { trialState };

type Admin = { graphql: (query: string, options?: any) => Promise<Response> };

// Set BILLING_DISABLED=true in .env to unlock every feature while developing. It has no effect in
// production, so a leftover variable can never switch billing off for real merchants.
export const billingDisabled = () => process.env.NODE_ENV !== "production" && process.env.BILLING_DISABLED === "true";

// Set DEV_PLAN=free|basic|grow|pro in .env to run the app as that plan while developing, without a Shopify
// charge (e.g. to check what Essential merchants see). Like BILLING_DISABLED, it has no effect in production.
const DEV_PLANS: PlanId[] = ["free", "basic", "grow", "pro"];
export const devPlan = (): PlanId | null => {
  const id = process.env.DEV_PLAN as PlanId;
  return process.env.NODE_ENV !== "production" && DEV_PLANS.includes(id) ? id : null;
};

// Test charges (no money moves) are used in development and, in production, only on Shopify development
// stores (shop.plan.partnerDevelopment), e.g. Partner test stores and App Review's stores. Every other store
// gets real charges; there is deliberately no environment switch that could make them free. This decides only how a
// charge is created: reading the plan accepts every active subscription (see getPlan).
// Cached briefly: a development store transferred to a merchant stops being one, and must get real charges.
const DEV_STORE_TTL = 10 * 60 * 1000;
const devStores = new Map<string, { dev: boolean; at: number }>();
export async function isTestBilling(admin: Admin, shop: string) {
  if (process.env.NODE_ENV !== "production") return true;
  const known = devStores.get(shop);
  if (known && Date.now() - known.at < DEV_STORE_TTL) return known.dev;
  try {
    const json: any = await (await admin.graphql(`#graphql
      query { shop { plan { partnerDevelopment } } }`)).json();
    const dev = json.data?.shop?.plan?.partnerDevelopment === true;
    devStores.set(shop, { dev, at: Date.now() });
    return dev;
  } catch (e) {
    // Keep the last known answer through a transient API error, so a development store isn't briefly treated
    // as a real one (and sent to the Plans page). Never seen this shop: treat it as a real store.
    console.error("Couldn't read the shop plan", e);
    return known ? known.dev : false;
  }
}

const PLAN_NAMES = BILLING_PLAN_NAMES;

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

// Current plan: an active Shopify subscription wins, then Free if picked, then the app trial, else "choose".
export async function getPlan(billing: any, shop: string, admin: Admin): Promise<PlanInfo> {
  const row = await trialRow(shop);
  const trial = trialState(row.startedAt);
  const trialExtra = trial.active ? { trialEndsAt: trial.endsAt.toISOString(), trialDaysLeft: trial.daysLeft } : {};
  if (billingDisabled()) return info("pro", trialExtra);
  const dev = devPlan();
  if (dev) return info(dev);

  // isTest: true returns test subscriptions too. Test charges are only ever created for development stores (the
  // isTestBilling check when the charge is requested), so one that exists was made for a store Shopify doesn't
  // bill. Checking the dev store again here hid approved charges whenever the second answer differed (App Review:
  // "Premium ACTIVE (test), plan trial").
  const { appSubscriptions } = await billing.check({ plans: PLAN_NAMES, isTest: true });
  const subs = appSubscriptions || [];
  warnTestOnRealStore(subs, admin, shop);
  return resolvePlan(subs, trial, trialExtra, !!row.freeChosenAt);
}

// A test subscription on a store that isn't a development store (e.g. a transferred one): logged so it can be
// followed up. It doesn't block the plan, since a failed or differing dev-store answer must never hide a charge.
function warnTestOnRealStore(subs: { name: string; status: string; test?: boolean }[], admin: Admin, shop: string) {
  const sub = subs.find((s) => s.test && s.status === "ACTIVE");
  if (!sub) return;
  isTestBilling(admin, shop).then((dev) => {
    if (!dev) console.warn(`Test subscription ${sub.name} is active on ${shop}, which isn't a development store`);
  }, () => {});
}

// Returning from Shopify's approval page (?charge_id=...). Right after approval the subscription can still be
// PENDING, or not yet listed as active, for a moment: wait briefly until Shopify settles it, so this page and every
// other page (which use getPlan) agree on the plan. The charge is read from this app installation's own
// subscriptions, so a charge_id of another app or shop never matches. Logged so a failed review can be traced.
export type ReturnedCharge = { id: string; name: string; status: string; test: boolean };
const ATTEMPTS = 4;
export async function planAfterReturn(billing: any, admin: Admin, shop: string, chargeId: string) {
  const gid = /^\d+$/.test(chargeId) ? `gid://shopify/AppSubscription/${chargeId}` : null;
  let plan = await getPlan(billing, shop, admin);
  let charge: ReturnedCharge | null = null;
  if (!gid) return { plan, charge };
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const json: any = await (await admin.graphql(`#graphql
        query ReturnedCharge { currentAppInstallation { allSubscriptions(first: 25, sortKey: CREATED_AT, reverse: true) { nodes { id name status test } } } }`)).json();
      charge = (json.data?.currentAppInstallation?.allSubscriptions?.nodes || []).find((s: ReturnedCharge) => s.id === gid) ?? null;
    } catch (e) {
      if (e instanceof Response) throw e;
      console.error(`Couldn't read charge ${chargeId} for ${shop}`, e);
      return { plan, charge };
    }
    const settled = charge?.status !== "PENDING" && (charge?.status !== "ACTIVE" || plan.subscriptionId === gid);
    console.log(
      `Billing return for ${shop}: charge ${chargeId} ${charge ? `${charge.name} ${charge.status}${charge.test ? " (test)" : ""}` : "not found"}, plan ${plan.id} (attempt ${attempt})`,
    );
    if (settled || attempt === ATTEMPTS) break;
    await new Promise((r) => setTimeout(r, 1500));
    plan = await getPlan(billing, shop, admin);
  }
  return { plan, charge };
}

// Same as getPlan, for webhooks (no billing helper there): reads the subscriptions with the Admin API.
export async function getPlanFromAdmin(admin: Admin, shop: string): Promise<PlanInfo> {
  const row = await trialRow(shop);
  const trial = trialState(row.startedAt);
  const trialExtra = trial.active ? { trialEndsAt: trial.endsAt.toISOString(), trialDaysLeft: trial.daysLeft } : {};
  if (billingDisabled()) return info("pro", trialExtra);
  const dev = devPlan();
  if (dev) return info(dev);
  const json: any = await (await admin.graphql(`#graphql
    query { currentAppInstallation { activeSubscriptions { id name status test } } }`)).json();
  // Test subscriptions count here too (see getPlan).
  const subs = json.data?.currentAppInstallation?.activeSubscriptions || [];
  warnTestOnRealStore(subs, admin, shop);
  return resolvePlan(subs, trial, trialExtra, !!row.freeChosenAt);
}


export const paidPlanName = (id: PaidPlanId, cycle: BillingCycle = "monthly") => billingPlanName(id, cycle);
