import { cartCurrency, cartivoDiscountTotal, countsAfterDiscounts, currencyRate, hasClass, readConfig, tierLabel, unlockedTiers } from "./shared.js";

/** Free shipping when a "free_shipping" reward tier is unlocked. */
export function cartDeliveryOptionsDiscountsGenerateRun(input) {
  if (!hasClass(input, "SHIPPING")) return { operations: [] };
  const config = readConfig(input);
  // Same lines as the cart-lines target, so both agree on progress.
  const lines = input.cart.lines.filter((l) => l.merchandise?.__typename === "ProductVariant");
  const rate = currencyRate(input);
  const currency = cartCurrency(input);
  const isShipping = ({ tier }) => tier.type === "free_shipping";
  // Discounts only lower progress, so a cart that misses free shipping before them misses it after:
  // skip working out Cartivo's discounts then (keeps the Function cheap on large carts).
  if (!unlockedTiers(config, lines, rate, currency).some(isShipping)) return { operations: [] };
  // "After discounts" campaigns count the cart minus Cartivo's own discounts (other discounts are not visible here).
  const discount = config.rewards.some(countsAfterDiscounts) ? cartivoDiscountTotal(config, lines, rate, currency) : 0;
  const freeShipping = unlockedTiers(config, lines, rate, currency, discount).find(isShipping);
  const groups = input.cart.deliveryGroups || [];
  if (!freeShipping || !groups.length) return { operations: [] };

  return {
    operations: [
      {
        deliveryDiscountsAdd: {
          candidates: [
            {
              message: tierLabel(freeShipping.tier, input) || "Free shipping",
              targets: groups.map((group) => ({ deliveryGroup: { id: group.id } })),
              value: { percentage: { value: 100 } },
            },
          ],
          selectionStrategy: "ALL",
        },
      },
    ],
  };
}
