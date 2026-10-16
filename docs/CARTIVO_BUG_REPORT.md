# Cartivo — Bug Report

Branch `appstore-readiness`, 2026-10-16. Every bug below was reproduced by an executed test. Fixes are local and uncommitted; nothing was pushed or deployed.

| ID | Severity | Title | Status |
|---|---|---|---|
| BUG-01 | Critical (P0, security) | Any shop can overwrite and take over another shop's campaign | Fixed, regression test passes |
| BUG-02 | Critical (P0, buyer consent 1.1.9) | BXGY auto-adds a unit the shopper is charged for | Fixed, regression tests pass |
| BUG-03 | Critical (P0, buyer consent 1.1.9) | Auto-added gift / BXGY item stays in the cart at full price when the discount doesn't apply | Fixed in harness; **needs live verification (LIVE-06)** |
| BUG-04 | High (P1, buyer consent) | Add-on checkbox shows the wrong state while adding; a keyboard untick is lost and the paid add-on stays | Fixed, regression tests pass |
| BUG-05 | Medium (P2) | Add-to-cart errors (e.g. sold out) are invisible when the cart is empty | Fixed |
| BUG-06 | Medium (P2, a11y) | Keyboard focus leaves the aria-modal drawer | Fixed |
| BUG-07 | Medium (P2, a11y) | Image links in cart lines and upsells have no accessible name | Fixed |
| BUG-08 | Medium (P2, a11y) | Green success text fails WCAG contrast (2.88:1 / 3.1:1) | Fixed (approved, second pass): badge colour darkened to 4.5:1 for the three texts; all 7 looks pass |
| BUG-09 | Low (P3) | Publish failures show "[object Response]" to the merchant | Fixed |
| BUG-10 | Critical for submission | Production (cartivo-app.onrender.com) runs an old build: shop-domain login form and old "CartKit" name | **Open — needs a redeploy (not done by QA)**; still open on re-check 2026-10-16 |
| BUG-11 | High (P1, buyer consent 1.1.9) | Paid add-on checkbox offered without a visible price | Fixed (CON-21..23); details in `CARTIVO_SHOPIFY_APPSTORE_READINESS_REPORT.md` |
| BUG-12 | Medium | Malformed admin input (JSON, dates, settings sections) → HTTP 500 | Fixed (VAL-01/02/07) |
| BUG-13 | Low–Medium | Campaign end date before start date saved silently | Fixed (VAL-03) |
| BUG-14 | Low | `__proto__` type, non-object config and unlimited names accepted | Fixed (VAL-05/06) |
| BUG-15 | Low | `app/scopes_update` without a scope list → 500 | Fixed (WH-SCOPES-02) |
| BUG-16 | Low–Medium (a11y) | "Taxes and shipping calculated at checkout" under 4.5:1 in the Sunset (4.35:1) and Ocean (4.48:1) looks | Fixed (approved, third pass): A11Y-05 passes in all 7 looks |
| BUG-17 | Low (1.1.4 wording) | An ended countdown showed "Offer ends in 00:00:00" when "Hide when the timer reaches zero" was off (was OBS-7) | Fixed (approved, third pass): CMP-07..09 |

OBS-4 below is corrected: support tickets are limited to 5 per hour per shop (verified by VAL-08).

---

## BUG-16 — Muted text contrast in the Sunset and Ocean looks (fixed in the third pass)

- **Evidence:** A11Y-05 (axe `color-contrast`) failed for `.ck-taxes` in 4 runs (Sunset and Ocean, desktop and Pixel 7):
  Sunset `#78716c` on the footer `#f8f3ee` = 4.36:1, Ocean `#64748b` on `#f8f8f9` = 4.48:1. The footer background
  (`--ck-soft`) is 3% of the text colour over the drawer background, slightly darker than the drawer itself.
- **Fix:** `cartkit.js` publishes `--ck-muted` through `readableMuted()`: the look's muted colour is kept when it
  already reaches 4.5:1 on `--ck-soft`, otherwise the same hue is darkened (lightened on dark drawers) in 2% steps
  until it does. Same approach as BUG-08, so it also protects merchants' own muted colours.
- **Result:** Sunset `#78716c` → `#736c68` (4.69:1 on the footer, 4.97:1 on the drawer); Ocean `#64748b` → `#627288`
  (4.62:1 / 4.90:1). Aurora, Liquid glass, Forest, Midnight and Minimal are byte-for-byte unchanged. The BUG-08
  badge colours are unchanged in all looks (checked by script after the shared helper was refactored).
