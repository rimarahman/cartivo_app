import { test } from "node:test";
import assert from "node:assert/strict";
import { cartLinesDiscountsGenerateRun, cartDeliveryOptionsDiscountsGenerateRun } from "../src/index.js";

const P = (n) => `gid://shopify/Product/${n}`;
const V = (n) => `gid://shopify/ProductVariant/${n}`;
const line = (id, product, variant, qty, price, gift) => ({
  id: `gid://shopify/CartLine/${id}`,
  quantity: qty,
  cost: { amountPerQuantity: { amount: String(price) }, subtotalAmount: { amount: String(price * qty) } },
  gift: gift ? { value: gift } : null,
  merchandise: { __typename: "ProductVariant", id: V(variant), product: { id: P(product) } },
});
const input = (lines, config, rate = "1.0") => ({
  presentmentCurrencyRate: rate,
  cart: { lines, deliveryGroups: [{ id: "gid://shopify/CartDeliveryGroup/1" }] },
  discount: { discountClasses: ["PRODUCT", "ORDER", "SHIPPING"], metafield: { jsonValue: config } },
});
const rewards = {
  rewards: [{
    id: "c1", basis: "subtotal",
    tiers: [
      { id: "t1", threshold: 50, type: "free_shipping", value: 100, label: "Free shipping" },
      { id: "t2", threshold: 100, type: "free_gift", value: 100, label: "Free gift", giftVariantIds: [V(99)] },
      { id: "t3", threshold: 150, type: "percent_off", value: 10, label: "10% off" },
    ],
  }],
};

test("gift is free only when tier unlocked", () => {
  const locked = cartLinesDiscountsGenerateRun(input([line(1, 1, 1, 1, 60), line(2, 9, 99, 1, 20, "c1:t2")], rewards));
  assert.equal(locked.operations.length, 0);
  const open = cartLinesDiscountsGenerateRun(input([line(1, 1, 1, 2, 60), line(2, 9, 99, 1, 20, "c1:t2")], rewards));
  const c = open.operations[0].productDiscountsAdd.candidates;
  assert.equal(c.length, 1);
  assert.deepEqual(c[0].targets[0].cartLine, { id: "gid://shopify/CartLine/2", quantity: 1 });
});

test("gift with wrong variant is not discounted", () => {
  const r = cartLinesDiscountsGenerateRun(input([line(1, 1, 1, 2, 60), line(2, 9, 55, 1, 20, "c1:t2")], rewards));
  assert.equal(r.operations.length, 0);
});

test("thresholds respect presentment currency rate", () => {
  // 120 in presentment currency at rate 2 = 60 shop currency -> gift tier (100) locked
  const r = cartLinesDiscountsGenerateRun(input([line(1, 1, 1, 1, 120), line(2, 9, 99, 1, 20, "c1:t2")], rewards, "2.0"));
  assert.equal(r.operations.length, 0);
});

test("order percent tier", () => {
  const r = cartLinesDiscountsGenerateRun(input([line(1, 1, 1, 1, 200)], rewards));
  const op = r.operations.find((o) => o.orderDiscountsAdd);
  assert.equal(op.orderDiscountsAdd.candidates[0].value.percentage.value, 10);
});

test("free shipping", () => {
  assert.equal(cartDeliveryOptionsDiscountsGenerateRun(input([line(1, 1, 1, 1, 40)], rewards)).operations.length, 0);
  const r = cartDeliveryOptionsDiscountsGenerateRun(input([line(1, 1, 1, 1, 50)], rewards));
  assert.equal(r.operations[0].deliveryDiscountsAdd.candidates[0].value.percentage.value, 100);
});

test("buy 2 get 1 free, same product", () => {
  const cfg = { bxgy: [{ id: "b", buyProductIds: [P(1)], buyQuantity: 2, getProductIds: [P(1)], getQuantity: 1, percent: 100 }] };
  const r = cartLinesDiscountsGenerateRun(input([line(1, 1, 1, 3, 10)], cfg));
  assert.equal(r.operations[0].productDiscountsAdd.candidates[0].targets[0].cartLine.quantity, 1);
  assert.equal(cartLinesDiscountsGenerateRun(input([line(1, 1, 1, 2, 10)], cfg)).operations.length, 0);
});

test("buy X get Y different product", () => {
  const cfg = { bxgy: [{ id: "b", buyProductIds: [P(1)], buyQuantity: 1, getProductIds: [P(2)], getQuantity: 1, percent: 50 }] };
  const r = cartLinesDiscountsGenerateRun(input([line(1, 1, 1, 2, 10), line(2, 2, 2, 3, 5)], cfg));
  const c = r.operations[0].productDiscountsAdd.candidates[0];
  assert.equal(c.targets[0].cartLine.quantity, 2);
  assert.equal(c.value.percentage.value, 50);
});

