// Support requests from the Help panel: validation, storage, diagnostics and team notification.
import db from "../db.server";
import { SUPPORT_CATEGORIES, type SupportCategory } from "../lib/support";

type Admin = { graphql: (query: string, options?: any) => Promise<Response> };

export { SUPPORT_CATEGORIES };

// Optional contact details shown on the Support page (set in .env).
export const supportContact = () => ({
  email: process.env.SUPPORT_EMAIL || null,
  docsUrl: process.env.SUPPORT_DOCS_URL || null,
});

const MAX_PER_HOUR = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type TicketInput = { email: string; category: string; subject: string; message: string };

export function validateTicket(input: TicketInput) {
  const errors: Partial<Record<keyof TicketInput, string>> = {};
  if (!EMAIL_RE.test(input.email.trim())) errors.email = "Enter a valid email so we can reply.";
  if (!(input.category in SUPPORT_CATEGORIES)) errors.category = "Choose a topic.";
  if (input.subject.trim().length < 3) errors.subject = "Add a short subject.";
  else if (input.subject.length > 120) errors.subject = "Keep the subject under 120 characters.";
  if (input.message.trim().length < 10) errors.message = "Tell us a little more (at least 10 characters).";
  else if (input.message.length > 5000) errors.message = "Keep the message under 5,000 characters.";
  return errors;
}

// Store and theme details that save a round of back-and-forth. Every query fails gracefully.
export async function collectDiagnostics(admin: Admin, extra: Record<string, unknown>) {
  let shop: any = null;
  let theme: any = null;
  try {
    const json: any = await (
      await admin.graphql(`#graphql
        query {
          shop { name myshopifyDomain primaryDomain { host } currencyCode plan { displayName } }
          themes(first: 1, roles: [MAIN]) { nodes { name } }
        }`)
    ).json();
    shop = json.data?.shop ?? null;
    theme = json.data?.themes?.nodes?.[0] ?? null;
  } catch {
    // diagnostics are best-effort
  }
  return {
    store: shop?.myshopifyDomain ?? null,
    domain: shop?.primaryDomain?.host ?? null,
    shopifyPlan: shop?.plan?.displayName ?? null,
    currency: shop?.currencyCode ?? null,
    theme: theme?.name ?? null,
    ...extra,
  };
}

// The store owner's email, used to prefill the reply address.
export async function shopEmail(admin: Admin) {
  try {
    const json: any = await (await admin.graphql(`#graphql
      query { shop { email contactEmail } }`)).json();
    return (json.data?.shop?.contactEmail || json.data?.shop?.email || "") as string;
  } catch {
    return "";
  }
}

// Never throws: the Help panel loads on every admin page and must not take the page down with it.
export async function listTickets(shop: string) {
  try {
    return await db.supportTicket.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, category: true, subject: true, status: true, createdAt: true },
    });
  } catch (e) {
    console.error("Couldn't load support requests", e);
    return [];
  }
}

export async function createTicket(shop: string, input: TicketInput, diagnostics: Record<string, unknown> | null) {
  try {
    return await saveTicket(shop, input, diagnostics);
  } catch (e) {
    console.error("Couldn't save support request", e);
    return { error: "We couldn't send your message. Please try again in a moment." };
  }
}

async function saveTicket(shop: string, input: TicketInput, diagnostics: Record<string, unknown> | null) {
  const recent = await db.supportTicket.count({
    where: { shop, createdAt: { gte: new Date(Date.now() - 3600e3) } },
  });
  if (recent >= MAX_PER_HOUR) return { error: "You've sent several requests in the last hour. We'll get back to you soon." };
  const ticket = await db.supportTicket.create({
    data: {
      shop,
      email: input.email.trim(),
      category: input.category,
      subject: input.subject.trim(),
      message: input.message.trim(),
      diagnostics: diagnostics ? JSON.stringify(diagnostics) : null,
    },
  });
  await notifyTeam(ticket);
  return { ticket };
}

// Posts new requests to a Slack/Discord-compatible incoming webhook when SUPPORT_WEBHOOK_URL is set.
async function notifyTeam(t: { id: string; shop: string; email: string; category: string; subject: string; message: string; diagnostics: string | null }) {
  const url = process.env.SUPPORT_WEBHOOK_URL;
  if (!url) return;
  const topic = SUPPORT_CATEGORIES[t.category as SupportCategory] ?? t.category;
  const text = [
    `New Cartivo support request #${t.id}`,
    `Store: ${t.shop}`,
    `Reply to: ${t.email}`,
    `Topic: ${topic}`,
    `Subject: ${t.subject}`,
    "",
    t.message,
    t.diagnostics ? `\nDiagnostics: ${t.diagnostics}` : "",
  ].join("\n");
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, content: text.slice(0, 2000) }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    // The request is already saved; a failed notification must not fail the merchant's submit.
    console.error("Support webhook failed", e);
  }
}
