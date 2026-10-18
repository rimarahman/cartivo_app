# Cartivo — Shopify App Store Readiness Report

- **Branch:** `appstore-readiness`. **Date:** 2026-10-16 (second pass; third pass in section 0).
- **Local commits:** `2e1b2ca`, `c5709a1`, `e2f7024`, `f13b4ea`, `4f6be32`, plus the live-test and documentation commit. **Not pushed.**
- **Scope:** local and isolated testing only.
  - Nothing was pushed, merged, deployed or submitted.
  - No billing charge was created and no app was uninstalled.
  - Production wasn't changed. The only contact with production was read-only GETs of `/` and `/healthz`.
  - The live checks ran on the **development** store only, and no order was placed.
- **Builds on:** `CARTIVO_FINAL_QA_REPORT.md`, `CARTIVO_BUG_REPORT.md`, `CARTIVO_TEST_INVENTORY.md` and `CARTIVO_SHOPIFY_COMPLIANCE.md`.

**GO/NO-GO: NO-GO** (section 23).

---

## 0. Third pass (2026-10-16): what changed

Approved and done: BUG-16 fix, "Offer ended" countdown, accessibility and regression re-runs. Nothing was pushed,
merged, deployed or submitted; no billing request and no uninstall were made; production wasn't contacted.

### 0.1 The 4 failed tests, one by one (priority A)

| # | Test | Project | Cause | Defect? | Now |
|---|---|---|---|---|---|
| 1 | A11Y-05 "sunset" | chromium-desktop | `.ck-taxes` `#78716c` on the footer `#f8f3ee`: 4.36:1 (< 4.5) | Yes, app (BUG-16) | PASS |
| 2 | A11Y-05 "sunset" | mobile-chrome (Pixel 7) | Same element and colours (viewport-independent) | Same defect | PASS |
| 3 | A11Y-05 "ocean" | chromium-desktop | `.ck-taxes` `#64748b` on `#f8f8f9`: 4.48:1 | Yes, app (BUG-16) | PASS |
| 4 | A11Y-05 "ocean" | mobile-chrome (Pixel 7) | Same | Same defect | PASS |

The footer background is `--ck-soft` (3% of the text colour over the drawer background). The muted colours pass
on the drawer background (4.63 and 4.76:1) but not on this slightly darker footer. No test, harness or
environment problem was involved; all four were the same real defect.

### 0.2 Fixes

- **BUG-16 (contrast, Sunset and Ocean):** `--ck-muted` is now the look's muted colour, kept when it already
  reaches 4.5:1 on the footer, otherwise the same hue darkened in 2% steps until it does
  (`readableMuted()` in `cartkit.js`, same method as BUG-08).
  - Sunset `#78716c` → `#736c68`: 4.69:1 on the footer, 4.97:1 on the drawer.
  - Ocean `#64748b` → `#627288`: 4.62:1 and 4.90:1.
  - The other five looks are unchanged; the BUG-08 badge colours are unchanged in every look.
  - Merchant-chosen muted colours that fail get the same minimal adjustment.
- **BUG-17 (was OBS-7, "Offer ended"):** an ended, visible countdown shows "Offer ended" (campaign field
  "Text after the offer ends", default "Offer ended", translatable) instead of "Offer ends in 00:00:00".
  - "Hide when the timer reaches zero" still hides it (default on).
  - Configs published before the field existed fall back to "Offer ended".

### 0.3 Executed evidence (third pass)

| Run | Result |
|---|---|
| Typecheck | Clean |
| Lint | 0 errors (1 existing warning in `quality.spec.ts`) |
| Unit (`npm test`) | 24/24 + 13/13 |
| Build | OK |
| Consolidated Playwright, installed Chrome (`server` + `chromium-desktop` + `mobile-chrome`) | **165 passed, 0 failed, 0 flaky** (`tests/e2e/.results/results.json`, 2026-10-16 04:51 UTC; HTML in `tests/e2e/.report/`). Was 155/4. |
| Edge: `quality.spec.ts` + `cart.spec.ts`, desktop + Pixel 7 | **72 passed, 0 failed, 0 flaky** (`tests/e2e/evidence/edge-a11y-cart-results-pass3.json`) |
| New cases | CMP-07, CMP-08, CMP-09 (countdown), each on desktop and Pixel 7 |

