import { createHmac, randomUUID } from "node:crypto";
import { loadTestEnv } from "./env.mjs";

export const ENV = loadTestEnv();
export const APP = "http://localhost:4600";
// The Shopify library answers 410 to bot user agents (Node's default included): look like the admin's browser.
export const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36" };
// Fake shops that exist only in the dev database for these tests.
export const SHOP_A = "cartivo-qa-a.myshopify.com";
export const SHOP_B = "cartivo-qa-b.myshopify.com";

const b64url = (v: Buffer | string) => Buffer.from(v).toString("base64url");

// App Bridge session token (HS256 JWT signed with the app secret), as sent by the embedded admin.
export function sessionToken(shop: string, secret = ENV.SHOPIFY_API_SECRET!, overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    iss: `https://${shop}/admin`, dest: `https://${shop}`, aud: ENV.SHOPIFY_API_KEY, sub: "1",
    exp: now + 60, nbf: now - 5, iat: now - 5, jti: randomUUID(), sid: randomUUID(), ...overrides,
  }));
  const sig = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

// Calls a route action the way the embedded admin does (fetch with a session token).
export async function adminPost(path: string, shop: string, form: Record<string, string>, token = sessionToken(shop)) {
  const route = path.replace(/^\//, "").replace(/\//g, ".");
  const res = await fetch(`${APP}${path}.data?_routes=routes/${encodeURIComponent(route)}`, {
    method: "POST",
    headers: { ...UA, Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form),
    redirect: "manual",
  });
  return { status: res.status, text: await res.text() };
}

export function signedWebhook(topic: string, shop: string, body: unknown, secret = ENV.SHOPIFY_API_SECRET!) {
  const raw = JSON.stringify(body);
  return {
    method: "POST",
    body: raw,
    headers: {
      ...UA,
      "Content-Type": "application/json",
      "X-Shopify-Topic": topic,
      "X-Shopify-Shop-Domain": shop,
      "X-Shopify-API-Version": "2026-10",
      "X-Shopify-Webhook-Id": randomUUID(),
      "X-Shopify-Event-Id": randomUUID(),
      "X-Shopify-Triggered-At": new Date().toISOString(),
      "X-Shopify-Hmac-Sha256": createHmac("sha256", secret).update(raw).digest("base64"),
    },
  };
}

// App proxy request signature: hex HMAC of the sorted "key=value" pairs joined without separators.
export function proxyQuery(shop: string, secret = ENV.SHOPIFY_API_SECRET!) {
  const params: Record<string, string> = { shop, path_prefix: "/apps/cartkit", timestamp: String(Math.floor(Date.now() / 1000)), logged_in_customer_id: "" };
  const message = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("");
  const signature = createHmac("sha256", secret).update(message).digest("hex");
  return new URLSearchParams({ ...params, signature }).toString();
}
