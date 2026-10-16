# Cartivo — Test Inventory

Branch `appstore-readiness` (commit `beed070` + uncommitted working tree), executed 2026-10-15/16.
Statuses are from actual runs. **PASS** = executed and passed. **FAIL** = executed and failed. **FIXED** = failed, fixed, passes on re-run. **BLOCKED** = can't run without live Shopify access (see "Why live tests are blocked" below). **NOT TESTED** = not executed.

Evidence locations:

| What | Where |
|---|---|
| Playwright HTML report | `tests/e2e/.report/index.html` (`npx playwright show-report tests/e2e/.report`) |
| Screenshots, traces, error context of failures | `tests/e2e/.results/<test>/` (`trace.zip`: `npx playwright show-trace <path>`) |
| JSON results | `tests/e2e/.results/results.json` |
| Unit tests | `npm test` (`test/*.test.ts`, `extensions/cartkit-discounts/test/`) |

## Feature inventory (discovered from the code)

| Area | Features | Code |
|---|---|---|
| Admin pages | Dashboard (setup guide, republish, theme-editor deep link), Cart drawer, Campaigns list/editor, Sticky & floating cart, Custom code & languages, Analytics, Plans, Help (support tickets, live chat) | `app/routes/app.*.tsx` |
| Campaign types | rewards (free shipping / free gift / % off / fixed off tiers, gift picker, per-currency thresholds), bxgy, volume, announcement (rotating messages, countdown), upsell (manual products, triggers), addon (paid checkbox) | `app/lib/defaults.ts`, `app/routes/app.campaigns.$id.tsx` |
| Campaign options | status, priority, start/end schedule, country targeting, translations | same |
| Plans | Trial (7 days, all features), Starter (free), Essential $10, Growth $20, Premium $60, "choose" state after trial | `app/lib/plans.ts`, `app/models/billing.server.ts` |
| Server-side gating | campaign types, active-campaign limit, design tier, glass, sticky/floating, custom CSS, custom HTML/JS, Markets, live chat | `actions.server.ts`, `sync.server.ts`, routes |
| Publishing | app-data metafield (storefront config) + automatic app discount with function config metafield | `app/models/sync.server.ts` |
| Discount Function | free gifts, BXGY, volume, order % / fixed, free shipping, schedules, Markets | `extensions/cartkit-discounts/src` |
| Theme extension | app embed (drawer, sticky ATC, floating cart, announcements, goals, upsells, add-ons, gift picker, note, discount code, terms), volume-tiers block | `extensions/cartkit-theme` |
| Webhooks | app/uninstalled, app/scopes_update, app_subscriptions/update, customers/data_request, customers/redact, shop/redact | `app/routes/webhooks.*` |
| App proxy | `/apps/cartkit/track` analytics events | `app/routes/proxy.track.tsx` |
| Support | tickets with diagnostics, live chat, support inbox at `/support/inbox` (key + signed cookie) | `app/models/support.server.ts`, `chat.server.ts`, `routes/support.inbox.tsx` |
| Auth | embedded session tokens, OAuth, manual login form (dev only), bot filter | `app/shopify.server.ts`, `routes/auth.*`, `routes/_index` |

## Test environments

| Env | Description | Isolation |
|---|---|---|
| **Storefront harness** | `tests/e2e/harness/server.mjs`: serves the real `cartkit.js`/`cartkit.css`, emulates the Ajax Cart API, prices every cart with the real discount Function code (`cart_lines_discounts_generate_run.js`). Campaign configs go through the real defaults and buyer-protection rules. | Local only, no Shopify |
| **Local app server** | Built app (`npm run build`) started by `tests/e2e/server/start-app.mjs` on `localhost:4600` with throwaway API key/secret, `DEV_PLAN=basic` (Essential). Admin requests use HS256 session tokens signed with the throwaway secret. | Refuses to start unless `DATABASE_URL` is the dev Neon endpoint `ep-lucky-bonus-…` (production is `ep-bil…`). Test shops `cartivo-qa-a/b.myshopify.com` are created and deleted by the tests. |
| **Unit** | `node --test` | Pure functions |

