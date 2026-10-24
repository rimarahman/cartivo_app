// Plan catalog shared by the server (gating, billing) and the admin UI (pricing page, upgrade hints).
import type { CampaignType, DesignTier } from "./defaults";

// Every feature is unlocked for the first 7 days. After that the merchant must pick a plan on the Plans page:
// Starter (free), Essential, Growth or Premium ("choose" until they do). Paid plans have no trial of their own.
export const TRIAL_DAYS = 7;

export type PaidPlanId = "basic" | "grow" | "pro";
export type PlanId = "trial" | "choose" | "free" | PaidPlanId;

export type PlanFeatures = {
  campaignTypes: CampaignType[];
  maxActiveCampaigns: number; // Infinity = unlimited
  markets: boolean; // country targeting, campaign translations, per-currency thresholds
  prioritySupport: boolean;
  liveChat: boolean; // live chat with the support team (email support is in every plan)
  designTier: DesignTier; // one-click cart looks up to this tier (see DESIGN_PRESETS): Starter only Minimal, Premium all
  stickyCart: boolean; // sticky add-to-cart bar and floating cart button (Essential and higher)
  customCss: boolean; // custom CSS (Essential and higher)
  customCode: boolean; // custom HTML and JavaScript in the drawer (Growth and higher)
};

const ALL_TYPES: CampaignType[] = ["rewards", "announcement", "upsell", "addon", "bxgy", "volume"];

export const PLAN_FEATURES: Record<PlanId, PlanFeatures> = {
  free: { campaignTypes: [], maxActiveCampaigns: 0, markets: false, prioritySupport: false, liveChat: false, designTier: 0, stickyCart: false, customCss: false, customCode: false },
  // Trial over, no plan picked yet: Starter features until they choose.
  choose: { campaignTypes: [], maxActiveCampaigns: 0, markets: false, prioritySupport: false, liveChat: false, designTier: 0, stickyCart: false, customCss: false, customCode: false },
  basic: { campaignTypes: ["rewards", "announcement"], maxActiveCampaigns: 3, markets: false, prioritySupport: false, liveChat: false, designTier: 1, stickyCart: true, customCss: true, customCode: false },
  grow: { campaignTypes: ["rewards", "announcement", "upsell", "addon", "bxgy"], maxActiveCampaigns: 10, markets: true, prioritySupport: false, liveChat: true, designTier: 2, stickyCart: true, customCss: true, customCode: true },
  pro: { campaignTypes: ALL_TYPES, maxActiveCampaigns: Infinity, markets: true, prioritySupport: true, liveChat: true, designTier: 3, stickyCart: true, customCss: true, customCode: true },
  // The trial unlocks everything.
  trial: { campaignTypes: ALL_TYPES, maxActiveCampaigns: Infinity, markets: true, prioritySupport: true, liveChat: true, designTier: 3, stickyCart: true, customCss: true, customCode: true },
};

// Each paid plan is billed every 30 days (price) or yearly (yearlyPrice, two months free).
export type BillingCycle = "monthly" | "yearly";

// Billing plan names as configured in shopify.server.ts (also what Shopify shows the merchant).
export const PAID_PLANS: Record<PaidPlanId, { name: string; price: number; yearlyPrice: number; tagline: string; badge?: string; features: string[] }> = {
  basic: {
    name: "Essential",
    price: 10,
    yearlyPrice: 100,
    tagline: "More cart designs, sticky cart and cart goals",
    features: ["Everything in Starter", "3 cart designs", "Sticky add-to-cart & floating cart", "Custom CSS", "Free shipping & free gift goals", "Announcements & countdown timers", "Up to 3 active campaigns"],
  },
  grow: {
    name: "Growth",
    price: 20,
    yearlyPrice: 200,
    tagline: "Upsells, languages and custom code",
    // Factual labels only (App Store 1.1.4): no "most popular" or "best value" claims without data behind them.
    badge: "Live chat included",
    features: [
      "Everything in Essential",
      "5 cart designs",
      "In-cart upsells & one-click add-ons",
      "Buy X Get Y",
      "Shopify Markets: countries, translations, currencies",
      "Custom HTML & JavaScript",
      "Up to 10 active campaigns",
      "Live chat support",
    ],
  },
  pro: {
    name: "Premium",
    price: 60,
    yearlyPrice: 600,
    tagline: "Every design and feature, no limits",
    badge: "All features",
    features: ["Everything in Growth", "All 7 cart designs, incl. Liquid glass", "Volume discounts", "Unlimited active campaigns", "Priority live chat support"],
  },
};

