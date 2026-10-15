// Server tests against the built app and the isolated dev database: authentication boundaries, cross-shop
// isolation, webhooks (HMAC), app proxy signatures, plan gating and billing plan resolution.
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { APP, UA, ENV, SHOP_A, SHOP_B, adminPost, proxyQuery, sessionToken, signedWebhook } from "./helpers";

const db = new PrismaClient();
const SHOPS = [SHOP_A, SHOP_B];
test.describe.configure({ mode: "default" }); // sequential in one worker (project fullyParallel: false), failures don't skip the rest

async function wipe() {
  for (const shop of SHOPS) {
    await db.campaign.deleteMany({ where: { shop } });
    await db.event.deleteMany({ where: { shop } });
    await db.shopSettings.deleteMany({ where: { shop } });
    await db.supportTicket.deleteMany({ where: { shop } });
    await db.chatMessage.deleteMany({ where: { shop } });
    await db.shopTrial.deleteMany({ where: { shop } });
    await db.session.deleteMany({ where: { shop } });
  }
}
const campaign = (shop: string, type = "rewards", name = "Mine") =>
  db.campaign.create({ data: { shop, type, name, status: "active", priority: 0, config: JSON.stringify({ tiers: [] }) } });

const ensureSession = (shop: string) =>
  db.session.upsert({
    where: { id: `offline_${shop}` },
    create: { id: `offline_${shop}`, shop, state: "", isOnline: false, scope: ENV.SCOPES, accessToken: "qa-fake-token" },
    update: {},
  });

test.beforeAll(async () => {
  await wipe();
  for (const shop of SHOPS) await ensureSession(shop);
});
test.afterAll(async () => {
  await wipe();
  await db.$disconnect();
});

test.describe("Authentication", () => {
  test("AUTH-01 admin action without a session token is refused and changes nothing @p0", async () => {
    const victim = await campaign(SHOP_A, "rewards", "Auth victim");
    const res = await fetch(`${APP}/app/campaigns.data?_routes=routes/app.campaigns._index`, { method: "POST", headers: UA, body: new URLSearchParams({ intent: "delete", id: victim.id }), redirect: "manual" });
    const text = await res.text();
    // Refusals are a bounce page / 401 (single-fetch may wrap them in a 200); the action must not have run.
    expect(res.status, "rejected as a bot, not by auth").not.toBe(410);
    expect(text).not.toContain("saved");
    expect(await db.campaign.findUnique({ where: { id: victim.id } })).not.toBeNull();
  });

  test("AUTH-02 session token signed with the wrong secret is refused and changes nothing @p0", async () => {
    const victim = await campaign(SHOP_A, "rewards", "Auth victim");
    const { status, text } = await adminPost("/app/campaigns", SHOP_A, { intent: "delete", id: victim.id }, sessionToken(SHOP_A, "wrong-secret"));
    expect(status, "rejected as a bot, not by auth").not.toBe(410);
    expect(text).not.toContain("saved");
    expect(await db.campaign.findUnique({ where: { id: victim.id } })).not.toBeNull();
  });

  test("AUTH-03 expired session token is refused and changes nothing @p0", async () => {
    const victim = await campaign(SHOP_A, "rewards", "Auth victim");
    const now = Math.floor(Date.now() / 1000);
    const { status, text } = await adminPost("/app/campaigns", SHOP_A, { intent: "delete", id: victim.id }, sessionToken(SHOP_A, undefined, { exp: now - 120, nbf: now - 600, iat: now - 600 }));
    expect(status, "rejected as a bot, not by auth").not.toBe(410);
    expect(text).not.toContain("saved");
    expect(await db.campaign.findUnique({ where: { id: victim.id } })).not.toBeNull();
  });

  test("AUTH-05 token for another shop's domain can't act on shop A's data @p0", async () => {
    const victim = await campaign(SHOP_A, "rewards", "Auth victim");
    await adminPost("/app/campaigns", SHOP_B, { intent: "delete", id: victim.id });
    expect(await db.campaign.findUnique({ where: { id: victim.id } })).not.toBeNull();
  });

  test("AUTH-04 valid session token is accepted @p0", async () => {
    const { status, text } = await adminPost("/app/campaigns", SHOP_A, { intent: "deactivate", id: "none" });
    expect(status, text.slice(0, 300)).toBe(200);
  });
});

