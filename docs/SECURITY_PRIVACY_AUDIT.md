# Security ও privacy audit — Cartivo

- **তারিখ:** ২০২৬-১০-১৫
- **উৎস:** https://shopify.dev/docs/apps/build/security, https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance, https://shopify.dev/docs/apps/launch/protected-customer-data
- **পদ্ধতি:** নিজে কোড পড়ে review, একটি আলাদা review agent দিয়ে পুরো branch-এর diff পর্যালোচনা, আর (commit `66fdb27`-এর পরে) production build-এ local HTTP smoke test (নিচে দেখুন)। কোনো penetration test বা production scan করা হয়নি, আর production DB বা production app-এ কোনো request পাঠানো হয়নি।

## সারাংশ

| বিষয় | অবস্থা | প্রমাণ বা মন্তব্য |
|---|---|---|
| OAuth / session token | ✅ | `@shopify/shopify-app-react-router` 3.0.2, managed install, token exchange, `expiringOfflineAccessTokens: true` (`app/shopify.server.ts`) |
| Admin route-এ authorization | ✅ | সব `app.*` loader/action-এ `authenticate.admin(request)` আছে। সব DB query `session.shop` দিয়ে scope করা (shop-ভিত্তিক data isolation)। |
| Webhook HMAC | ✅ | সব webhook route-এ `authenticate.webhook(request)` আছে। HMAC ভুল হলে library `401` দেয়, যা compliance doc-এর দাবি। |
| Compliance webhook | ✅ | TOML-এ `customers/data_request`, `customers/redact`, `shop/redact` subscribe করা। `app/routes/webhooks.compliance.tsx` `200` দেয়, আর `shop/redact` এলে সব shop data মুছে ফেলে (`deleteShopData`: campaign, event, settings, ticket, chat, trial)। Customer data রাখা হয় না, তাই customer-এর দুটো topic-এ কিছু মোছার দরকার হয় না। |
| App proxy | ✅ | `authenticate.public.appProxy` signature যাচাই করে। শুধু allowlist-এ থাকা event type নেওয়া হয়, প্রতি request-এ সর্বোচ্চ ২০টি, campaignId সর্বোচ্চ ৪০ অক্ষর। এই branch-এ ১২০ দিনের পুরোনো event মোছার ব্যবস্থা যোগ হয়েছে (commit `7f80d7d`)। |
| Support inbox (`/support/inbox`) | ✅ | `SUPPORT_INBOX_KEY` না থাকলে 404। Key মেলানো হয় `timingSafeEqual` দিয়ে। Cookie signed, `httpOnly`, `secure` (production), `sameSite: lax` (cross-site POST-এ cookie যায় না, তাই CSRF থেকে সুরক্ষিত), path `/support`। ⚠️ Sign-in-এ rate limit নেই, তাই key লম্বা আর random হতে হবে। |
| XSS (admin) | ✅ | React escape করে। `dangerouslySetInnerHTML` বা `innerHTML` ব্যবহার হয় না। |
| XSS (storefront) | ✅/⚠️ | Template-এর data `esc()` দিয়ে escape করা হয়। Merchant-এর "Custom HTML/JS" ইচ্ছাকৃতভাবে যেমন আছে তেমন চালানো হয়। এটা merchant নিজের store-এর জন্য লেখে, তাই এটা feature, vulnerability নয়। |
| SQL injection | ✅ | শুধু Prisma query builder ব্যবহার হয়, কোনো raw SQL নেই। |
| SSRF | ✅ | Outbound `fetch` শুধু `SUPPORT_WEBHOOK_URL`-এ (operator-এর env, user input নয়), 5s timeout সহ। |
| Secret | ✅ | `.env` gitignore-এ আছে। `.env.example`-এ শুধু placeholder। এই branch-এ কোনো secret commit করা হয়নি। |
| Logging | ✅ | Log-এ শুধু webhook topic আর shop domain থাকে। কোনো token বা payload log হয় না। |
| Billing bypass | ✅ FIXED | `BILLING_DISABLED` production-এ কাজ করে না। `BILLING_TEST` সরানো হয়েছে। Test charge হয় শুধু development store-এ (`shop.plan.partnerDevelopment`, ১০ মিনিটের cache)। Commit `7f80d7d`, `273d919`। |
| Billing error | ✅ FIXED | Plans পেজে `billing.request` বা `billing.cancel` ব্যর্থ হলে (Shopify-এর user error, network) আগে generic error page আসত। এখন লাল `ErrorBanner` দেখায়, plan অপরিবর্তিত থাকে, আর error log হয় (commit `66fdb27`)। Approve-এর redirect (`Response`) আগের মতো throw হয়। |
| Plan gating (server) | ✅ FIXED | Campaign save আর activate server-এও plan যাচাই করে, তাই UI এড়িয়ে সরাসরি POST করলেও plan-এ নেই এমন campaign type সেভ বা চালু হয় না (commit `66fdb27`)। Storefront-এ যা যায় তা আগের মতোই `planCampaigns` দিয়ে ছাঁকা হয়। |
| Billing callback | ✅ | Return URL-এ (`/app/pricing?upgraded=1`) কিছু বিশ্বাস করা হয় না। Plan সবসময় Shopify থেকে নতুন করে পড়া হয় (`billing.check`)। `app_subscriptions/update` webhook HMAC দিয়ে যাচাই করা। |
| Access scope | ✅ FIXED | `read_locales,read_products,write_app_proxy,write_discounts`। `read_themes` সরানো হয়েছে (commit `d81fbd3`)। কোনো protected customer data scope নেই। |
| HTTPS | ✅ (manual test) | Render managed TLS। TOML-এর সব URL `https://`। |
| Rate limit (Shopify API) | ⚠️ | Library-র GraphQL client ব্যবহার হয়। Throttle হলে আলাদা কোনো retry বা backoff নেই। Sync ব্যর্থ হলে error banner দেখায় (`trySync` → `syncError`)। কম ঝুঁকি। |
| Dependency | ⚠️ | নিচে দেখুন। |