// The free Starter plan (also included in every paid plan).
export const FREE_PLAN = { name: "Starter", tagline: "A slide cart drawer, free forever" };
export const FREE_FEATURES = [
  "Slide cart drawer (Minimal design)",
  "Order notes, discount field, terms checkbox",
  "Automatic product recommendations",
];

export const PLAN_ORDER: PaidPlanId[] = ["basic", "grow", "pro"];

export const planName = (id: PlanId) => (id === "trial" ? "Free trial" : id === "free" ? FREE_PLAN.name : id === "choose" ? "No plan selected" : PAID_PLANS[id].name);

// Cheapest paid plan that includes a campaign type.
export function planFor(type: CampaignType): PaidPlanId {
  return PLAN_ORDER.find((p) => PLAN_FEATURES[p].campaignTypes.includes(type)) ?? "pro";
}

// Lowest plan that includes a design tier ("Starter", "Essential", ...).
export const designTierPlan = (tier: DesignTier) => (tier === 0 ? FREE_PLAN.name : PAID_PLANS[PLAN_ORDER[tier - 1]].name);

// Shopify subscription name for a plan and cycle: "Growth" (every 30 days) or "Growth Yearly".
export const billingPlanName = (id: PaidPlanId, cycle: BillingCycle = "monthly") =>
  cycle === "yearly" ? `${PAID_PLANS[id].name} Yearly` : PAID_PLANS[id].name;
export const BILLING_PLAN_NAMES = PLAN_ORDER.flatMap((p) => [billingPlanName(p), billingPlanName(p, "yearly")]);

export function paidPlanByName(name: string | undefined | null): PaidPlanId | null {
  return PLAN_ORDER.find((p) => billingPlanName(p) === name || billingPlanName(p, "yearly") === name) ?? null;
}
export const cycleByName = (name: string | undefined | null): BillingCycle =>
  name?.endsWith(" Yearly") ? "yearly" : "monthly";

// The serializable plan state the server hands to pages.
export type PlanInfo = {
  id: PlanId;
  name: string;
  trialEndsAt: string | null; // set while the app trial runs
  trialDaysLeft: number;
  subscriptionId: string | null;
  cycle: BillingCycle | null; // billing cycle of the active subscription, null without one
  features: Omit<PlanFeatures, "maxActiveCampaigns"> & { maxActiveCampaigns: number | null }; // null = unlimited (JSON-safe)
};

export const canUse = (plan: PlanInfo, type: CampaignType) => plan.features.campaignTypes.includes(type);

// Plan resolution (used by app/models/billing.server.ts; pure so it can be unit tested).
const DAY = 864e5;

export function trialState(startedAt: Date, now = Date.now()) {
  const endsAt = new Date(+startedAt + TRIAL_DAYS * DAY);
  const left = Math.max(0, Math.ceil((+endsAt - now) / DAY));
  return { endsAt, daysLeft: left, active: +endsAt > now };
}

export function planInfo(id: PlanId, extra: Partial<PlanInfo> = {}): PlanInfo {
  const f = PLAN_FEATURES[id];
  return {
    id,
    name: planName(id),
    trialEndsAt: null,
    trialDaysLeft: 0,
    subscriptionId: null,
    cycle: null,
    ...extra,
    // Copy the array: callers must never be able to mutate the shared plan table.
    features: { ...f, campaignTypes: [...f.campaignTypes], maxActiveCampaigns: Number.isFinite(f.maxActiveCampaigns) ? f.maxActiveCampaigns : null },
  };
}

// Current plan: an active Shopify subscription wins, then the app trial, then Free if picked, else "choose".
export function resolvePlan(
  subs: { id: string; name: string; status: string }[],
  trial: ReturnType<typeof trialState>,
  trialExtra: Partial<PlanInfo>,
  freeChosen: boolean,
) {
  const sub = subs.find((s) => s.status === "ACTIVE" && paidPlanByName(s.name));
  if (sub) return planInfo(paidPlanByName(sub.name)!, { subscriptionId: sub.id, cycle: cycleByName(sub.name), ...trialExtra });
  if (trial.active) return planInfo("trial", trialExtra);
  return planInfo(freeChosen ? "free" : "choose");
}
