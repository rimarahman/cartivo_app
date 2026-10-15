# Performance audit — Cartivo

- **তারিখ:** ২০২৬-১০-১৫
- **উৎস:** https://shopify.dev/docs/apps/launch/built-for-shopify/requirements (section 2), https://shopify.dev/docs/apps/build/performance/admin-installation-oauth, https://shopify.dev/docs/apps/build/performance/storefront, https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration (size limit)

> **কোনটা মাপা আর কোনটা অনুমান:** এই ডকুমেন্টের **মাপা** সংখ্যাগুলো এসেছে local build বা file size থেকে। কোনো development store বা production-এর access ছিল না, তাই **Web Vitals (LCP, CLS, INP) আর storefront Lighthouse score মাপা হয়নি**। এগুলো নিয়ে যা লেখা আছে তা অনুমান।

## BFS-এর লক্ষ্য
- Admin: p75 LCP ≤ 2.5s, CLS ≤ 0.1, INP ≤ 200ms (২৮ দিনে কমপক্ষে ১০০টি call)
- Storefront: Lighthouse score ১০ পয়েন্টের বেশি কমানো যাবে না
- Checkout: N/A (কোনো carrier service নেই)

## মাপা ফলাফল

### Theme app extension asset (`git show`, gzip -9)
| File | `main` (`5a2ed54`) | `appstore-readiness` | মন্তব্য |
|---|---|---|---|
| `cartkit.js` | 64,092 B, gz 16,748 B | 64,958 B, gz 17,355 B | নতুন comment আর `img()`-এর fix-এর কারণে প্রায় ৬০০ B (gz) বেড়েছে |
| `cartkit.css` | 29,314 B, gz 6,194 B | 29,314 B, gz 6,192 B | প্রায় অপরিবর্তিত |
| `cartkit-embed.liquid` | 1,666 B | 2,743 B | Template বড় হয়েছে, কিন্তু **render হওয়া** product JSON অনেক ছোট (নিচে দেখুন) |

**Minify করলে (esbuild, মাপা):** `cartkit.js` gz 17.2 KB থেকে **12.6 KB** (প্রায় ২৭% কম), `cartkit.css` gz 6.2 থেকে 5.6 KB। Shopify-এর *suggested* সীমা schema থেকে লোড হওয়া JS-এর জন্য compressed 10 KB। Cartivo-র JS schema-র `javascript` key দিয়ে নয়, `asset_url` দিয়ে `defer` হয়ে লোড হয়, তবে নিয়মের মূল উদ্দেশ্য এখানেও প্রযোজ্য।
**সিদ্ধান্ত:** এই branch-এ minify **করা হয়নি**। Minify করলে source file আলাদা রাখতে হবে আর একটা build step যোগ করতে হবে, যেটা `shopify app dev`-এর workflow বদলে দেয়। লাভ মাত্র প্রায় ৪.৬ KB (gz), আর JS `defer` হওয়ায় render আটকায় না। Lighthouse-এ মাপার পরে প্রয়োজন হলে করার সুপারিশ রইল (`REMAINING_ACTIONS.md`)।

### Admin bundle (`npm run build`, মাপা)
- `entry.client`: 140 KB (gz 45 KB), `jsx-runtime` chunk: 129 KB (gz 44 KB), `admin.css`: 22 KB (gz 4.9 KB)। মোট client asset প্রায় 399 KB। এগুলো React Router আর React-এর framework-এর অংশ, Cartivo-র code ছোট।

## এই branch-এর optimization

| পরিবর্তন | প্রভাব | ধরন |
|---|---|---|
| Dashboard আর theme-এর `settings_data.json` পড়ে না (embed status এখন `app.extensions()` দিয়ে) | প্রতিবার Dashboard লোডে Admin GraphQL-এ একটি call কম, তাই server response দ্রুত হওয়ার কথা (LCP) | অনুমান |
| Support panel খুললে আর theme পড়া হয় না | একটি GraphQL call কম | মাপা (কোড) |
| Product page-এ `{{ product \| json }}`-এর বদলে শুধু দরকারি field (title, image, variant-এর id/title/available/price/compare_at_price/image) | Description, options, media, tags ইত্যাদি বাদ পড়ে, তাই HTML ছোট হয় আর parse কম লাগে। বড় description-ওয়ালা product-এ কয়েক KB থেকে দশ KB পর্যন্ত কমার কথা | অনুমান (store-এ মাপতে হবে) |
| প্রতি সেকেন্ডের countdown interval এখন শুধু countdown চালু থাকলে চলে | বেশিরভাগ store-এ প্রতি সেকেন্ডে DOM query বন্ধ হয় (CPU/INP) | মাপা (কোড) |
| Admin-এ animation (pulse, pop) সরানো, Dashboard থেকে gradient hero সরানো | Paint কমে, layout sizing সহজ হয় (CLS/LCP) | অনুমান |

## ঝুঁকি ও সুপারিশ (অনুমান, মাপতে হবে)
1. **Render cold start:** `/healthz` আছে, যা uptime pinger-এর জন্য ইঙ্গিত দেয় যে free বা spin-down instance ব্যবহার হতে পারে। Cold start-এ প্রথম load কয়েক সেকেন্ড লাগতে পারে, যা LCP-এর p75 নষ্ট করবে। **সুপারিশ:** এমন paid instance যা কখনো sleep করে না।
2. **Neon cold start / latency:** Compute scale-to-zero থাকলে প্রথম query ধীর হয়। **সুপারিশ:** production-এ autosuspend বন্ধ রাখা, আর Render আর Neon একই region-এ রাখা। Pooled `DATABASE_URL` ইতিমধ্যে ব্যবহার হচ্ছে।
3. **প্রতি navigation-এ দুইবার `billing.check`:** `app.tsx`-এর loader আর পেজের loader দুটোই `getPlan` call করে, তাই দুটো GraphQL call হয়। Request-scoped memo দিয়ে একটা call বাঁচানো যায়। এই branch-এ করা হয়নি, কারণ দুই loader একই `Request` object পায় কিনা যাচাই করা দরকার।
4. **Inline `{{ cart | json }}`:** বড় cart-এ HTML বড় হয়। এখনো যেমন আছে তেমন রাখা হয়েছে, কারণ এটা না থাকলে প্রথম render-এর জন্য `/cart.js` request লাগত।
5. **Live chat polling:** Growth বা Premium plan-এ Help panel বন্ধ থাকলেও ধীর গতিতে polling চলে। Server load সামান্য বাড়ে, Web Vitals-এ প্রভাব নেই।

## যেভাবে মাপবেন
- **Admin:** App Bridge-এর Web Vitals (`shopify.webVitals.onReport`) বা debug meta `<meta name="shopify-debug" content="web-vitals">`। Dev Dashboard-এর Web Vitals ২৮ দিনের data দেখায়।
- **Storefront:** Dev store-এ (Dawn theme, Shopify-এর benchmark product CSV) embed **বন্ধ** আর **চালু** অবস্থায় mobile Lighthouse ৩–৫ বার চালিয়ে median score তুলনা করুন। পার্থক্য ১০ পয়েন্টের কম হতে হবে। Product page, collection আর home তিনটাই মাপুন।
