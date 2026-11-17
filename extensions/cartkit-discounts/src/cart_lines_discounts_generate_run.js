import {
  bestOrderDiscount,
  cartCurrency,
  cartivoDiscountTotal,
  countsAfterDiscounts,
  currencyRate,
  hasClass,
  isGiftLine,
  productOffers,
  readConfig,
  tierLabel,
  unlockedTiers,
} from "./shared.js";

const variantIdOf = (line) => line.merchandise?.id;

/**
 * Product discounts: free gifts (100% off one unit of an unlocked gift line), Buy X Get Y and
 * volume discounts. Order discounts: highest unlocked percentage / fixed amount tier.
 */
export function cartLinesDiscountsGenerateRun(input) {
  const config = readConfig(input);
  const lines = input.cart.lines.filter((l) => l.merchandise?.__typename === "ProductVariant");
  const rate = currencyRate(input);
  const currency = cartCurrency(input);
  const offers = productOffers(config, lines);
  // Gift tiers of "after discounts" campaigns count the cart minus Cartivo's discounts. Only gifts depend
  // on it here, so skip the work when there is no gift line (keeps the Function cheap).
  const discount =
    lines.some(isGiftLine) && config.rewards.some(countsAfterDiscounts)
      ? cartivoDiscountTotal(config, lines, rate, currency, offers)
      : 0;
  const unlocked = unlockedTiers(config, lines, rate, currency, discount);
  const operations = [];

  if (hasClass(input, "PRODUCT")) {
    const candidates = [];

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
      candidates.push({
        message: tierLabel(match.tier, input) || "Free gift",
        targets: [{ cartLine: { id: line.id, quantity: 1 } }],
        value: { percentage: { value: 100 } },
      });
    }

    // 2. Buy X Get Y and volume discounts.
    for (const offer of offers) {
      const cartLine = offer.quantity == null ? { id: offer.line.id } : { id: offer.line.id, quantity: offer.quantity };
      candidates.push({
        message: offer.message,
        targets: [{ cartLine }],
        value: { percentage: { value: offer.percent } },
      });
    }

    if (candidates.length) {
      operations.push({ productDiscountsAdd: { candidates, selectionStrategy: "ALL" } });
    }
  }

  if (hasClass(input, "ORDER")) {
    const subtotal = lines
      .filter((l) => !isGiftLine(l))
      .reduce((sum, l) => sum + parseFloat(l.cost?.subtotalAmount?.amount || "0"), 0);
    const best = bestOrderDiscount(unlocked, subtotal, rate);
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
