# Asset validation report (2026-10-16)

Machine checks: `node app-store-assets/source/validate.mjs` → `asset-validation.json`. Visual checks were done by
opening every image and sampled frames of both videos.

## Files

| File | Check | Result |
|---|---|---|
| `screenshots/01…08-*.png` (8) | 1600 × 900 PNG | ✅ all 8 |
| `screenshots/feature/feature-image.png` | 1600 × 900 PNG | ✅ |
| `brand/cartivo-app-icon-1200.png` | 1200 × 1200 PNG, opaque, no text/price | ✅ |
| `review-demo/cartivo-review-demo.mp4` | H.264, yuv420p, 1920 × 1080, 30 fps, 4:08, full decode | ✅ 0 decode errors, 10.1 MB |
| `review-demo/cartivo-review-demo-no-captions.mp4` + `.en.srt` | same video without burned captions + English subtitles | ✅ 0 decode errors |
| `promotional-video/cartivo-promo.mp4` | H.264 + AAC 48 kHz, 1920 × 1080, 30 fps, 0:52, full decode | ✅ 0 decode errors, 11.7 MB |
| Promo audio | level / sync | ✅ mean −19.6 dB, peak −8.3 dB; audio starts at 0.000 s, ends 52.39 s (video 52.43 s). Music only, so there is nothing to lip-sync |
| Promo screen recording share | ≤ 25 % (Shopify guidance) | ✅ 23.9 % (12.5 s of 52.4 s) |

## Content checks

| Check | Result |
|---|---|
| Real UI only, nothing drawn or retouched | ✅ captures are cropped/scaled only; captions sit outside the UI |
| No browser chrome / desktop background in listing images | ✅ admin = app iframe only; storefront = page viewport only |
| No app pricing in images | ✅ Plans page and Plan card excluded. (Store product prices in the demo cart are store content.) |
| No statistics / outcome claims / superlatives | ✅ captions describe features; dashboard stats card cropped out |
| No reviews or testimonials | ✅ |
| No PII / credentials | ✅ Dev Console (showed an e-mail address), Sidekick and dev-preview overlays hidden before every capture and recording; no password or login screen appears in any asset; storefront password never written to a file |
| Unique images (4.4.5) | ✅ 8 different features/views |
| Spelling | ✅ all caption and image text proof-read (`*.srt`, `source/compose/listing.json`) |
| Branding consistent | ✅ one logo (`brand/cartivo-mark.svg`) and the app's own brand colours (#4f46e5, #db2777) everywhere |
| Transitions | ✅ promo: 0.6 s cross-fades between all 12 segments; no black frames at joins (frames sampled) |
| Features shown actually work | ✅ verified in Shopify's own `/cart.js` and cart page (see `04-findings-and-issues.md`) |
| Shopify trademarks | ⚠️ see manual review: small Shopify bag print on sample snowboard art; theme footer "© 2023 / Shopify, Inc." visible in the review demo (not in listing images or the promo) |

## Listing image alt text (paste into the submission form)

| Image | Alt text |
|---|---|
| 01-cart-drawer-offers | Cartivo cart drawer on a storefront with a free gift, a Buy X Get Y item at $0 and a reward progress bar. |
| 02-free-gift-goal | Cartivo free gift goal settings next to the cart drawer gift picker on the storefront. |
| 03-buy-x-get-y | Cartivo Buy X Get Y settings next to the cart drawer showing the free item at $0. |
| 04-in-cart-upsell | Cartivo in-cart upsell settings next to the cart drawer's Frequently bought together section. |
| 05-drawer-design | Cartivo cart drawer settings: look presets with Liquid glass selected and a live preview of the frosted drawer. |
| 06-dashboard-setup | Cartivo dashboard with the live status card and a completed setup guide. |
| 07-campaigns | Cartivo campaigns list with free gift, Buy X Get Y and upsell campaigns and their status. |
| 08-mobile | Cartivo on a phone: the product page and the cart drawer with a free gift and a $0 Buy X Get Y item. |
| feature-image | Cartivo cart drawer with a free gift and an upsell, next to a storefront product page. |

Shopify allows 3–6 desktop screenshots: suggested set **01, 02, 03, 04, 05, 06**; use **08** as the mobile
screenshot; **07** is a spare.
