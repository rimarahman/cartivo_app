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
// because tier thresholds are configured in the shop currency.
export function progressValue(lines, basis, rate) {
  let subtotal = 0;
  let quantity = 0;
  for (const line of lines) {
    if (isGiftLine(line)) continue;
    subtotal += parseFloat(line.cost?.subtotalAmount?.amount || "0");
    quantity += line.quantity;
  }
  return basis === "quantity" ? quantity : subtotal / rate;
}

// All tiers of all rewards campaigns that the cart has reached.
export function unlockedTiers(config, lines, rate, currency = null) {
  const unlocked = [];
  for (const campaign of config.rewards) {
    const value = progressValue(lines, campaign.basis, rate);
    for (const tier of campaign.tiers || []) {
      if (value + 1e-9 >= tierThreshold(tier, campaign.basis, rate, currency)) unlocked.push({ campaign, tier });
    }
  }
  return unlocked;
}
