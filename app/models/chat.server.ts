// Live chat: one thread per shop between the merchant (Help panel) and the support team (/support/inbox).
import { createCookie } from "react-router";
import { timingSafeEqual } from "node:crypto";
import db from "../db.server";

export type Sender = "merchant" | "agent";
export type ChatMessageView = { id: string; sender: Sender; body: string; createdAt: string };

const MAX_LENGTH = 2000;
const ONLINE_WINDOW = 5 * 60e3; // agent counts as online for 5 minutes after the inbox last polled
const NOTIFY_GAP = 10 * 60e3; // ping the team webhook at most once per 10 minutes per thread
const MAX_PER_MINUTE = 10;

const view = (m: { id: string; sender: string; body: string; createdAt: Date }): ChatMessageView => ({
  id: m.id,
  sender: m.sender as Sender,
  body: m.body,
  createdAt: m.createdAt.toISOString(),
});

export function validateMessage(body: unknown) {
  const text = typeof body === "string" ? body.trim() : "";
  if (!text) return { error: "Type a message first." };
  if (text.length > MAX_LENGTH) return { error: `Keep messages under ${MAX_LENGTH.toLocaleString()} characters.` };
  return { text };
}

export async function getThread(shop: string, since?: string | null) {
  const after = since ? new Date(since) : null;
  const rows = await db.chatMessage.findMany({
    // gte, not gt: two messages can share a millisecond; the client de-duplicates by id.
    where: { shop, ...(after && !isNaN(+after) ? { createdAt: { gte: after } } : {}) },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return rows.map(view);
}

export async function unreadForMerchant(shop: string) {
  return db.chatMessage.count({ where: { shop, sender: "agent", readAt: null } });
}

export async function markRead(shop: string, reader: Sender) {
  await db.chatMessage.updateMany({
    where: { shop, sender: reader === "merchant" ? "agent" : "merchant", readAt: null },
    data: { readAt: new Date() },
  });
}

export async function postMessage(shop: string, sender: Sender, body: unknown) {
  const v = validateMessage(body);
  if ("error" in v) return { error: v.error };
  if (sender === "merchant") {
    const recent = await db.chatMessage.count({
      where: { shop, sender, createdAt: { gte: new Date(Date.now() - 60e3) } },
    });
    if (recent >= MAX_PER_MINUTE) return { error: "You're sending messages very quickly. Please wait a moment." };
  }
  const previous = await db.chatMessage.findFirst({ where: { shop, sender }, orderBy: { createdAt: "desc" } });
  const message = await db.chatMessage.create({ data: { shop, sender, body: v.text } });
  if (sender === "merchant" && (!previous || Date.now() - +previous.createdAt > NOTIFY_GAP)) {
    await notifyTeam(shop, v.text);
  }
  return { message: view(message) };
}

// --- agent presence -------------------------------------------------------------------------------

export async function touchAgent() {
  await db.supportPresence.upsert({
    where: { id: "team" },
    create: { id: "team", lastSeen: new Date() },
    update: { lastSeen: new Date() },
  });
}

export async function agentOnline() {
  try {
    const row = await db.supportPresence.findUnique({ where: { id: "team" } });
    return Boolean(row && Date.now() - +row.lastSeen < ONLINE_WINDOW);
  } catch {
    return false;
  }
}

// --- inbox ----------------------------------------------------------------------------------------

export async function listConversations() {
  const latest = await db.chatMessage.groupBy({
    by: ["shop"],
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } },
    take: 100,
  });
  const unread = await db.chatMessage.groupBy({
    by: ["shop"],
    where: { sender: "merchant", readAt: null },
    _count: { _all: true },
  });
  const unreadBy = Object.fromEntries(unread.map((u) => [u.shop, u._count._all]));
  const last = await Promise.all(
    latest.map((l) => db.chatMessage.findFirst({ where: { shop: l.shop }, orderBy: { createdAt: "desc" } })),
  );
  return latest.map((l, i) => ({
    shop: l.shop,
    unread: unreadBy[l.shop] || 0,
    last: last[i] ? view(last[i]!) : null,
  }));
}

// The inbox is enabled only when SUPPORT_INBOX_KEY is set. Signing in stores a signed cookie.
export const inboxEnabled = () => Boolean(process.env.SUPPORT_INBOX_KEY);

const inboxCookie = () =>
  createCookie("cartkit_inbox", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/support",
    maxAge: 60 * 60 * 24 * 14,
    secrets: [process.env.SUPPORT_INBOX_KEY || "disabled"],
  });

export function keyMatches(candidate: string) {
  const key = process.env.SUPPORT_INBOX_KEY || "";
  const a = Buffer.from(candidate);
  const b = Buffer.from(key);
  return key.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

export async function isAgent(request: Request) {
  if (!inboxEnabled()) return false;
  return (await inboxCookie().parse(request.headers.get("Cookie"))) === "agent";
}

export const signInCookie = () => inboxCookie().serialize("agent");
export const signOutCookie = () => inboxCookie().serialize("", { maxAge: 0 });

async function notifyTeam(shop: string, text: string) {
  const url = process.env.SUPPORT_WEBHOOK_URL;
  if (!url) return;
  const msg = `New Cartivo live chat from ${shop}:\n${text.slice(0, 500)}\nReply in the support inbox (/support/inbox).`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: msg, content: msg.slice(0, 2000) }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    console.error("Chat webhook failed", e);
  }
}