### 0.4 LIVE-06b (BXGY) re-run (priority B): not run, needs you

- A single unauthenticated GET of the storefront now returns a normal `302 → /password`, not Shopify's
  "connection needs to be verified" page.
- The run needs the storefront password, which isn't stored anywhere. Steps: `tests/e2e/live/README.md`, with
  `-g "LIVE-06b"` (one login only).
- **Status: NOT RUN.** It is not recorded as a pass.
- Dev DB check (read-only, 04:50 UTC): the BXGY campaign is active. The $60 gift campaign ends today at
  14:09 UTC, and 3 rewards campaigns are active.
- Your `npm run dev` (started 10:37 local) is running and serves the working tree, so the dev store preview
  already has the third-pass `cartkit.js`.

### 0.5 Install, OAuth, uninstall, reinstall and billing (priority C): prepared, not run

The runbooks are in `tests/e2e/live/README.md`:

- LIVE-04: billing, with test charges;
- LIVE-01/02: uninstall and reinstall;
- the recommended order;
- the expected results for each step.

`tests/e2e/live/dev-state.mjs` takes read-only before/after snapshots of the dev store's rows, and refuses any
database other than the dev one.

### 0.6 Billing environment (priority E): verified, `DEV_PLAN` not removed

| Check | Result |
|---|---|
| `shopify app info --config cartivo-dev` | "Cartivo Dev", client `ab4953…`, org Softique Commerce, dev store `cartivo-app-test` |
| `.env` | `BILLING_DISABLED=false`, `DEV_PLAN=grow`, no Shopify API key or secret |
| Test mode | `isTestBilling()` returns `true` whenever `NODE_ENV` isn't `production`. `npm run dev` runs `react-router dev`, so `billing.request`, `billing.check` and `billing.cancel` are all `isTest: true`. In production, test charges are only used on Partner development stores. |
| Charge amounts | Essential $10, Growth $20, Premium $60, every 30 days, USD (`shopify.server.ts`) |
| Effect of removing `DEV_PLAN` | The dev store's trial ended 2026-10-14 and Starter was chosen 2026-10-15. Without `DEV_PLAN` it resolves to **Starter**, and the next publish turns off campaigns, sticky and floating, and Forest → Minimal. Nothing is deleted. Run LIVE-06b first. |

`DEV_PLAN` was left in place. Removing it and approving test charges are steps 2–8 of the LIVE-04 runbook,
done from your admin session.

### 0.7 Uninstall data-loss inventory (priority F): needs your explicit approval

The full table is in `tests/e2e/live/README.md` ("What an uninstall loses").

- **Immediately:** the offline session is deleted. The app embed is removed from the theme. Any test
  subscription is cancelled.
- **Expected on the Shopify side:** the "Cartivo rewards" discount and the app-owned config metafield go away.
  Shopify only retains metafield values temporarily, with no guaranteed period.
- **About 48 hours later:** Shopify sends `shop/redact`, and Cartivo then deletes **all** of the dev store's
  rows: 9 campaigns, settings, the trial row, tickets and chat. Reinstalling may not stop it.
- **Unaffected:** the production Cartivo app on the store, products, orders, theme code and the storefront
  password.
- The trial row keeps a reinstall on Starter, so the first-install trial (2.3.2) needs a second development
  store.

**No uninstall was done.**

### 0.8 Commit `2e1b2ca` (priority D): what it changes

**Where it is:**

- `2e1b2ca` is a local commit on `appstore-readiness`, 6 commits below `HEAD`. It is **not pushed** (origin is at
  `f6b778f`), not on `main`, and not deployed. It wasn't reverted.
- It builds on `beed070` ("Starter includes only the Minimal look"), which is also local and unpushed.
- The changes are not in production: production runs a build older than both (BUG-10).

**Entitlements compared with `origin/main`** (the last pushed baseline). These are the effective rules after
`beed070` + `2e1b2ca`:

