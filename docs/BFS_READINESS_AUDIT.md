# Built for Shopify (BFS) readiness audit — Cartivo

- **তারিখ:** ২০২৬-১০-১৫
- **উৎস:** https://shopify.dev/docs/apps/launch/built-for-shopify/requirements (২০২৬-১০-১৫ তারিখে যাচাই করা)
- **Category:** Cartivo একটি **Discount app** (category 5.5), কারণ এটা discount Function ব্যবহার করে। অন্য কোনো category (ads, analytics, bundles, subscription ইত্যাদি) প্রযোজ্য নয়।

> **গুরুত্বপূর্ণ:** BFS status শুধু Shopify দেয়। এই ডকুমেন্ট শুধু দেখায় কোডের দিক থেকে অ্যাপ কতটা প্রস্তুত। অ্যাপ এখনো BFS-এর যোগ্য (eligible) **নয়**, কারণ install, review আর Web Vitals-এর data এখনো নেই।

শ্রেণি: **A** = কোডে এখনই ঠিক করা যায় · **B** = manual test লাগবে · **C** = production-এর measurement লাগবে · **D** = launch-এর পরে merchant আসার উপর নির্ভর করে

## 1. Prerequisites

| Req | অবস্থা | শ্রেণি |
|---|---|---|
| 1.1.1 App Store requirement মানা | App Store audit দেখুন। কোডে কোনো FAIL বাকি নেই, manual test আর listing বাকি। | B |
| 1.1.2 Partner account-এর ভালো standing | Repo থেকে যাচাই করা যায় না (Partner Dashboard)। | NOT VERIFIED |
| 1.2.1 paid plan-এ থাকা shop থেকে কমপক্ষে ৫০টি net install | Launch-এর পরে। | D |
| 1.2.2 কমপক্ষে ৫টি review | Launch-এর পরে। | D |
| 1.2.3 Minimum rating | Launch-এর পরে। | D |

## 2. Performance

| Req | অবস্থা | শ্রেণি |
|---|---|---|
| 2.1.1 LCP ≤ 2.5s (p75, ২৮ দিনে কমপক্ষে ১০০টি call) | Web Vitals মাপার জন্য দরকারি latest App Bridge আছে। Dashboard থেকে theme file পড়া বাদ দেওয়া হয়েছে, ফলে প্রতি load-এ একটি GraphQL call কমেছে। Render বা Neon cold start-এর ঝুঁকি আছে (`PERFORMANCE_AUDIT.md` দেখুন)। | C |
| 2.1.2 CLS ≤ 0.1 | Embed status আসার পরে banner আর যোগ হয় না, শুধু badge-এর লেখা বদলায়। Gradient hero সরানো হয়েছে। | C |
| 2.1.3 INP ≤ 200ms | কোনো বড় synchronous কাজ চোখে পড়েনি। | C |
| 2.2.1 Storefront Lighthouse ১০ পয়েন্টের বেশি না কমানো | JS `defer` দিয়ে লোড হয়। Product page-এর inline JSON ছোট করা হয়েছে। Timer interval এখন শুধু দরকার হলে চলে। | B/C |
| 2.3.1 Checkout speed (carrier rates) | N/A, কারণ কোনো carrier service নেই। | N/A |

## 3. Integration

| Req | অবস্থা |
|---|---|
| 3.1.1 Embedded, latest App Bridge, ID token | ✅ PASS (`AppProvider`, managed install, token exchange) |
| 3.1.2 মূল workflow Shopify-এর ভেতরে | ✅ PASS |
| 3.1.3 Shopify credential দিয়ে sign up | ✅ PASS (আলাদা কোনো sign up নেই) |
| 3.1.4 Monitoring বা reporting সহজ ভাবে দেখানো | ✅ PASS (Dashboard-এ "Last 30 days" metric, Analytics পেজ) |
| 3.1.5 Third-party connection-এর setting | N/A |
| 3.2.1 Uninstall করলে কিছু থেকে যায় না (theme app extension) | ✅ PASS |
| 3.2.2 Asset API দিয়ে লেখা হয় না | ✅ PASS। এখন theme file পড়াও হয় না, আর `read_themes` scope সরানো হয়েছে। |

## 4. Design

