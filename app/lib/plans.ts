// Plan catalog shared by the server (gating, billing) and the admin UI (pricing page, upgrade hints).
import type { CampaignType } from "./defaults";

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
};

const ALL_TYPES: CampaignType[] = ["rewards", "announcement", "upsell", "addon", "bxgy", "volume"];

export const PLAN_FEATURES: Record<PlanId, PlanFeatures> = {
  free: { campaignTypes: [], maxActiveCampaigns: 0, markets: false, prioritySupport: false, liveChat: false },
  // Trial over, no plan picked yet: Starter features until they choose.
  choose: { campaignTypes: [], maxActiveCampaigns: 0, markets: false, prioritySupport: false, liveChat: false },
  basic: { campaignTypes: ["rewards", "announcement"], maxActiveCampaigns: 3, markets: false, prioritySupport: false, liveChat: false },
  grow: { campaignTypes: ["rewards", "announcement", "upsell", "addon", "bxgy"], maxActiveCampaigns: 10, markets: true, prioritySupport: false, liveChat: true },
  pro: { campaignTypes: ALL_TYPES, maxActiveCampaigns: Infinity, markets: true, prioritySupport: true, liveChat: true },
  // The trial unlocks everything.
  trial: { campaignTypes: ALL_TYPES, maxActiveCampaigns: Infinity, markets: true, prioritySupport: true, liveChat: true },
};

// Billing plan names as configured in shopify.server.ts (also what Shopify shows the merchant).
export const PAID_PLANS: Record<PaidPlanId, { name: string; price: number; tagline: string; badge?: string; features: string[] }> = {
  basic: {
    name: "Essential",
    price: 10,
    tagline: "Grow order value with goals",
    features: ["Everything in Starter", "Free shipping & free gift goals", "Announcements & countdown timers", "Up to 3 active campaigns"],
  },
  grow: {
    name: "Growth",
    price: 20,
    tagline: "Upsell and sell internationally",
    badge: "Most popular",
    features: [
      "Everything in Essential",
      "In-cart upsells & one-click add-ons",
      "Buy X Get Y",
      "Shopify Markets: countries, translations, currencies",
      "Up to 10 active campaigns",
      "Live chat support",
    ],
  },
  pro: {
    name: "Premium",
    price: 60,
    tagline: "Every feature, no limits",
    badge: "Best value",
    features: ["Everything in Growth", "Volume discounts", "Unlimited active campaigns", "Priority live chat support"],
  },
};

// The free Starter plan (also included in every paid plan).
export const FREE_PLAN = { name: "Starter", tagline: "The essentials, free forever" };
export const FREE_FEATURES = [
  "Slide cart drawer",
  "Sticky add-to-cart",
  "Floating mini cart",
  "Order notes, discount field, terms checkbox",
  "Automatic product recommendations",
  "Custom CSS / HTML / JS",
];

export const PLAN_ORDER: PaidPlanId[] = ["basic", "grow", "pro"];

export const planName = (id: PlanId) => (id === "trial" ? "Free trial" : id === "free" ? FREE_PLAN.name : id === "choose" ? "No plan selected" : PAID_PLANS[id].name);

// Cheapest paid plan that includes a campaign type.
export function planFor(type: CampaignType): PaidPlanId {
  return PLAN_ORDER.find((p) => PLAN_FEATURES[p].campaignTypes.includes(type)) ?? "pro";
}

export function paidPlanByName(name: string | undefined | null): PaidPlanId | null {
  return PLAN_ORDER.find((p) => PAID_PLANS[p].name === name) ?? null;
}

// The serializable plan state the server hands to pages.
export type PlanInfo = {
  id: PlanId;
  name: string;
  trialEndsAt: string | null; // set while the app trial runs
  trialDaysLeft: number;
  subscriptionId: string | null;
  features: Omit<PlanFeatures, "maxActiveCampaigns"> & { maxActiveCampaigns: number | null }; // null = unlimited (JSON-safe)
};

export const canUse = (plan: PlanInfo, type: CampaignType) => plan.features.campaignTypes.includes(type);
