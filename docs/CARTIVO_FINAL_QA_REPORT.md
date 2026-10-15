# Cartivo — Final QA Report

- **Branch:** `appstore-readiness` (`beed070` plus uncommitted working tree). Dates: 2026-10-15/16.
- **Scope:** Local and isolated testing only. Nothing was pushed, merged, deployed or submitted, and no billing charge was created. The production database and production app config weren't touched. The only contact with production was two read-only GETs (`/` and `/healthz`).

> **Status update, 2026-10-16 (second pass):** see `CARTIVO_SHOPIFY_APPSTORE_READINESS_REPORT.md` for the current state. Summary: BUG-08 and BUG-11..15 fixed; all changes committed locally (not pushed); regression 155 passed, 4 failed (BUG-16, open), 0 flaky; LIVE-06a (gift free in Shopify cart and checkout) **passed on the dev store**; LIVE-06b (BXGY) needs a clean re-run; BUG-10 (production on the old build) still open. Verdict unchanged: **NO-GO**.

## Verdict: **NO-GO** for App Store submission

The release gate isn't met. The reasons:

1. **BUG-10:** the production deployment runs an old build that asks merchants to type their shop domain (requirement 2.3.1). It fails today until it's redeployed.
2. **Critical E2E tests weren't executed:**
   - install/OAuth, onboarding, billing approve/decline/upgrade/downgrade/cancel, reinstall;
   - real cart and checkout totals on the dev store (LIVE-01..07).

   These are BLOCKED: no authenticated Shopify admin session for automation. (Second pass: the storefront password was provided and LIVE-06 ran; see the status update above.)
3. ~~BUG-03 live check~~: **done for gifts** (LIVE-06a passed on the dev store, 2026-10-16); the BXGY case needs a clean re-run (LIVE-06b).
4. ~~BUG-08~~: **fixed** (approved). New BUG-16: muted tax line slightly under 4.5:1 in the Sunset and Ocean looks, needs approval.

No critical or high defect found by the executed tests is still open in the code.

## Environment isolation (verified)

| Check | Result |
|---|---|
| Separate dev app | `shopify.app.cartivo-dev.toml`: "Cartivo Dev", client_id `ab4953…` (production `fbeacb…`) |
| Separate credentials | `.env` has no production API key/secret; `.env` and `.env.render` are gitignored |
| Separate database | `.env` uses Neon `ep-lucky-bonus-…`; production (`.env.render`) uses `ep-bil…`. The server tests refuse to start on any other host. Schema up to date (`prisma migrate status`) |
| Dev store | `cartivo-app-test.myshopify.com` (shared by both apps — OBS-5) |
| Credentials in tests | Server tests use a throwaway API key and secret, so they can't reach real Shopify |

## Execution summary

| Suite | Cases | Executed runs | Passed | Failed | Blocked / not run |
|---|---|---|---|---|---|
| Storefront E2E (harness) | 48 | 96 (chromium-desktop + mobile-chrome, on installed Chrome) | 94 | 2 (A11Y-04 contrast, both projects) | — |
| Same suite on installed Edge | 48 | 96 | 94 | 2 (same) | — |
| Server (local app + dev DB) | 27 | 27 | 27 | 0 | — |
| Unit (existing) | 28 | 28 | 28 | 0 | — |
| Firefox, WebKit, mobile-safari, tablet projects | 48 each | 0 | — | — | **NOT RUN**: browser downloads from the Playwright CDN stalled repeatedly (Chromium-family coverage only) |
| Live Shopify (LIVE-01..10) | 10 | 0 | — | — | **BLOCKED** |

- **Final consolidated run** (server + chromium-desktop + mobile-chrome): **121 passed, 2 failed**, 0 flaky.
- **Typecheck, lint, `npm test`:** pass.
- **Total discovered test cases:** 113 (48 storefront + 27 server + 28 unit + 10 live).
- **Evidence:**
  - HTML report: `tests/e2e/.report/index.html`
  - Failure screenshots, traces, error context: `tests/e2e/.results/`
  - JSON: `tests/e2e/.results/results.json`
  - Video recording: off (`PW_NO_VIDEO=1`) because ffmpeg couldn't be downloaded.

## Bugs

10 found; 8 fixed and re-tested; 2 open. Details are in `docs/CARTIVO_BUG_REPORT.md`.

| ID | Severity | Status |
|---|---|---|
| BUG-01 Cross-shop campaign takeover | Critical | Fixed — ISO-01 passes |
| BUG-02 BXGY adds a charged unit | Critical | Fixed — CON-06/07 pass |
| BUG-03 Gift/BXGY left at full price | Critical | Fixed in harness — live check LIVE-06 needed |
| BUG-04 Add-on checkbox race | High | Fixed — CON-15/15b pass |
| BUG-05 Errors invisible on empty cart | Medium | Fixed |
| BUG-06 No focus trap | Medium | Fixed |
| BUG-07 Unnamed image links | Medium | Fixed |
| BUG-08 Colour contrast | Medium | Fixed (second pass): A11Y-04 passes; badge, promo and savings pass in all 7 looks |
| BUG-11 to BUG-15 | High–Low | Fixed (second pass), see the readiness report |
| BUG-16 Muted tax line contrast in Sunset and Ocean looks | Low–Medium | **Open** (needs approval) |
| BUG-09 "[object Response]" | Low | Fixed |
| BUG-10 Production on old build (2.3.1) | Submission blocker | **Open** (needs redeploy) |

