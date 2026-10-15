# Cartivo — Shopify App Store Readiness Report

- **Branch:** `appstore-readiness`. **Date:** 2026-10-16 (second pass).
- **Local commits:** `2e1b2ca`, `c5709a1`, `e2f7024`, `f13b4ea`, `4f6be32`, plus the live-test and documentation commit. **Not pushed.**
- **Scope:** local and isolated testing only.
  - Nothing was pushed, merged, deployed or submitted.
  - No billing charge was created and no app was uninstalled.
  - Production wasn't changed. The only contact with production was read-only GETs of `/` and `/healthz`.
  - The live checks ran on the **development** store only, and no order was placed.
- **Builds on:** `CARTIVO_FINAL_QA_REPORT.md`, `CARTIVO_BUG_REPORT.md`, `CARTIVO_TEST_INVENTORY.md` and `CARTIVO_SHOPIFY_COMPLIANCE.md`.

**GO/NO-GO: NO-GO** (section 23).

---

## 1. Executive summary

**Done in this pass:**

- **BUG-08 (contrast) fixed** for the three approved elements: discount badge, BXGY promo line and savings text.
  - They use the badge colour darkened just enough for WCAG AA 4.5:1 (lightened on dark looks). Colours that already pass are unchanged.
  - For the default look this gives `#117a38`. Your suggested `#15803d` only reaches 4.27:1 on the badge's own tint, so it would still have failed.
  - axe passes for these elements in all 7 looks, on Chrome and Edge.
- **New: BUG-16** (open, needs approval). The muted "Taxes and shipping calculated at checkout" text is just under 4.5:1 in two Premium looks: Sunset 4.35:1, Ocean 4.48:1. This is outside the approved change, so it wasn't touched.
- **All uncommitted work reviewed** and committed locally in 5 logical commits. The first commit (plan tiers) was verified on its own: typecheck clean, 15/15 unit tests.
  - The working tree contained a **pre-existing plan-tiering change** that isn't a QA fix: Starter loses sticky add-to-cart, floating cart and custom code, and looks are tiered per plan. It is committed separately so it can be reviewed or reverted on its own.
- **Full regression:** 155 passed, 4 failed (BUG-16 only), 0 flaky. Unit tests 37/37, typecheck clean, lint 0 errors.
- **LIVE-06 executed on the real dev store** (Cartivo Dev, with the storefront password you provided; not stored anywhere):
  - **Gift: PASS.** The picked free gift is $0 in Shopify's own `/cart.js` (was $24.95). It stays in the cart, and checkout shows "FREE GIFT (-$24.95)" with a total of $749.95, the same as the cart.
  - **BXGY:** the auto-added free item was $0 in `/cart.js` (was $699.95) and every assertion passed, but that run was marked failed by a Playwright teardown timeout (since fixed). A clean re-run was then stopped by Shopify's bot verification page, so **LIVE-06b isn't recorded as a clean pass yet**.
  - This settles the main BUG-03 risk: Shopify's cart reflects the Function discount, so Cartivo's "remove if not free" check keeps valid gifts.
- **Production still runs the old build** (BUG-10, re-checked today), so requirement 2.3.1 fails there.

**Technical readiness is not App Store approval.** Shopify's own review decides approval.

## 2. Application architecture overview

| Layer | Implementation |
|---|---|
| Admin app | React Router 7 (`@shopify/shopify-app-react-router` 3.x), embedded, Polaris web components, App Bridge |
| Backend / DB | Node 22+, Prisma 6, PostgreSQL on Neon (Session, ShopSettings, Campaign, Event, ShopTrial, SupportTicket, ChatMessage) |
| Auth | Session tokens and token exchange, Prisma session storage, expiring offline tokens |
| Billing | Billing API: Essential $10, Growth $20, Premium $60 every 30 days; app-tracked 7-day trial; Starter free; test charges only on development stores |
| Plan gating | Looks by tier (Starter Minimal → Premium all); sticky cart and custom CSS Essential+; custom HTML/JS and languages Growth+; campaign types and active limits. Enforced in the editor, on save and when publishing. |
| Discounts | Shopify Function (automatic app discount "Cartivo rewards") |
| Storefront | Theme app extension: app embed (drawer, goals, gifts, BXGY, upsells, add-ons, sticky, floating) and volume block |
| Webhooks | app/uninstalled, app/scopes_update, app_subscriptions/update, plus the compliance topics |

