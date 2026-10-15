import { cartCurrency, currencyRate, hasClass, isGiftLine, readConfig, tierLabel, unlockedTiers } from "./shared.js";

const productIdOf = (line) => line.merchandise?.product?.id;
const variantIdOf = (line) => line.merchandise?.id;
const unitPrice = (line) => parseFloat(line.cost?.amountPerQuantity?.amount || "0");

/**
 * Product discounts: free gifts (100% off one unit of an unlocked gift line), Buy X Get Y and
 * volume discounts. Order discounts: highest unlocked percentage / fixed amount tier.
 */
export function cartLinesDiscountsGenerateRun(input) {
  const config = readConfig(input);
  const lines = input.cart.lines.filter((l) => l.merchandise?.__typename === "ProductVariant");
  const rate = currencyRate(input);
  const unlocked = unlockedTiers(config, lines, rate, cartCurrency(input));
  const operations = [];

  if (hasClass(input, "PRODUCT")) {
    const candidates = [];
    // A cart line may only receive one CartKit product discount.
    const used = new Set();

    // 1. Free gifts. Attribute value is "<campaignId>:<tierId>".
    const giftedTiers = new Set();
    for (const line of lines) {
      if (!isGiftLine(line)) continue;
      const key = line.gift.value;
      const match = unlocked.find(
        ({ campaign, tier }) =>
          `${campaign.id}:${tier.id}` === key &&
          tier.type === "free_gift" &&
          (tier.giftVariantIds || []).includes(variantIdOf(line)),
      );
      if (!match || giftedTiers.has(key)) continue;
      giftedTiers.add(key);
      used.add(line.id);
      candidates.push({
        message: tierLabel(match.tier, input) || "Free gift",
        targets: [{ cartLine: { id: line.id, quantity: 1 } }],
        value: { percentage: { value: 100 } },
      });
    }

    // 2. Buy X Get Y.
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
        candidates.push({
          message: offer.message || "Buy X Get Y",
          targets: [{ cartLine: { id: line.id, quantity } }],
          value: { percentage: { value: offer.percent } },
        });
      }
    }

    // 3. Volume discounts.
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
          candidates.push({
            message: offer.message ? `${offer.message} (${tier.percent}% off)` : `${tier.percent}% off`,
            targets: [{ cartLine: { id: line.id } }],
            value: { percentage: { value: tier.percent } },
          });
        }
      }
    }

    if (candidates.length) {
      operations.push({ productDiscountsAdd: { candidates, selectionStrategy: "ALL" } });
    }
  }

  if (hasClass(input, "ORDER")) {
    const subtotal = lines
      .filter((l) => !isGiftLine(l))
      .reduce((sum, l) => sum + parseFloat(l.cost?.subtotalAmount?.amount || "0"), 0);
    let best = null;
    for (const { tier } of unlocked) {
      if (tier.type !== "percent_off" && tier.type !== "fixed_off") continue;
      const amount = tier.type === "percent_off" ? (subtotal * tier.value) / 100 : tier.value * rate;
      if (amount > 0 && (!best || amount > best.amount)) best = { tier, amount };
    }
    if (best) {
      const giftLineIds = lines.filter(isGiftLine).map((l) => l.id);
      operations.push({
        orderDiscountsAdd: {
          candidates: [
            {
              message: tierLabel(best.tier, input) || "Cart reward",
              targets: [{ orderSubtotal: { excludedCartLineIds: giftLineIds } }],
              value:
                best.tier.type === "percent_off"
                  ? { percentage: { value: best.tier.value } }
                  : { fixedAmount: { amount: (best.tier.value * rate).toFixed(2) } },
            },
          ],
          selectionStrategy: "FIRST",
        },
      });
    }
  }

  return { operations };
}