- **Regression:** A11Y-04 and A11Y-05 (7 looks) pass on Chrome and Edge, desktop and Pixel 7.

## BUG-17 — Ended countdown showed 00:00:00 (fixed in the third pass)

- **Evidence:** live dev store drawer, second pass: "Offer ends in 00:00:00" (OBS-7).
- **Fix:** when the offer end has passed and "Hide when the timer reaches zero" is off, the timer shows the
  campaign's new "Text after the offer ends" (`expiredText`, default "Offer ended", translatable under Markets).
  Configs published before this field existed fall back to "Offer ended". With the hide option on (the default),
  the timer is still hidden. The editor shows the new text field only when the hide option is off.
- **Regression:** CMP-07 (running timer shows `hh:mm:ss`), CMP-08 (ended → "Offer ended", new and old configs),
  CMP-09 (hide option still hides).

## BUG-01 — Cross-shop campaign takeover

- **Severity:** Critical (cross-shop data integrity).
- **Evidence:** `ISO-01` failed before the fix: `status 200: [..."saved",true,...]` and the campaign's `shop` changed from `cartivo-qa-b` to `cartivo-qa-a`.
- **Reproduction:** As shop A (valid session token), POST `/app/campaigns/<shop B campaign id>` with any payload. Campaign ids are public: they're in every storefront's page source (`#cartkit-config`).
- **Root cause:** The route action didn't check ownership, and `saveCampaign` did `db.campaign.update({ where: { id } })` with `data.shop = session.shop`, which moved the row into shop A.
- **Fix:** `app/models/store.server.ts` updates with `updateMany({ where: { id, shop } })` and returns `null` when nothing matched. `app/routes/app.campaigns.$id.tsx` answers "This campaign doesn't exist anymore."
- **Regression:** `ISO-01` (and `ISO-02`, `ISO-03`, `AUTH-05`) pass.

## BUG-02 — BXGY auto-add charges the shopper

- **Severity:** Critical (unauthorised paid cart addition).
- **Evidence:** `CON-06` failed before the fix: expected total $30.00, actual **$40.00**. `CON-07` failed: an auto-added line was charged.
- **Reproduction:** BXGY "buy Shirt, get Socks free", auto-add on. The shopper adds Socks ($10), then Shirt ($30).
  1. The Function makes the shopper's own Socks free.
  2. `cartkit.js` still auto-adds another Socks, because it only counted lines it had tagged.
  3. The Function's free quantity is already used, so the added Socks costs $10.
  The same happens when a cheaper "get" product is already in the cart: the Function discounts cheapest units first.
- **Root cause:** `planAutoLines()` compared the free quantity only with Cartivo-tagged lines. The Function discounts the cheapest get-product units in the whole cart.
- **Fix:** `extensions/cartkit-theme/assets/cartkit.js` now adds only the missing units: `want − get-product units already in the cart`.
- **Regression:** `CON-05` to `CON-10`, `CMP-03`, `CMP-05` pass.

## BUG-03 — Gift / BXGY item left at full price

