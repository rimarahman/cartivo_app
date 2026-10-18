# App Store compliance audit — Cartivo

- **তারিখ:** ২০২৬-১০-১৫
- **Branch:** `appstore-readiness` (তৈরি হয়েছে `main` @ `5a2ed54` থেকে)
- **উৎস:** https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements (২০২৬-১০-১৫ তারিখে যাচাই করা)। যেখানে আলাদা উৎস ব্যবহার হয়েছে, সেখানে উল্লেখ করা আছে।

**Status-এর মানে:** PASS = কোডে প্রমাণ পাওয়া গেছে · FIXED = এই branch-এ ঠিক করা হয়েছে · NEEDS MANUAL TEST = dev store-এ চালিয়ে দেখতে হবে · NOT VERIFIED = repo থেকে যাচাই করা যায় না (listing বা Partner Dashboard-এর বিষয়) · N/A = এই ধরনের অ্যাপের জন্য প্রযোজ্য নয়।

> এটা Shopify-এর অফিসিয়াল review নয়। Shopify নিজের review-এ আরও বিষয় দেখবে, এবং approval-এর কোনো গ্যারান্টি নেই।

## সারাংশ

| | সংখ্যা |
|---|---|
| অফিসিয়াল পেজে মোট requirement | 174 |
| এই অ্যাপে প্রযোজ্য | 52 |
| PASS (কোডে প্রমাণ আছে) | 20 |
| FIXED (এই branch-এ) | 4 |
| কোডে এখনো বাকি FAIL | 0 (এই branch অনুযায়ী) |
| NEEDS MANUAL TEST | 7 |
| NOT VERIFIED (listing বা Partner Dashboard) | 21 |
| N/A | 122 (section 1–4-এর 20টি + category 5.2–5.11-এর 102টি) |

## FIXED: এই branch-এ সমাধান করা হয়েছে

### 1.1.9 Obtain explicit buyer consent before adding charges — **FIXED** (severity: Critical)
- **সমস্যা:** add-on campaign-এ `defaultChecked` চালু থাকলে storefront script paid add-on product নিজে থেকে cart-এ যোগ করত (আগে `extensions/cartkit-theme/assets/cartkit.js:311`, admin-এ "Checked by default (adds automatically)" checkbox)। এ ছাড়া BXGY-এর "get" item আংশিক ছাড়ে (যেমন 50% off) থাকলেও নিজে থেকে যোগ হতো, ফলে buyer-এর অনুমতি ছাড়াই cart total বেড়ে যেত।
- **সমাধান (commit `d85fa7b`):**
  - `cartkit.js`: add-on আর কখনো নিজে থেকে যোগ হয় না। BXGY auto-add হয় শুধু `percent >= 100` হলে (`bxgyAutoAdd()`)।
  - `app/lib/storefront-rules.ts`: publish করার সময় প্রতিটি campaign-এর config থেকে `defaultChecked` বাদ দেওয়া হয় আর partial BXGY-তে `autoAdd=false` করা হয়। পুরোনো সেভ করা config-এর জন্যও এটা প্রযোজ্য।
  - Campaign editor: add-on-এর checkbox সরানো হয়েছে। Partial BXGY-তে auto-add checkbox disabled, সঙ্গে কারণ লেখা আছে।
  - Unit test: `test/storefront-rules.test.ts` (৭টি test)।
- **যাচাই:** `npm test` চালানো হয়েছে। Dev store-এ manual test-এর ধাপ `TESTING_CHECKLIST.md`-এ আছে।

### 1.1.4 Use only factual information — **FIXED** (severity: High)
- **সমস্যা:** "Evergreen (per visitor)" countdown প্রতিটি visitor-এর জন্য localStorage-এ নতুন করে শুরু হতো। ফলে আসল offer-এর কোনো deadline না থাকলেও "Offer ends in 14:59" দেখাত, যা fake urgency।
- **সমাধান (commit `d85fa7b`, `273d919`):** evergreen mode সরানো হয়েছে। এখন countdown শুধু merchant-এর দেওয়া "Offer ends at" তারিখ দেখায়, তারিখ না থাকলে timer দেখায় না। পুরোনো evergreen config storefront-এ আর timer দেখায় না। প্রথমে timer campaign-এর `endsAt` তারিখে fallback করত, কিন্তু trial চলাকালীন `endsAt` trial শেষ হওয়ার তারিখে সীমাবদ্ধ থাকে, তাই এতেও ভুয়া deadline দেখাত। Code review-এ এটা ধরা পড়ার পরে fallback সরানো হয়েছে।
- **আনুষঙ্গিক পরিবর্তন:** "AI recommendations" লেখাটা বদলে "Shopify product recommendations" করা হয়েছে, কারণ অ্যাপ Shopify-এর `/recommendations/products.json` ব্যবহার করে (commit `aac60f0`)।

