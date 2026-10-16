# Live tests on the development store

These run against the real `cartivo-app-test.myshopify.com` storefront with the **Cartivo Dev** app. They never
place an order, and they refuse any other store.

## Before running

1. `npm run dev` is running (Cartivo Dev, `shopify.app.cartivo-dev.toml`).
2. In the theme editor (Online Store → Themes → Customize → App embeds), only the **Cartivo Dev** embed is on.
   Turn off the production Cartivo embed on this store.
3. Cartivo Dev → Campaigns has one active "Cart goals & free gifts" campaign with a **free gift** goal
   (one gift product), not ended. Deactivate the duplicates while testing.

## LIVE-06: gifts are free in Shopify's cart

In PowerShell (the password stays in your terminal):

```
$env:CARTIVO_LIVE_STORE = "cartivo-app-test.myshopify.com"
$env:CARTIVO_STOREFRONT_PASSWORD = "<storefront password>"
$env:SKIP_APP_SERVER = "1"
npx playwright test --project=live
Remove-Item Env:CARTIVO_STOREFRONT_PASSWORD
```

Evidence lands in `tests/e2e/evidence/live/`: `live06-cart.json` (Shopify's `/cart.js`), the drawer and checkout
screenshots, and the cart total to compare with the checkout total.

To re-run only the BXGY case (one storefront login, which keeps Shopify's bot check from triggering), add
`-g "LIVE-06b"` to the `npx playwright test` line. Run it **before** removing `DEV_PLAN` (BXGY needs Growth).

## Dev store snapshot (read-only)

`node tests/e2e/live/dev-state.mjs` prints the dev store's campaigns, sessions, settings summary, trial row and
row counts from the isolated dev DB (it refuses any other database). Save its output before and after each step
below as evidence: `node tests/e2e/live/dev-state.mjs > tests/e2e/evidence/live/state-<step>.json`.

## Recommended order

1. LIVE-06b (needs `DEV_PLAN=grow`).
2. LIVE-04 billing (remove `DEV_PLAN`). Test charges only.
3. LIVE-01/02 uninstall + reinstall, **only after explicit approval** (see "What an uninstall loses").

## LIVE-04: billing with test charges

Safeguards (verified in code, 2026-10-16):

- `isTestBilling()` returns `true` whenever `NODE_ENV` isn't `production`. `npm run dev` runs `react-router dev`,
  so every `billing.request`, `billing.check` and `billing.cancel` from your dev session is a **test** charge.
- `cartivo-app-test` is a Partner development store; Shopify doesn't take real payments from development stores.
- `BILLING_DISABLED=false` in `.env`; it must stay `false` (when `true` the app runs as Premium without billing).

Before you start, note what changes on the dev store: the trial ended on 2026-10-14 and `freeChosenAt` is set,
so without `DEV_PLAN` the app resolves to **Starter**. The next publish (any save, or the Plans page) sends the
Starter config: the Forest look becomes Minimal, sticky/floating turn off, and campaigns stop showing. Nothing
is deleted; subscribing (test) to Growth or putting `DEV_PLAN=grow` back restores it.

Steps:

1. `node tests/e2e/live/dev-state.mjs > tests/e2e/evidence/live/state-before-billing.json`
2. In `.env`, comment out `DEV_PLAN=grow`. Restart `npm run dev`.
3. Open Cartivo Dev → Plans. Expected: no "Development: DEV_PLAN" banner; current plan Starter.
4. **Approve:** choose Essential. Shopify's approval page must say it's a **test** charge. Approve. Expected:
   back on Plans with `?upgraded=1`, plan Essential, storefront config republished (Ocean/Forest allowed).
5. **Upgrade:** choose Growth → approve (test). Expected: plan Growth; the Essential subscription is replaced.
6. **Downgrade:** choose Essential → approve (test). Expected: plan Essential; Growth-only features
   (BXGY, upsells, add-ons, custom HTML/JS, languages) stop showing on the storefront; nothing is deleted.
7. **Decline:** choose Growth → on Shopify's page click Decline/Cancel. Expected: back in the app on Essential,
   no error page, no new subscription.
8. **Cancel to Starter:** choose Starter. Expected: subscription cancelled (test), plan Starter, dashboard
   explains what stopped. Check Partner Dashboard → Apps → Cartivo Dev → test charges list.
9. `node tests/e2e/live/dev-state.mjs > tests/e2e/evidence/live/state-after-billing.json`; screenshots of each
   Shopify approval page (showing "test") into `tests/e2e/evidence/live/`.
10. Put `DEV_PLAN=grow` back afterwards if you want the dev store to keep showing campaigns.

Stop immediately if an approval page does **not** say "test".

## What an uninstall loses (LIVE-01/02) — needs your explicit approval

Uninstalling **Cartivo Dev** from `cartivo-app-test` (snapshot of 2026-10-16 04:50 UTC):

| Where | What | On uninstall | On reinstall |
|---|---|---|---|
| Dev DB `Session` | 1 offline session (scopes `read_locales,read_products,write_discounts`) | Deleted by our `app/uninstalled` handler | New session from OAuth |
| Dev DB `Campaign` | 9 active campaigns: 3 rewards (one with the $60 free gift, ending 2026-10-16 14:09 UTC), 1 BXGY, 3 upsells, 1 add-on, 1 announcement | Kept by our handler | Still there **unless** `shop/redact` has run |
| Dev DB `ShopSettings` | Settings (Forest look, sticky + floating on), stored "Cartivo rewards" discount id | Kept | Still there unless redacted; the discount id is re-checked and the discount re-created if missing |
| Dev DB `ShopTrial` | Trial started 2026-10-07, Starter chosen 2026-10-15 | Kept (by design: the trial can't restart) | Reinstall shows Starter, **not** a fresh trial |
| Shopify | `shop/redact` webhook | Shopify sends it about **48 hours** after uninstall | If it arrives, our handler deletes **all** of the dev store's rows above (campaigns, settings, trial, tickets, chat) |
| Shopify | App-owned metafield `cartkit.config` (published storefront config) and the discount's function configuration | Definitions removed; values retained only temporarily, no guaranteed period | Re-published by the next sync |
| Shopify | "Cartivo rewards" automatic app discount | Expected to be removed with the app's function | Re-created by `ensureDiscount` on the next sync |
| Shopify | Cartivo Dev app embed (and volume block, if placed) in the theme | Removed / disabled | Must be enabled again in the theme editor (LIVE-03 deep link) |
| Shopify | Any test subscription from LIVE-04 | Cancelled | Must be re-subscribed (LIVE-02 checks this) |
| Not affected | The production **Cartivo** app on the same store, products, orders, theme code, storefront password | — | — |

To keep a copy of the campaign data, run the snapshot first. The campaign `config` JSON isn't in the snapshot;
ask for a full export before approving if you want to be able to restore them exactly.

## LIVE-01/02: install, OAuth, uninstall, reinstall

1. `node tests/e2e/live/dev-state.mjs > tests/e2e/evidence/live/state-before-uninstall.json`
2. Dev store admin → Settings → Apps → Cartivo Dev → Uninstall. (Not the production "Cartivo".)
3. Expected within a minute: `npm run dev` log shows `Received APP_UNINSTALLED webhook`; snapshot shows 0
   sessions and campaigns still present. Storefront: no Cartivo Dev drawer.
4. **Reinstall (LIVE-01/02):** open the install link from `npm run dev` (press `p` for the preview URL), or
   Partner Dashboard → Cartivo Dev → Select store → `cartivo-app-test`.
   Expected:
   - OAuth grant screen lists exactly: read locales, read products, write discounts;
   - after approval, Shopify redirects **straight into the embedded app UI** (2.3.3), no shop-domain field anywhere (2.3.1);
   - a new offline session in the snapshot.
5. Expected in the app: dashboard loads, plan Starter (trial already used), setup guide shows the embed as off;
   the theme-editor deep link enables the embed (LIVE-03).
6. Re-subscribe with a test charge (LIVE-02 / 1.2.2) as in LIVE-04 step 4.
7. Save a campaign; expected: the "Cartivo rewards" discount exists again (Discounts page) and the storefront
   drawer is back.
8. `node tests/e2e/live/dev-state.mjs > tests/e2e/evidence/live/state-after-reinstall.json`
9. **Within 48 hours** decide whether to let `shop/redact` wipe the dev store's rows. Reinstalling doesn't
   necessarily stop it; check the dev log for `SHOP_REDACT` and re-create test campaigns if needed.

Fresh-install case (2.3.2) on a store that never had the app: needs a second development store. The dev store
above has a trial row, so it can't show the first-install trial.
