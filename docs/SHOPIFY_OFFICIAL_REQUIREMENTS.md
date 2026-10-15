# Shopify-র অফিসিয়াল requirement — উৎস ও যাচাইয়ের তারিখ

এই অডিটে যে অফিসিয়াল Shopify ডকুমেন্টেশন ব্যবহার করা হয়েছে, তার তালিকা। সব পেজ **২০২৬-১০-১৫** তারিখে Shopify CLI-র `shopify doc fetch` (Shopify AI Toolkit) দিয়ে সরাসরি shopify.dev থেকে আনা হয়েছে। কোনো third-party blog বা টিউটোরিয়াল ব্যবহার করা হয়নি।

| # | ডকুমেন্ট | URL | অবস্থা |
|---|---|---|---|
| 1 | App Store requirements | https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements | ✅ যাচাই করা হয়েছে |
| 2 | App Store AI self-review requirements (কোড দিয়ে যাচাই করা যায় এমন অংশ) | https://shopify.dev/docs/apps/launch/app-store-review/app-store-ai-self-review-requirements | ✅ |
| 3 | Built for Shopify requirements | https://shopify.dev/docs/apps/launch/built-for-shopify/requirements | ✅ |
| 4 | App review process | https://shopify.dev/docs/apps/launch/app-store-review/review-process | ✅ |
| 5 | Pass app review | https://shopify.dev/docs/apps/launch/app-store-review/pass-app-review | ✅ |
| 6 | Submit app for review | https://shopify.dev/docs/apps/launch/app-store-review/submit-app-for-review | ✅ |
| 7 | App quality | https://shopify.dev/docs/apps/build/app-quality | ✅ |
| 8 | Security | https://shopify.dev/docs/apps/build/security | ✅ |
| 9 | Privacy law compliance (compliance webhooks) | https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance | ✅ |
| 10 | Protected customer data | https://shopify.dev/docs/apps/launch/protected-customer-data | ✅ |
| 11 | Performance (overview) | https://shopify.dev/docs/apps/build/performance | ✅ |
| 12 | Admin, installation and OAuth performance (Web Vitals) | https://shopify.dev/docs/apps/build/performance/admin-installation-oauth | ✅ |
| 13 | Storefront performance | https://shopify.dev/docs/apps/build/performance/storefront | ✅ |
| 14 | App Store best practices (listing, app name branding, asset size) | https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices | ✅ |
| 15 | Billing | https://shopify.dev/docs/apps/launch/billing | ✅ |
| 16 | Billing API free trials ও development store | https://shopify.dev/docs/apps/launch/billing/manual-pricing/subscription-billing/offer-free-trials | ✅ (search_docs দিয়ে) |
| 17 | Theme app extension configuration (deep link, size limit) | https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration | ✅ |
| 18 | Token exchange / session tokens | https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/token-exchange | ✅ |
| 19 | API versioning | https://shopify.dev/docs/api/usage/versioning | ✅ |
| 20 | App Bridge `app.extensions()` API | https://shopify.dev/docs/api/app-home/apis/app | ✅ |
| 21 | Polaris `s-modal` | https://shopify.dev/docs/api/app-home/polaris-web-components/overlays/modal | ✅ |
| 22 | Polaris `s-banner` | https://shopify.dev/docs/api/app-home/polaris-web-components/feedback-and-status-indicators/banner | ✅ |
| 23 | App listing guidelines (আলাদা পেজ) | https://shopify.dev/docs/apps/launch/app-store-review/app-listing-guidelines | ⚠️ **Not Verified**: CLI এই URL আনতে পারেনি। listing-এর নিয়ম ১ ও ১৪ নম্বর পেজ থেকে নেওয়া হয়েছে। |
| 24 | Mandatory webhooks (পুরোনো URL) | https://shopify.dev/docs/apps/build/webhooks/mandatory-webhooks | ⚠️ **Not Verified**: URL আনা যায়নি। একই তথ্য ৯ নম্বর পেজে আছে এবং সেখান থেকেই নেওয়া হয়েছে। |

## এই অডিটের জন্য গুরুত্বপূর্ণ তথ্য (ডকুমেন্ট থেকে)

- **API version** (উৎস ১৯): ২০২৬-১০-১৫ তারিখে `2026-10` হলো *latest stable*, আর `2027-01` হলো *release candidate*। Release candidate production-এর জন্য সুপারিশ করা হয় না। প্রতিটি stable version কমপক্ষে ১২ মাস চলে।
- **`shop/redact`** (উৎস ৯): store owner অ্যাপ uninstall করার **৪৮ ঘণ্টা পরে** পাঠানো হয়। Compliance webhook-এ HMAC ভুল হলে অ্যাপকে `401` দিতে হবে।
- **Test charge** (উৎস ৫, ১৬): Billing API-তে `test: true` রেখে দিলে "app users who install your app aren't charged"। Development store চেনা যায় `shop.plan.partnerDevelopment` দিয়ে।
- **Theme app extension size** (উৎস ১৭): schema থেকে সরাসরি লোড হওয়া JS-এর জন্য compressed **10 KB** *suggested*, CSS-এর জন্য 100 KB *suggested*, আর সব Liquid মিলিয়ে 100 KB *enforced*।
- **App name** (উৎস ১, ১৪): সর্বোচ্চ ৩০ অক্ষর। Dev Dashboard (TOML) আর listing-এর নাম "similar" হতে হবে, অর্থাৎ নামগুলোতে একই শব্দ থাকতে হবে (requirement 4.1.1)।
- **Listing asset** (উৎস ১৪, ৬): icon 1200×1200 px (JPEG/PNG), feature image ও screenshot 1600×900 px (16:9), ৩ থেকে ৬টি desktop screenshot, app introduction ১০০ অক্ষর, app details ৫০০ অক্ষর, প্রতিটি feature ৮০ অক্ষর।
- **Storefront branding** (উৎস ১ req 5.1.4, উৎস ১৪): storefront-এ অ্যাপের নাম বা লোগো শুধু বিশেষ ক্ষেত্রে দেখানো যায়, বাকি সব জায়গায় standard attribution (২৪×২৪ px)।
- **BFS** (উৎস ৩): paid plan-এ থাকা active shop থেকে কমপক্ষে ৫০টি net install, কমপক্ষে ৫টি review, minimum rating; ২৮ দিনে কমপক্ষে ১০০টি call-এর ভিত্তিতে admin-এ p75 LCP ≤ 2.5s, CLS ≤ 0.1, INP ≤ 200ms; storefront Lighthouse score ১০ পয়েন্টের বেশি কমানো যাবে না।
