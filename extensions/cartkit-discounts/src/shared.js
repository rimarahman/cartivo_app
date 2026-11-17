// Shared helpers for both discount targets.
// Configuration is written by the app (app/models/sync.server.ts) to the discount metafield.

export function readConfig(input) {
  const cfg = input?.discount?.metafield?.jsonValue || {};
  const today = input?.shop?.localTime?.date;
  const country = input?.localization?.country?.isoCode;
  // Campaign schedules are compared by shop-local date (YYYY-MM-DD strings sort chronologically).
  const live = (c) => !today || ((!c.startDate || c.startDate <= today) && (!c.endDate || c.endDate >= today));
  // Markets: a campaign limited to some countries only applies to buyers in those countries.
  const inMarket = (c) => !c.countries?.length || !country || c.countries.includes(country);
  const list = (v) => (Array.isArray(v) ? v.filter((c) => live(c) && inMarket(c)) : []);
  return { rewards: list(cfg.rewards), bxgy: list(cfg.bxgy), volume: list(cfg.volume) };
}

// Presentment currency of the cart (e.g. "EUR"), used for per-currency tier amounts.
export function cartCurrency(input) {
  return input?.cart?.cost?.subtotalAmount?.currencyCode || null;
}

// Tier label in the buyer's language. LanguageCode is like "FR" or "PT_BR"; labels keys are "fr" / "pt-br".
export function tierLabel(tier, input) {
  const code = String(input?.localization?.language?.isoCode || "").toLowerCase().replace("_", "-");
  const labels = tier.labels || {};
  return labels[code] || labels[code.split("-")[0]] || tier.label;
}

// Threshold in shop currency. A fixed amount for the cart's currency (Markets) wins over conversion.
export function tierThreshold(tier, basis, rate, currency) {
  const fixed = basis !== "quantity" && currency ? tier.thresholds?.[currency] : undefined;
  return fixed != null ? Number(fixed) / rate : Number(tier.threshold || 0);
}

export function hasClass(input, cls) {
  return (input?.discount?.discountClasses || []).includes(cls);
}

export function currencyRate(input) {
  const rate = parseFloat(input?.presentmentCurrencyRate);
  return rate > 0 ? rate : 1;
}

export const isGiftLine = (line) => Boolean(line.gift?.value);

// Progress toward reward tiers, excluding gift lines. Subtotal is converted to the shop currency
// because tier thresholds are configured in the shop currency. `discount` (presentment currency) is
// taken off the subtotal for campaigns that count progress after discounts.
export function progressValue(lines, basis, rate, discount = 0) {
  let subtotal = 0;
  let quantity = 0;
  for (const line of lines) {
    if (isGiftLine(line)) continue;
    subtotal += parseFloat(line.cost?.subtotalAmount?.amount || "0");
    quantity += line.quantity;
  }
  return basis === "quantity" ? quantity : Math.max(0, subtotal - discount) / rate;
}

// Discount tiers always measure the cart before discounts: counting their own discount would
// lock them again as soon as they unlock.
export const isDiscountTier = (tier) => tier.type === "percent_off" || tier.type === "fixed_off";
export const countsAfterDiscounts = (campaign) => campaign.basis !== "quantity" && campaign.afterDiscounts !== false;

// All tiers of all rewards campaigns that the cart has reached. `discount` is the Cartivo discount
// on the cart (presentment currency), see cartivoDiscountTotal.
export function unlockedTiers(config, lines, rate, currency = null, discount = 0) {
  const unlocked = [];
  for (const campaign of config.rewards) {
    const before = progressValue(lines, campaign.basis, rate);
    const after = countsAfterDiscounts(campaign) ? progressValue(lines, campaign.basis, rate, discount) : before;
    for (const tier of campaign.tiers || []) {
      const value = isDiscountTier(tier) ? before : after;
      if (value + 1e-9 >= tierThreshold(tier, campaign.basis, rate, currency)) unlocked.push({ campaign, tier });
    }
  }
  return unlocked;
}

const productIdOf = (line) => line.merchandise?.product?.id;
export const unitPrice = (line) => parseFloat(line.cost?.amountPerQuantity?.amount || "0");

