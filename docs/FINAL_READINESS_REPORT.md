# Final readiness report — Cartivo

- **তারিখ:** ২০২৬-১০-১৫
- **Branch:** `appstore-readiness` (শুধু local। Push, merge, deploy বা submit কিছুই করা হয়নি। `main` অপরিবর্তিত।)
- **উৎস:** https://shopify.dev/docs/apps/launch/built-for-shopify/requirements, https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements, https://shopify.dev/docs/apps/design (২০২৬-১০-১৫ তারিখে যাচাই করা। Shopify Dev MCP connect হয়নি, তাই docs সরাসরি পড়া হয়েছে।)

> **চিহ্ন:** ✅ = এই session-এ সত্যিই চালানো বা যাচাই করা · 🔒 = access না থাকায় চালানো যায়নি · ⏳ = বাকি কাজ। কোনো ফলাফল অনুমান করে "pass" লেখা হয়নি।

## ০. Environment (Phase 1-এর ফলাফল)

| প্রশ্ন | উত্তর |
|---|---|
| Branch ও working tree | `appstore-readiness`, শুরুতে clean। আগের ৭টি commit (`d85fa7b` … `1d45b53`) review করা হয়েছে। |
| App config | একটাই: `shopify.app.toml`, client_id `fbeacb55…`, URL `https://cartivo-app.onrender.com`। এটাই **production app**। |
| Dev store | `cartivo-app-test.myshopify.com` (`.shopify/project.json`)। এখানে production app install করা, যেটা Render থেকে চলে। |
| Backend | Hosted (Render)। Local dev server চালু নেই। |
| Database | ⚠️ Local `.env` আর `.env.render`-এর `DATABASE_URL` আর `DIRECT_URL` **হুবহু এক** (hash মিলিয়ে যাচাই করা, মান দেখানো হয়নি)। মানে local dev আর production একই Neon DB। |
| ঝুঁকি | এখন `shopify app dev` চালালে production DB-তে migration চলবে, production app-এর URL tunnel-এ বদলাবে, আর extension-এর dev preview বসবে। তাই এই session-এ `shopify app dev` **চালানো হয়নি**। আপনি জানিয়েছেন, অ্যাপ এখনো publish হয়নি তাই এটা ব্যবহার করা যায়, আর publish-এর আগে cleanup করবেন। তবু login করা browser না থাকায় এটা চালিয়ে কোনো লাভ হতো না। |
| Secret | কোনো `.env` file কখনো commit হয়নি (`git log --all`)। শেষ ৫০টি commit-এ কোনো token বা DB credential নেই। |

## ১. App Store compliance status
**Code: কোনো FAIL বাকি নেই।** বিস্তারিত `APP_STORE_COMPLIANCE_AUDIT.md`-এ। এই session-এ নতুন যা হয়েছে:
- Plans পেজে billing request বা cancel ব্যর্থ হলে আর error page আসে না। লাল banner দেখায়, plan অপরিবর্তিত থাকে (1.2.x billing UX)।
- Buyer consent (1.1.9), session token auth (2.3.x), compliance webhook (HMAC `401`, `shop/redact`-এ data মোছা) local production build-এ ✅ HTTP দিয়ে যাচাই করা।

**Submission-এর আগে বাকি (code নয়):** deploy, dev store-এ manual test, listing (icon, screenshot, screencast), privacy policy, emergency contact (`APP_STORE_SUBMISSION_CHECKLIST.md`)।

## ২. Built for Shopify readiness
**Code অংশ সম্পন্ন।** এই session-এ তিনটি বাকি ঝুঁকি ঠিক করা হয়েছে (commit `66fdb27`):

| Req | আগে | এখন |
|---|---|---|
| 4.3.7 Premium feature disable | Plan-এ নেই এমন campaign type বানানো আর সেভ করা যেত | Grid-এ ঝাপসা, link নয়, lock badge-এ plan-এর নাম আর "See plans"। নতুন বানানোর URL redirect করে। পুরোনো campaign read-only, Save disabled। Server save আর activate প্রত্যাখ্যান করে। Deactivate আর delete চলে। Starter-এ "Create campaign" disabled। |
| 4.3.6 / 4.3.4 Promotional banner | Dashboard-এ trial banner, "Compare plans" button সহ, dismiss করা যেত না | Banner সরানো হয়েছে। একই তথ্য Plan card-এ, যেটা banner নয়। Plans পেজের trial banner-এ কোনো button নেই, শুধু account-এর অবস্থা জানায়। |
| 4.1.1 / 4.3.3 Admin-এর মতো দেখতে | প্রতিটি পেজে custom floating "Help" button, gradient header-যুক্ত overlay panel | Nav-এ Polaris **Help** পেজ (FAQ, Live chat, Email us, Your requests)। কোনো floating element বা overlay নেই, কিছু নিজে থেকে খোলে না। |