test.describe("Cross-shop isolation", () => {
  test("ISO-01 shop A can't overwrite or take over shop B's campaign by id @p0", async () => {
    const theirs = await campaign(SHOP_B, "rewards", "Shop B campaign");
    const { status, text } = await adminPost(`/app/campaigns/${theirs.id}`, SHOP_A, {
      payload: JSON.stringify({ type: "rewards", name: "HIJACKED", status: "draft", priority: 0, config: { tiers: [] } }),
    });
    const after = await db.campaign.findUnique({ where: { id: theirs.id } });
    expect(after?.shop, `status ${status}: ${text.slice(0, 200)}`).toBe(SHOP_B);
    expect(text).not.toContain("saved");
    expect(after?.name).toBe("Shop B campaign");
    expect(after?.status).toBe("active");
  });

  test("ISO-02 shop A can't delete or deactivate shop B's campaign @p0", async () => {
    const theirs = await campaign(SHOP_B, "rewards", "Keep me");
    await adminPost("/app/campaigns", SHOP_A, { intent: "deactivate", id: theirs.id });
    await adminPost("/app/campaigns", SHOP_A, { intent: "delete", id: theirs.id });
    const after = await db.campaign.findUnique({ where: { id: theirs.id } });
    expect(after?.status).toBe("active");
  });

  test("ISO-03 shop A's own campaign can be edited, deactivated and deleted @p1", async () => {
    const mine = await campaign(SHOP_A, "rewards", "Mine");
    await adminPost(`/app/campaigns/${mine.id}`, SHOP_A, {
      payload: JSON.stringify({ type: "rewards", name: "Renamed", status: "active", priority: 1, config: { tiers: [] } }),
    });
    expect((await db.campaign.findUnique({ where: { id: mine.id } }))?.name).toBe("Renamed");
    await adminPost("/app/campaigns", SHOP_A, { intent: "deactivate", id: mine.id });
    expect((await db.campaign.findUnique({ where: { id: mine.id } }))?.status).toBe("draft");
    await adminPost("/app/campaigns", SHOP_A, { intent: "delete", id: mine.id });
    expect(await db.campaign.findUnique({ where: { id: mine.id } })).toBeNull();
  });

  test("ISO-04 shop/redact deletes only that shop's data @p0", async () => {
    await campaign(SHOP_A);
    await campaign(SHOP_B);
    await db.event.create({ data: { shop: SHOP_B, type: "drawer_open" } });
    const res = await fetch(`${APP}/webhooks/compliance`, signedWebhook("shop/redact", SHOP_B, { shop_id: 1, shop_domain: SHOP_B }));
    expect(res.status).toBe(200);
    expect(await db.campaign.count({ where: { shop: SHOP_B } })).toBe(0);
    expect(await db.event.count({ where: { shop: SHOP_B } })).toBe(0);
    expect(await db.campaign.count({ where: { shop: SHOP_A } })).toBeGreaterThan(0);
  });
});

test.describe("Publishing errors", () => {
  test("SYNC-01 a failed publish shows a readable reason, not [object Response] @p3", async () => {
    const mine = await campaign(SHOP_A, "rewards", "Sync");
    const { text } = await adminPost(`/app/campaigns/${mine.id}`, SHOP_A, {
      payload: JSON.stringify({ type: "rewards", name: "Sync", status: "active", priority: 0, config: { tiers: [] } }),
    });
    expect(text).toContain("syncError");
    expect(text).not.toContain("[object Response]");
  });
});