**Regression after the fixes:** the full storefront and server suites were re-run. No new failures; the only failure is BUG-08.

## Security findings

| Area | Result |
|---|---|
| Session tokens: none / wrong signature / expired / other shop | Refused, no data change (AUTH-01..05) |
| Bot user agents | Library returns 410 (tests use a browser UA so auth is what's tested) |
| Cross-shop isolation | Was broken (BUG-01), fixed; delete/deactivate/redact already scoped |
| Webhook HMAC (6 topics) | Bad HMAC → 401, valid → 200 |
| Privacy: shop/redact | Deletes only that shop's data |
| App proxy signature | Unsigned refused; events whitelisted, ≤ 20 per request, campaignId ≤ 40 chars |
| Support inbox | Wrong key 401; forged cookie rejected (signed cookie, timing-safe key compare) |
| Storefront XSS | Product/variant/property/note/code payloads escaped (SEC-SF-01) |
| Plan gating by direct POST | Refused server-side (PLAN-01..05) |
| Rate limiting | Live chat 10/min; support tickets none (OBS-4) |

## Performance (measured)

| Measurement | Value |
|---|---|
| `cartkit.js` | 73,755 B raw / 19,914 B gzip / 17,005 B brotli |
| `cartkit.css` | 30,797 B raw / 6,750 B gzip / 5,808 B brotli |
| Add to cart → drawer open (harness, Chrome desktop / mobile emulation) | 141–183 ms / 240 ms |
| Quantity change incl. gift reconciliation | 612–660 ms |
| Cumulative Layout Shift during these interactions | 0 |
| Lighthouse / Core Web Vitals on a real store | **Not measured** (BLOCKED, LIVE-09) |

Harness timings exclude real network and theme cost. Treat them as Cartivo's own overhead only.

## Accessibility

- **Pass:** dialog role, `aria-modal` and label, focus on open, Escape to close, button names.
- **Fixed:** focus trap (BUG-06), image links (BUG-07).
- **Fixed (second pass):** axe `color-contrast` for badge, promo and savings (BUG-08). **Open:** BUG-16 (tax line, Sunset and Ocean looks).

## ISSUES THAT COULD CAUSE SHOPIFY APP STORE REJECTION

| # | Issue | Severity | Evidence | Reproduction | Required fix | Status |
|---|---|---|---|---|---|---|
| 1 | Manual shop-domain login on production (2.3.1) | Critical | GET `https://cartivo-app.onrender.com/` shows `name="shop"` form and "CartKit" heading (2026-10-16) | Open the app URL without `?shop=` | Redeploy the current branch; keep `ALLOW_MANUAL_LOGIN` unset | Open |
| 2 | Paid item added without consent: BXGY (1.1.9) | Critical | CON-06: total $40 instead of $30 | Add get product, then buy product, with BXGY auto-add | Count units already in cart (done) | Fixed locally, not deployed |
| 3 | Gift charged at full price when discount not applied (1.1.9) | Critical | CON-11/12: gift line $25 | Deactivate "Cartivo rewards" discount or apply a winning non-combinable code, reach goal | Remove non-free auto lines (done); verify on dev store | Fixed; **verified live for gifts** (LIVE-06a); BXGY re-run pending |
| 4 | Paid add-on kept after shopper unticked it (1.1.9) | High | CON-15: `{checked:true, qty:1}` | Slow network, tick then untick with keyboard | Track pending choice (done) | Fixed locally |
| 5 | Billing flows unverified (1.2.2, 1.2.3) | High (unknown) | Not executed | — | Run LIVE-02/04 on the dev store with test charges | Blocked |
| 6 | Install/OAuth/reinstall unverified (2.3.2–2.3.4) | High (unknown) | Not executed | — | Run LIVE-01/02 | Blocked |
| 7 | Contrast failures (Built for Shopify accessibility) | Medium | axe color-contrast 2.88:1 | Open drawer with a discount/BXGY promo | Badge colour darkened to 4.5:1 for these texts (approved) | Fixed |
| 8 | Cross-shop campaign takeover (security review) | Critical | ISO-01 | Shop A posts to shop B's campaign id | Shop-scoped update (done) | Fixed locally, not deployed |

## What you need to do next

1. Review the local diff (`git diff`). Then commit and deploy it yourself; QA did not commit, push or deploy.
2. ~~Approve the darker green for BUG-08~~ (done). Decide BUG-16.
3. Run LIVE-01..10 on `cartivo-app-test` with the dev app (`shopify app dev --config cartivo-dev`), with only one Cartivo embed enabled. LIVE-06 (gift shows $0 in `cart.js`) comes first.
4. Re-run the Firefox/WebKit/tablet projects once the browsers download: `npx playwright install`, then `npx playwright test`.
5. Optionally, set up the Playwright MCP server: `claude mcp add playwright -- npx @playwright/mcp@latest`. The `claude` CLI isn't on PATH in this VS Code session.

## How to re-run

```
npm run build                        # server tests use the built app
npx playwright test                  # all projects (needs all browsers)
PW_CHROMIUM_CHANNEL=chrome PW_NO_VIDEO=1 npx playwright test --project=server --project=chromium-desktop --project=mobile-chrome
npx playwright show-report tests/e2e/.report
```
