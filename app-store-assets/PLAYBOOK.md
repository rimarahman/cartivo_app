# Playbook: making the Cartivo App Store media again

This is the full process used on 2026-10-16. Follow it to refresh the screenshots and videos after the app changes.
All commands run from the repo root. Scripts are in `app-store-assets/source/`.

## Rules (do not break)

- Work on `appstore-readiness` and the development store `cartivo-app-test` only. Every capture script checks this.
- Never touch production, create billing charges, push, merge, deploy or submit.
- Never type or save a password. The person signs in to the browser themselves.
- Use only real UI. Crop and scale, but never draw, fake or retouch.
- Shopify listing rules:
  - Screenshots are 1600 × 900, 3–6 desktop plus mobile.
  - No browser chrome, no app pricing, no stats or claims, no Shopify trademarks.
  - Every image is unique.
  - The review demo is in English.
  - Screen recording is at most 25 % of the promo video.

## 1. Set up (about 10 min)

1. **Chrome you sign in to yourself.** Use a profile folder outside the repo:
   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir=<folder> --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1
   ```
   Sign in to the Shopify admin and unlock the storefront in that window. Keep one admin tab open.
   The scripts attach to that tab (`capture/browser.mjs` → `attach()`). They never open a new window or tab.
2. **Run the app:** `npm run dev`. The app must be reachable at `admin…/apps/cartivo-dev/app`.
3. **ffmpeg:** install ffmpeg and ffprobe if they are missing. One way is `npm i ffmpeg-static ffprobe-static` in a scratch folder. Then set the paths:
   ```
   FFMPEG=<path to ffmpeg.exe>  FFPROBE=<path to ffprobe.exe>
   ```
   In Git Bash, put `MSYS_NO_PATHCONV=1` in front of commands that take `/`-style arguments.
4. **Back up the dev data:** `node app-store-assets/source/capture/dev-backup.mjs > backup.json`.
5. **Unlock every feature (Liquid glass needs Premium or trial):**
   - Run `node app-store-assets/source/capture/dev-trial.mjs start`. It saves the old trial state.
   - Comment out `DEV_PLAN` in `.env`, because `DEV_PLAN` wins over the trial.
   - Restart `npm run dev`.

## 2. Capture

| Step | Command | Output |
|---|---|---|
| Review demo recording (full flow, about 6 min) | `node app-store-assets/source/capture/record-review.mjs <recDir>` | frames + `timeline.json` |
| Storefront screenshots, desktop and mobile | `node app-store-assets/source/capture/storefront.mjs` | `source/raw/sf-*.png`, cart evidence |
| Admin screenshots | `node app-store-assets/source/capture/admin.mjs` | `source/raw/admin-*.png` |
| Promo storefront clip | `node app-store-assets/source/capture/record-promo-clip.mjs <clipDir>` | frames + timeline |

Notes:

**Before recording, `record-review.mjs` resets the store off-camera:**
- It sets the upsell source back to auto and the look back to Forest.
- It deletes the demo campaigns from the last take.
- It empties the cart.

**Then it records this flow:**
- The dashboard.
- Style presets, ending with Liquid glass, then Save.
- Upsell source set to "both".
- The sticky and floating button settings.
- It creates three campaigns: an upsell (draft, then Activate), a Buy X Get Y and a $100 gift goal.
- On the storefront, using the Oxygen product page: the floating button, the sticky bar, Add to cart, the drawer, BXGY at $0, picking the gift, adding the upsell, closing the drawer, reopening it from the floating button, then View cart.

**Admin overlays:**
- Dev Console, Sidekick and the dev-preview pill are hidden by `hideAdminOverlays`.
- The Dev Console shows an email address, so always hide it.

**Old dev campaigns:** set them to Draft first. Old campaigns with odd texts, such as "Offer ended" or "gift wrapping", look wrong on camera.

**Shopify product picker:**
- It can open slowly; the helper waits and retries.
- Checkboxes are clicked by mouse position, because a plain click gets intercepted.

## 3. Build

| Step | Command |
|---|---|
| Listing images and feature image (texts and crops in `source/compose/listing.json`) | `node app-store-assets/source/compose/compose.mjs` |
| Logo, icon (1200) and mark (512) from `brand/cartivo-mark.svg` | `node app-store-assets/source/brand/render-brand.mjs` |
| Review video (`REVIEW_SPEED`, default 1.5) | `node app-store-assets/source/video/build-review.mjs <recDir>` |
| Promo video, 45–90 s, with music, cross-fades and captions | `node app-store-assets/source/video/build-promo.mjs <recDir> <clipDir>` |
| Checks | `node app-store-assets/source/validate.mjs` → `reports/asset-validation.json` |

Then copy the final images into `final-images/`:
- `01–08`: the screenshots.
- `09`: the feature image.
- `10`: the app icon.
- `11`: the horizontal logo.
- `12`: the logo mark.

## 4. Check by eye

- Open every image. Pull sample frames from both videos.
- Look for:
  - Shopify logos.
  - Emails.
  - Prices of the app.
  - Overlapping text.
- The promo video's screen recording share must be at or below 25 %; `validate.mjs` prints it.
- Update the reports in `reports/` (01 requirements, 02 storyboards, 03 validation and alt texts, 04 findings, 05 manual review).

## 5. Put the dev store back

Use the table in `reports/04-findings-and-issues.md`:
- Run `dev-trial.mjs restore <file>`.
- Uncomment `DEV_PLAN` in `.env`.
- Set the drawer look and upsell source back.
- Set the drafted campaigns back to active, if wanted.
- Delete the three demo campaigns.

## Style choices the owner asked for

- Liquid glass drawer look.
- The style presets shown being switched.
- The floating cart button and the sticky add-to-cart bar visible.
- The Oxygen product page.
- The Cartivo logo on every card and image.
- Faster video: the review at 1.5×, the promo clip at 1.3×.
- All final images in one folder.

## Known open items

- Sample snowboards have a small Shopify bag print. Replace the product images, or use your own demo products.
- The theme footer "© Shopify" appears in the review video.
- The install/OAuth part is not recorded. Recording it needs an approved uninstall and reinstall.
- Product decision: should free BXGY items count toward cart goals?
