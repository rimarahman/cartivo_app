# Storyboards

## Review demo (`review-demo/cartivo-review-demo.mp4`, 4:08, for Shopify's app reviewers)

Real screen recording on the development store, played at 1.5× (every frame kept), English captions burned in
(plus `cartivo-review-demo.en.srt`). Recording: 5:59 at normal speed; step log in `evidence/review-recording-steps.json`.

| # | Caption (on screen) | What happens (real) |
|---|---|---|
| 0 | Title card "App review demo" | Brand card |
| 1 | Shopify admin → Apps → Cartivo | Admin home → click **Cartivo Dev** in the nav |
| 2 | Dashboard: live status of the cart drawer and a setup guide | Status card "Live on your store", setup guide |
| 3 | Campaign types you can create | Scroll to the campaign type cards |
| 4 | Cart drawer: looks, texts and a live preview | Open **Cart drawer** |
| 5 | Style: pick a ready-made look, the preview updates live | Click Aurora → Sunset → Ocean → Midnight → **Liquid glass**; preview changes |
| 6 | Keep Liquid glass and save | Save → "All changes saved" |
| 7 | Upsells: use your upsell campaigns first, then Shopify recommendations | Source → "Manual first, then automatic", Save |
| 8 | Sticky add-to-cart bar and floating cart button | Open **Sticky & floating cart** settings |
| 9 | Campaigns: every offer in one list | Open **Campaigns** |
| 10–13 | Create an in-cart upsell / When Oxygen is in the cart… / …recommend Liquid / Save (draft) | Name, status Draft, Shopify product picker ×2, Save |
| 14 | Activate the campaign: it goes live on the storefront | Campaigns → **Activate** → badge "Live" |
| 15–17 | Create a Buy X Get Y offer / buys Oxygen… / …gets The Complete Snowboard at 100 % off, added automatically | Picker ×2, Save |
| 18–20 | Create a free gift goal / Tier 1: $100 or more / Gift options: Ski Wax | Minimum cart value 100, Reward "Free gift", gift picker, Save |
| 21 | Three campaigns live | Campaigns list |
| 22 | Storefront: The Collection Snowboard: Oxygen | The product page provided for the demo |
| 23 | Floating cart button (bottom right) on every page | Pointer on the floating button |
| 24–25 | Scroll down: the sticky add-to-cart bar… / Add to cart from the sticky bar | Sticky bar appears; its **Add to cart** opens the Liquid glass drawer |
| 26 | Buy X Get Y: The Complete Snowboard was added at $0 | Auto-added line, $699.95 struck, $0.00 |
| 27–28 | Goal reached: choose a free gift / The gift is in the cart for free | Gift picker → pick → "FREE" line |
| 29 | Upsell: one click adds the recommended board | "Frequently bought together" → **Add** |
| 30–31 | Close the drawer: the floating button shows the item count / Open the cart again | Badge "4"; click floating button |
| 32 | Shopify's cart page: the free board and the gift are $0 | **View cart** → Shopify's own cart page |
| — | End card | Brand card |

Final cart (Shopify `/cart.js` at the end of the take): Oxygen $1,025.00 · Liquid $749.95 · The Complete Snowboard
(BXGY) **$0.00** · Selling Plans Ski Wax (gift) **$0.00** · total $1,774.95. Checkout was not opened; no order.

## Promotional video (`promotional-video/cartivo-promo.mp4`, 0:52, optional feature media)

Mostly listing images (real UI) with a slow zoom; two short real clips (12.5 s = **24 %**, under Shopify's 25 %
guidance); synthesized music bed; cross-fades 0.6 s. Segment list with sources: `evidence/promo-segments.json`.

| Time | Segment | On screen |
|---|---|---|
| 0:00 | Intro card | Logo · "A slide cart with rewards and offers built in" · "For Shopify stores" |
| 0:03 | Benefits card | "Show offers where shoppers decide: the cart" · Free gift goals · Buy X Get Y · In-cart upsells · Your own look |
| 0:07 | Image 01 | Rewards and offers, right in the cart |
| 0:12 | **Clip** (storefront, real) | Oxygen page → Add to cart → Liquid glass drawer adds the free board → gift picked. Caption: "Add to cart: a free board is added and the shopper picks a gift" |
| 0:18 | Images 02, 03, 04, 05 | Free gift goals · Buy X Get Y · In-cart upsells · Pick a look, including Liquid glass |
| 0:35 | **Clip** (admin, real) | Look presets clicked, preview changes, Liquid glass kept. Caption: "Pick a look, including Liquid glass, and preview it live" |
| 0:40 | Images 07, 08 | Every campaign in one list · Made for mobile shoppers |
| 0:48 | Closing card | Logo · "Cartivo: Slide Cart & Upsells" · "Find Cartivo on the Shopify App Store" |

Shopify recommends 2–3 minutes for feature videos; this one follows your 45–90 s brief. A feature video is
optional — the 1600 × 900 feature image (`screenshots/feature/feature-image.png`) is the alternative.
