// Catalog and campaign scenarios for the storefront harness. Settings and campaign defaults come from the app
// (app/lib/defaults.ts) and every campaign goes through the real buyer-protection rules
// (app/lib/storefront-rules.ts). toStorefront/toFunction mirror storefrontCampaign/functionConfig in
// app/models/sync.server.ts (which can't be imported here because it pulls in Prisma).
import { DEFAULT_SETTINGS, DEFAULT_CAMPAIGN_CONFIG, DESIGN_PRESETS, deepMerge, parseCurrencyAmounts } from "../../../app/lib/defaults.ts";
import { applyBuyerProtection } from "../../../app/lib/storefront-rules.ts";

const v = (id, product_id, title, price, available = true) => ({ id, product_id, title, price, available });
export const PRODUCTS = {
  101: { id: 101, handle: "shirt", title: "Shirt", variants: [v(1001, 101, "S", 3000), v(1002, 101, "M", 3000), v(1003, 101, "L", 3200, false)] },
  201: { id: 201, handle: "socks", title: "Socks", variants: [v(2001, 201, "Default Title", 1000)] },
  301: { id: 301, handle: "cap", title: "Cap", variants: [v(3001, 301, "Default Title", 1500)] },
  401: { id: 401, handle: "tote", title: "Tote bag", variants: [v(4001, 401, "Default Title", 2500)] },
  402: { id: 402, handle: "pin", title: "Enamel pin", variants: [v(4021, 402, "Default Title", 800)] },
  501: { id: 501, handle: "protection", title: "Shipping protection", variants: [v(5001, 501, "Default Title", 299)] },
  601: { id: 601, handle: "bottle", title: "Bottle", variants: [v(6001, 601, "Blue", 1200), v(6002, 601, "Red", 1400)] },
  701: { id: 701, handle: "soldout", title: "Sold out thing", variants: [v(7001, 701, "Default Title", 900, false)] },
  801: { id: 801, handle: "xss", title: '<img src=x onerror="window.__xss=1">Evil', variants: [v(8001, 801, '<b onmouseover="window.__xss=1">V</b>', 500)] },
};
export const variantById = (id) => Object.values(PRODUCTS).flatMap((p) => p.variants).find((x) => x.id === Number(id));

const ref = (productId, variantId) => {
  const p = PRODUCTS[productId];
  return { productId: `gid://shopify/Product/${productId}`, variantId: variantId ? `gid://shopify/ProductVariant/${variantId}` : null, handle: p.handle, title: p.title, image: null };
};
const num = (g) => (g ? String(g).split("/").pop() : null);
const sref = (r) => r && { productId: num(r.productId), variantId: num(r.variantId), handle: r.handle, title: r.title, image: r.image };

function campaign(id, type, config, extra = {}) {
  return { id, type, name: extra.name || type, startsAt: extra.startsAt ?? null, endsAt: extra.endsAt ?? null, config: deepMerge(structuredClone(DEFAULT_CAMPAIGN_CONFIG[type]), config) };
}
function toStorefront(c) {
  const cfg = applyBuyerProtection(c.type, c.config);
  if (c.type === "rewards") cfg.tiers = cfg.tiers.map((t) => ({ ...t, gifts: (t.gifts || []).map(sref), thresholds: parseCurrencyAmounts(t.currencyThresholds) })).sort((a, b) => a.threshold - b.threshold);
  if (c.type === "bxgy") { cfg.buyProducts = cfg.buyProducts.map(sref); cfg.getProducts = cfg.getProducts.map(sref); }
  if (c.type === "volume") cfg.products = cfg.products.map(sref);
  if (c.type === "upsell") { cfg.triggerProducts = cfg.triggerProducts.map(sref); cfg.upsellProducts = cfg.upsellProducts.map(sref); }
  if (c.type === "addon") cfg.product = sref(cfg.product);
  return { id: c.id, type: c.type, name: c.name, startsAt: c.startsAt, endsAt: c.endsAt, config: cfg };
}
function toFunction(list) {
  const out = { rewards: [], bxgy: [], volume: [] };
  const ids = (l = []) => l.map((p) => p.productId);
  for (const c of list) {
    const cfg = c.config;
    const schedule = { startDate: c.startsAt?.slice(0, 10) ?? null, endDate: c.endsAt?.slice(0, 10) ?? null, countries: cfg.countries || [] };
    if (c.type === "rewards") out.rewards.push({ id: c.id, ...schedule, basis: cfg.basis, tiers: cfg.tiers.map((t) => ({ id: t.id, threshold: Number(t.threshold) || 0, type: t.type, value: Number(t.value) || 0, label: t.label, labels: {}, thresholds: parseCurrencyAmounts(t.currencyThresholds), giftVariantIds: (t.gifts || []).map((g) => g.variantId).filter(Boolean) })) });
    if (c.type === "bxgy") out.bxgy.push({ id: c.id, ...schedule, buyProductIds: ids(cfg.buyProducts), buyQuantity: Math.max(1, Number(cfg.buyQuantity) || 1), getProductIds: ids(cfg.getProducts), getQuantity: Math.max(1, Number(cfg.getQuantity) || 1), percent: Math.min(100, Math.max(0, Number(cfg.percent) || 0)), message: c.name });
    if (c.type === "volume") out.volume.push({ id: c.id, ...schedule, productIds: ids(cfg.products), combineProducts: !!cfg.combineProducts, tiers: cfg.tiers.map((t) => ({ minQuantity: Number(t.minQuantity) || 0, percent: Number(t.percent) || 0 })).sort((a, b) => a.minQuantity - b.minQuantity), message: c.name });
  }
  return out;
}

