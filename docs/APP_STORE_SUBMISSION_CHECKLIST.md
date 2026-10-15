# App Store submission checklist — Cartivo

উৎস: https://shopify.dev/docs/apps/launch/app-store-review/submit-app-for-review, https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices, https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements (section 4), সব ২০২৬-১০-১৫ তারিখে যাচাই করা। নিচের listing copy শুধু **draft**। কিছুই publish বা submit করা হয়নি।

## Configuration (Dev Dashboard / Partner Dashboard)
- [ ] `appstore-readiness` merge করে `shopify app deploy` চালান (নতুন নাম "SC Cartivo", scope থেকে `read_themes` বাদ, webhook `2026-10`)। ⚠️ এটা আপনার অনুমতি নিয়ে করতে হবে।
- [ ] App URL বা domain-এ "Shopify" বা "Example" শব্দ থাকবে না (`cartivo-app.onrender.com` ✅)।
- [ ] Compliance webhook subscribe করা আছে (TOML ✅)।
- [ ] App icon: **1200×1200 px**, JPEG বা PNG। Shopify লোগো ব্যবহার করবেন না, Shopify-এর first-party অ্যাপের মতো gradient ব্যবহার করবেন না, icon-এ কোনো দাম লিখবেন না।
- [ ] API contact email-এ "Shopify" শব্দ থাকবে না।
- [ ] **Emergency developer contact** (email আর ফোন) যোগ করুন (4.5.6)।
- [ ] Protected customer data: **opt out** (অ্যাপ customer data ব্যবহার করে না)।
- [ ] Review পেজের automated check চালিয়ে সব pass করাতে হবে।
- [ ] `noreply@shopify.com` allow-list-এ যোগ করুন।

## Listing
| Field | নিয়ম | Draft |
|---|---|---|
| App name | ≤ ৩০ অক্ষর, TOML-এর নামের সঙ্গে মিল থাকতে হবে (4.1.1), brand আগে | **SC: Cartivo - Cart & Upsells** (২৮ অক্ষর)। TOML-এ (admin nav) ছোট নাম **SC Cartivo**, যাতে nav-এ কেটে না যায় (BFS 4.1.3)। দুটো নাম "similar", তাই 4.1.1 মানা হয়। ⚠️ "SC (Sticky Cart)" (TenGrowth) নামে একটা app আগে থেকে আছে, তাই "SC Cart" বা "SC Sticky Cart" নয়। "Cartivo" শব্দটাই আলাদা করে। Submit-এর আগে App Store-এ "Cartivo" আর "SC Cartivo" খুঁজে দেখুন। |
| App card subtitle | Keyword stuffing বা stats চলবে না | Slide cart with free gift goals, upsells and a sticky add-to-cart |
| App introduction | ≤ ১০০ অক্ষর, কোনো দাবি বা stat নয় (4.3.3) | Give shoppers a slide cart that shows rewards, upsells and offers before checkout. ("fast" বাদ: মাপা দাবি নয়) |
| App details | ≤ ৫০০ অক্ষর, কোনো guarantee বা stat নয় | Cartivo replaces your theme's cart with a customizable slide cart. Show a progress bar toward free shipping or a free gift, recommend products inside the cart, run Buy X Get Y and volume discounts, and add optional extras like gift wrapping that shoppers choose themselves. A sticky add-to-cart and floating cart button help shoppers on every page. Set it up in the Shopify admin with a live preview, no code needed. |
| Feature list | প্রতিটি ≤ ৮০ অক্ষর | Slide cart drawer with your brand colors and live preview · Free shipping and free gift goals with a progress bar · In-cart upsells, Buy X Get Y and volume discounts · Sticky add-to-cart and floating cart button · Translations and country targeting for Shopify Markets |
| Pricing | Trial, free plan আর সব charge উল্লেখ করতে হবে; দাম শুধু Pricing section-এ | Starter: Free · Essential: $10/30 days · Growth: $20/30 days · Premium: $60/30 days · প্রথম ৭ দিন সব feature free (app trial)। ⚠️ Trial **app নিজে চালায়**, Shopify-র billing trial নয়। Pricing-এর লেখায় লিখুন: "7-day free trial of all features, then choose Starter (free) or a paid plan"। |
| Screenshot | 1600×900 (16:9), ৩–৬টি desktop, browser chrome বা PII থাকবে না, দাম বা review থাকবে না, প্রতিটি আলাদা | Dashboard, Cart drawer editor + preview, Campaign editor (free gift goal), Campaigns list, storefront drawer, mobile |
| Feature image | 1600×900, এক জায়গায় focus, alt text | – |
| Demo screencast | English (বা English subtitle): install → embed চালু → drawer customize → goal তৈরি → storefront | তৈরি করতে হবে |
| Languages | শুধু সেই ভাষা যেখানে admin UI আছে | **English** (storefront-এর লেখা অনুবাদ করা যায়, এটা App details-এ বলা যেতে পারে) |
| Sales channel ও requirement (4.3.8) | Online store লাগে, আর theme-এর শর্ত listing-এ লিখতে হবে | "Merchant must have online store" ✅ select করুন। App details বা requirement-এ লিখুন: "Requires an Online Store 2.0 theme that supports app embeds." |
| Category / tags | সঠিক হতে হবে | যেমন "Cart customization", "Upsell and cross-sell" (Partner form-এর তালিকা থেকে বেছে নিন) |
| Privacy policy URL | লাগবে | তৈরি করুন (`SECURITY_PRIVACY_AUDIT.md`-এর "Privacy policy-তে যা উল্লেখ করতে হবে" অংশ দেখুন) |
| Terms of service | সুপারিশ | তৈরি করুন |
| Support email, docs | লাগবে | Render-এ `SUPPORT_EMAIL` আর `SUPPORT_DOCS_URL` set করুন |
| Testimonial বা review | কোথাও রাখা যাবে না | – |

## Reviewer-এর জন্য testing instruction (draft)
> Cartivo has no separate login. Install the app, then on the Dashboard click "Turn on in theme editor" and save to enable the app embed. Open your storefront and add any product to the cart to see the slide cart. To test campaigns, create a "Free shipping or free gift goal" under Campaigns (all features are unlocked during the 7-day trial). Plans can be changed under Plans; development stores receive test charges. Paid add-ons are never pre-selected: shoppers tick the box to add them.

## Submit করার আগে
- [ ] `TESTING_CHECKLIST.md`-এর সব manual test pass করেছে।
- [ ] Production env: `NODE_ENV=production`, `BILLING_DISABLED` unset, `SUPPORT_INBOX_KEY` লম্বা আর random।
- [ ] Render-এর instance always-on, Neon-এর region আর autosuspend যাচাই করা।