### 2.3.1 Initiate installation from a Shopify-owned surface — **FIXED** (severity: High)
- **সমস্যা:** `app/routes/_index/route.tsx` আর `/auth/login`-এ production-এ "Shop domain" লিখে লগইন করার form ছিল।
- **সমাধান (commit `aac60f0`):** এই form এখন শুধু development-এ দেখা যায় (non-production deployment-এ `ALLOW_MANUAL_LOGIN=true` দিয়ে চালু করা যায়)। Production-এ এর বদলে লেখা থাকে "Shopify admin থেকে খুলুন"। Shopify থেকে `?shop=` সহ আসা request আগের মতোই সরাসরি OAuth-এ যায়।

### 4.1.1 App name fields must be similar — **FIXED** (deploy করা বাকি)
- **সমস্যা:** TOML-এ নাম ছিল "Cartivo – Smart Cart & Upsells", কিন্তু অ্যাপের ভেতরে, theme editor-এ আর discount-এ সব জায়গায় "CartKit" লেখা ছিল।
- **সমাধান (commit `aac60f0`):** TOML-এ নাম এখন `"Cartivo"`, যাতে admin nav-এ নাম কেটে না যায় (BFS 4.1.3)। Listing-এর নাম হবে "Cartivo – Smart Cart & Upsells"। দুই নামেই "Cartivo" শব্দটা আছে, তাই নাম দুটো similar। Merchant যা দেখে, সেই সব লেখা "Cartivo" করা হয়েছে। Internal handle, metafield namespace, CSS class আর DB আগের মতোই আছে। Storefront-এ `window.Cartivo` চালু করা হয়েছে, আর আগের custom code যাতে চলে সেজন্য `window.CartKit` alias রাখা হয়েছে।
- **বাকি:** `shopify app deploy` করার পরেই নতুন নাম কার্যকর হবে (deploy করা হয়নি)।

## PASS (কোডে প্রমাণ আছে)

| Req | বিষয় | প্রমাণ |
|---|---|---|
| 1.1.1 | Session token | `app/shopify.server.ts`: `@shopify/shopify-app-react-router` embedded auth, `expiringOfflineAccessTokens`। Admin-এ কোনো cookie বা localStorage auth নেই। (Incognito-তে manual test করার সুপারিশ রইল।) |
| 1.1.2 | Shopify checkout | Storefront শুধু Ajax Cart API আর `/checkout` ব্যবহার করে। কোনো external checkout বা payment নেই। |
| 1.1.3 | Theme download নেই | Theme তৈরি বা upload-এর কোনো কোড নেই। |
| 1.1.10 | সবচেয়ে সস্তা shipping default | Delivery discount Function (`cart_delivery_options_discounts_generate_run.js`) শুধু ছাড় দেয়, shipping option-এর ক্রম বদলায় না। |
| 1.1.12 | Web-based | হ্যাঁ। |
| 1.2.1 | Shopify Billing API | `app/shopify.server.ts`-এর `billing` config, `app/models/billing.server.ts` (`billing.check/request/cancel`)। |
| 1.2.3 | Plan বদলানো | `app/routes/app.pricing.tsx`: upgrade হয় `billing.request` দিয়ে, Starter-এ নামা হয় `billing.cancel` দিয়ে। Support-এর সাহায্য বা reinstall লাগে না। |
| 1.3.1 | Review-এর জন্য incentive নেই | Review চাওয়ার কোনো লেখা বা কোড পাওয়া যায়নি। |
| 2.2.1 | Shopify API | GraphQL Admin API, Functions, theme app extension। |
| 2.2.2 | Consistent embedded experience | Merchant-এর সব workflow embedded অ্যাপের ভেতরে। `/support/inbox` শুধু support team-এর internal টুল, merchant-এর জন্য নয়। |
| 2.2.3 | Latest App Bridge | `AppProvider` (`@shopify/shopify-app-react-router` 3.0.2) document-এর প্রথম script হিসেবে `cdn.shopify.com/shopifycloud/app-bridge.js` যোগ করে। |
| 2.2.4 | Shudhu GraphQL Admin API | `/admin/api` বা REST client-এর কোনো ব্যবহার নেই। |
| 2.3.2–2.3.4 | OAuth / redirect / reinstall | Shopify managed install (TOML scopes), library-র OAuth আর token exchange, `PrismaSessionStorage` upsert করে। Reinstall-এ কোনো install-once flag আটকায় না। |
| 4.5.2 | Regular app | কোনো `channel_config` extension নেই। |
| 5.1.1 | Theme app extension | শুধু `extensions/cartkit-theme` (app embed + app block)। Asset API বা ScriptTag নেই। এখন theme file পড়াও হয় না। |
| 5.1.3 | Onboarding + deep link | Dashboard-এর setup guide আর `activateAppId=` deep link (`app/routes/app._index.tsx`)। |
| 5.1.4 | App name branding | Storefront-এ "Cartivo" লেখা বা লোগো দেখানো হয় না (`cartkit.js`/`cartkit.css`-এ খুঁজে দেখা হয়েছে)। |
| 5.1.5 | সংগ্রহ করা data merchant-কে ফেরত | কোনো customer data সংগ্রহ করা হয় না। Analytics event-এ কোনো PII নেই (`proxy.track.tsx`: type, campaignId, value)। |