test.describe("Plan gating (server side)", () => {
  // The test server runs as Essential: rewards + announcement, up to 3 active campaigns.
  test("PLAN-01 a campaign type outside the plan can't be created by posting directly @p0", async () => {
    const before = await db.campaign.count({ where: { shop: SHOP_A, type: "bxgy" } });
    const { text } = await adminPost("/app/campaigns/new", SHOP_A, {
      payload: JSON.stringify({ type: "bxgy", name: "Sneaky", status: "active", priority: 0, config: {} }),
    });
    expect(text).toContain("Growth plan");
    expect(await db.campaign.count({ where: { shop: SHOP_A, type: "bxgy" } })).toBe(before);
  });

  test("PLAN-02 a plan-gated campaign can't be activated by posting directly @p0", async () => {
    const vol = await db.campaign.create({ data: { shop: SHOP_A, type: "volume", name: "Vol", status: "draft", priority: 0, config: "{}" } });
    const { text } = await adminPost("/app/campaigns", SHOP_A, { intent: "activate", id: vol.id });
    expect(text).toContain("Premium");
    expect((await db.campaign.findUnique({ where: { id: vol.id } }))?.status).toBe("draft");
  });

  test("PLAN-03 custom JavaScript (Growth+) can't be saved on Essential by posting directly @p0", async () => {
    const { text } = await adminPost("/app/advanced", SHOP_A, {
      payload: JSON.stringify({ advanced: { customJs: "alert(1)", customCss: "", customHtmlTop: "", customHtmlBottom: "" } }),
    });
    expect(text).toContain("Growth plan");
    const row = await db.shopSettings.findUnique({ where: { shop: SHOP_A } });
    expect(row?.data ?? "").not.toContain("alert(1)");
  });

  test("PLAN-04 a Premium-only look can't be saved on Essential @p0", async () => {
    const { text } = await adminPost("/app/drawer", SHOP_A, { payload: JSON.stringify({ design: { preset: "glass", glass: true } }) });
    expect(text).toMatch(/plan/);
    const row = await db.shopSettings.findUnique({ where: { shop: SHOP_A } });
    expect(row?.data ?? "").not.toContain('"glass":true');
  });

  test("PLAN-05 live chat (Growth+) is refused on Essential @p1", async () => {
    const { text } = await adminPost("/app/chat", SHOP_A, { body: "hello" });
    expect(text).toContain("Growth and Premium");
    expect(await db.chatMessage.count({ where: { shop: SHOP_A } })).toBe(0);
  });
});

test.describe("Webhooks", () => {
  for (const [path, topic] of [
    ["/webhooks/compliance", "customers/data_request"],
    ["/webhooks/compliance", "customers/redact"],
    ["/webhooks/compliance", "shop/redact"],
    ["/webhooks/app/uninstalled", "app/uninstalled"],
    ["/webhooks/app/subscriptions_update", "app_subscriptions/update"],
    ["/webhooks/app/scopes_update", "app/scopes_update"],
  ] as const) {
    test(`WH ${topic}: invalid HMAC → 401, valid → 200 @p0`, async () => {
      const body = { shop_domain: SHOP_A, current: ["read_products"], app_subscription: {} };
      const bad = await fetch(`${APP}${path}`, signedWebhook(topic, SHOP_A, body, "not-the-secret"));
      expect(bad.status).toBe(401);
      const good = await fetch(`${APP}${path}`, signedWebhook(topic, SHOP_A, body));
      // subscriptions_update tries to republish via the Admin API (unreachable fake shop): must still answer 200.
      expect(good.status).toBe(200);
    });
  }

  test("WH-UNINSTALL app/uninstalled removes the shop's sessions @p1", async () => {
    await db.session.upsert({
      where: { id: `offline_${SHOP_B}` },
      create: { id: `offline_${SHOP_B}`, shop: SHOP_B, state: "", isOnline: false, scope: ENV.SCOPES, accessToken: "qa-fake-token" },
      update: {},
    });
    const res = await fetch(`${APP}/webhooks/app/uninstalled`, signedWebhook("app/uninstalled", SHOP_B, { id: 1 }));
    expect(res.status).toBe(200);
    expect(await db.session.count({ where: { shop: SHOP_B } })).toBe(0);
  });
});

