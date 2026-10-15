# Testing checklist — Cartivo

## ১. Automated check (২০২৬-১০-১৫, local, Node 26.12, branch `appstore-readiness`, commit `66fdb27`)

| Check | Command | ফলাফল |
|---|---|---|
| TypeScript | `npm run typecheck` | ✅ কোনো error নেই |
| ESLint | `npm run lint` | ✅ কোনো error বা warning নেই |
| Unit test (buyer-protection rules + plan gating) | `node --test test/` | ✅ ১১/১১ pass (নতুন: `test/plans.test.ts`-এর ৪টি) |
| Discount Function test | `npm test --workspace extensions/cartkit-discounts` | ✅ ১৩/১৩ pass |
| মোট (`npm test`) | `npm test` | ✅ ২৪/২৪ |
| Discount Function build (Wasm) | `npm run build --workspace extensions/cartkit-discounts` | ✅ "Function built successfully" (`function.wasm` ১০.৭ KB) |
| Production build | `npm run build` | ✅ সফল |
| App config validation | `shopify app config validate` | ✅ "App configuration 'shopify.app.toml' is valid." |
| Theme check (extension) | `shopify theme check --path extensions/cartkit-theme` | ✅ ৩টি file, কোনো offense নেই |
| DB migration (আলাদা local Postgres 17.5, scratchpad-এ, production DB নয়) | `main`-এর schema → sample data → `migrate deploy` → যাচাই | ✅ পুরোনো row অপরিবর্তিত, নতুন column সব row-এ NULL, লেখা যায়; `migrate status` up to date; `migrate diff` "No difference detected" |
| Local production-mode security smoke test (`NODE_ENV=production`, ভুয়া secret, আলাদা local DB) | built server-এ HTTP request | ✅ ১৯/১৯ (বিস্তারিত `SECURITY_PRIVACY_AUDIT.md`) |
| Dependency audit | `npm audit --omit=dev` | ⚠️ ৩৭টি high, সবই build/CLI tooling-এর transitive dependency (`SECURITY_PRIVACY_AUDIT.md` দেখুন) |
| Code review | আলাদা review agent দিয়ে পুরো diff | ৬টি সমস্যা পাওয়া গেছে: ৫টি ঠিক করা হয়েছে (commit `273d919`), আর ১টি (পুরোনো `BILLING_TEST` subscription) production-এ যাচাই করতে হবে |

**যা চালানো হয়নি:** Development store (`cartivo-app-test.myshopify.com`)-এ install করা অ্যাপটা **production app** (Render, production Neon DB)। এই session-এ Shopify admin-এ login করা কোনো browser ছিল না, storefront password-protected, আর branch-এর code dev store-এ চালাতে হলে deploy বা `shopify app dev` লাগে (দুটোই production app-এর URL বা version বদলায়)। তাই নিচের manual test-গুলো **একটিও চালানো হয়নি**। কোনো ফলাফল বানিয়ে লেখা হয়নি।

## ২. Manual test (development store-এ)

**প্রস্তুতি:** একটি নতুন dev store (Dawn theme), কয়েকটি product (variant সহ, একটির দাম $0 নয় এমন add-on product), production-এর মতো build (`NODE_ENV=production`), `BILLING_DISABLED` unset। **নিরাপদ পথ:** Partner Dashboard-এ আলাদা একটি dev app (`shopify app config link` → `shopify.app.dev.toml`) আর Neon-এ একটি branch DB ব্যবহার করুন, যাতে `shopify app dev` production app-এর URL আর DB না ছোঁয়।
### Install / Auth
- [ ] Partner Dashboard বা Dev Dashboard থেকে install করুন। OAuth screen-এর পরে সরাসরি `/app` (Dashboard) খুলবে, OAuth-এর আগে কোনো UI দেখাবে না (2.3.2, 2.3.3)।
- [ ] Chrome incognito-তে (third-party cookie block করা) অ্যাপ খুলে সব পেজ ঘুরে দেখুন (1.1.1)।
- [ ] Browser-এ সরাসরি `https://cartivo-app.onrender.com/` আর `/auth/login` খুলুন। কোনো "Shop domain" field থাকবে না, শুধু "Shopify admin থেকে খুলুন" লেখা থাকবে (2.3.1)।
- [ ] Uninstall করে আবার install করুন। আবার OAuth হবে, কোনো error হবে না (2.3.4)।