- **Severity:** Critical (unauthorised paid cart addition).
- **Evidence:** `CON-11` and `CON-12` failed before the fix: the gift line had `final_line_price` 2500 ($25) in the server cart.
- **Reproduction:** A free-gift goal is reached while the "Cartivo rewards" automatic discount isn't applied, for any of these reasons:
  - the merchant deactivated or deleted it in Shopify admin (`ensureDiscount` only checks that it exists, not that it's active);
  - the shopper applied a code that doesn't combine with product discounts and is worth more;
  - a device clock outside the campaign dates.

  `cartkit.js` adds the gift anyway, and it is charged at full price.
- **Root cause:** Gifts and BXGY items were added on the assumption that the Function would make them free; the price Shopify returned was never checked.
- **Fix:** `cartkit.js` removes any auto-added gift or BXGY line whose `final_line_price > 0`. It records the key in `sessionStorage` (`cartkit_not_free`) so the item isn't re-added this session. Picking a gift in the gift picker clears the mark.
- **Remaining risk — must verify live (LIVE-06):** The fix assumes Shopify's Ajax `cart.js` reflects the Function discount (gift line = $0) right after the add, as Shopify documents for automatic discounts. If a store's cart API did not, every gift would be removed. Confirm on the dev store before submitting.
- **Suggested follow-up (not done):** Show the merchant a warning on the Dashboard when the "Cartivo rewards" discount isn't `ACTIVE`.

## BUG-04 — Add-on checkbox race

- **Severity:** High.
- **Evidence:** `CON-15` failed before the fix: end state `{ checked: true, qty: 1 }` after the shopper's untick.
- **Reproduction:** Tick the paid add-on on a slow connection.
  1. The drawer re-renders immediately and the box shows **unticked** while the add is still in flight.
  2. A keyboard user unticks it, and the untick is lost.
  3. The add lands: the paid add-on is in the cart and the box shows ticked.

  Ticking again during the request could add a second unit.
- **Fix:** `cartkit.js` remembers the shopper's last choice (`addonWanted`) and renders it while pending. An untick during the add records the decline, and `planAutoLines()` removes the line when it arrives. Add-ons are kept at one unit.
- **Regression:** `CON-13` to `CON-16`, `CON-15b` pass.

## BUG-05 — Errors invisible on an empty cart

- **Evidence:** `SF-03` and `SF-10` failed: no `.ck-error-text`.
- **Root cause:** `renderFooter()` only rendered `state.error` when the cart had items.
- **Fix:** The error renders as `role="alert"` when the cart is empty.

## BUG-06 — Focus not trapped in the modal drawer

- **Evidence:** `A11Y-03` failed: focus moved to page links behind the drawer.
- **Fix:** `trapFocus()` cycles Tab and Shift+Tab inside the drawer while it's open.

## BUG-07 — Image links without names

- **Evidence:** axe `link-name` violation (3 nodes) in `A11Y-04`. The upsell image links always had `alt=""`; cart lines without an image produced empty links.
- **Fix:** The image links duplicate the title link next to them, so they are now `aria-hidden="true" tabindex="-1"`.

## BUG-08 — Colour contrast (fixed in the second pass)

- **Evidence:** axe `color-contrast`, serious:
  - `#16a34a` on `#e3f4e9`: 2.88:1 (discount badge, BXGY promo line);
  - `#16a34a` on `#f8f8f9`: 3.1:1 (savings text).

  WCAG AA needs 4.5:1 for this text size.
- **Required fix:** A darker green (for example `#15803d` or darker) for these three elements in `cartkit.css`. Not changed: design colours need your approval.

## BUG-09 — "[object Response]"

- **Evidence:** `syncError: "[object Response]"` in action responses before the fix.
- **Fix:** `trySync` reports "Shopify answered <status> <text>".

## BUG-10 — Production runs an old build (open)

- **Evidence:** A read-only `GET https://cartivo-app.onrender.com/` on 2026-10-16 returned a page with the manual `name="shop"` login form and the heading "CartKit – Cart Drawer & Free Gift". The branch hides that form in production (`app/routes/auth.login/manual.server.ts`) and uses the Cartivo name.
- **Required fix:** Deploy the current branch (with these fixes) to Render. Check that `ALLOW_MANUAL_LOGIN` isn't set there: `manualLoginAllowed()` shows the form in production when it is.

---

## Observations (not defects; business decisions, not changed)

| ID | Observation | Risk |
|---|---|---|
| OBS-1 | When the trial ends and the merchant never returns, the published storefront config keeps trial-level settings: sticky cart, floating cart, custom HTML/JS, premium looks. Campaigns do stop (their end date is capped at the trial end). Nothing republishes on trial expiry. | Revenue leak, not merchant harm |
| OBS-2 | A free BXGY item counts at its full price toward reward goals (storefront and Function agree). A shopper can unlock a free gift or % off partly with an item they don't pay for. | Merchant may give more than intended |
| OBS-3 | `ensureDiscount` doesn't check that the automatic discount is active (see BUG-03). | Gifts silently not free; now removed instead of charged |
| OBS-4 | Support tickets have no rate limit (live chat has 10/min). Proxy analytics accepts any request Shopify signs, so shoppers can inflate analytics. | Low |
| OBS-5 | The dev store has both the production app and the dev app installed; two app embeds can be enabled at once. | Duplicate drawers while testing |
| OBS-6 | `manualLoginAllowed()` lets `ALLOW_MANUAL_LOGIN=true` show the form in production too, while its comment says "non-production". | Config mistake would break 2.3.1 |