## 3. Test environment verification (re-checked this pass)

| Check | Result | Evidence |
|---|---|---|
| Dev app | PASS | `shopify app info --config cartivo-dev`: "Cartivo Dev", client_id `ab4953…`, org Softique Commerce, dev store `cartivo-app-test.myshopify.com`. Production is `fbeacb…`. |
| Dev database | PASS | `.env` host `ep-lucky-bonus-…`; production `ep-billowing-…`. Server tests and the read-only state query refuse other hosts. |
| No production credentials locally | PASS | `.env` has no Shopify API key or secret. Tests use throwaway credentials. |
| Dev app installed on the dev store | PASS | Dev DB (read-only): an offline session for `cartivo-app-test` with the correct scopes; "Cartivo rewards" discount id stored. |
| Shopify CLI | Logged in | Partner account, Softique Commerce |
| Your running dev session | Found | `npm run dev` (pid 24844, started 00:51) serves the working tree, so the fixes are already in your dev preview. A second dev session I started was stopped during start-up, before its tunnel and URL update steps, so it shouldn't affect yours. If the app stops loading in admin, restart `npm run dev`. |
| `.env` flags | Note | `DEV_PLAN=grow`: the local app runs as Growth without calling Shopify Billing. Remove it for LIVE-04 (billing). `BILLING_DISABLED=false`. |
| Playwright MCP | **Not available** | No Playwright tools are loaded in this Claude session. All browser runs used Playwright Test. |

## 4–8. Test totals

| Suite | Cases | Executed runs | Passed | Failed | Not run / blocked |
|---|---|---|---|---|---|
| Unit (plans, storefront rules, billing) | 24 | 24 | 24 | 0 | — |
| Unit (discount Function) | 13 | 13 | 13 | 0 | — |
| Server (built app + dev DB) | 43 | 43 | 43 | 0 | — |
| Storefront harness, Chrome desktop + Pixel 7 | 58 (51 + 7 new A11Y-05) | 116 | 112 | 4 (A11Y-05 sunset/ocean, BUG-16) | — |
| Storefront harness, Edge: full suite (before the BUG-08 fix) | 51 | 102 | 100 | 2 (A11Y-04, since fixed) | — |
| Storefront harness, Edge: accessibility (after the fix) | 11 | 22 | 18 | 4 (BUG-16) | — |
| Firefox, WebKit, mobile-safari, tablet | 58 each | 0 | — | — | **NOT RUN**: browser download stalls (twice) |
| Live dev store: LIVE-06a (gift) | 1 | 1 | **1** | 0 | — |
| Live dev store: LIVE-06b (BXGY) | 1 | 1 (assertions passed; run marked failed by a teardown timeout) | — | — | Clean re-run blocked by Shopify's bot verification |
| Live dev store: LIVE-01..05, 07..10 | 9 | 0 | — | — | **BLOCKED** (section 21) |

- **Final consolidated run** (`server` + `chromium-desktop` + `mobile-chrome`, installed Chrome): **155 passed, 4 failed, 0 flaky** (`tests/e2e/.results/results.json`: expected 155, unexpected 4, flaky 0).
- **Distinct cases:** 149 (37 unit, 43 server, 58 storefront, 11 live; LIVE-06 is split into 06a and 06b).
- **Executed on the real dev store:** LIVE-06a (pass) and LIVE-06b (assertions passed, run not clean).
- **Needs manual verification:** LIVE-01..05 and 07..10, a clean LIVE-06b re-run, listing, privacy policy.

## 9. Real browser E2E results

- **Executed:**
  - Real Chrome and Edge, driven by Playwright Test, against the local harness. The harness uses the real `cartkit.js`/`cartkit.css` and prices carts with the real discount Function.
  - Covered: desktop and Pixel 7 viewports, cart, variants, sold-out, failures, upsells, BXGY, gifts, add-ons, stacking, schedules, checkout redirect, XSS, focus, and axe on all 7 looks.