**BFS eligibility:** ❌ এখনো নয়। লাগবে ৫০টি paid install, ৫টি review, rating, আর ২৮ দিনের admin Web Vitals (`BFS_READINESS_AUDIT.md`)।

## ৩. বাকি manual test
পুরো তালিকা `TESTING_CHECKLIST.md` § ২-এ। সবচেয়ে জরুরি:
1. Buyer consent: add-on untick থাকে, BXGY 50% auto-add হয় না, BXGY 100% হয়।
2. Billing: approve, decline, upgrade, downgrade (modal), reinstall, test charge শুধু dev store-এ।
3. নতুন 4.3.7 আচরণ: Essential plan-এ locked card, read-only editor, Activate disabled।
4. Help পেজ: email form, live chat, locked chat।
5. Embed status (`app.extensions()`) on আর off, theme editor deep link।
6. Product page-এর slim JSON (ছবিসহ এবং ছবি ছাড়া product), mobile (৩৭৫ px)।
7. Discounts → Create discount → Cartivo (5.5.4)। Starter-এ এটা Campaigns পেজে যায়।
8. Uninstall আর reinstall (শুধু আপনার অনুমতিতে)।

## ৪. Development store test results
| Area | ফলাফল |
|---|---|
| Install, auth, embedded navigation, Dashboard, onboarding | 🔒 Shopify admin-এ login করা browser ছিল না |
| Theme embed activation ও detection | 🔒 একই কারণ |
| Cart drawer, add to cart, upsell, paid add-on consent, free gift, BXGY, quantity, discount | 🔒 Storefront password-protected (`/` → `302 /password`), আর সেখানে deploy করা পুরোনো extension চলে, branch-এর নয় |
| Campaign create, edit, delete | 🔒 (Admin UI)। Server-side plan gating code review আর unit test দিয়ে ✅ |
| Mobile responsiveness | 🔒 |
| Billing plans, trial, upgrade, downgrade, decline | 🔒 Code review ✅, unit test ✅ (`test/plans.test.ts`)। আসল charge flow চালানো হয়নি। |
| `read_themes` বাদ দেওয়ার প্রভাব | ✅ Code: কোনো জায়গায় `theme`/`asset` GraphQL query নেই, embed status `app.extensions()` দিয়ে (scope লাগে না)। 🔒 Store-এ চোখে দেখে যাচাই বাকি। |
| Uninstall, reinstall | 🔒 করা হয়নি (অনুমতি লাগবে) |

**Dev store-এ কোনো test চালানো হয়নি।**

## ৫. Security ও billing findings
- ✅ **Local smoke test ১৯/১৯** (production build, আলাদা Postgres): জাল session token → `401`, জাল `id_token` → bounce, compliance webhook ভুল HMAC → `401` আর কিছু মোছে না, `shop/redact` শুধু ওই shop-এর সব data মোছে, জাল app-proxy signature → `400` আর কিছু সেভ হয় না, production-এ manual login form নেই (`SECURITY_PRIVACY_AUDIT.md`)।
- ✅ **Billing:** production-এ test charge শুধু `partnerDevelopment` store-এ। `BILLING_DISABLED` আর `BILLING_TEST` production-এ কিছু খোলে না (code review, আর smoke test-এ দুটোই set ছিল)। Return URL-এ কিছু বিশ্বাস করা হয় না।
- ✅ **FIXED:** billing error এখন persistent banner। Plan gating server-এও প্রয়োগ হয়।
- ✅ **DB migration** (`20261015120000_setup_dismissed`): আলাদা local Postgres 17.5-এ `main`-এর schema, তারপর sample data, তারপর migration। পুরোনো row অক্ষত, নতুন column NULL, `migrate diff`-এ কোনো drift নেই। শুধু একটি nullable column যোগ হয়, কিছু মোছে না।
- ⚠️ `npm audit --omit=dev`: ৩৭টি high, সবই build বা CLI tooling-এ (`prisma` CLI → `deepmerge-ts`, `@shopify/shopify_function` → `lodash`, `@graphql-tools/utils`, `braces`)। Request-এর পথে নেই। Breaking change ছাড়া কোনো fix নেই।
- ⚠️ **Environment:** local আর production একই DB ব্যবহার করে (উপরে § ০)। Submission-এর আগে আলাদা করা উচিত।
- ⚠️ Declined charge আর আসল billing error dev store-এ চালানো হয়নি (🔒)।

