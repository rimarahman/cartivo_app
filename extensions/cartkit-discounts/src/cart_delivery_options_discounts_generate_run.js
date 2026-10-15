import { cartCurrency, currencyRate, hasClass, readConfig, tierLabel, unlockedTiers } from "./shared.js";

/** Free shipping when a "free_shipping" reward tier is unlocked. */
export function cartDeliveryOptionsDiscountsGenerateRun(input) {
  if (!hasClass(input, "SHIPPING")) return { operations: [] };
  const config = readConfig(input);
  const unlocked = unlockedTiers(config, input.cart.lines, currencyRate(input), cartCurrency(input));
  const freeShipping = unlocked.find(({ tier }) => tier.type === "free_shipping");
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