Browsers/devices configured: chromium-desktop, firefox-desktop, webkit-desktop, mobile-chrome (Pixel 7), mobile-safari (iPhone 14), tablet (iPad gen 7).

## Storefront — buyer consent (P0)

Preconditions for all: harness scenario named in "Data"; fresh cart per test. Expected results are checked against the **server-side cart priced by the discount Function**, not the drawer display.

| ID | Feature | Pri | Steps | Data | Expected | Result |
|---|---|---|---|---|---|---|
| CON-01 | Free gift | P0 | Add shirt $30, then + to $60 | `gift` (gift at $50) | Gift added once, price $0, no console errors | PASS (after harness favicon fix) |
| CON-02 | Free gift | P0 | Reach goal, then − below it | `gift` | Gift removed | PASS |
| CON-03 | Free gift | P0 | Remove gift, reload, navigate | `gift` | Gift stays removed | PASS |
| CON-04 | Free gift | P0 | 5 rapid + clicks | `gift` | Exactly 1 gift, $0 | PASS |
| CON-05 | BXGY | P0 | Add buy product | `bxgyFree` | Free get item added, $0, total $30 | PASS |
| CON-06 | BXGY | P0 | Shopper adds socks (get product), then shirt (buy) | `bxgyFree` | No paid auto-added unit; total $30 | **FIXED** (was $40: paid sock added — BUG-02) |
| CON-07 | BXGY | P0 | Shopper adds pin (cheaper get product), then shirt | `bxgyMultiGet` | No paid auto-added unit; total $30 | **FIXED** (BUG-02) |
| CON-08 | BXGY | P0 | Add buy product | `bxgyHalf` (50%, autoAdd on) | Nothing auto-added | PASS |
| CON-09 | BXGY | P0 | Remove free item, reload | `bxgyFree` | Stays removed | PASS |
| CON-10 | BXGY | P0 | + on the free line | `bxgyFree` | Can't add paid units; total $30 | PASS |
| CON-11 | Gift safety | P0 | Reach goal while the automatic discount is inactive | `giftDiscountInactive` | No gift left at full price | **FIXED** (gift charged $25 — BUG-03) |
| CON-12 | Gift safety | P0 | Reach goal, apply a non-combinable code that wins | `giftNonCombinable` | No gift left at full price | **FIXED** (BUG-03) |
| CON-13 | Add-on | P0 | Open drawer | `addonPrechecked` (old defaultChecked) | Box unticked, nothing added | PASS |
| CON-14 | Add-on | P0 | Tick, untick, reload | `addon` | 1 then 0, stays 0 | PASS |
| CON-15 | Add-on | P0 | Tick (add delayed 400 ms), untick with keyboard before it lands | `addon` | Box unticked, 0 in cart; box shows choice while pending | **FIXED** (paid add-on kept, box showed state contrary to shopper action — BUG-04) |
| CON-15b | Add-on | P0 | Tick + 2 forced clicks while add in flight | `addon` | ≤ 1 unit, cart matches box | PASS (written with the BUG-04 fix; no pre-fix run) |
| CON-16 | Add-on | P0 | Tick, remove last real item | `addon` | Cart empty | PASS |
| CON-17 | Upsell | P0 | Show upsells, pick Red variant, Add | `upsell` | Nothing added until click; 1 × Red | PASS |
| CON-18 | Upsell | P0 | Double-click Add (add delayed) | `upsell` | 1 unit | PASS |
| CON-19 | Concurrency | P0 | 3 parallel theme fetches to cart API | `everything` | No paid auto lines, add-on never added, ≤ 1 gift | PASS |
| CON-20 | Schedules | P0 | Reach goal | `expired`, `scheduled` | Nothing added | PASS |

## Storefront — cart, campaigns, failures, security, accessibility, performance