### Billing (test charge)
- [ ] ৭ দিনের trial চলাকালীন Dashboard-এ কোনো trial banner নেই। ডান দিকের Plan card-এ "Free trial" আর "N days left" badge দেখায়। Plans পেজে trial-এর info banner থাকে (BFS 4.3.4, 4.3.6)।
- [ ] Plans পেজে subscription শুরু বা cancel ব্যর্থ হলে লাল banner দেখায় আর dismiss না করা পর্যন্ত থাকে (error page নয়)।
- [ ] Plans → Essential বেছে নিয়ে **approve** করুন। `/app/pricing?upgraded=1`-এ ফিরে আসবে, "Current plan" দেখাবে (1.2.2)।
- [ ] অন্য plan বেছে নিয়ে **decline** করুন। App ভাঙবে না, আগের plan থেকে যাবে।
- [ ] Growth-এ upgrade করুন, তারপর Starter-এ downgrade করুন। Modal-এ confirm চাইবে, subscription cancel হবে (1.2.3, BFS 4.1.6)। Shopify admin → Settings → Billing-এ charge history দেখুন।
- [ ] Uninstall করে আবার install করুন। আবার plan বেছে নেওয়া যাবে, কোনো error হবে না (1.2.2)।
- [ ] Production build-এ `BILLING_DISABLED=true` দিয়ে চালান। Billing এরপরও চালু থাকবে।

### Buyer consent (1.1.9, 1.1.4): **সবচেয়ে জরুরি**
- [ ] Add-on campaign (paid product) তৈরি করুন। Storefront-এ cart খুলুন: checkbox **untick** থাকবে, cart-এ কিছু যোগ হবে না। Tick করলে যোগ হবে, untick করলে সরে যাবে।
- [ ] BXGY 100% (free): "buy" product যোগ করলে "get" product নিজে থেকে যোগ হবে আর checkout-এ free হবে।
- [ ] BXGY 50%: editor-এ auto-add checkbox disabled থাকবে আর কারণ লেখা থাকবে। Storefront-এ কিছু নিজে থেকে যোগ হবে না, শুধু promo message দেখাবে। Shopper নিজে "get" product যোগ করলে checkout-এ 50% ছাড় পাবে।
- [ ] BXGY quantity: "buy"-এর quantity বাড়ালে বা কমালে auto-add করা free item-এর quantity ঠিকমতো বদলায়।
- [ ] Announcement countdown: "Offer ends at" না দিলে কোনো timer দেখাবে না। তারিখ দিলে সেই তারিখ পর্যন্ত countdown চলবে, আর আলাদা browser বা incognito-তেও একই সময় দেখাবে।
- [ ] Free gift goal: threshold পার হলে gift যোগ হবে ($0), threshold-এর নিচে নামলে সরে যাবে।

### Theme / storefront
- [ ] Dashboard → Status: embed বন্ধ থাকলে "App embed is off" আর "Turn on in theme editor" deep link দেখাবে। Theme editor-এ embed চালু হয়ে খুলবে। Save করে Dashboard reload করলে "Live on your store" দেখাবে (BFS 4.2.3)।
- [ ] Theme editor-এ embed **toggle off** করে save করুন, তারপর Dashboard-এ দেখুন status বদলায় কিনা। `app.extensions()` `active` status ঠিকমতো দেয় কিনা নিশ্চিত হতে হবে।
- [ ] Product page: sticky add-to-cart-এ variant, দাম, ছবি আর sold out ঠিক দেখায়। ছবিসহ এবং ছবি ছাড়া দুই ধরনের product-এ পরীক্ষা করুন, কারণ Liquid-এর slim JSON valid হতে হবে। Browser console-এ কোনো error থাকবে না।
- [ ] Volume discount block product page-এ যোগ করে tier দেখায় কিনা দেখুন।
- [ ] Mobile (৩৭৫ px): drawer, sticky bar আর floating cart ব্যবহার করা যায়।
- [ ] Custom JS-এ `Cartivo.on('cart:updated', ...)` আর পুরোনো `CartKit.on(...)` দুটোই কাজ করে।
- [ ] Uninstall করলে theme-এ কোনো code থাকে না।

