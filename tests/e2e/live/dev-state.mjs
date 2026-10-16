// Read-only snapshot of the dev store's rows in the isolated dev DB (refuses any other DB host). Run before and
// after LIVE-01/02 (uninstall/reinstall) and LIVE-04 (billing): node tests/e2e/live/dev-state.mjs
import { loadTestEnv } from "../server/env.mjs";
const env = loadTestEnv();
process.env.DATABASE_URL = env.DATABASE_URL;
const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();
const shop = "cartivo-app-test.myshopify.com";
try {
  const now = new Date();
  const campaigns = await db.campaign.findMany({ where: { shop }, select: { id: true, type: true, name: true, status: true, startsAt: true, endsAt: true, updatedAt: true } });
  const sessions = await db.session.findMany({ where: { shop }, select: { id: true, isOnline: true, scope: true, expires: true } });
  const settings = await db.shopSettings.findUnique({ where: { shop } }).catch(() => null);
  const trial = await db.shopTrial.findUnique({ where: { shop } }).catch(() => null);
  const counts = {
    events: await db.event.count({ where: { shop } }).catch(() => "n/a"),
    tickets: await db.supportTicket.count({ where: { shop } }).catch(() => "n/a"),
    chat: await db.chatMessage.count({ where: { shop } }).catch(() => "n/a"),
  };
  const s = settings ? JSON.parse(settings.data) : null;
  console.log(JSON.stringify({
    now,
    campaigns: campaigns.map((c) => ({ ...c, ended: c.endsAt ? c.endsAt < now : false })),
    sessions: sessions.map((x) => ({ id: x.id.slice(0, 12) + "…", isOnline: x.isOnline, scope: x.scope, expires: x.expires })),
    settings: s && { preset: s.design?.preset, sticky: s.sticky?.enabled, floating: s.floating?.enabled, discountId: settings.discountId ? "set" : undefined, keys: Object.keys(settings) },
    trial, counts,
  }, null, 1));
} finally { await db.$disconnect(); }