| Feature | `origin/main` | After `2e1b2ca` |
|---|---|---|
| One-click looks (7) | All plans, all looks | Starter: Minimal. Essential: + Ocean, Forest. Growth: + Sunset, Midnight. Premium: + Aurora, Liquid glass |
| Liquid glass switch | All plans | Premium only |
| Fine-tuned colours ("custom" look) | All plans | All plans (glass removed below Premium) |
| Sticky add-to-cart | All plans incl. Starter | Essential+ |
| Floating cart button | All plans incl. Starter | Essential+ |
| Custom CSS | All plans incl. Starter | Essential+ |
| Custom HTML (top/bottom) and JavaScript | All plans incl. Starter | **Growth+** (Essential loses it too) |
| Drawer text translations (settings `translations`) | All plans | **Growth+** (Markets) (Essential loses it too) |
| Campaign types, active-campaign limits, Markets for campaigns, live chat | — | Unchanged |
| Prices ($10 / $20 / $60) and the 7-day all-features trial | — | Unchanged |

- **How it's enforced:** the editor locks these features. Server-side saves are refused (PLAN-03/04). On publish,
  `syncShop` strips them from the storefront config.
- **Stored data is never deleted.** Upgrading restores it on the next publish.
- **New:** `DEV_PLAN` in `.env` runs the app as any plan without billing. It is ignored when
  `NODE_ENV=production`.

**Is it intentional?** It looks like a deliberate product decision, but only you can confirm the business intent.
The evidence:

- The commit message lists each change.
- The pricing cards, the FAQ ("Which cart designs come with each plan?", "What happens if I move to a lower plan?"),
  the Starter dashboard copy and the cancel banner were all updated to match.
- 8 unit tests and the server tests PLAN-03/04 assert the new rules.
- It came from your uncommitted working tree, not from QA. QA only committed it separately in the second pass.

**Points that look unintended or need a decision:**

1. **The default look is Aurora (Premium tier).**
   - Every new install starts on Aurora. During the trial the drawer shows Aurora.
   - When the trial ends, a merchant on Starter, Essential ($10) **or Growth ($20)** who never changed the look
     is published as **Minimal**.
   - The copy only warns about Minimal on cancel, not on a paid plan below Premium.
   - Suggested fix (needs your decision): make the default look a Starter-tier look, or warn on the Plans page.
2. **"Custom" keeps any colours on every plan.**
   - Changing a single colour turns the look into "custom", which is kept on every plan.
   - So a merchant who touched one colour keeps an Aurora-like design on Starter, while one who didn't gets Minimal.
   - The FAQ says fine-tuning colours is on every plan, so the gate effectively covers one-click presets and
     glass only.
3. **Paid Essential subscribers lose features they had:** custom HTML/JS, drawer translations, and the Sunset,
   Midnight, Aurora and Glass looks.

**Impact on existing merchants** (if deployed as is):

- **When it applies:** on the merchant's **next publish**, not at deploy time. That means any save, the
  Plans/pricing return, a dashboard load while the config is unpublished, or an `app_subscriptions/update`
  webhook. Until then the published metafield keeps the old features.
- **After that publish:**
  - **Starter:** loses sticky add-to-cart, the floating cart, custom CSS/HTML/JS, drawer translations, glass, and
    any one-click look except Minimal. This is the most visible change, because these were advertised as free.
  - **Essential:** loses custom HTML/JS, drawer translations and the Growth/Premium looks.
  - **Growth:** loses Aurora and Liquid glass.
  - **Premium and trial:** no change.
- **How many merchants:** unknown. Counting installs per plan needs the production database or the Partner
  Dashboard, which this pass was not allowed to query.
- **Before release:**
  - update the App Store listing's pricing and feature lists to match (1.1.4 / listing accuracy);
  - consider telling paying merchants, or grandfathering them;
  - test a downgrade in LIVE-04.

Nothing in this commit was reverted or released.

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
| 3.2.x | Restricted scopes | N/A | `read_locales,read_products,write_app_proxy,write_discounts` |
| 5.1.1 | Theme app extensions only | PASS | Theme Check; no Asset API |
| 5.1.3 | Onboarding + deep link | PASS (code); click-through NOT TESTED | `app/routes/app._index.tsx:93` |
| 5.1.5 | Customer data | PASS | None collected |
| Privacy webhooks | Compliance topics | PASS | Section 13 |
| 5.2–5.10 | Other extension groups | N/A | Conditions not met |
| Listing, privacy policy, terms, support contact | Partner Dashboard | NOT TESTED | Not in the repo; privacy policy still to be created per `APP_STORE_SUBMISSION_CHECKLIST.md` |
| BFS accessibility | Contrast | **PASS in all 7 looks** (third pass) | A11Y-04, A11Y-05 on Chrome and Edge |

