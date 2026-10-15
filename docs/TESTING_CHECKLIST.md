# Testing checklist — Cartivo

## ১. Automated check (২০২৬-১০-১৫, local, Node 26.12, branch `appstore-readiness`)

| Check | Command | ফলাফল |
|---|---|---|
| TypeScript | `npm run typecheck` | ✅ কোনো error নেই |
| ESLint | `npm run lint` | ✅ কোনো error বা warning নেই |
| Unit test (storefront buyer-protection rules) | `node --test test/` | ✅ ৭/৭ pass |
| Discount Function test | `npm test --workspace extensions/cartkit-discounts` | ✅ ১৩/১৩ pass |
| মোট (`npm test`) | `npm test` | ✅ ২০/২০ |
| Production build | `npm run build` | ✅ সফল |
| App config validation | `shopify app config validate` | ✅ "App configuration 'shopify.app.toml' is valid." |
| Theme check (extension) | `shopify theme check --path extensions/cartkit-theme` | ✅ ৩টি file, কোনো offense নেই |
| Dependency audit | `npm audit --omit=dev` | ⚠️ ৩৭টি high, সবই tooling-এর transitive dependency (`SECURITY_PRIVACY_AUDIT.md` দেখুন) |
| Code review | আলাদা review agent দিয়ে পুরো diff | ৬টি সমস্যা পাওয়া গেছে: ৫টি ঠিক করা হয়েছে (commit `273d919`), আর ১টি (পুরোনো `BILLING_TEST` subscription) production-এ যাচাই করতে হবে |

**যা চালানো হয়নি:** কোনো development store বা credential ছিল না, তাই নিচের manual test-গুলো **একটিও চালানো হয়নি**। কোনো ফলাফল বানিয়ে লেখা হয়নি।

## ২. Manual test (development store-এ)

**প্রস্তুতি:** একটি নতুন dev store (Dawn theme), কয়েকটি product (variant সহ, একটির দাম $0 নয় এমন add-on product), production-এর মতো build (`NODE_ENV=production`), `BILLING_DISABLED` unset।

### Install / Auth
- [ ] Partner Dashboard বা Dev Dashboard থেকে install করুন। OAuth screen-এর পরে সরাসরি `/app` (Dashboard) খুলবে, OAuth-এর আগে কোনো UI দেখাবে না (2.3.2, 2.3.3)।
- [ ] Chrome incognito-তে (third-party cookie block করা) অ্যাপ খুলে সব পেজ ঘুরে দেখুন (1.1.1)।
- [ ] Browser-এ সরাসরি `https://cartivo-app.onrender.com/` আর `/auth/login` খুলুন। কোনো "Shop domain" field থাকবে না, শুধু "Shopify admin থেকে খুলুন" লেখা থাকবে (2.3.1)।
- [ ] Uninstall করে আবার install করুন। আবার OAuth হবে, কোনো error হবে না (2.3.4)।

### Billing (test charge)
- [ ] ৭ দিনের trial চলাকালীন Dashboard-এ trial banner আছে, শুধু একটি।
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
- [ ] Setup guide → "Hide setup guide" চাপুন। Reload করলেও লুকানো থাকবে। Help → "Show setup guide" চাপলে ফিরে আসবে (4.2.2)।
- [ ] Campaign delete করতে গেলে `s-modal` খুলবে। Cancel করলে কিছু হবে না, "Delete campaign" চাপলে মুছে যাবে (4.1.6)।
- [ ] Starter বা Essential plan-এ campaign editor-এর Markets আর Translations ঝাপসা দেখাবে, click বা keyboard দিয়ে ব্যবহার করা যাবে না, আর "Growth plan" link দেখাবে (4.3.7)।
- [ ] Discounts → Create discount → Cartivo চাপলে embedded campaign editor খুলবে (BFS 5.5.4)।
- [ ] Mobile admin (Shopify mobile app বা ৩৭৫ px): পুরো পেজে কোনো horizontal scroll নেই (4.1.2)।
- [ ] Nav-এ নাম "Cartivo", কাটা ছাড়া পুরোটা দেখায় (deploy করার পরে)।

### Compliance webhook
- [ ] `shopify app webhook trigger --topic shop/redact --address <url>/webhooks/compliance` চালালে `200` দেবে আর ওই shop-এর data মুছে যাবে। এটা **শুধু dev DB-তে** চালাবেন।
- [ ] ভুল HMAC দিয়ে request পাঠালে `401` দেবে।
- [ ] `customers/data_request` আর `customers/redact` → `200`।
