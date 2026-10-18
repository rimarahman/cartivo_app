// Local Shopify storefront emulator for Cartivo E2E tests.
// Serves the real theme extension (cartkit.js / cartkit.css), emulates the Ajax Cart API, and prices the cart
// with the real discount Function (extensions/cartkit-discounts) so storefront tests check what a shopper would
// actually be charged — not only what the drawer displays. One cart per browser context (cookie).
import http from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { cartLinesDiscountsGenerateRun } from "../../../extensions/cartkit-discounts/src/cart_lines_discounts_generate_run.js";
import { SCENARIOS, PRODUCTS, variantById } from "./scenarios.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const ASSETS = path.join(ROOT, "extensions/cartkit-theme/assets");
const PORT = Number(process.env.HARNESS_PORT || 4599);

const sessions = new Map(); // sid -> { scenario, cart, log, faults }
let nextKey = 1;

function session(req) {
  const sid = /(?:^|;\s*)ck_sid=([^;]+)/.exec(req.headers.cookie || "")?.[1];
  return sid && sessions.get(sid);
}
function newSession(scenario) {
  const sid = Math.random().toString(36).slice(2);
  const s = { scenario, lines: [], note: "", codes: [], log: [], track: [], faults: {} };
  sessions.set(sid, s);
  return { sid, s };
}

const gid = (kind, id) => `gid://shopify/${kind}/${id}`;

// Runs the discount Function over the cart and returns the Shopify-style cart JSON.
function priced(s) {
  const sc = SCENARIOS[s.scenario];
  const fnLines = s.lines.map((l) => ({
    id: l.key,
    quantity: l.quantity,
    cost: { amountPerQuantity: { amount: (l.price / 100).toFixed(2) }, subtotalAmount: { amount: ((l.price * l.quantity) / 100).toFixed(2) } },
    gift: l.properties._cartkit_gift ? { value: l.properties._cartkit_gift } : null,
    merchandise: { __typename: "ProductVariant", id: gid("ProductVariant", l.variant_id), product: { id: gid("Product", l.product_id) } },
  }));
  const allocations = {}; // key -> cents
  let orderDiscount = null;
  if (sc.discountActive !== false && s.lines.length) {
    const out = cartLinesDiscountsGenerateRun({
      presentmentCurrencyRate: "1.0",
      localization: { country: { isoCode: "US" }, language: { isoCode: "EN" } },
      shop: { localTime: { date: new Date().toISOString().slice(0, 10) } },
      cart: { cost: { subtotalAmount: { currencyCode: "USD" } }, lines: fnLines },
      discount: { discountClasses: ["PRODUCT", "ORDER"], metafield: { jsonValue: sc.fn } },
    });
    for (const op of out.operations) {
      if (op.productDiscountsAdd) {
        for (const c of op.productDiscountsAdd.candidates) {
          for (const t of c.targets) {
            const line = s.lines.find((l) => l.key === t.cartLine.id);
            // A non-combinable code that beats the product discount wins (how Shopify resolves conflicts).
            if (s.codes.includes(sc.nonCombinableCode)) continue;
            const qty = t.cartLine.quantity ?? line.quantity;
            const cents = Math.round((line.price * qty * c.value.percentage.value) / 100);
            allocations[line.key] = { amount: (allocations[line.key]?.amount || 0) + cents, title: c.message };
          }
        }
      }
      if (op.orderDiscountsAdd) orderDiscount = op.orderDiscountsAdd.candidates[0];
    }
  }
  const items = s.lines.map((l) => {
    const p = PRODUCTS[l.product_id];
    const disc = allocations[l.key];
    const original = l.price * l.quantity;
    return {
      key: l.key, id: l.variant_id, variant_id: l.variant_id, product_id: l.product_id, quantity: l.quantity,
      title: p.title, product_title: p.title, variant_title: variantById(l.variant_id).title, handle: p.handle,
      url: `/products/${p.handle}?variant=${l.variant_id}`, image: null, vendor: "Harness",
      product_has_only_default_variant: p.variants.length < 2,
      properties: l.properties, price: l.price, original_price: l.price, final_price: l.price - Math.round((disc?.amount || 0) / l.quantity),
      original_line_price: original, final_line_price: original - (disc?.amount || 0),
      line_level_discount_allocations: disc ? [{ amount: disc.amount, discount_application: { title: disc.title } }] : [],
    };
  });
  let total = items.reduce((t, i) => t + i.final_line_price, 0);
  const cartLevel = [];
  if (orderDiscount) {
    const base = items.filter((i) => !i.properties._cartkit_gift).reduce((t, i) => t + i.final_line_price, 0);
    const v = orderDiscount.value;
    const amt = v.percentage ? Math.round((base * v.percentage.value) / 100) : Math.min(base, Math.round(Number(v.fixedAmount.amount) * 100));
    cartLevel.push({ title: orderDiscount.message, total_allocated_amount: amt });
    total -= amt;
  }
  const code = s.codes.find((c) => sc.codes?.[c]);
  if (code) {
    const amt = Math.round((total * sc.codes[code]) / 100);
    cartLevel.push({ title: code, total_allocated_amount: amt });
    total -= amt;
  }
  const original = items.reduce((t, i) => t + i.original_line_price, 0);
  return {
    token: "harness", note: s.note, currency: "USD", item_count: items.reduce((t, i) => t + i.quantity, 0), items,
    original_total_price: original, total_price: total, total_discount: original - total,
    cart_level_discount_applications: cartLevel,
    discount_codes: s.codes.map((c) => ({ code: c, applicable: !!sc.codes?.[c] || c === sc.nonCombinableCode })),
  };
}