## ৬. Performance measurement
| মাপ | ফলাফল |
|---|---|
| `cartkit.js` | main gz 16,747 B → branch gz 17,355 B (+৬০৮ B) |
| `cartkit.css` | অপরিবর্তিত (gz ৬.২ KB) |
| `cartkit-embed.liquid` (template) | 1,666 → 2,743 B। Render হওয়া HTML ছোট হওয়ার কথা (পুরো `product \| json`-এর বদলে কয়েকটা field), কিন্তু store-এ মাপা যায়নি। |
| Admin client asset মোট | প্রায় 399 KB → **392 KB**। `admin.css` 22 → 16 KB। Support UI (9.8 KB) এখন শুধু Help পেজে লোড হয়। |
| Admin background polling | আগে প্রতিটি পেজে প্রতি ৩০ সেকেন্ডে chat poll হতো, এখন শুধু Help পেজ খোলা থাকলে। |
| Storefront Lighthouse (আগে ও পরে) | 🔒 মাপা হয়নি: storefront password-protected, আর branch-এর extension deploy করা নেই |
| Admin Web Vitals | 🔒 মাপা হয়নি: launch-এর পরে Dev Dashboard-এ দেখা যাবে |
| Theme extension loading | ✅ Code: JS `defer`, CSS `asset_url` দিয়ে। Theme Check-এ কোনো offense নেই। |

## ৭. Changed files (commit `66fdb27` আর docs commit)
**Code:**
- `app/routes/app.campaigns.$id.tsx`: locked type redirect, server-side save রোধ, read-only editor
- `app/routes/app.campaigns._index.tsx`: server-side activate রোধ, locked হলে Activate disabled, Starter-এর লেখা, "Create campaign" disabled
- `app/components/ui.tsx`: `Locked` stacked mode, locked campaign-type card
- `app/routes/app._index.tsx`: trial banner সরানো, Help link
- `app/routes/app.help.tsx` (নতুন): Polaris Help পেজ, loader আর action
- `app/components/LiveChat.tsx`: Polaris দিয়ে chat, locked অবস্থা
- `app/routes/app.tsx`: nav-এ Help, floating widget সরানো
- `app/routes/app.pricing.tsx`: billing error banner
- `app/styles/admin.css`: floating panel-এর CSS সরানো, locked card-এর CSS
- `app/shopify.server.ts`, `app/routes/app.chat.tsx`, `app/lib/support.ts`, `app/models/chat.server.ts`, `app/models/support.server.ts`, `app/components/useEmbedStatus.ts`: comment
- মুছে ফেলা: `app/components/SupportWidget.tsx`, `app/routes/app.support.tsx`
- `test/plans.test.ts` (নতুন)

**Docs:** `FINAL_READINESS_REPORT.md` (নতুন), `BFS_READINESS_AUDIT.md`, `TESTING_CHECKLIST.md`, `SECURITY_PRIVACY_AUDIT.md`, `PERFORMANCE_AUDIT.md`, `REMAINING_ACTIONS.md`

## ৮. Local commit
আগের ৭টি: `d85fa7b`, `aac60f0`, `d81fbd3`, `7f80d7d`, `f889399`, `273d919`, `1d45b53`
এই session-এ:
- `66fdb27` BFS: lock plan-gated campaign types, drop the dashboard trial banner, move support to a Help page
- docs commit (এই report সহ)

## ৯. বাকি blocker
1. **আলাদা test environment নেই।** Dev app (`shopify.app.dev.toml`) আর Neon branch DB তৈরি করুন (`REMAINING_ACTIONS.md` ধাপ ০)।
2. **Dev store-এ কোনো manual test হয়নি।** বিশেষ করে buyer consent, billing আর নতুন 4.3.7 ও Help পেজ।
3. **Deploy হয়নি।** নাম "Cartivo", `read_themes` বাদ, webhook `2026-10` আর সব extension-এর পরিবর্তন এখনো live নয়।
4. **Storefront Lighthouse-এ আগে আর পরের তুলনা হয়নি।**
5. **Listing asset:** icon, screenshot, screencast, privacy policy, emergency contact।
6. Production-এ পুরোনো `BILLING_TEST` subscription আছে কিনা যাচাই করা।

## ১০. GO / NO-GO
**App Store submission: NO-GO (এখনই নয়)।**
Code-এর দিক থেকে প্রস্তুত: কোনো জানা compliance FAIL নেই, BFS-এর design ঝুঁকিগুলো ঠিক করা হয়েছে, সব automated check pass। কিন্তু অ্যাপের মূল flow (install, billing, buyer consent, storefront) একবারও আসল store-এ চালানো হয়নি, আর submit করা version-টা এখনো deploy হয়নি। Shopify reviewer এই flow-গুলোই প্রথমে পরীক্ষা করে।

**GO-এর শর্ত:** blocker ১–৩ আর ৫ শেষ হলে, এবং `TESTING_CHECKLIST.md`-এর "Buyer consent" আর "Billing" section পুরোপুরি pass করলে submit করা যায়।