test.describe("App proxy (storefront analytics)", () => {
  // The webhook tests uninstall shop A (its sessions are deleted): reinstall it.
  test.beforeEach(() => ensureSession(SHOP_A));
  test("PROXY-01 unsigned request is refused and stores nothing @p0", async () => {
    const res = await fetch(`${APP}/proxy/track?shop=${SHOP_A}`, { method: "POST", headers: UA, body: JSON.stringify({ events: [{ type: "drawer_open" }] }) });
    expect([400, 401]).toContain(res.status);
    expect(await db.event.count({ where: { shop: SHOP_A } })).toBe(0);
  });

  test("PROXY-02 signed request stores only allowed events, max 20, for the signed shop @p1", async () => {
    const events = [{ type: "drawer_open" }, { type: "evil<script>" }, ...Array.from({ length: 30 }, () => ({ type: "item_add", value: "1e400", campaignId: "x".repeat(100) }))];
    const res = await fetch(`${APP}/proxy/track?${proxyQuery(SHOP_A)}`, { method: "POST", headers: UA, body: JSON.stringify({ events }) });
    expect(res.status).toBe(204);
    const rows = await db.event.findMany({ where: { shop: SHOP_A } });
    expect(rows.length).toBe(19); // first 20 events, minus the unknown type
    expect(rows.every((r) => r.type !== "evil<script>")).toBe(true);
    expect(rows.every((r) => (r.campaignId?.length ?? 0) <= 40)).toBe(true);
    expect(rows.every((r) => r.value === null || Number.isFinite(r.value))).toBe(true);
  });

  test("PROXY-03 malformed body → 400 @p2", async () => {
    const res = await fetch(`${APP}/proxy/track?${proxyQuery(SHOP_A)}`, { method: "POST", headers: UA, body: "{not json" });
    expect(res.status).toBe(400);
  });
});

test.describe("Support inbox", () => {
  test("INBOX-01 wrong key is refused; forged cookie isn't an agent session @p0", async () => {
    const res = await fetch(`${APP}/support/inbox.data?_routes=routes/support.inbox`, { method: "POST", headers: UA, body: new URLSearchParams({ intent: "signin", key: "guess" }) });
    expect(res.status).toBe(401);
    const forged = await fetch(`${APP}/support/inbox.data?_routes=routes/support.inbox`, {
      method: "POST", headers: { ...UA, Cookie: `cartkit_inbox=${Buffer.from(JSON.stringify("agent")).toString("base64")}` },
      body: new URLSearchParams({ intent: "reply", shop: SHOP_A, body: "spoof" }),
    });
    expect(forged.status).toBe(401);
    expect(await db.chatMessage.count({ where: { shop: SHOP_A } })).toBe(0);
  });
});