function addLine(s, { id, quantity = 1, properties = {} }) {
  const v = variantById(Number(id));
  if (!v) throw Object.assign(new Error("Cannot find variant"), { status: 404 });
  if (!v.available) throw Object.assign(new Error("Sold out"), { status: 422, description: `${v.title} is sold out.` });
  const props = Object.fromEntries(Object.entries(properties || {}).filter(([, val]) => val !== "" && val != null));
  const same = s.lines.find((l) => l.variant_id === v.id && JSON.stringify(l.properties) === JSON.stringify(props));
  if (same) same.quantity += Number(quantity);
  else s.lines.unshift({ key: `${v.id}:${nextKey++}`, variant_id: v.id, product_id: v.product_id, price: v.price, quantity: Number(quantity), properties: props });
}
function changeLine(s, key, quantity) {
  const line = s.lines.find((l) => l.key === key || String(l.variant_id) === String(key));
  if (!line) throw Object.assign(new Error("No line"), { status: 400 });
  if (quantity <= 0) s.lines = s.lines.filter((l) => l !== line);
  else line.quantity = quantity;
}

function page(s, kind, handle) {
  const sc = SCENARIOS[s.scenario];
  const product = kind === "product" ? Object.values(PRODUCTS).find((p) => p.handle === handle) : null;
  const ctx = {
    moneyFormat: "${{amount}}", locale: "en", country: "US", language: "EN", rootUrl: "/", template: kind,
    designMode: false, previewDrawer: false, cart: priced(s),
    product: product && { title: product.title, has_only_default_variant: product.variants.length < 2, featured_image: null,
      variants: product.variants.map((v) => ({ id: v.id, title: v.title, available: v.available, price: v.price, compare_at_price: null, featured_image: null })) },
  };
  const jsonScript = (o) => JSON.stringify(o).replace(/</g, "\\u003c");
  const form = product
    ? `<form action="/cart/add" method="post" class="product-form" data-testid="product-form">
        ${product.variants.length > 1
          ? `<select name="id" data-testid="variant">${product.variants.map((v) => `<option value="${v.id}"${v.available ? "" : " disabled"}>${v.title}</option>`).join("")}</select>`
          : `<input type="hidden" name="id" value="${product.variants[0].id}">`}
        <input type="number" name="quantity" value="1" min="1" data-testid="qty">
        <button type="submit" data-testid="add-to-cart">Add to cart</button>
      </form><div style="height:2000px"></div>`
    : "";
  const nav = Object.values(PRODUCTS).map((p) => `<a href="/products/${p.handle}">${p.title.replace(/</g, "&lt;")}</a>`).join(" | ");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Harness ${kind}</title><link rel="stylesheet" href="/assets/cartkit.css"></head>
<body><header><a href="/">Home</a> <nav>${nav}</nav> <a href="/cart" id="cart-icon-bubble">Cart <span class="cart-count">${ctx.cart.item_count}</span></a></header>
<main><h1>${product ? product.title.replace(/</g, "&lt;") : "Home"}</h1>${form}</main>
<script id="cartkit-config" type="application/json">${jsonScript({ version: 1, settings: sc.settings, campaigns: sc.campaigns })}</script>
<script id="cartkit-context" type="application/json">${jsonScript(ctx)}</script>
<script src="/assets/cartkit.js" defer></script></body></html>`;
}

async function body(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString();
  const type = req.headers["content-type"] || "";
  if (type.includes("application/json")) return JSON.parse(raw || "{}");
  if (type.includes("multipart/form-data")) {
    const out = {};
    const boundary = type.split("boundary=")[1];
    for (const part of raw.split("--" + boundary)) {
      const m = /name="([^"]+)"\r\n\r\n([\s\S]*?)\r\n$/.exec(part);
      if (m) out[m[1]] = m[2];
    }
    return out;
  }
  if (type.includes("urlencoded")) return Object.fromEntries(new URLSearchParams(raw));
  return raw;
}

const send = (res, status, data, headers = {}) => {
  res.writeHead(status, { "Content-Type": typeof data === "string" ? "text/html" : "application/json", ...headers });
  res.end(typeof data === "string" ? data : JSON.stringify(data));
};
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  try {
    if (u.pathname === "/favicon.ico") return send(res, 204, "");
    if (u.pathname === "/__setup") {
      const scenario = u.searchParams.get("scenario") || "base";
      if (!SCENARIOS[scenario]) return send(res, 400, { error: "unknown scenario" });
      const { sid } = newSession(scenario);
      return send(res, 302, "", { Location: u.searchParams.get("to") || "/", "Set-Cookie": `ck_sid=${sid}; Path=/` });
    }
    const s = session(req);
    if (!s) return send(res, 400, "call /__setup first");
    if (u.pathname.startsWith("/assets/")) {
      const file = path.join(ASSETS, path.basename(u.pathname));
      return send(res, 200, readFileSync(file, "utf8"), { "Content-Type": file.endsWith(".css") ? "text/css" : "text/javascript" });
    }
    if (u.pathname === "/__state") return send(res, 200, { cart: priced(s), log: s.log, track: s.track });
    if (u.pathname === "/__fault") { Object.assign(s.faults, await body(req)); return send(res, 200, { ok: true }); }
    if (u.pathname === "/__seed") { for (const it of (await body(req)).items) addLine(s, it); return send(res, 200, priced(s)); }
    if (u.pathname === "/apps/cartivo/track") { s.track.push(await body(req)); return send(res, 204, ""); }

    const ajax = u.pathname.replace(/\.(js|json)$/, "");
    if (/^\/cart\/(add|change|update|clear)$/.test(ajax) || ajax === "/cart" && req.method === "POST") {
      const f = s.faults[ajax];
      if (f?.delay) await delay(f.delay);
      if (f?.status) { s.log.push({ op: ajax, failed: f.status }); return send(res, f.status, { status: f.status, message: "Server error", description: "Temporary failure" }); }
    }
    if (ajax === "/cart" && req.method === "GET") return send(res, 200, priced(s));
    if (ajax === "/cart/add") {
      const b = await body(req);
      const items = b.items || [{ id: b.id, quantity: Number(b.quantity || 1), properties: b.properties }];
      s.log.push({ op: "add", items });
      try { for (const it of items) addLine(s, it); } catch (e) { return send(res, e.status || 422, { status: e.status, message: e.message, description: e.description || e.message }); }
      return send(res, 200, { items });
    }
    if (ajax === "/cart/change") {
      const b = await body(req);
      s.log.push({ op: "change", ...b });
      changeLine(s, b.id ?? b.line, Number(b.quantity));
      return send(res, 200, priced(s));
    }
    if (ajax === "/cart/update") {
      const b = await body(req);
      s.log.push({ op: "update", ...b });
      for (const [key, q] of Object.entries(b.updates || {})) changeLine(s, key, Number(q));
      if (b.note !== undefined) s.note = String(b.note);
      if (b.discount !== undefined) s.codes = String(b.discount).split(",").map((c) => c.trim()).filter(Boolean);
      return send(res, 200, priced(s));
    }
    if (ajax === "/cart/clear") { s.lines = []; return send(res, 200, priced(s)); }
    const pm = /^\/products\/([^/.]+)$/.exec(ajax);
    if (pm && u.pathname.endsWith(".js")) {
      const p = Object.values(PRODUCTS).find((x) => x.handle === pm[1]);
      if (!p) return send(res, 404, {});
      return send(res, 200, { id: p.id, title: p.title, handle: p.handle, price: p.variants[0].price, has_only_default_variant: p.variants.length < 2, featured_image: null, images: [], variants: p.variants });
    }
    if (pm) return send(res, 200, page(s, "product", pm[1]));
    if (ajax === "/recommendations/products") {
      const recs = SCENARIOS[s.scenario].recommendations || [];
      return send(res, 200, { products: recs.map((id) => ({ ...PRODUCTS[id], price: PRODUCTS[id].variants[0].price, featured_image: null, images: [] })) });
    }
    if (u.pathname === "/checkout") return send(res, 200, `<!doctype html><title>Checkout</title><h1 data-testid="checkout">Checkout ${u.search}</h1>`);
    if (u.pathname === "/" || u.pathname === "/cart" || u.pathname.startsWith("/collections")) return send(res, 200, page(s, "index"));
    return send(res, 404, "not found");
  } catch (e) {
    return send(res, e.status || 500, { message: e.message });
  }
});

server.listen(PORT, () => console.log(`Cartivo storefront harness on http://localhost:${PORT}`));
