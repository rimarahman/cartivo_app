# Shopify App Store media requirements (checked 2026-10-16)

Sources (shopify.dev, read through the Shopify Dev MCP on 2026-10-16):

- App Store requirements, section 4 "App Store listing": https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements
- Best practices for apps in the Shopify App Store (listing content): https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices
- Changelog, "Clearer standards for app listing images" (4.4.4 updated, 4.4.5 added, enforced from 2026-03-26): https://shopify.dev/changelog/posts/clearer-standards-for-app-listing-images
- Pass app review: https://shopify.dev/docs/apps/launch/app-store-review/pass-app-review

## What is required, what is optional

| Item | Required? | Rule (source) |
|---|---|---|
| Demo screencast for reviewers | **Required** (4.5.3) | Shows onboarding and the features described in the listing, step by step, so the reviewer can set up and test the app. English, or English subtitles. |
| Test credentials | Required if the app has its own login (4.5.4/4.5.5) | Cartivo uses Shopify auth only, so none (state this in the testing instructions). |
| Listing screenshots | Required | 1600 × 900 px (16:9). 3–6 desktop screenshots, at least one of the app UI. Mobile screenshots if the app is mobile-responsive (best practices). |
| Feature media | One of the two | **Video is optional.** Either a short video (best practice 2–3 min, promotional rather than instructional, screencasts ≤ 25 % of the video) **or** a static feature image 1600 × 900 px (16:9), one focal point, good contrast (4.5:1 recommended), alt text. |
| App icon | Required | 1200 × 1200 px JPEG/PNG (project checklist); no Shopify logo, no pricing. |

## Image rules that apply to every listing image

- 4.4.4: images must **primarily show the app's actual UI and features**; **no desktop backgrounds or browser windows**; images that only contain a logo are not allowed.
- 4.4.5: every image unique (different feature, view or state); no duplicates or near-duplicates.
- 4.2.2: **no pricing information** in images (including the icon).
- 4.3.4: **no statistics, data or unsubstantiated claims** ("the best", "the only", guarantees) in images.
- 4.3.6: **no reviews or testimonials** in images.
- 4.4.3: **no Shopify trademarks** in the icon, banner or screenshots.
- Best practices: crop out browser chrome and sensitive information, no PII, alt text for every image; feature image: don't repeat the app card subtitle, don't use Shopify logos.

## How the delivered assets apply this

| Rule | How |
|---|---|
| Real UI, no browser chrome | Admin captures are the app's own iframe only (no Shopify admin navigation or logo); storefront captures are the page viewport only. |
| No pricing in images | Plans page and the dashboard Plan card are never shown in listing images. Product prices in the demo store's cart are store content, not app pricing. |
| No stats/claims | Captions describe features only. The dashboard "Last 30 days" card (test counts) is cropped out. |
| No Shopify trademarks | No Shopify admin chrome or logo in listing images. (The demo store's own sample products include a small Shopify bag print on a snowboard graphic in some storefront shots — see manual review.) |
| Unique images | 8 screenshots, each a different feature or view. |
| Review screencast | Real recording, English captions burned in plus `.srt`. |
| Promo ≤ 25 % screencast | Measured by the build script (see validation report). |