// Buy X Get Y and volume discounts: [{ line, quantity?, percent, message }]. Gift lines never take part.
// Discount functions can't see each other, so this only covers Cartivo's own discounts.
export function productOffers(config, lines) {
  const offers = [];
  // A cart line may only receive one Cartivo product discount.
  const used = new Set();

  for (const offer of config.bxgy) {
    const buyIds = new Set(offer.buyProductIds || []);
    const getIds = new Set(offer.getProductIds || []);
    if (!buyIds.size || !getIds.size || !(offer.percent > 0)) continue;

    const buyUnits = lines
      .filter((l) => !isGiftLine(l) && buyIds.has(productIdOf(l)))
      .reduce((sum, l) => sum + l.quantity, 0);
    const overlap = [...getIds].some((id) => buyIds.has(id));
    const sets = overlap
      ? Math.floor(buyUnits / (offer.buyQuantity + offer.getQuantity))
      : Math.floor(buyUnits / offer.buyQuantity);
    let remaining = sets * offer.getQuantity;
    if (remaining <= 0) continue;

    // Discount the cheapest eligible units first.
    const getLines = lines
      .filter((l) => !isGiftLine(l) && !used.has(l.id) && getIds.has(productIdOf(l)))
      .sort((a, b) => unitPrice(a) - unitPrice(b));
    for (const line of getLines) {
      if (remaining <= 0) break;
      const quantity = Math.min(remaining, line.quantity);
      remaining -= quantity;
      used.add(line.id);
      offers.push({ line, quantity, percent: offer.percent, message: offer.message || "Buy X Get Y" });
    }
  }

  for (const offer of config.volume) {
    const ids = new Set(offer.productIds || []);
    const tiers = (offer.tiers || []).filter((t) => t.minQuantity > 0 && t.percent > 0);
    if (!tiers.length) continue;
    const eligible = lines.filter(
      (l) => !isGiftLine(l) && !used.has(l.id) && (!ids.size || ids.has(productIdOf(l))),
    );

    const groups = new Map();
    for (const line of eligible) {
      const key = offer.combineProducts ? "all" : productIdOf(line);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(line);
    }
    for (const group of groups.values()) {
      const quantity = group.reduce((sum, l) => sum + l.quantity, 0);
      const tier = tiers.filter((t) => quantity >= t.minQuantity).sort((a, b) => b.percent - a.percent)[0];
      if (!tier) continue;
      for (const line of group) {
        used.add(line.id);
        offers.push({
          line,
          percent: tier.percent,
          message: offer.message ? `${offer.message} (${tier.percent}% off)` : `${tier.percent}% off`,
        });
      }
    }
  }
  return offers;
}

// Highest unlocked percentage / fixed amount tier and its amount (presentment currency) on `base`.
export function bestOrderDiscount(unlocked, base, rate) {
  let best = null;
  for (const { tier } of unlocked) {
    if (!isDiscountTier(tier)) continue;
    const amount = tier.type === "percent_off" ? (base * tier.value) / 100 : tier.value * rate;
    if (amount > 0 && (!best || amount > best.amount)) best = { tier, amount };
  }
  return best;
}

const nonGiftSubtotal = (lines) =>
  lines.filter((l) => !isGiftLine(l)).reduce((sum, l) => sum + parseFloat(l.cost?.subtotalAmount?.amount || "0"), 0);

// What Cartivo takes off the cart (presentment currency): Buy X Get Y, volume and the order reward.
// The order reward applies after product discounts, so its amount is worked out on what is left.
// Known limit: if a discount code doesn't combine with Cartivo's, Shopify may drop a Cartivo discount
// that is still subtracted here, making checkout stricter than the cart drawer.
export function cartivoDiscountTotal(config, lines, rate, currency, offers = productOffers(config, lines)) {
  // Rounded to cents, like the discount Shopify applies.
  const cents = (n) => Math.round(n * 100) / 100;
  const productAmount = offers.reduce(
    (sum, o) => sum + cents((unitPrice(o.line) * (o.quantity ?? o.line.quantity) * o.percent) / 100),
    0,
  );
  const subtotal = nonGiftSubtotal(lines);
  const remaining = Math.max(0, subtotal - productAmount);
  // Same tier choice as the cart-lines target (on the subtotal before discounts).
  const best = bestOrderDiscount(unlockedTiers(config, lines, rate, currency), subtotal, rate);
  const orderAmount = !best ? 0 : best.tier.type === "percent_off" ? cents((remaining * best.tier.value) / 100) : best.amount;
  return productAmount + Math.min(remaining, orderAmount);
}
