# Cartivo App Store media

Made 2026-10-16 on branch `appstore-readiness` from the real **Cartivo Dev** app on the development store
`cartivo-app-test` (7-day trial, all features, Liquid glass look). Every screenshot and clip is a real capture;
nothing was drawn, simulated or retouched.

## Deliverables

| Status | Item | File |
|---|---|---|
| ✅ Done | **All final images in one folder** (screenshots, feature image, app icon, logos) | `final-images/` |
| ✅ Done | 8 listing screenshots, 1600 × 900 | `screenshots/01…08-*.png` |
| ✅ Done | Feature image, 1600 × 900 | `screenshots/feature/feature-image.png` |
| ✅ Done | Logo + app icon 1200 × 1200 | `brand/` (`cartivo-mark.svg` is the editable source) |
| ✅ Done | Review demo video (4:08, English captions) | `review-demo/cartivo-review-demo.mp4` (+ no-captions version and `.en.srt`) |
| ✅ Done | Promotional video (0:52, music, captions) | `promotional-video/cartivo-promo.mp4` (+ `.en.srt`) |
| ✅ Done | Storyboards | `reports/02-storyboards.md` |
| ✅ Done | Requirements check | `reports/01-shopify-requirements.md` |
| ✅ Done | Validation report + alt texts | `reports/03-asset-validation-report.md` |
| ✅ Done | Findings, dev-store changes, how to undo | `reports/04-findings-and-issues.md` |
| ⚠️ Manual | Items for a person | `reports/05-manual-review.md` |
| ❌ Not done | Install/OAuth segment in the review video | needs an uninstall/reinstall you approve (see manual review #4) |

## Rebuild

Full step-by-step guide (setup, capture, build, checks, putting the dev store back): **[PLAYBOOK.md](PLAYBOOK.md)**.

Editable sources are in `source/`. Requirements: the installed Chrome, ffmpeg/ffprobe (`FFMPEG`, `FFPROBE` env vars),
`npm run dev` running for Cartivo Dev, and a Chrome window you signed in to yourself:

```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir=<folder outside the repo> --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1
```

Sign in to the admin and unlock the storefront in that window; the scripts attach to its tab and never handle a
credential. Then:

| Step | Command |
|---|---|
| Backup dev campaigns first | `node app-store-assets/source/capture/dev-backup.mjs > backup.json` |
| Review demo recording | `node app-store-assets/source/capture/record-review.mjs <recDir>` |
| Storefront / admin captures | `node app-store-assets/source/capture/storefront.mjs` · `…/admin.mjs` |
| Promo storefront clip | `node app-store-assets/source/capture/record-promo-clip.mjs <clipDir>` |
| Listing images (edit `source/compose/listing.json`) | `node app-store-assets/source/compose/compose.mjs` |
| Logo files | `node app-store-assets/source/brand/render-brand.mjs` |
| Review video (`REVIEW_SPEED`, default 1.5) | `node app-store-assets/source/video/build-review.mjs <recDir>` |
| Promo video | `node app-store-assets/source/video/build-promo.mjs <recDir> <clipDir>` |
| Validate | `node app-store-assets/source/validate.mjs` |

All capture scripts refuse any store other than `cartivo-app-test`; the DB scripts refuse any database other than
the isolated dev database.