function scenario(campaigns, { settings = {}, ...rest } = {}) {
  return { settings: deepMerge(structuredClone(DEFAULT_SETTINGS), settings), campaigns: campaigns.map(toStorefront), fn: toFunction(campaigns), ...rest };
}

const giftTier = (extra = {}) => ({ id: "g1", threshold: 50, type: "free_gift", value: 0, label: "Free tote", gifts: [ref(401, 4001)], ...extra });
const rewards = (tiers, extra) => campaign("cmp_rewards", "rewards", { tiers }, extra);
const bxgy = (cfg, id = "cmp_bxgy") => campaign(id, "bxgy", { buyProducts: [ref(101)], getProducts: [ref(201, 2001)], ...cfg });
const addon = (cfg = {}) => campaign("cmp_addon", "addon", { product: ref(501, 5001), label: "Add shipping protection for {{price}}", ...cfg });
const past = new Date(Date.now() - 864e5 * 2).toISOString();
const future = new Date(Date.now() + 864e5 * 2).toISOString();

export const SCENARIOS = {
  base: scenario([], { codes: { SAVE10: 10 }, recommendations: [601] }),
  terms: scenario([], { settings: { drawer: { showTerms: true } } }),
  gift: scenario([rewards([giftTier()])]),
  giftPicker: scenario([rewards([giftTier({ gifts: [ref(401, 4001), ref(402, 4021)] })])]),
  // The automatic discount was deactivated/deleted in Shopify admin, but the storefront config is still published.
  giftDiscountInactive: scenario([rewards([giftTier()])], { discountActive: false }),
  // Shopper uses a code that doesn't combine with product discounts and beats them.
  giftNonCombinable: scenario([rewards([giftTier()])], { nonCombinableCode: "BIG25" }),
  tiers: scenario([rewards([giftTier({ threshold: 80 }), { id: "s1", threshold: 40, type: "free_shipping", value: 100, label: "Free shipping", gifts: [] }, { id: "p1", threshold: 120, type: "percent_off", value: 10, label: "10% off", gifts: [] }])]),
  bxgyFree: scenario([bxgy({ percent: 100, autoAdd: true })]),
  bxgyMultiGet: scenario([bxgy({ percent: 100, autoAdd: true, getProducts: [ref(201, 2001), ref(402, 4021)] })]),
  bxgyHalf: scenario([bxgy({ percent: 50, autoAdd: true })]),
  bxgySame: scenario([bxgy({ percent: 100, autoAdd: true, buyQuantity: 2, getProducts: [ref(101, 1001)] })]),
  addon: scenario([addon()]),
  addonPrechecked: scenario([addon({ defaultChecked: true })]),
  addonNoPriceLabel: scenario([addon({ label: "Protect my order" })]),
  upsell: scenario([campaign("cmp_up", "upsell", { upsellProducts: [ref(601), ref(301)], triggerProducts: [] })], { settings: { upsells: { enabled: true, mode: "manual" } } }),
  volume: scenario([campaign("cmp_vol", "volume", { products: [ref(101)] })]),
  expired: scenario([rewards([giftTier()], { endsAt: past })]),
  scheduled: scenario([rewards([giftTier()], { startsAt: future })]),
  evergreen: scenario([campaign("cmp_ann", "announcement", { timerEnabled: true, timerType: "evergreen", evergreenMinutes: 15, messages: ["Hurry"] })]),
  timerRunning: scenario([campaign("cmp_ann", "announcement", { timerEnabled: true, timerEnd: future, messages: ["Hurry"] })]),
  timerEndedShown: scenario([campaign("cmp_ann", "announcement", { timerEnabled: true, timerEnd: past, hideWhenExpired: false, messages: ["Hurry"] })]),
  timerEndedHidden: scenario([campaign("cmp_ann", "announcement", { timerEnabled: true, timerEnd: past, hideWhenExpired: true, messages: ["Hurry"] })]),
  // Published before expiredText existed: no such key in the config.
  timerEndedOldConfig: scenario([(() => {
    const c = campaign("cmp_ann", "announcement", { timerEnabled: true, timerEnd: past, hideWhenExpired: false, messages: ["Hurry"] });
    delete c.config.expiredText;
    return c;
  })()]),
  everything: scenario([rewards([giftTier()]), bxgy({ percent: 100, autoAdd: true }), addon(), campaign("cmp_vol", "volume", { products: [ref(301)] })], { codes: { SAVE10: 10 } }),
};
// The same cart in each one-click look (`everything_<preset id>`), for the accessibility scan.
for (const p of DESIGN_PRESETS) {
  SCENARIOS[`everything_${p.id}`] = scenario(
    [rewards([giftTier()]), bxgy({ percent: 100, autoAdd: true }), addon(), campaign("cmp_vol", "volume", { products: [ref(301)] })],
    { codes: { SAVE10: 10 }, settings: { design: { ...p.design, preset: p.id } } },
  );
}
