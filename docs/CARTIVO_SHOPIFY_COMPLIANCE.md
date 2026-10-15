# Cartivo — Shopify App Store Compliance Matrix

Requirements source: the live list fetched on **2026-10-16** with
`shopify doc fetch --url https://shopify.dev/docs/apps/launch/app-store-review/app-store-ai-self-review-requirements`.
Full requirements: https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements

Result meanings:
- **PASS**: verified by an executed test, plus code.
- **PASS (code)**: verified by code inspection only. Code inspection is not proof of live behaviour.
- **FAIL**: executed evidence of a violation.
- **BLOCKED**: needs the live dev store.
- **N/A**: doesn't apply to this app.

| Req | Requirement | Evidence | Test performed | Result | Remaining risk |
|---|---|---|---|---|---|
| 1.1.1 | Session tokens, no 3rd-party cookies | `@shopify/app-bridge-react` 4.x, `authenticate.admin` | AUTH-01..05 (local app: no token / bad signature / expired token refused; valid token accepted) | PASS | Incognito Chrome in the real admin not tested (BLOCKED) |
| 1.1.2 | Use Shopify checkout | Drawer sends to `/checkout` (`cartkit.js` `checkout()`) | SF-09 | PASS | — |
| 1.1.3 | No theme downloads | No Themes/Asset API use (grep) | Code search | PASS (code) | — |
| 1.1.4 | Factual information only | Evergreen (per-visitor) timers dropped (`storefront-rules.ts`, `timerEnd()`); plan badges factual | CMP-06 | PASS | Listing text not reviewed by tests |
| 1.1.6–1.1.8, 1.1.13–1.1.16 | Marketplace, payments, POS, product copying, agencies, refunds, lending | None of these features exist | Code review | N/A | — |
| **1.1.9** | **Explicit buyer consent before adding charges** | Add-ons never pre-ticked; upsells only on click; only 100%-free BXGY auto-added; gifts free | CON-01..20, CON-15b | **PASS after fixes BUG-02, BUG-03, BUG-04** (failed before) | BUG-03 fix depends on `cart.js` showing Function discounts — **verify live (LIVE-06)** |
| 1.1.10 | Cheapest shipping default | App only discounts shipping (free-shipping tier), never reorders | Code review | PASS (code) | — |
| 1.2.1 | Shopify Billing API | `billing.request` / `billing.check` / `billing.cancel` (`shopify.server.ts` plans) | Code review | PASS (code) | — |
| 1.2.2 | Accept, decline, re-approve after reinstall | Plans page handles billing errors; ShopTrial survives reinstall | Code review only | BLOCKED | Decline and reinstall flows not executed (LIVE-02, LIVE-04) |
| 1.2.3 | Upgrade/downgrade in app | Plans page: subscribe replaces plan; Starter cancels with proration | Code review only | BLOCKED | Not executed against Shopify billing (LIVE-04) |
| 2.2.1 | Uses Shopify APIs | Admin GraphQL, Functions, theme extension | Code review | PASS (code) | — |
| 2.2.3 | Latest App Bridge | `@shopify/app-bridge-react` ^4.2.4; bounce page loads `cdn.shopify.com/shopifycloud/app-bridge.js` (seen in AUTH-01 response) | AUTH-01 | PASS | — |
| 2.2.4 | GraphQL Admin API only | No `/admin/api/*.json` or REST clients (grep) | Code search | PASS (code) | — |
| 2.2.6, 2.2.7 | Admin extension ads, Max modal | No admin UI extensions / Max modal | Code search | N/A | — |
| **2.3.1** | **No manual myshopify.com entry** | Branch hides the form in production (`manualLoginAllowed`) | Read-only GET of production landing page | **FAIL in production** (BUG-10: form shown, old build) | Redeploy; ensure `ALLOW_MANUAL_LOGIN` unset (OBS-6) |
| 2.3.2 | OAuth immediately after install | `shopifyApp` + `/auth/*` routes | — | BLOCKED (LIVE-01) | |
| 2.3.3 | Redirect to app UI after install | `_index` redirects `?shop=` to `/app` | — | BLOCKED (LIVE-01) | |
| 2.3.4 | OAuth on reinstall | Uninstall webhook deletes sessions (WH-UNINSTALL); Prisma session storage upserts | WH-UNINSTALL | PASS (partial); full reinstall BLOCKED (LIVE-02) | |
| 3.1.1 | Valid TLS | Production `https://cartivo-app.onrender.com` answered 200 over HTTPS | Read-only GET | PASS | — |
| 3.2.x | Restricted scopes | Scopes: `read_locales,read_products,write_discounts` (no restricted scopes) | Config review | N/A | — |
| 5.1.1 | Theme app extensions only | `extensions/cartkit-theme` app embed + block; no ScriptTag/Asset API | Code search | PASS (code) | — |
| 5.1.3 | Onboarding + deep link | Dashboard deep link `.../themes/current/editor?context=apps&activateAppId=<key>/<embed>` (`app._index.tsx:93`) | Code review | PASS (code); live click-through BLOCKED (LIVE-03) | |
| 5.1.5 | Customer data back to merchant | No customer data collected (events have no customer ids; note/code go to the Shopify cart) | Code review, PROXY-02 | PASS | — |
| Privacy | Mandatory compliance webhooks (customers/data_request, customers/redact, shop/redact) | `webhooks.compliance.tsx`, subscribed in `shopify.app.toml` | WH ×3 (HMAC 401/200), ISO-04 (shop/redact deletes only that shop) | PASS | — |
| Security | Webhook HMAC | `authenticate.webhook` | WH ×6 | PASS | — |
| Security | App proxy signature | `authenticate.public.appProxy` | PROXY-01..03 | PASS | — |
| Security | Shop isolation | Shop-scoped queries | ISO-01..04, AUTH-05 | **PASS after fix BUG-01** (failed before) | — |
| Security | XSS in storefront drawer | `esc()` on shopper/product data | SEC-SF-01 | PASS | Merchant-entered HTML (announcements, terms, custom HTML) is intentionally raw |
| Groups 5.2–5.10 | Payments, purchase options, checkout, channels, post-purchase, mobile, donations | Not applicable | — | N/A (skipped: no matching extension types or scopes) | — |

## Built for Shopify notes (from executed tests)

- **Accessibility:**
  - Drawer is a labelled `aria-modal` dialog, and focus moves in on open (A11Y-01).
  - Focus trap added (BUG-06).
  - Image links fixed (BUG-07).
  - Contrast still fails (BUG-08, open).
- **Plan gating is enforced server-side:** PLAN-01..05.