## 17–19. Issues: discovered, fixed, remaining

| ID | Severity | Status |
|---|---|---|
| BUG-01..07, 09 | Critical–Low | Fixed (first QA pass), regression passing, committed |
| **BUG-08** | Medium (a11y) | **Fixed this pass** (approved): A11Y-04 passes; badge/promo/savings pass in all 7 looks |
| BUG-11 | High (1.1.9) | Fixed, committed (CON-21..23) |
| BUG-12..15 | Medium–Low | Fixed, committed (VAL-01..07, WH-SCOPES-02) |
| **BUG-16** | Low–Medium (a11y) | **Fixed (third pass, approved):** see section 0.2. Was: `.ck-taxes` uses each look's muted colour: Sunset `#78716c` on `#f8f3ee` (4.35:1), Ocean `#64748b` on `#f8f8f9` (4.48:1). Options: slightly darker muted colours in those two presets (`app/lib/defaults.ts`), or the same "readable" adjustment used for BUG-08 applied to `.ck-taxes`. |
| **BUG-10** | Submission blocker | **Open:** production runs the old build (2.3.1) |
| BUG-03 live check | Critical if wrong | **Resolved for gifts** (LIVE-06a); BXGY re-run pending |
| OBS-7 → BUG-17 | Low (1.1.4 wording) | **Fixed (third pass, approved):** an ended visible timer shows "Offer ended"; the hide option is kept (CMP-07..09). |
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

## 22. Submission blockers (updated in the third pass)

Precise blockers, in the order to clear them:

1. **BUG-10: production fails 2.3.1.** Production still runs the old build, as last checked on 2026-10-16
   (not re-checked in the third pass, to avoid contacting production).
   - Fix: deploy this branch yourself.
   - Then confirm `/` has no `name="shop"` field, and that `ALLOW_MANUAL_LOGIN` is unset.
2. **Decide on commit `2e1b2ca` before any deploy** (section 0.8).
   - Deploying it changes plan entitlements for existing merchants on their next publish.
   - The App Store listing's pricing and feature text must match whichever version ships.
3. **LIVE-06b (BXGY $0 in Shopify's cart and checkout): not cleanly recorded.**
   - Needs your storefront password: one run, `-g "LIVE-06b"`.
4. **LIVE-04 billing: NOT RUN.** Covers approve, decline, upgrade, downgrade and cancel with test charges
   (1.2.1–1.2.3).
   - Environment verified (section 0.6).
   - Needs you to remove `DEV_PLAN` and click the Shopify approval pages.
5. **LIVE-01/02 install, OAuth, uninstall, reinstall: NOT RUN** (2.3.2–2.3.4).
   - Needs your explicit approval of the data-loss inventory (section 0.7).
   - The first-install trial path needs a second development store.
6. **Listing assets: NOT TESTED** (not in the repo). Privacy policy URL, support contact, and screenshots without
   the duplicate test campaigns (OBS-8).

**Not blockers for listing:**

- Firefox, WebKit and tablet projects not run (browser downloads stalled);
- LIVE-03, 05, 07–10 admin click-throughs;
- Lighthouse on a real store.

## 23. GO/NO-GO

### **NO-GO**

**Why:**

- Production fails 2.3.1 (BUG-10).
- The journeys App Review starts with (install, OAuth, billing) have no executed evidence.
- The plan-tier commit needs a release decision.

**Code on this branch:** every executed functional, security, webhook, buyer-consent and accessibility test passes:

- 165/165 on Chrome (server, desktop and Pixel 7);
- 72/72 on Edge for accessibility and cart;
- BUG-16 and BUG-17 fixed.

There are no open code defects found by executed tests.

**Path to GO:**

1. LIVE-06b.
2. Decide on `2e1b2ca`.
3. Deploy and re-check 2.3.1.
4. LIVE-04.
5. LIVE-01/02, after your approval.
6. Listing assets.

With 1–5 passing, the assessment becomes **READY WITH MINOR ISSUES** (Firefox/WebKit not run).

**App Store approval remains Shopify's decision.**
