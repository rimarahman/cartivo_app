# CartKit – Cart Drawer & Free Gift (Shopify app)

A slide-cart app for raising average order value, with the same feature set as Corner Cart:

| Area | Features |
| --- | --- |
| Cart drawer | Slide-out drawer (left/right), quantity editing, line discounts, savings, order note, discount code field, terms checkbox, taxes note, empty state, custom colors / radius / font size, mobile optimized |
| Sticky & floating | Sticky add-to-cart bar on product pages (variant, quantity, price), floating mini cart button with count |
| Cart goals | Multi-tier progress bar: free shipping, free gift, % off, fixed amount off; by cart value or item count; multi-currency |
| Free gifts | Use any product (no $0 copies needed). One gift is added automatically, several give a "choose your gift" picker. Removed automatically when the cart drops below the goal |
| Promotions | Buy X Get Y (auto-add), volume / quantity-break discounts (+ product page table block), announcements with rotating messages, fixed or evergreen countdown timers, campaign scheduling |
| Upsells | Shopify AI recommendations (related / complementary), manual "frequently bought together" upsells, one-click add-on checkbox (gift wrap, protection, …) |
| Customization | Custom CSS, custom HTML (two slots), custom JavaScript with a `CartKit` API, translations per language, theme-compatibility selectors |
| Analytics | Cart opens, upsells, gifts, sticky adds, checkouts (via app proxy) + Google Analytics events |
| Billing | 7-day free trial with every feature, then the merchant picks Starter (free), Essential ($10), Growth ($20) or Premium ($60) per 30 days (see `app/lib/plans.ts`) |

## How it works

```
app/                     Admin app (React Router + Polaris web components)
  routes/app._index      Dashboard, embed status, setup guide
  routes/app.drawer      Drawer behavior, content, upsells, design
  routes/app.campaigns.* Campaign list + editor (rewards, bxgy, volume, announcement, upsell, addon)
  routes/app.sticky      Sticky add-to-cart + floating cart
  routes/app.advanced    Custom CSS/HTML/JS, theme selectors, translations
  routes/app.analytics   Event dashboard
  routes/app.pricing     Billing
  routes/proxy.track     Storefront analytics endpoint (/apps/cartkit/track)
  models/sync.server.ts  Publishes config to the storefront + discount function
extensions/
  cartkit-theme/         Theme app extension: app embed (drawer, sticky, floating) + volume table block
  cartkit-discounts/     Discount Function: gift = 100% off, BXGY, volume, tier order discounts, free shipping
```

Every save stores data in the database (Prisma) and then **publishes** it:

1. Settings and active campaigns go to an app-data metafield (`cartkit.config`), which the app embed reads in Liquid. The storefront needs no extra API calls.
2. Discount rules go to the metafield of one automatic app discount ("CartKit rewards"). The Function validates thresholds on the server, so customers can't keep a free gift after dropping below the goal.

## Setup

Requirements: **Node.js 22.12+** (the template needs it; `nvm install 22` / `nvm use 22`), the Shopify CLI, a Partner account and a development store.

```bash
npm install
npm run config:link          # create/link the app in your Partner dashboard (fills client_id)
cp .env.example .env         # optional: BILLING_DISABLED=true unlocks every feature while developing
npm run dev                  # starts the app + tunnel, installs on your dev store
```

Then in the app:

1. Click **Enable in theme editor** on the dashboard and turn on the *CartKit cart drawer* app embed.
2. Open **Campaigns** and create a cart goal (for example free shipping at 50 and a free gift at 100).
3. Optional: add the *Volume discount table* block to your product template.

Deploy extensions and config with `npm run deploy`.

### Notes

- Free gifts and BXGY items are added with hidden line properties (`_cartkit_gift`, `_cartkit_bxgy`, `_cartkit_addon`) and priced by the Function. Free shipping appears at checkout.
- Discount codes are applied with the AJAX Cart API (`/cart/update.js` `discount`). On older carts the code is passed to checkout with `?discount=`.
- Tier thresholds are in the shop currency and are converted with `Shopify.currency.rate` (storefront) or `presentmentCurrencyRate` (Function).
- The storefront hides common theme cart drawers (`cart-drawer`, `cart-notification`, `#CartDrawer`) when "Open the drawer when the cart icon is clicked" is on. Add selectors for other themes under *Custom code & languages*.
- Campaign schedules are exact to the minute on the storefront. The Function checks them by shop-local **date** (`shop.localTime.date`), so a campaign that ends at 18:00 can still be priced at checkout until midnight.

### Shopify Markets (countries, languages, currencies)

- **Languages:** the drawer reads `request.locale` and uses translations from *Custom code & languages* (drawer texts) and each campaign's *Translations* section (progress message, reward names, announcements, …). The store's published languages are listed automatically (`read_locales` scope). All cart and product requests go through the locale root (`/fr/cart.js`, `/fr/products/x.js`), so product names, gift names and recommendations come back in the shopper's language.
- **Countries:** a campaign can be limited to countries (*Markets* section). The storefront filters with Liquid `localization.country`, and the Function filters with `localization.country.isoCode`, so checkout pricing follows the same rule.
- **Currencies:** goal amounts are converted from the shop currency automatically. A reward tier can also have fixed amounts per currency (`EUR 45, GBP 40`), which the storefront and the Function both use. Discount labels at checkout use the tier name in the buyer's language.

## Tests

```bash
cd extensions/cartkit-discounts && npm test     # discount function unit tests
npm run typecheck && npm run lint && npm run build
```

## Support: Help button, live chat and inbox

Every admin page has a floating **Help** button (`app/components/SupportWidget.tsx`). It opens a panel with quick fixes and an FAQ, **live chat** with your team, and an email form whose requests are stored in `SupportTicket`.

Answer live chats at `<app url>/support/inbox`. It runs outside the Shopify admin, so any browser works:

| Variable | Purpose |
| --- | --- |
| `SUPPORT_INBOX_KEY` | Required for the inbox (it returns 404 without one). Use a long random string; you sign in with it. |
| `SUPPORT_WEBHOOK_URL` | Optional Slack- or Discord-compatible webhook, pinged on new email requests and new chats. |
| `SUPPORT_EMAIL`, `SUPPORT_DOCS_URL` | Optional contact links shown in the panel. |

While the inbox is open, merchants see you as **Online**. After 5 minutes without it they see **Away**. Uninstalling the app deletes the store's chats and requests.