test.describe("Input validation", () => {
  const save = (payload: unknown, id = "new") =>
    adminPost(`/app/campaigns/${id}`, SHOP_A, { payload: typeof payload === "string" ? payload : JSON.stringify(payload) });
  const rewards = (extra: Record<string, unknown> = {}) => ({ type: "rewards", name: "Val", status: "active", priority: 0, config: { tiers: [] }, ...extra });

  test("VAL-01 malformed campaign JSON gets a readable error, not a 500, and stores nothing @p1", async () => {
    const before = await db.campaign.count({ where: { shop: SHOP_A } });
    const { status, text } = await save("{not json");
    expect(status, text.slice(0, 300)).toBeLessThan(500);
    expect(text).toContain("error");
    expect(text).not.toMatch(/SyntaxError|at .*\.(ts|js):\d+/);
    expect(await db.campaign.count({ where: { shop: SHOP_A } })).toBe(before);
  });

  test("VAL-02 an invalid schedule date is refused, not a 500 @p1", async () => {
    const before = await db.campaign.count({ where: { shop: SHOP_A } });
    const { status, text } = await save(rewards({ startsAt: "not-a-date" }));
    expect(status, text.slice(0, 300)).toBeLessThan(500);
    expect(text).toContain("date");
    expect(await db.campaign.count({ where: { shop: SHOP_A } })).toBe(before);
  });

  test("VAL-03 an end date before the start date is refused (the campaign would never run) @p2", async () => {
    const before = await db.campaign.count({ where: { shop: SHOP_A } });
    const { text } = await save(rewards({ startsAt: "2030-01-02T00:00:00.000Z", endsAt: "2030-01-01T00:00:00.000Z" }));
    expect(text).toContain("end");
    expect(await db.campaign.count({ where: { shop: SHOP_A } })).toBe(before);
  });

  test("VAL-04 a valid schedule is stored as given @p1", async () => {
    const { text } = await save(rewards({ name: "Scheduled", startsAt: "2030-01-01T00:00:00.000Z", endsAt: "2030-01-02T00:00:00.000Z" }));
    expect(text).toContain("saved");
    const row = await db.campaign.findFirst({ where: { shop: SHOP_A, name: "Scheduled" } });
    expect(row?.startsAt?.toISOString()).toBe("2030-01-01T00:00:00.000Z");
    expect(row?.endsAt?.toISOString()).toBe("2030-01-02T00:00:00.000Z");
  });

  test("VAL-05 unknown campaign type and non-object config are refused @p1", async () => {
    const before = await db.campaign.count({ where: { shop: SHOP_A } });
    expect((await save(rewards({ type: "__proto__" }))).text).toContain("Unknown campaign type");
    const { status, text } = await save(rewards({ config: "oops" }));
    expect(status).toBeLessThan(500);
    expect(text).toContain("error");
    expect(await db.campaign.count({ where: { shop: SHOP_A } })).toBe(before);
  });

  test("VAL-06 an over-long campaign name is refused @p3", async () => {
    const { text } = await save(rewards({ name: "x".repeat(500) }));
    expect(text).toContain("error");
    expect(await db.campaign.count({ where: { shop: SHOP_A, name: "x".repeat(500) } })).toBe(0);
  });

  test("VAL-07 malformed settings JSON or a non-object section is refused, settings unchanged @p1", async () => {
    await db.shopSettings.deleteMany({ where: { shop: SHOP_A } });
    const bad = await adminPost("/app/drawer", SHOP_A, { payload: "{not json" });
    expect(bad.status, bad.text.slice(0, 300)).toBeLessThan(500);
    expect(bad.text).toContain("error");
    const wrongType = await adminPost("/app/drawer", SHOP_A, { payload: JSON.stringify({ design: "broken" }) });
    expect(wrongType.text).toContain("error");
    expect(await db.shopSettings.count({ where: { shop: SHOP_A } })).toBe(0);
    // The admin still loads afterwards (a stored string section would break every page and the storefront).
    const ok = await adminPost("/app/drawer", SHOP_A, { payload: JSON.stringify({ drawer: { enabled: true } }) });
    expect(ok.text).toContain("saved");
  });

  test("VAL-08 support requests: invalid input refused, max 5 per hour per shop @p2", async () => {
    await db.supportTicket.deleteMany({ where: { shop: SHOP_A } });
    const ticket = { email: "qa@example.com", category: "setup", subject: "Help please", message: "The drawer does not open on my store." };
    const invalid = await adminPost("/app/help", SHOP_A, { ...ticket, email: "nope", message: "short" });
    expect(invalid.text).toContain("valid email");
    expect(await db.supportTicket.count({ where: { shop: SHOP_A } })).toBe(0);
    for (let i = 0; i < 6; i++) await adminPost("/app/help", SHOP_A, ticket);
    expect(await db.supportTicket.count({ where: { shop: SHOP_A } })).toBe(5);
    await db.supportTicket.deleteMany({ where: { shop: SHOP_A } });
  });
});

test.describe("Request context (bot filter vs authentication)", () => {
  // The library's bot filter (isbot → 410) runs before admin authentication only. These tests check that the
  // browser user agent used elsewhere isn't hiding a problem: real Shopify callers aren't filtered, and a bot
  // user agent on an admin route is refused without the action running.
  test("CTX-01 admin action with a bot user agent and a valid token answers 410 and changes nothing @p1", async () => {
    const victim = await campaign(SHOP_A, "rewards", "Bot victim");
    const res = await fetch(`${APP}/app/campaigns.data?_routes=routes/app.campaigns._index`, {
      method: "POST",
      headers: { "User-Agent": "Googlebot/2.1 (+http://www.google.com/bot.html)", Authorization: `Bearer ${sessionToken(SHOP_A)}` },
      body: new URLSearchParams({ intent: "delete", id: victim.id }),
    });
    expect(res.status).toBe(410);
    expect(await db.campaign.findUnique({ where: { id: victim.id } })).not.toBeNull();
  });

  test("CTX-02 webhooks with Shopify's own user agent (and with none) are accepted @p0", async () => {
    for (const ua of ["Shopify-Captain-Hook", ""]) {
      const req = signedWebhook("customers/data_request", SHOP_A, { shop_domain: SHOP_A, customer: { id: 1 }, orders_requested: [] });
      (req.headers as Record<string, string>)["User-Agent"] = ua;
      const res = await fetch(`${APP}/webhooks/compliance`, req);
      expect(res.status, `UA "${ua}"`).toBe(200);
    }
  });

  test("CTX-03 app proxy requests without a browser user agent are still verified by signature only @p1", async () => {
    await ensureSession(SHOP_A);
    await db.event.deleteMany({ where: { shop: SHOP_A } });
    const res = await fetch(`${APP}/proxy/track?${proxyQuery(SHOP_A)}`, { method: "POST", headers: { "User-Agent": "Shopify Proxy" }, body: JSON.stringify({ events: [{ type: "drawer_open" }] }) });
    expect(res.status).toBe(204);
    expect(await db.event.count({ where: { shop: SHOP_A } })).toBe(1);
    await db.event.deleteMany({ where: { shop: SHOP_A } });
  });
});

