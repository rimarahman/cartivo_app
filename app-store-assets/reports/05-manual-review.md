# Needs a person before submission

1. **Shopify trademark on sample products (4.4.3).** Shopify's generated test snowboards have a small Shopify bag
   print (e.g. bottom of the Oxygen board, visible in `08-mobile.png` and in the promo storefront clip; very small
   or dimmed elsewhere). The theme footer "© 2023 / Shopify, Inc." appears in the **review** demo only. Safest:
   swap the demo products' images (or use your own demo products) and re-run the capture scripts. Decide whether
   the small print is acceptable.
2. **Pick the 3–6 desktop screenshots** (suggested 01–06, mobile 08) and paste the alt texts from
   `03-asset-validation-report.md`.
3. **Feature media:** upload the promo video (the submission form takes a hosted video link, e.g. YouTube) **or**
   the feature image. The video is optional; Shopify suggests 2–3 min, this one is 52 s as briefed.
4. **Review screencast:** upload `review-demo/cartivo-review-demo.mp4` (unlisted link) in the submission form.
   It does **not** show install/OAuth or turning on the app embed (the store already has the app installed and the
   embed on; reinstalling needs your approval per `tests/e2e/live/README.md`). Shopify asks to see onboarding —
   consider adding a short install + "Open theme editor" segment, or describe those steps in the testing
   instructions.
5. **App icon:** `brand/cartivo-app-icon-1200.png` is new. Check you like it, then set it in the Partner Dashboard
   (and, if wanted, as the app's admin icon). The logo was not added to the app's own UI.
6. **Product decision:** should free BXGY items count toward cart goals? (`04-findings-and-issues.md` #1.)
7. **Development store state:** restore if needed (table in `04-findings-and-issues.md`): trial row, `DEV_PLAN`,
   drawer look (now Liquid glass), upsell source, the 9 drafted campaigns, the 3 demo campaigns.
8. **Music:** synthesized in ffmpeg by the build script (no third-party audio). Replace with a licensed track if
   you prefer; keep it quiet under the captions.
9. **Nothing was committed, pushed, deployed or submitted.** Review `app-store-assets/` and commit it yourself if you
   want it in git (about 54 MB, most of it videos and raw captures).