## NEEDS MANUAL TEST

| Req | কী পরীক্ষা করতে হবে |
|---|---|
| 1.2.2 | Dev store-এ charge approve, decline (decline করলে app ভাঙবে না), আর uninstall করে reinstall করলে আবার charge চাওয়া হয় কিনা। |
| 2.1.1 / 2.1.2 / 2.1.3 | Reviewer-এর মতো প্রতিটি পেজ ঘুরে দেখা: কোনো 404/500 নেই, UI bug নেই। |
| 2.1.4 | Settings বা campaign সেভ করলে metafield আর "Cartivo rewards" automatic discount ঠিকমতো sync হয় কিনা। |
| 3.1.1 | `https://cartivo-app.onrender.com`-এর TLS certificate valid কিনা (Render managed)। |
| 5.1.2 | Theme editor আর online store-এ embed ও volume block কোনো error ছাড়া দেখায় কিনা (Dawn-এ)। |

## NOT VERIFIED (repo থেকে যাচাই করা যায় না, listing বা Partner Dashboard-এর বিষয়)

1.1.5 (duplicate app নেই), 4.1.2 (নামটা unique কিনা, App Store-এ খুঁজে দেখতে হবে), 4.2.1–4.2.3 (listing-এ pricing), 4.3.1–4.3.8 (listing content: "Merchant must have online store" select করা, শুধু English ভাষা, কোনো stats বা guarantee না রাখা, সঠিক tag, কোনো testimonial না রাখা, geographic requirement), 4.4.1–4.4.5 (subtitle, details, Shopify trademark ব্যবহার না করা, screenshot), 4.5.3 (demo screencast), 4.5.4 (testing instruction), 4.5.6 (emergency contact)। এগুলোর checklist আর draft `APP_STORE_SUBMISSION_CHECKLIST.md`-এ আছে।

## N/A

- **Section 1–4:** 1.1.6, 1.1.7, 1.1.8, 1.1.11, 1.1.13, 1.1.14, 1.1.15, 1.1.16 (marketplace, payment gateway, POS, browser extension, product duplication, agency, refund, lending: অ্যাপ এর কোনোটাই করে না); 2.2.5–2.2.9 (admin বা Sidekick extension নেই, Max modal নেই); 3.2.1–3.2.5 (এই restricted scope-গুলো চাওয়া হয় না; এখনকার scope: `read_locales,read_products,write_app_proxy,write_discounts`); 4.5.1 (sales channel নয়); 4.5.5 (অ্যাপে আলাদা login নেই)।
- **Category 5.2–5.11:** Payment, Payment facilitator, Purchase option, Product sourcing, Checkout customization (checkout UI extension নেই), Sales channel, Post purchase, Mobile app builder, Donation, Blockchain। এর কোনো extension type বা scope অ্যাপে নেই।

## AI self-review tool
Shopify-এর অফিসিয়াল "app-store-review" self-review টুল (Shopify AI Toolkit) দিয়ে কোড দিয়ে যাচাই করা যায় এমন requirement-এর তালিকা আনা হয়েছে এবং প্রতিটি মিলিয়ে দেখা হয়েছে। এর ফলাফল এই ডকুমেন্টের PASS/FIXED কলামে অন্তর্ভুক্ত।
