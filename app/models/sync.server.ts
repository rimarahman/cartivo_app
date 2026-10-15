// Publishes settings + active campaigns to the storefront (app-data metafield read by the
// theme app extension) and to the discount Function (metafield on an automatic app discount).
import db from "../db.server";
import { getSettings, listCampaigns, type CampaignRecord } from "./store.server";
import { parseCurrencyAmounts, type ProductRef } from "../lib/defaults";
import type { PlanInfo } from "../lib/plans";

// The plan facts publishing needs (id/trialEndsAt end trial-only campaigns on time).
export type SyncPlan = Pick<PlanInfo, "features"> & Partial<Pick<PlanInfo, "id" | "trialEndsAt">>;

type Admin = { graphql: (query: string, options?: any) => Promise<Response> };

export const METAFIELD_NAMESPACE = "cartkit";
export const FUNCTION_HANDLE = "cartkit-discounts";

async function gql(admin: Admin, query: string, variables?: any) {
  const res = await admin.graphql(query, variables ? { variables } : undefined);
  const json: any = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

const numericId = (gid?: string | null) => (gid ? gid.split("/").pop() : null);

function storefrontRef(ref: ProductRef | null | undefined) {
  if (!ref) return null;
  return {
    productId: numericId(ref.productId),
    variantId: numericId(ref.variantId),
    handle: ref.handle,
    title: ref.title,
    image: ref.image,
  };
}

const refs = (list: ProductRef[] = []) => list.map(storefrontRef).filter(Boolean);

function storefrontCampaign(c: CampaignRecord) {
  const cfg = { ...c.config };
  switch (c.type) {
    case "rewards":
      cfg.tiers = (cfg.tiers || [])
        .map((t: any) => ({ ...t, gifts: refs(t.gifts), thresholds: parseCurrencyAmounts(t.currencyThresholds) }))
        .sort((a: any, b: any) => a.threshold - b.threshold);
      break;
    case "bxgy":
      cfg.buyProducts = refs(cfg.buyProducts);
      cfg.getProducts = refs(cfg.getProducts);
      break;
    case "volume":
      cfg.products = refs(cfg.products);
      break;
    case "upsell":
      cfg.triggerProducts = refs(cfg.triggerProducts);
      cfg.upsellProducts = refs(cfg.upsellProducts);
      break;
    case "addon":
      cfg.product = storefrontRef(cfg.product);
      break;
  }
  return {
    id: c.id,
    type: c.type,
    name: c.name,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    config: cfg,
  };
}

// Shop-local calendar date (YYYY-MM-DD); the Function compares it with shop.localTime.date.
function localDate(iso: string | null, timeZone: string) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

// { fr: "Livraison gratuite", ... } for a reward tier, from the campaign translations.
function tierLabels(cfg: any, tierId: string) {
  const labels: Record<string, string> = {};
  for (const [locale, texts] of Object.entries<any>(cfg.translations || {})) {
    const label = texts?.[`tier.${tierId}.label`];
    if (label) labels[locale.toLowerCase()] = label;
  }
  return labels;
}

// Only the data the Function needs to validate and price discounts.
function functionConfig(campaigns: CampaignRecord[], timeZone: string) {
  const ids = (list: ProductRef[] = []) => list.map((p) => p.productId);
  const out: any = { rewards: [], bxgy: [], volume: [] };
  for (const c of campaigns) {
    const cfg = c.config;
    const schedule = {
      startDate: localDate(c.startsAt, timeZone),
      endDate: localDate(c.endsAt, timeZone),
      // Markets: ISO country codes; empty = every country.
      countries: (cfg.countries || []) as string[],
    };
    if (c.type === "rewards") {
      out.rewards.push({
        id: c.id,
        ...schedule,
        basis: cfg.basis,
        tiers: (cfg.tiers || []).map((t: any) => ({
          id: t.id,
          threshold: Number(t.threshold) || 0,
          type: t.type,
          value: Number(t.value) || 0,
          label: t.label,
          labels: tierLabels(cfg, t.id),
          thresholds: parseCurrencyAmounts(t.currencyThresholds),
          giftVariantIds: (t.gifts || []).map((g: ProductRef) => g.variantId).filter(Boolean),
        })),
      });
    } else if (c.type === "bxgy") {
      out.bxgy.push({
        id: c.id,
        ...schedule,
        buyProductIds: ids(cfg.buyProducts),
        buyQuantity: Math.max(1, Number(cfg.buyQuantity) || 1),
        getProductIds: ids(cfg.getProducts),
        getQuantity: Math.max(1, Number(cfg.getQuantity) || 1),
        percent: Math.min(100, Math.max(0, Number(cfg.percent) || 0)),
        message: c.name,
      });
    } else if (c.type === "volume") {
      out.volume.push({
        id: c.id,
        ...schedule,
        productIds: ids(cfg.products),
        combineProducts: !!cfg.combineProducts,
        tiers: (cfg.tiers || [])
          .map((t: any) => ({ minQuantity: Number(t.minQuantity) || 0, percent: Number(t.percent) || 0 }))
          .sort((a: any, b: any) => a.minQuantity - b.minQuantity),
        message: c.name,
      });
    }
  }
  return out;
}

async function setMetafield(admin: Admin, ownerId: string, namespace: string, key: string, value: any) {
  const data = await gql(
    admin,
    `#graphql
    mutation SetMetafield($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) { userErrors { field message } }
    }`,
    { metafields: [{ ownerId, namespace, key, type: "json", value: JSON.stringify(value) }] },
  );
  const errors = data.metafieldsSet.userErrors;
  if (errors.length) throw new Error(errors.map((e: any) => e.message).join(", "));
}

async function findFunctionId(admin: Admin) {
  const data = await gql(
    admin,
    `#graphql
    query { shopifyFunctions(first: 50) { nodes { id apiType title app { apiKey } } } }`,
  );
  const fn = data.shopifyFunctions.nodes.find(
    (f: any) =>
      f.app?.apiKey === process.env.SHOPIFY_API_KEY && String(f.apiType).toLowerCase().includes("discount"),
  );
  return fn?.id as string | undefined;
}

async function ensureDiscount(admin: Admin, shop: string, config: any) {
  const row = await db.shopSettings.findUnique({ where: { shop } });
  if (row?.discountId) {
    const data = await gql(admin, `query($id: ID!) { discountNode(id: $id) { id } }`, { id: row.discountId });
    if (data.discountNode) return row.discountId;
  }

  const base = {
    title: "CartKit rewards",
    discountClasses: ["PRODUCT", "ORDER", "SHIPPING"],
    startsAt: new Date().toISOString(),
    combinesWith: { orderDiscounts: true, productDiscounts: true, shippingDiscounts: true },
    metafields: [
      { namespace: `$app:${METAFIELD_NAMESPACE}`, key: "function-configuration", type: "json", value: JSON.stringify(config) },
    ],
  };
  const create = async (input: any) =>
    (
      await gql(
        admin,
        `#graphql
        mutation CreateDiscount($discount: DiscountAutomaticAppInput!) {
          discountAutomaticAppCreate(automaticAppDiscount: $discount) {
            automaticAppDiscount { discountId }
            userErrors { field message }
          }
        }`,
        { discount: input },
      )
    ).discountAutomaticAppCreate;

  let result = await create({ ...base, functionHandle: FUNCTION_HANDLE }).catch(() => null);
  if (!result || result.userErrors.length) {
    const functionId = await findFunctionId(admin);
    if (!functionId) throw new Error("Discount function not deployed yet. Run `npm run deploy` or `npm run dev`.");
    result = await create({ ...base, functionId });
  }
  if (result.userErrors.length) throw new Error(result.userErrors.map((e: any) => e.message).join(", "));

  const discountId = result.automaticAppDiscount.discountId as string;
  await db.shopSettings.upsert({
    where: { shop },
    create: { shop, data: "{}", discountId },
    update: { discountId },
  });
  return discountId;
}

export async function syncShop(admin: Admin, shop: string, plan: SyncPlan) {
  const settings = await getSettings(shop);
  const campaigns = planCampaigns(await listCampaigns(shop), plan);

  const { currentAppInstallation, shop: shopInfo } = await gql(
    admin,
    `query { currentAppInstallation { id } shop { ianaTimezone } }`,
  );
  await setMetafield(admin, currentAppInstallation.id, METAFIELD_NAMESPACE, "config", {
    version: Date.now(),
    settings,
    campaigns: campaigns.map(storefrontCampaign),
  });

  const fnConfig = functionConfig(campaigns, shopInfo.ianaTimezone || "UTC");
  const needsFunction = fnConfig.rewards.length || fnConfig.bxgy.length || fnConfig.volume.length;
  const row = await db.shopSettings.findUnique({ where: { shop } });
  if (!needsFunction && !row?.discountId) return { discount: false };

  const discountId = await ensureDiscount(admin, shop, fnConfig);
  await setMetafield(admin, discountId, `$app:${METAFIELD_NAMESPACE}`, "function-configuration", fnConfig);
  return { discount: true };
}

// Active campaigns the plan allows: its campaign types, up to its active-campaign limit (highest priority
// first), and without Markets targeting/translations unless the plan includes Markets.
export function planCampaigns(all: CampaignRecord[], plan: SyncPlan) {
  const { campaignTypes, maxActiveCampaigns, markets } = plan.features;
  const allowed = all.filter((c) => c.status === "active" && campaignTypes.includes(c.type as any));
  let limited = maxActiveCampaigns === null ? allowed : allowed.slice(0, maxActiveCampaigns);
  // Trial: campaigns end with the trial even if the merchant never opens the app again. The storefront and the
  // discount Function already honor campaign end dates; choosing a plan republishes without this cap.
  const trialEnd = plan.id === "trial" ? plan.trialEndsAt : null;
  if (trialEnd) {
    limited = limited.map((c) => ({ ...c, endsAt: !c.endsAt || c.endsAt > trialEnd ? trialEnd : c.endsAt }));
  }
  if (markets) return limited;
  return limited.map((c) => ({
    ...c,
    config: {
      ...c.config,
      countries: [],
      translations: {},
      tiers: c.type === "rewards" && Array.isArray(c.config.tiers) ? c.config.tiers.map((t: any) => ({ ...t, currencyThresholds: "" })) : c.config.tiers,
    },
  }));
}

// Wraps syncShop so a failing sync never loses the merchant's saved data.
export async function trySync(admin: Admin, shop: string, plan: SyncPlan) {
  try {
    await syncShop(admin, shop, plan);
    return { ok: true as const, error: null };
  } catch (e: any) {
    console.error("CartKit sync failed", e);
    return { ok: false as const, error: String(e?.message || e) };
  }
}
