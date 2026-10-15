# বাকি কাজ — Cartivo

তারিখ: ২০২৬-১০-১৫ · Branch: `appstore-readiness` (local, push করা হয়নি)

## Status কোথায় আছে
| ধাপ | অবস্থা |
|---|---|
| **Code Ready** | ✅ কোডে যাচাই করা যায় এমন App Store requirement-এ কোনো FAIL বাকি নেই। BFS-এর কোড অংশ সম্পন্ন। |
| **Testing Ready** | ⏳ Automated check pass করেছে। Dev store-এ manual test **একটিও চালানো হয়নি**। |
| **App Store Submission Ready** | ❌ Deploy, manual test, listing, screencast, privacy policy আর emergency contact বাকি। |
| **Officially Approved** | ❌ Submit করা হয়নি। এটা Shopify ঠিক করবে। |
| **BFS Eligible** | ❌ Launch-এর পরে লাগবে: ৫০টি paid-plan install, ৫টি review, rating আর ২৮ দিনের Web Vitals। |
| **BFS Approved** | ❌ BFS-এর জন্য apply করার পরে Shopify ঠিক করবে। |

## Submit করার আগে (ক্রম অনুযায়ী)
1. **Branch review করে merge করুন।** `git log main..appstore-readiness` দেখুন। Push বা merge শুধু আপনি বললে হবে।
2. **Production-এ পুরোনো test subscription যাচাই করুন।** আগে কখনো production-এ `BILLING_TEST=true` set করা ছিল কিনা দেখুন। থাকলে real store-এ তৈরি হওয়া test subscription এখন আর গোনা হবে না, ফলে সেই merchant "No plan" দেখবে। Render-এর env history দেখে নিন, আর `BILLING_TEST` env মুছে দিন।
3. **Render env:** `NODE_ENV=production`, `BILLING_DISABLED` মুছে দিন বা unset রাখুন, `SUPPORT_INBOX_KEY` ≥ ৩২ অক্ষরের random, `SUPPORT_EMAIL` set করুন।
4. **DB migration:** deploy-এর সময় `prisma migrate deploy` চলবে, যা `20261015120000_setup_dismissed` apply করবে (শুধু একটি nullable column যোগ হয়, কোনো data বদলায় না)। আগে Neon-এ backup বা branch তৈরি করে রাখার সুপারিশ রইল।
5. **`shopify app deploy`:** নতুন নাম "Cartivo", scope থেকে `read_themes` বাদ, webhook `2026-10`, আর extension-এর পরিবর্তন release হবে। (Scope কমালে merchant-কে আবার অনুমতি দিতে হয় না।)
6. **Dev store-এ manual test** (`TESTING_CHECKLIST.md`)। বিশেষ করে দেখুন: add-on আর BXGY-তে consent, timer, product page-এর slim JSON (ছবিসহ এবং ছবি ছাড়া product), `app.extensions()` embed toggle, billing-এ approve, decline আর reinstall।
7. **Storefront Lighthouse-এ আগে আর পরের তুলনা** (`PERFORMANCE_AUDIT.md`)। ১০ পয়েন্টের বেশি কমলে `cartkit.js` minify করুন (মাপা লাভ: gz 17.2 থেকে 12.6 KB)।
8. **Listing** (`APP_STORE_SUBMISSION_CHECKLIST.md`): icon, screenshot, screencast, privacy policy, terms, pricing-এর লেখা, emergency contact।
9. Review পেজের automated check চালান, তারপর **Submit**। এটাও শুধু আপনার সিদ্ধান্তে।

## Manual review লাগবে এমন design ঝুঁকি
- **BFS 4.3.7:** Plan-এ নেই এমন campaign type-ও draft হিসেবে বানানো আর সেভ করা যায় (উপরে banner দিয়ে জানানো থাকে)। Reviewer একে "interactive premium feature" বললে editor-কে read-only বা preview mode করতে হবে।
- **BFS 4.3.6:** Trial banner-এর "Compare plans" button-কে promotional ধরলে banner-টি dismiss করার ব্যবস্থা আর সেই অবস্থা মনে রাখা লাগবে।
- **BFS 4.1.1:** Help-এর floating button আর panel custom UI। App Bridge-এর মতো না দেখালে reviewer আপত্তি করতে পারে।

## Launch-এর পরে (BFS)
1. Partner Dashboard → Distribution-এ BFS-এর প্রতিটি criterion দেখুন।
2. Dev Dashboard-এ Web Vitals: p75 LCP ≤ 2.5s, CLS ≤ 0.1, INP ≤ 200ms (২৮ দিনে কমপক্ষে ১০০টি load)।
3. Paid plan-এ থাকা shop থেকে ৫০টি net install, ৫টি review, minimum rating। Review চাওয়ার সময় নিরপেক্ষ ভাষা ব্যবহার করুন, কোনো incentive দেবেন না (App Store 1.3.1)।
4. সব শর্ত পূরণ হলে Distribution পেজ থেকে BFS-এর জন্য apply করুন।

## Technical debt (ঐচ্ছিক)
- প্রতি navigation-এ দুইবার `billing.check` হয়: request-scoped cache যোগ করা যায় (`PERFORMANCE_AUDIT.md`)।
- `npm audit`: upstream-এ fix এলে `prisma`, `@shopify/shopify_function` আর CLI tooling upgrade করুন।
- Support inbox-এর sign-in-এ rate limit যোগ করা।
- React 19-এ upgrade করলে `inert: ""`-এর বদলে `inert={true}` ব্যবহার করতে হবে (`app/components/ui.tsx`-এর `Locked`)।