| ID | Feature | Pri | Steps / data | Expected | Result |
|---|---|---|---|---|---|
| SF-SMOKE-01 | Boot | P0 | Product page → Add | Drawer opens, 1 item, $30, no errors | PASS |
| SF-01 | Variants | P1 | Select M, qty 2 | 2 × M | PASS |
| SF-02 | Qty/remove | P1 | +, −, remove | Totals $60/$30/empty state | PASS |
| SF-03 | Sold out | P1 | Add sold-out product to empty cart | Error visible, nothing added | **FIXED** (error invisible on empty cart — BUG-05) |
| SF-04 | Persistence | P1 | Add, navigate | Cart and header count kept | PASS |
| SF-05 | Cart link | P2 | Click header cart | Drawer opens, no navigation | PASS |
| SF-06 | Discount code | P1 | Invalid then SAVE10, remove | Error; 10% off; removed | PASS |
| SF-07 | Order note | P2 | Type note, collapse | Saved to cart | PASS |
| SF-08 | Terms | P1 | Checkout without/with tick | Blocked / proceeds | PASS |
| SF-09 | Checkout | P0 | Checkout | `/checkout` | PASS |
| SF-10 | Add failure | P1 | `cart/add` → 500 | Error visible, cart unchanged | **FIXED** (BUG-05) |
| SF-11 | Change failure | P1 | `cart/change` → 500 | Cart and drawer agree ($30, qty 1) | PASS |
| SF-12 | Gift add failure | P1 | Gift add → 500 | No retry loop (≤ 1 failed add) | PASS |
| SF-13 | Slow network | P2 | 1.5 s add delay | aria-busy, consistent end state | PASS |
| SF-14 | Large cart | P2 | 40 lines | 40 rendered, $1,200.00 | PASS (after test fix: refresh after seeding) |
| CMP-01 | Reward tiers | P1 | $30→$120 | Progress text, gift at $80, 10% at $120 | PASS |
| CMP-02 | Gift picker | P1 | 2 gifts offered | None added until picked; 1 only | PASS |
| CMP-03 | BXGY same product | P1 | Buy 2 get 1, qty 3 | $60 | PASS |
| CMP-04 | Volume | P1 | qty 1/2/3 | Hint; $54; $76.50 | PASS |
| CMP-05 | Stacking | P1 | Gift + BXGY + volume + code | No duplicates, total $78.30 | PASS |
| CMP-06 | Fake urgency | P1 | Evergreen timer config | No timer | PASS |
| CMP-07 | Countdown | P1 | Offer end in the future | "Offer ends in" + `hh:mm:ss` | PASS (third pass) |
| CMP-08 | Ended countdown | P1 | Offer end passed, hide option off (new config and pre-`expiredText` config) | "Offer ended", never 00:00:00 | PASS (third pass; BUG-17) |
| CMP-09 | Ended countdown | P1 | Offer end passed, hide option on | Timer hidden | PASS (third pass) |
| SEC-SF-01 | XSS | P0 | Script payloads in product title, variant, property, note, code | Escaped, not executed | PASS (after test fix) |
| A11Y-01 | Dialog | P1 | Open drawer | role=dialog, aria-modal, label, focus in, Escape closes | PASS |
| A11Y-02 | Names | P2 | All drawer buttons | Accessible names | PASS |
| A11Y-03 | Focus trap | P2 | Tab ×25 | Focus stays in drawer | **FIXED** (focus escaped — BUG-06) |
| A11Y-04 | axe scan | P1 | axe-core on open drawer | No serious/critical violations | PASS (BUG-08 fixed second pass; `link-name` fixed, BUG-07) |
| A11Y-05 | Contrast per look | P1 | axe `color-contrast` in all 7 one-click looks | No violations | PASS (third pass; Sunset/Ocean were BUG-16) |
| PERF-01 | Timings | P2 | Add, qty change with gift | Measured (see QA report) | PASS |

## Server (local app + dev database)