### Admin UX (BFS)
- [ ] যেকোনো settings পেজে কিছু বদলালে CSB দেখায়। Save না করে অন্য পেজে যাওয়ার চেষ্টা করলে আটকায় (4.1.5)।
- [ ] Network বন্ধ করে, বা ভুল config দিয়ে, save ব্যর্থ করান। লাল banner থাকবে যতক্ষণ না dismiss করা হয় (4.2.4)।
- [ ] Setup guide → "Hide setup guide" চাপুন। Reload করলেও লুকানো থাকবে। Dashboard-এর Help card → "Show setup guide" চাপলে ফিরে আসবে (4.2.2)।
- [ ] Campaign delete করতে গেলে `s-modal` খুলবে। Cancel করলে কিছু হবে না, "Delete campaign" চাপলে মুছে যাবে (4.1.6)।
- [ ] Starter বা Essential plan-এ campaign editor-এর Markets আর Translations ঝাপসা দেখাবে, click বা keyboard দিয়ে ব্যবহার করা যাবে না, আর "Growth plan" link দেখাবে (4.3.7)।
- [ ] Starter-এ Sticky & floating cart পেজ ঝাপসা আর "Essential plan" link, storefront-এ sticky bar আর floating button দেখাবে না। Custom CSS Essential থেকে, Custom HTML/JS আর Languages Growth থেকে: নিচের plan-এ ঝাপসা, server save প্রত্যাখ্যান করে, storefront-এ publish হয় না।
- [ ] Cart drawer-এর look plan অনুযায়ী: Starter শুধু Minimal, Essential + Ocean/Forest, Growth + Sunset/Midnight, Premium + Aurora/Liquid glass (আর Liquid glass switch)। Plan-এর উপরের look ঝাপসা, lock badge-এ plan-এর নাম, server save প্রত্যাখ্যান করে, storefront-এ Minimal publish হয়।
- [ ] Essential plan-এ Campaigns → "Create another campaign": Upsell, Add-on, BXGY আর Volume card ঝাপসা, click করলে কিছু খোলে না, "Growth plan" বা "Premium plan" badge আর "See plans" link দেখায় (4.3.7)।
- [ ] Essential plan-এ browser-এ সরাসরি `/app/campaigns/new?type=volume` খুললে Campaigns পেজে ফিরে যায়।
- [ ] Trial-এ একটি BXGY campaign বানান, তারপর Essential বেছে নিন। Campaign editor read-only (ঝাপসা, Save disabled), উপরে "Needs the Growth plan" banner। Campaigns তালিকায় Deactivate আর Delete কাজ করে, Draft অবস্থায় Activate disabled।
- [ ] Starter plan-এ Campaigns-এর "Create campaign" button disabled, আর banner-এ লেখা আছে campaign-এর জন্য plan লাগবে।
- [ ] Starter plan-এ Cart drawer → Style: শুধু "Minimal" বেছে নেওয়া যায়। বাকি look (Aurora, Liquid glass, Sunset, Ocean, Forest, Midnight) ঝাপসা, click করলে কিছু হয় না, lock badge-এ "Essential" লেখা। Trial-এ Aurora বেছে নিয়ে তারপর Starter বেছে নিলে storefront-এর drawer Minimal দেখায়। Colors নিজে বদলানো ("custom") Starter-এও চলে।
- [ ] Nav → Help: FAQ, Live chat, Email us আর Your requests section Polaris-এর মতো দেখায়। কোনো floating button বা overlay নেই, কিছু নিজে থেকে খোলে না (4.1.1, 4.3.3)।
- [ ] Help → Email us: খালি form পাঠালে field-এ error দেখায়। ঠিকমতো পাঠালে toast "Message sent", আর "Your requests" table-এ নতুন row আসে।
- [ ] Help → Live chat: Growth বা trial-এ message পাঠানো যায় আর `/support/inbox`-এ পৌঁছায়। Essential-এ chat-এর কোনো control নেই, শুধু "Growth plan" badge আর "See plans" দেখায়।
- [ ] Trial শেষ, plan বেছে নেওয়া হয়নি (`choose`): Help পেজ খোলে, অন্য পেজ Plans-এ redirect করে।
- [ ] Discounts → Create discount → Cartivo চাপলে embedded campaign editor খুলবে (BFS 5.5.4)।
- [ ] Mobile admin (Shopify mobile app বা ৩৭৫ px): পুরো পেজে কোনো horizontal scroll নেই (4.1.2)।
- [ ] Nav-এ নাম "Cartivo", কাটা ছাড়া পুরোটা দেখায় (deploy করার পরে)।

### Compliance webhook
- [ ] `shopify app webhook trigger --topic shop/redact --address <url>/webhooks/compliance` চালালে `200` দেবে আর ওই shop-এর data মুছে যাবে। এটা **শুধু dev DB-তে** চালাবেন।
- [x] ভুল HMAC দিয়ে request পাঠালে `401` দেবে। **Local-এ যাচাই করা হয়েছে** (production build, ভুয়া secret, আলাদা DB)।
- [x] `customers/data_request` আর `customers/redact` → `200`। **Local-এ যাচাই করা হয়েছে।** Shopify-এর পাঠানো আসল webhook-এ এখনো পরীক্ষা বাকি।