## Protected customer data
অ্যাপ কোনো customer বা order data পড়ে না। Storefront শুধু `cart` (Liquid/Ajax) ব্যবহার করে, আর analytics event-এ কোনো PII নেই। Support ticket-এ merchant-এর নিজের email থাকে, যা customer data নয়। তাই **protected customer data-র জন্য আবেদন করার দরকার নেই**: submission-এর সময় "opt out" বেছে নিন (উৎস: submit-app-for-review, "Protected customer data")।

## Privacy policy-তে যা উল্লেখ করতে হবে
- Merchant-এর data: settings, campaign, analytics event (PII ছাড়া), support ticket (merchant-এর email), live chat।
- Third party: যদি `SUPPORT_WEBHOOK_URL` set করা থাকে, তাহলে নতুন ticket বা chat-এর সারাংশ (shop domain, subject বা message-এর প্রথম ৫০০ অক্ষর) Slack বা Discord-এ যায়।
- Data কতদিন থাকে: uninstall করার ৪৮ ঘণ্টা পরে `shop/redact` এলে সব মুছে ফেলা হয়। Analytics event থাকে সর্বোচ্চ প্রায় ১২০ দিন।

## `npm audit --omit=dev` (২০২৬-১০-১৫)
৩৭টি **high**, কোনো critical নেই। এগুলোর মূলে চারটি advisory:

| Package | কোথা থেকে আসে | Runtime-এ ঝুঁকি |
|---|---|---|
| `deepmerge-ts` <8 | `prisma` CLI → `@prisma/config` | কম: CLI বা config-এ ব্যবহার হয়, request-এর data এখানে পৌঁছায় না |
| `lodash` ≤4.17.23 | `@shopify/shopify_function` (Function build tooling) | কম: build-এর সময় ব্যবহার হয় |
| `@graphql-tools/utils` ≤12 | GraphQL codegen বা CLI tooling | কম |
| `braces` | file-glob tooling | কম |

`npm audit fix --force` চালালে breaking downgrade হয় (যেমন `prisma@6.12.0`), তাই সেটা করা **হয়নি**। Upstream-এ fix এলে সাধারণ upgrade করার সুপারিশ রইল।

## বাকি ঝুঁকি
- Support inbox-এর sign-in-এ rate limit নেই। Key কমপক্ষে ৩২ অক্ষরের random হওয়া উচিত।
- Production-এ আগে কখনো `BILLING_TEST=true` থাকলে, real store-এ তৈরি হওয়া test subscription এখন আর গোনা হবে না। Deploy করার আগে যাচাই করুন (`REMAINING_ACTIONS.md`)।

## Local production-mode smoke test (২০২৬-১০-১৫, commit `66fdb27`)
**Setup:** `npm run build`-এর server, `NODE_ENV=production`, ভুয়া `SHOPIFY_API_SECRET`, আর scratchpad-এ চালানো আলাদা Postgres 17.5 (`localhost:54329`)। ইচ্ছা করে `BILLING_DISABLED=true` আর `BILLING_TEST=true` দেওয়া ছিল, দেখার জন্য যে production-এ এগুলো কিছু খোলে না। Production DB, Render বা Shopify-এ কোনো request যায়নি। Browser-এর User-Agent ব্যবহার করা হয়েছে, কারণ library bot-এর request `410` দিয়ে আটকে দেয় (প্রথমবার Node-এর default UA-তে সব `410` এসেছিল, ওই ফলাফল গোনা হয়নি)।

| Test | ফলাফল |
|---|---|
| `/auth/login`-এ production-এ manual "Shop domain" form নেই | ✅ |
| `/app` আর `/app/help` session token ছাড়া app render করে না | ✅ |
| Embedded document request-এ জাল `id_token` | ✅ `302` → `/auth/session-token` (bounce), app render হয় না |
| `Authorization: Bearer <জাল token>` দিয়ে `/app/campaigns` | ✅ `401` |
| Compliance webhook, ভুল HMAC | ✅ `401`, আর কোনো data মোছেনি |
| Compliance webhook, HMAC header নেই | ✅ `400` (library বাতিল করে) |
| `customers/data_request`, `customers/redact` (ঠিক HMAC) | ✅ `200` |
| `shop/redact` (ঠিক HMAC) | ✅ `200`: ওই shop-এর Campaign, Event, ShopSettings, ShopTrial, SupportTicket, ChatMessage সব ০, অন্য shop-এর data অক্ষত |
| App proxy `/proxy/track`, জাল signature | ✅ `400`, কোনো event সেভ হয়নি |
| `/support/inbox`, key set নেই | ✅ `404` (বন্ধ) |
| `/storefront.css` | ✅ `200 text/css` |

মোট **১৯/১৯ pass**। Script: session scratchpad-এর `pg/smoke.mjs` (repo-তে রাখা হয়নি)।

**যা এখনো যাচাই বাকি:** Shopify-এর পাঠানো আসল webhook (dev app-এ `shopify app webhook trigger`), আসল session token দিয়ে admin flow, আর billing-এর approve বা decline। এগুলোর জন্য আলাদা dev app আর dev DB দরকার (`TESTING_CHECKLIST.md`)।