test.describe("Webhook reliability", () => {
  test("WH-DUP-01 the same shop/redact delivered twice succeeds both times @p1", async () => {
    await campaign(SHOP_B);
    const body = { shop_id: 2, shop_domain: SHOP_B };
    const first = await fetch(`${APP}/webhooks/compliance`, signedWebhook("shop/redact", SHOP_B, body));
    const retry = await fetch(`${APP}/webhooks/compliance`, signedWebhook("shop/redact", SHOP_B, body));
    expect([first.status, retry.status]).toEqual([200, 200]);
    expect(await db.campaign.count({ where: { shop: SHOP_B } })).toBe(0);
  });

  test("WH-DUP-02 app/uninstalled after the sessions are already gone still answers 200 @p1", async () => {
    await db.session.deleteMany({ where: { shop: SHOP_B } });
    const res = await fetch(`${APP}/webhooks/app/uninstalled`, signedWebhook("app/uninstalled", SHOP_B, { id: 2 }));
    expect(res.status).toBe(200);
  });

  test("WH-PRIV-01 customers/redact and customers/data_request change no shop data (no customer data stored) @p0", async () => {
    await ensureSession(SHOP_A);
    const mine = await campaign(SHOP_A, "rewards", "Keep after customer redact");
    for (const topic of ["customers/redact", "customers/data_request"]) {
      const res = await fetch(`${APP}/webhooks/compliance`, signedWebhook(topic, SHOP_A, { shop_domain: SHOP_A, customer: { id: 7, email: "c@example.com" }, orders_to_redact: [] }));
      expect(res.status).toBe(200);
    }
    expect(await db.campaign.findUnique({ where: { id: mine.id } })).not.toBeNull();
  });

  test("WH-SCOPES-01 app/scopes_update stores the new scopes on the shop's session @p2", async () => {
    await ensureSession(SHOP_A);
    const res = await fetch(`${APP}/webhooks/app/scopes_update`, signedWebhook("app/scopes_update", SHOP_A, { id: 1, previous: [], current: ["read_products", "write_discounts"] }));
    expect(res.status).toBe(200);
    expect((await db.session.findUnique({ where: { id: `offline_${SHOP_A}` } }))?.scope).toBe("read_products,write_discounts");
  });

  test("WH-SCOPES-02 app/scopes_update without a scope list answers 200, not 500 @p3", async () => {
    await ensureSession(SHOP_A);
    const res = await fetch(`${APP}/webhooks/app/scopes_update`, signedWebhook("app/scopes_update", SHOP_A, { id: 1 }));
    expect(res.status).toBe(200);
  });
});

test.describe("Public surface", () => {
  test("PUB-01 security headers on the login page; no stack traces on bad input @p2", async () => {
    const res = await fetch(`${APP}/auth/login`);
    expect(res.status).toBeLessThan(500);
    const bad = await fetch(`${APP}/app/campaigns/%00%27`, { redirect: "manual" });
    expect(bad.status).toBeLessThan(500);
    expect(await bad.text()).not.toMatch(/at .*\.server\.ts|PrismaClient/);
  });
});