- **Real dev store** (`cartivo-app-test.myshopify.com`, real Chrome, Cartivo Dev's dev extension `…/extensions/01a140e9…/dev-b1a585d7…/assets/cartkit.js`, exactly one Cartivo embed):

  | Case | Shopify `/cart.js` | Checkout | Result |
  |---|---|---|---|
  | LIVE-06a: $749.95 snowboard, goal $60, gift picked in the drawer | "Selling Plans Ski Wax" qty 1, `final_line_price` **0** (original 2495); nothing removed (`cartkit_not_free` empty); total 74995 | Ski Wax ~~$24.95~~ **FREE**, "FREE GIFT (-$24.95)", total **$749.95** | **PASS** |
  | LIVE-06b: buy "The Collection Snowboard: Hydrogen" $600 (BXGY 100%, auto-add) | Auto-added "The Complete Snowboard" qty 1, `final_line_price` **0** (original 69995); nothing removed; total 60000 | Screenshot taken in that run | Assertions passed; run marked failed (teardown timeout, fixed); evidence file overwritten by the next run; values above are from that run's console output. **Re-run needed.** |

  - Also seen live: the add-on shows its price ("Add gift wrapping for $1,025.00"), so the BUG-11 fix works on the real store.
  - After about a dozen automated password logins, Shopify answered with **"Your connection needs to be verified before you can proceed"**. Testing stopped there; the challenge wasn't bypassed.
- **Not executed:** the merchant journey in the Shopify admin, LIVE-07 for volume, tier and code discounts, Firefox and WebKit.

## 10. Authentication results

Unchanged from the first pass; all checks re-ran and passed:

- No token, a bad signature or an expired token is refused (AUTH-01..03). A valid token is accepted (AUTH-04). A token for another shop can't act on shop A's data (AUTH-05).
- The bot filter (410) applies only to admin authentication. Real Shopify webhook and proxy callers aren't filtered (CTX-01..03).
- OAuth install, reinstall and offline-token refresh: **NOT TESTED** live.

## 11. Security audit results

All server security tests pass (43/43):

- cross-shop isolation;
- webhook HMAC;
- app proxy signatures;
- input validation (BUG-12..14);
- plan gating by direct POST;
- support inbox;
- rate limits (chat 10/min, tickets 5/hour);
- no raw SQL;
- XSS escaping (SEC-SF-01).

No secrets in the repo or the reports. A secret scan of the committed test files found none.

## 12. Billing test results

- **Executed:** plan-resolution unit tests, 9/9 pass. They cover approve, decline/pending/expired/frozen/cancelled, cancel to Starter, upgrade/downgrade replacement, unknown plan, and the trial boundary.
- **BLOCKED:** real test charges (LIVE-04) need your approval clicks in the dev store admin, and `DEV_PLAN` removed from `.env`. No charge was created.

## 13. Webhook test results

All six topics: bad HMAC → 401, valid → 200.

- shop/redact deletes only that shop's data and is idempotent.
- app/uninstalled is idempotent.
- The customer topics store nothing and change nothing.
- scopes_update is safe without a scope list.

## 14. Theme extension test results

- **Shopify Theme Check:** PASS on all 5 files (first pass; this pass changed only `cartkit.js`/`cartkit.css` colour logic, with no Liquid changes).
- **Code checks:** no Asset API or ScriptTag use; the embed renders nothing without its config metafield.
- **Live theme editor and real themes:** NOT TESTED.

## 15. Performance findings

| Measurement | Value |
|---|---|
| `cartkit.js` | ~75.9 KB raw after the BUG-08 helper (+~1.3 KB) |
| Harness add-to-cart → drawer | 141–240 ms (first pass) |
| Layout shift | 0 |
| Real-store Lighthouse | **NOT MEASURED** (LIVE-09) |

## 16. Shopify compliance checklist

**Source:** the live requirement list, fetched 2026-10-16 with `shopify doc fetch --url https://shopify.dev/docs/apps/launch/app-store-review/app-store-ai-self-review-requirements`. The full list is at https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements.

| Req | Requirement | Status | Evidence |
|---|---|---|---|
| 1.1.1 | Session tokens | PASS | AUTH-01..05, App Bridge |
| 1.1.2 | Shopify checkout | PASS | SF-09 |
| 1.1.3 | No theme downloads | PASS (code) | No Themes API |
| 1.1.4 | Factual information | PASS | CMP-06, factual plan badges |
| 1.1.6–8, 1.1.13–16 | Marketplace, payments, POS, copying, agencies, refunds, lending | N/A | Not present |
| **1.1.9** | Buyer consent before charges | **PASS** (harness, plus live for gifts) | CON-01..23. LIVE-06a: gift $0 in cart and checkout. LIVE-06b: BXGY $0 (re-run needed for a clean record). |
| 1.1.10 | Cheapest shipping default | PASS (code) | Shipping options never reordered |
| 1.2.1 | Billing API | PASS (code) | `billing.request/check/cancel` |
| 1.2.2 | Accept, decline, reinstall | NOT TESTED | BILL unit tests only; LIVE-02/04 |
| 1.2.3 | Plan changes in-app | NOT TESTED | Plans page + BILL; LIVE-04 |
| 2.2.1, 2.2.3, 2.2.4 | Shopify APIs, latest App Bridge, GraphQL only | PASS | Code + AUTH-01 response |
| 2.2.6, 2.2.7 | Admin extension ads, Max modal | N/A | — |
| **2.3.1** | No manual shop-domain entry | **FAIL (production)** | GET `https://cartivo-app.onrender.com/` on 2026-10-16 still shows `name="shop"` and "CartKit" (BUG-10). Branch code hides it. |
| 2.3.2–2.3.4 | OAuth on install and reinstall, redirect to app UI | NOT TESTED | LIVE-01/02 |
| 3.1.1 | TLS | PASS | HTTPS 200 |
| 3.2.x | Restricted scopes | N/A | `read_locales,read_products,write_discounts` |
| 5.1.1 | Theme app extensions only | PASS | Theme Check; no Asset API |
| 5.1.3 | Onboarding + deep link | PASS (code); click-through NOT TESTED | `app/routes/app._index.tsx:93` |
| 5.1.5 | Customer data | PASS | None collected |
| Privacy webhooks | Compliance topics | PASS | Section 13 |
| 5.2–5.10 | Other extension groups | N/A | Conditions not met |
| Listing, privacy policy, terms, support contact | Partner Dashboard | NOT TESTED | Not in the repo; privacy policy still to be created per `APP_STORE_SUBMISSION_CHECKLIST.md` |
| BFS accessibility | Contrast | **PASS for the default look**; **FAIL in Sunset and Ocean** | A11Y-04 pass; A11Y-05 (BUG-16) |

## 17–19. Issues: discovered, fixed, remaining

| ID | Severity | Status |
|---|---|---|
| BUG-01..07, 09 | Critical–Low | Fixed (first QA pass), regression passing, committed |
| **BUG-08** | Medium (a11y) | **Fixed this pass** (approved): A11Y-04 passes; badge/promo/savings pass in all 7 looks |
| BUG-11 | High (1.1.9) | Fixed, committed (CON-21..23) |
| BUG-12..15 | Medium–Low | Fixed, committed (VAL-01..07, WH-SCOPES-02) |
| **BUG-16** | Low–Medium (a11y, Premium looks) | **Open: needs your approval.** `.ck-taxes` uses each look's muted colour: Sunset `#78716c` on `#f8f3ee` (4.35:1), Ocean `#64748b` on `#f8f8f9` (4.48:1). Options: slightly darker muted colours in those two presets (`app/lib/defaults.ts`), or the same "readable" adjustment used for BUG-08 applied to `.ck-taxes`. |
| **BUG-10** | Submission blocker | **Open:** production runs the old build (2.3.1) |
| BUG-03 live check | Critical if wrong | **Resolved for gifts** (LIVE-06a); BXGY re-run pending |
| OBS-7 | Observation (1.1.4 wording) | Live drawer showed "Offer ends in 00:00:00": the dev store's announcement has "Hide when the timer reaches zero" switched off (the default is on). Suggest showing "Offer ended" or hiding the timer once it has ended. Not changed. |
| OBS-8 | Test data | The dev store has 9 active campaigns, including two free-shipping goals ($50 and $1000) whose messages disagree in the drawer. Merchant data, not a defect; clean it up before review screenshots. |
| Suggested | Improvement | Warn the merchant when the "Cartivo rewards" discount isn't active |

## 20. Screenshots and test evidence

| Evidence | Location |
|---|---|
| Final run HTML report and JSON | `tests/e2e/.report/index.html`, `tests/e2e/.results/results.json` (gitignored, local) |
| BUG-16 failure screenshots | `tests/e2e/.results/storefront-quality-A11Y-05-*-sunset-*`, `*-ocean-*` |
| Edge runs | `tests/e2e/evidence/edge-results.json`, `tests/e2e/evidence/edge-a11y-results.json` |
| BUG-11 before the fix | `tests/e2e/evidence/bug-11-before-fix/CON-21..23-*.png` |
| Drawer screenshots | `tests/e2e/evidence/screenshots/` |
| LIVE-06a (gift): cart, drawer, checkout | `tests/e2e/evidence/live/live06a-cart.json`, `live06a-drawer.png`, `live06a-checkout.png` |
| LIVE-06b (BXGY) | Console output of the 19:18 UTC run (section 9); files to be regenerated by a clean re-run |

## 21. Manual verification requirements: what you need to do

**LIVE-06a is done.** Re-run LIVE-06b once Shopify's verification has cleared, ideally from your own browser session. Wait a while, or open the storefront once by hand first. Steps are in `tests/e2e/live/README.md`:

1. Keep `npm run dev` running.
2. In the dev store admin, open **Online Store → Themes → Customize → App embeds**. Turn **off** the production Cartivo embed and keep **Cartivo Dev** on. Both apps are installed on this store (OBS-5); with both embeds on, the test stops.
3. In **Cartivo Dev → Campaigns**, keep one active "Cart goals & free gifts" campaign with a **free gift** goal, and deactivate the duplicates.
   - The dev DB currently has 9 active campaigns, including 2 free-shipping goals and 3 upsells.
   - The gift campaign (free gift at $60) **ends today, 2026-10-16 14:09 UTC**. Extend or remove its end date.
4. In PowerShell:
   ```
   $env:CARTIVO_LIVE_STORE = "cartivo-app-test.myshopify.com"
   $env:CARTIVO_STOREFRONT_PASSWORD = "<storefront password>"
   $env:SKIP_APP_SERVER = "1"
   npx playwright test --project=live
   Remove-Item Env:CARTIVO_STOREFRONT_PASSWORD
   ```
5. Check `live06b-checkout.png`: the BXGY item should show as free.

**Then:**

- **LIVE-01/02 (install, reinstall):** needs uninstalling Cartivo Dev from the dev store. **Your approval is needed** before an uninstall.
- **LIVE-04 (billing):** remove `DEV_PLAN` from `.env`, restart `npm run dev`, then approve and decline test charges on the Plans page.
- **LIVE-03/05/07/08/09/10:** admin and theme-editor click-throughs. These need you logged in to the dev store admin; Shopify login and 2FA can't be automated here.

## 22. Submission blockers

1. **BUG-10:** production fails 2.3.1 until this branch is deployed.
2. **LIVE-06b not cleanly recorded** (BXGY $0 was seen, but the run was marked failed). The gift case passed live.
3. **Install, OAuth and billing journeys not executed** (2.3.2–2.3.4, 1.2.2, 1.2.3).
4. **Commits are local only:** nothing is deployed.

Not blockers for listing: BUG-16 (Built for Shopify contrast in two Premium looks); Firefox and WebKit not run.

## 23. GO/NO-GO

### **NO-GO**

- **Why:** production fails a submission requirement (2.3.1). The live journeys App Review starts with (install, OAuth, billing) have no executed evidence yet. The live gift check passed (LIVE-06a); the BXGY check needs a clean re-run.
- **Code quality on this branch is good:** every executed functional, security, webhook, buyer-consent and accessibility test passes, except BUG-16, which awaits your approval.
- **Path to GO:**
  1. Re-run LIVE-06b (section 21).
  2. Decide BUG-16.
  3. Deploy the branch yourself, then confirm the landing page has no shop field.
  4. Run LIVE-01/02/04 with your approval for the uninstall.
- With those passing, the assessment becomes **READY WITH MINOR ISSUES**, or READY once BUG-16 is fixed and Firefox/WebKit have run.
- **App Store approval remains Shopify's decision.**
