// Buyer-protection rules applied to every campaign before it is published to the storefront, so a stored
// config (including ones saved before these rules existed) can't bypass them. cartkit.js enforces the same
// rules for configs that were published earlier.
// Kept free of imports so it can be unit tested with `node --test` (test/storefront-rules.test.ts).

// App Store requirement 1.1.9: no optional charge is added or pre-selected without the buyer's consent.
// App Store requirement 1.1.4: no fake urgency (per-visitor "evergreen" countdowns).
export function applyBuyerProtection(type: string, config: Record<string, any>): Record<string, any> {
  const cfg = { ...config };
  if (type === "bxgy") {
    // Only free "get" items may be added for the shopper; a partial discount would raise the cart total.
    cfg.autoAdd = Boolean(cfg.autoAdd) && Number(cfg.percent) >= 100;
  }
  if (type === "addon") {
    // Paid add-ons always start unticked.
    delete cfg.defaultChecked;
  }
  if (type === "announcement") {
    // A countdown only shows a real deadline (timerEnd, else the campaign's end date; none = no timer).
    // Old per-visitor settings are dropped, so such a timer falls back to that real deadline.
    delete cfg.timerType;
    delete cfg.evergreenMinutes;
  }
  return cfg;
}
