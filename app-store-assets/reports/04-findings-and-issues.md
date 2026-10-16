# Findings while producing the media (2026-10-16)

Everything below was seen on the development store `cartivo-app-test` with the **Cartivo Dev** app. Nothing was
hidden or simulated in the assets; where something looked wrong, the assets avoid it and it is listed here.

## Feature checks (all real, verified in Shopify's own cart)

| Feature | Result | Evidence |
|---|---|---|
| Free gift goal (cart value ≥ $100, shopper picks 1 of 3 Ski Wax variants) | **Works.** Gift added; Shopify `/cart.js` line price **$0.00**; Shopify cart page shows $24.95 struck through, $0.00 | `evidence/storefront-cart-evidence.json`, review video (cart page) |
| Buy X Get Y (buy Oxygen, get The Complete Snowboard 100 % off, auto-add) | **Works.** Auto-added; `/cart.js` **$0.00** | same |
| In-cart upsell (Oxygen in cart → recommend Liquid) | **Works** once Cart drawer → Upsells source is "Manual first, then automatic" (default is Automatic). One-click Add added Liquid at full price | review video |
| Campaign activate (draft → Live) | **Works** | review video |
| Cart drawer looks incl. Liquid glass (trial / Premium) | **Works**, saved and shown on the storefront | review video, storefront captures |
| Sticky add-to-cart bar, floating cart button | **Work** (bar appears after scrolling past the product form; floating button opens the drawer and shows the count) | review video |
| Checkout | **Not opened** in these sessions (by design: no orders). LIVE-06a evidence from 2026-10-15 covers checkout | `tests/e2e/evidence/live/` |

## Issues found (for the team)

1. **Free BXGY items count toward cart goals (product decision needed).** `rewardsProgress()` in
   `extensions/cartkit-theme/assets/cartkit.js` skips gift lines but counts `_cartkit_bxgy` lines at their original
   price; the discount Function (`extensions/cartkit-discounts/src/shared.js`, `progressValue`) does the same with the
   pre-discount line subtotal. Example seen: a $600 cart (Hydrogen + free Complete Snowboard worth $699.95) showed
   "Free shipping" unlocked against a $1,000 goal, and checkout would grant it. Consistent between drawer and checkout,
   but merchants may expect goals to count only what the shopper pays. Not changed (app code was out of scope).
2. **Campaigns list: the Actions column wraps** ("Delete" drops under "Edit / Deactivate") at a ~1,376 px app frame.
   Cosmetic; visible in `screenshots/07-campaigns.png`.
3. **Old dev-store test data looked wrong on camera**, so it was set to Draft (not deleted) before recording:
   - Announcement countdown ended 2026-10-14 → drawer showed "Offer ended";
   - its message "Free shipping on orders over $50" contradicted the $1,000 free-shipping goal of another campaign;
   - One-click add-on labelled "Add gift wrapping for {{price}}" but its product is the $1,025 Oxygen snowboard;
   - three "In-cart upsell" and three "Cart goals & free gifts" duplicates (two upsells empty).
4. **Shopify bag logo on sample product art.** Shopify's generated test snowboards carry a small Shopify bag print
   (e.g. bottom of the Oxygen board). It appears small in some storefront screenshots/video frames. App Store
   requirement 4.4.3 forbids Shopify trademarks in screenshots — see manual review.
5. **Review video caption timing:** a caption can appear a fraction of a second before its page finishes loading.
   Cosmetic.

## Changes made to the development store (all reversible)

| What | Before | After | Undo |
|---|---|---|---|
| 9 older campaigns | Active | Draft | Campaigns → Activate (full config in the dev backup) |
| 3 demo campaigns | — | "Oxygen board upsell", "Buy Oxygen, get a board free", "Free ski wax over $100" (Live) | Campaigns → Delete |
| Cart drawer → Upsells source | Automatic | Manual first, then automatic | Cart drawer → Upsells & recommendations |
| Cart drawer look | Forest | Liquid glass | Cart drawer → Style |
| Trial row (`ShopTrial`) | started 2026-10-07, Starter chosen 2026-10-15 | trial restarted 2026-10-16 (7 days, all features) | `node app-store-assets/source/capture/dev-trial.mjs restore app-store-assets/reports/evidence/dev-trial-before.json` |
| `.env` `DEV_PLAN` | `grow` | commented out (trial decides the plan) | put `DEV_PLAN=grow` back and restart `npm run dev` |

Full pre-change backup of campaigns and settings: `evidence/dev-backup-before.json` (checked: no secrets; it is
dev-store data only). Production database and the production app were never touched; no billing call created
a charge; nothing was pushed, merged, deployed or submitted.