| ID | Feature | Pri | Steps | Expected | Result |
|---|---|---|---|---|---|
| AUTH-01 | Session | P0 | Delete campaign with no token | Refused (bounce page), campaign kept | PASS |
| AUTH-02 | Session | P0 | Token signed with wrong secret | Refused, campaign kept | PASS |
| AUTH-03 | Session | P0 | Expired token | Refused, campaign kept | PASS |
| AUTH-04 | Session | P0 | Valid token | 200 | PASS |
| AUTH-05 | Shop ownership | P0 | Shop B token deletes shop A's campaign | Campaign kept | PASS |
| ISO-01 | Cross-shop | P0 | Shop A posts edit to shop B's campaign id | B's campaign unchanged | **FIXED** (A took over B's campaign — BUG-01) |
| ISO-02 | Cross-shop | P0 | A deletes/deactivates B's campaign | Unchanged | PASS |
| ISO-03 | Own campaigns | P1 | Edit, deactivate, delete own | Works | PASS |
| ISO-04 | shop/redact | P0 | Signed shop/redact for B | B's data deleted, A's kept | PASS |
| SYNC-01 | Errors | P3 | Publish fails | Readable reason | **FIXED** (`[object Response]` — BUG-09) |
| PLAN-01 | Gating | P0 | Create bxgy on Essential by direct POST | Refused, nothing stored | PASS |
| PLAN-02 | Gating | P0 | Activate volume on Essential | Refused | PASS |
| PLAN-03 | Gating | P0 | Save custom JS on Essential | Refused | PASS |
| PLAN-04 | Gating | P0 | Save Premium glass look on Essential | Refused | PASS |
| PLAN-05 | Gating | P1 | Live chat on Essential | Refused | PASS |
| WH ×6 | Webhook HMAC | P0 | Each topic: bad HMAC, good HMAC | 401 / 200 | PASS (6/6) |
| WH-UNINSTALL | Uninstall | P1 | Signed app/uninstalled | Sessions deleted | PASS |
| PROXY-01 | App proxy | P0 | Unsigned request | Refused, nothing stored | PASS |
| PROXY-02 | App proxy | P1 | Signed, 32 events incl. bad type, huge value | 19 rows, sanitised | PASS |
| PROXY-03 | App proxy | P2 | Malformed JSON | 400 | PASS |
| INBOX-01 | Support inbox | P0 | Wrong key; forged unsigned cookie | 401; no message stored | PASS |
| PUB-01 | Errors | P2 | Bad URL | < 500, no stack trace | PASS |

## Unit tests (existing)

| Suite | Cases | Result |
|---|---|---|
| `test/plans.test.ts`, `test/storefront-rules.test.ts` | 15 | PASS 15/15 |
| `extensions/cartkit-discounts/test/discounts.test.js` | 13 | PASS 13/13 |

## Cases that need live Shopify (BLOCKED)

| ID | Journey | Pri | Why it matters |
|---|---|---|---|
| LIVE-01 | Install from Shopify, OAuth, redirect to app UI (2.3.2, 2.3.3) | P0 | Install is the first thing App Review does |
| LIVE-02 | Uninstall + reinstall, OAuth again, re-subscribe (2.3.4, 1.2.2) — needs your approval | P0 | |
| LIVE-03 | Onboarding: setup guide, theme-editor deep link enables the embed (5.1.3) | P0 | |
| LIVE-04 | Trial → choose plan → approve test charge; decline charge; upgrade; downgrade; cancel to Starter (1.2.x) | P0 | Uses test charges on the dev store only |
| LIVE-05 | Create/edit/activate/deactivate/delete each campaign type in the admin UI and see it on the storefront | P0 | |
| LIVE-06 | **Real cart.js reflects the discount Function** (gift/BXGY lines show $0) — required to confirm the BUG-03 fix doesn't remove valid gifts | P0 | See BUG-03 risk |
| LIVE-07 | Checkout totals equal the cart totals for gift, BXGY, volume, tier discounts, codes | P0 | |
| LIVE-08 | Dawn + one non-Dawn theme: one drawer only, ATC, variants, mobile nav, dynamic checkout buttons | P1 | |
| LIVE-09 | Lighthouse / Core Web Vitals on the dev storefront with and without the embed | P2 | |
| LIVE-10 | Markets: country targeting and per-currency goals with a real second market | P2 | |

### Why live tests are blocked

- No authenticated Shopify admin session is available to automation (Shopify login + 2FA can't and mustn't be bypassed).
- Reading the Shopify CLI's stored storefront password for `cartivo-app-test.myshopify.com` was denied by the session's permission system, so the password-protected storefront couldn't be opened.
- `shopify app dev` (needed so the dev app's extensions run on the dev store) is interactive and was not started.
- The dev store has **both** the production app and the dev app installed; storefront tests there would also call the production app proxy unless blocked.