| Req | আগে | এখন | শ্রেণি |
|---|---|---|---|
| 4.1.1 Admin-এর মতো দেখতে | Indigo থেকে pink gradient hero, custom button, purple রং | **FIXED:** Polaris `s-section`/`s-badge`/`s-button` ব্যবহার, Polaris-এর neutral রং | B (চোখে দেখে যাচাই) |
| 4.1.2 Mobile-friendly | যাচাই করা হয়নি | Grid-গুলো `auto-fill`/`auto-fit`, setup step-গুলো wrap হয় | B |
| 4.1.3 নাম কেটে যায় না | "Cartivo – Smart Cart & Upsells" (৩০ অক্ষর, কেটে যেত) | **FIXED:** TOML-এ নাম `"Cartivo"` (deploy করার পরে কার্যকর হবে) | A (deploy বাকি) |
| 4.1.4 Nav menu | `s-app-nav`, `rel="home"`, কোনো emoji নেই | ✅ PASS | – |
| 4.1.5 Contextual Save Bar | App Bridge `SaveBar` (settings আর campaign editor) | ✅ PASS। CSB খোলা থাকলে অন্য পেজে যাওয়া আটকায় কিনা manual test-এ দেখতে হবে | B |
| 4.1.6 Modal | `window.confirm()` | **FIXED:** heading, primary-action আর secondary-actions slot সহ `s-modal` (campaign delete, plan downgrade) | B |
| 4.2.1 বানান ও ব্যাকরণ | – | Copy দেখে নিতে হবে | B |
| 4.2.2 Onboarding সরিয়ে ফেলা যায় | Setup guide সবসময় দেখাত | **FIXED:** "Hide setup guide" আর Help থেকে "Show setup guide" (`ShopSettings.setupDismissedAt`) | B |
| 4.2.3 Homepage-এ embed status | Theme-এর `settings_data.json` পড়ে বের করা হতো | **FIXED:** App Bridge `shopify.app.extensions()` দিয়ে (`app/components/useEmbedStatus.ts`) | B |
| 4.2.4 Error লাল আর নিজে থেকে মুছে যায় না | `toast.show(..., {isError})`, যা নিজে থেকে মুছে যেত | **FIXED:** critical `s-banner` থাকে যতক্ষণ না merchant dismiss করে বা আবার সেভ করে (`ErrorBanner`, `useSave`)। Help panel-এর error inline দেখায়। | B |
| 4.2.5 যুক্তিসঙ্গত action প্রধান দেখায় | – | Modal-এ সবচেয়ে যুক্তিসঙ্গত action (Delete, Switch) primary আর critical tone-এ | B |
| 4.2.6 Live preview | `Preview` component, editor আর preview পাশাপাশি | ✅ PASS (desktop-এ চোখে দেখে যাচাই করতে হবে) | B |
| 4.3.1 Outcome-এর দাবি না করা | "raises your average order value", "working hard for you" | **FIXED:** এই লেখাগুলো সরানো বা বদলানো হয়েছে | – |
| 4.3.2 Pressure না দেওয়া | Trial-এর বাকি দিন static লেখা হিসেবে দেখায়, কোনো animated timer নেই | ✅ PASS | – |
| 4.3.3 Distraction না রাখা | Pulse animation, unread badge-এর "pop" animation, লাল badge | **FIXED:** animation সরানো হয়েছে, লাল রং শুধু error-এর জন্য | – |
| 4.3.4 একসঙ্গে অনেক banner না দেখানো | Dashboard-এ trial আর embed warning, দুটো banner পাশাপাশি | **FIXED:** এখন সর্বোচ্চ একটি banner, embed status Status card-এ | – |
| 4.3.5 Shopify-এর মতো না দেখানো | Purple (#7c3aed), যা Shopify "magic"-এর মতো | **FIXED:** purple সরানো হয়েছে। App icon listing-এর সময় যাচাই করতে হবে | B |
| 4.3.6 Ad dismiss করা যায় | কোনো ad বা cross-promotion নেই। Trial banner শুধু account-এর status জানায় | ✅ PASS (reviewer একে promotional ধরে কিনা দেখতে হবে) | B |
| 4.3.7 Premium feature label ও disable | Markets আর Translations section enabled দেখাত | **FIXED:** `Locked` wrapper (`inert`, ঝাপসা) আর কোন plan লাগবে তা লেখা। Campaign type card-এ plan-এর badge। ⚠️ যে campaign type plan-এ নেই, সেটাও draft হিসেবে বানানো আর সেভ করা যায় (উপরে banner দিয়ে জানানো হয়)। Reviewer একে "interactive" ধরতে পারে, তাই manual review দরকার। | B |

## 5.5 Discount apps

| Req | অবস্থা |
|---|---|
| 5.5.1 Discount primitive ব্যবহার | ✅ PASS: discount Function (`extensions/cartkit-discounts`) আর automatic app discount |
| 5.5.2 Draft order দিয়ে discount না দেওয়া | ✅ PASS: draft order-এর কোনো কোড নেই |
| 5.5.3 একাধিক code-এর জন্য `discountRedeemCodeBulkAdd` | N/A: redeem code তৈরি করা হয় না |
| 5.5.4 "Create discount" থেকে আসা link | ✅ code: `ui.paths.create = "/app/campaigns/new"`, `type` না থাকলে `rewards` editor খোলে। Manual test: Discounts → Create discount → Cartivo। | 

## শ্রেণি অনুযায়ী সারাংশ

- **A (কোডে এখনই):** সব কাজ করা হয়েছে। শুধু TOML-এর নাম আর scope deploy করা বাকি।
- **B (manual test):** 4.1.1, 4.1.2, 4.1.5, 4.1.6, 4.2.1–4.2.6, 4.3.5–4.3.7, 5.5.4, 2.2.1। ধাপগুলো `TESTING_CHECKLIST.md`-এ আছে।
- **C (production measurement):** 2.1.1–2.1.3 (Dev Dashboard-এ Web Vitals), 2.2.1 (Lighthouse-এ আগে আর পরের তুলনা)।
- **D (launch-এর পরে):** 1.2.1–1.2.3।

## Eligibility কীভাবে দেখবেন
Partner Dashboard → Apps → Cartivo → **Distribution** পেজে BFS-এর প্রতিটি criterion-এর অবস্থা দেখা যায়। Web Vitals দেখা যায় Dev Dashboard-এ, অথবা App Bridge-এর Web Vitals API দিয়ে (`shopify.webVitals.onReport`)। Debug log দেখতে `<meta name="shopify-debug" content="web-vitals">` যোগ করুন (উৎস: https://shopify.dev/docs/apps/build/performance/admin-installation-oauth)।