test("volume tiers per product and mix & match", () => {
  const tiers = [{ minQuantity: 2, percent: 10 }, { minQuantity: 3, percent: 15 }];
  const per = { volume: [{ id: "v", productIds: [], combineProducts: false, tiers }] };
  const r = cartLinesDiscountsGenerateRun(input([line(1, 1, 1, 3, 10), line(2, 2, 2, 1, 10)], per));
  const c = r.operations[0].productDiscountsAdd.candidates;
  assert.equal(c.length, 1);
  assert.equal(c[0].value.percentage.value, 15);
  const mix = { volume: [{ id: "v", productIds: [], combineProducts: true, tiers }] };
  const r2 = cartLinesDiscountsGenerateRun(input([line(1, 1, 1, 1, 10), line(2, 2, 2, 1, 10)], mix));
  assert.equal(r2.operations[0].productDiscountsAdd.candidates.length, 2);
});

test("schedule by shop-local date", () => {
  const cfg = { volume: [{ id: "v", productIds: [], tiers: [{ minQuantity: 1, percent: 10 }], startDate: "2026-10-20", endDate: "2026-10-31" }] };
  const at = (date) => ({ ...input([line(1, 1, 1, 1, 10)], cfg), shop: { localTime: { date } } });
  assert.equal(cartLinesDiscountsGenerateRun(at("2026-10-15")).operations.length, 0);
  assert.equal(cartLinesDiscountsGenerateRun(at("2026-10-20")).operations.length, 1);
  assert.equal(cartLinesDiscountsGenerateRun(at("2026-11-01")).operations.length, 0);
});

test("empty config is a no-op", () => {
  const i = input([line(1, 1, 1, 1, 10)], null);
  i.discount.metafield = null;
  assert.deepEqual(cartLinesDiscountsGenerateRun(i), { operations: [] });
});

test("markets: campaign limited to countries", () => {
  const cfg = { ...rewards, rewards: [{ ...rewards.rewards[0], countries: ["US", "CA"] }] };
  const at = (isoCode) => ({ ...input([line(1, 1, 1, 1, 60)], cfg), localization: { country: { isoCode }, language: { isoCode: "EN" } } });
  assert.equal(cartDeliveryOptionsDiscountsGenerateRun(at("US")).operations.length, 1);
  assert.equal(cartDeliveryOptionsDiscountsGenerateRun(at("FR")).operations.length, 0);
});

test("markets: fixed amount per currency overrides conversion", () => {
  const tiers = [{ id: "t1", threshold: 50, type: "free_shipping", value: 100, label: "Free shipping", thresholds: { EUR: 45 } }];
  const cfg = { rewards: [{ id: "c1", basis: "subtotal", tiers }] };
  const eur = (amount) => {
    const i = input([line(1, 1, 1, 1, amount)], cfg, "0.9");
    i.cart.cost = { subtotalAmount: { currencyCode: "EUR" } };
    return cartDeliveryOptionsDiscountsGenerateRun(i).operations.length;
  };
  // Converted threshold would be 45 EUR at rate 0.9 too; use 1.2 to prove the fixed amount wins.
  const eur12 = (amount) => {
    const i = input([line(1, 1, 1, 1, amount)], cfg, "1.2");
    i.cart.cost = { subtotalAmount: { currencyCode: "EUR" } };
    return cartDeliveryOptionsDiscountsGenerateRun(i).operations.length;
  };
  assert.equal(eur(44), 0);
  assert.equal(eur(45), 1);
  assert.equal(eur12(46), 1, "46 EUR >= fixed 45 EUR even though 50 USD * 1.2 = 60 EUR");
});

test("markets: discount label in the buyer's language", () => {
  const tiers = [{ id: "t1", threshold: 10, type: "free_shipping", value: 100, label: "Free shipping", labels: { fr: "Livraison gratuite", "pt-br": "Frete grátis" } }];
  const cfg = { rewards: [{ id: "c1", basis: "subtotal", tiers }] };
  const msg = (lang) => {
    const i = { ...input([line(1, 1, 1, 1, 20)], cfg), localization: { country: { isoCode: "FR" }, language: { isoCode: lang } } };
    return cartDeliveryOptionsDiscountsGenerateRun(i).operations[0].deliveryDiscountsAdd.candidates[0].message;
  };
  assert.equal(msg("FR"), "Livraison gratuite");
  assert.equal(msg("PT_BR"), "Frete grátis");
  assert.equal(msg("DE"), "Free shipping");
});
