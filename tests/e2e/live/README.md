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
