// Support team inbox for live chat: open https://<app url>/support/inbox and sign in with SUPPORT_INBOX_KEY.
// Lives outside the Shopify admin (plain HTML, no Polaris) so the team can keep it open in any browser.
import type { ActionFunctionArgs, LinksFunction, LoaderFunctionArgs, MetaFunction } from "react-router";
import { Form, Link, data, redirect, useFetcher, useLoaderData, useRevalidator } from "react-router";
import { useEffect, useRef, useState } from "react";
import db from "../db.server";
import {
  getThread,
  inboxEnabled,
  isAgent,
  keyMatches,
  listConversations,
  markRead,
  postMessage,
  signInCookie,
  signOutCookie,
  touchAgent,
} from "../models/chat.server";
import { SUPPORT_CATEGORIES, type SupportCategory } from "../lib/support";
import adminStyles from "../styles/admin.css?url";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: adminStyles }];
export const meta: MetaFunction = () => [{ title: "CartKit support inbox" }, { name: "robots", content: "noindex" }];

const POLL_MS = 4000;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (!inboxEnabled()) throw new Response("Not found", { status: 404 });
  if (!(await isAgent(request))) return { signedIn: false as const };
  await touchAgent();
  const shop = new URL(request.url).searchParams.get("shop");
  const conversations = await listConversations();
  if (shop) await markRead(shop, "agent");
  const [messages, tickets] = shop
    ? await Promise.all([
        getThread(shop),
        db.supportTicket.findMany({
          where: { shop },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, subject: true, category: true, email: true, status: true, createdAt: true },
        }),
      ])
    : [[], []];
  return { signedIn: true as const, conversations, shop, messages, tickets };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (!inboxEnabled()) throw new Response("Not found", { status: 404 });
  const form = await request.formData();
  const intent = form.get("intent");
  if (intent === "signin") {
    if (!keyMatches(String(form.get("key") || ""))) return data({ error: "Wrong key." }, { status: 401 });
    return redirect("/support/inbox", { headers: { "Set-Cookie": await signInCookie() } });
  }
  if (intent === "signout") return redirect("/support/inbox", { headers: { "Set-Cookie": await signOutCookie() } });
  if (!(await isAgent(request))) return data({ error: "Sign in again." }, { status: 401 });
  const shop = String(form.get("shop") || "");
  if (intent === "reply" && shop) return postMessage(shop, "agent", form.get("body"));
  if (intent === "ticket-status" && shop) {
    const status = String(form.get("status"));
    if (["open", "answered", "closed"].includes(status)) {
      await db.supportTicket.updateMany({ where: { id: String(form.get("id")), shop }, data: { status } });
    }
    return { ok: true };
  }
  return { error: "Unknown action." };
};

const time = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: "short", timeStyle: "short" });

export default function Inbox() {
  const d = useLoaderData<typeof loader>();
  if (!d.signedIn) return <SignIn />;
  return <InboxView {...d} />;
}

function SignIn() {
  const fetcher = useFetcher<{ error?: string }>();
  return (
    <div className="ckx-inbox-signin">
      <fetcher.Form method="post" className="ckx-card">
        <h1>CartKit support inbox</h1>
        <p>Enter the inbox key (SUPPORT_INBOX_KEY) to answer live chats.</p>
        <input type="hidden" name="intent" value="signin" />
        <input type="password" name="key" placeholder="Inbox key" autoComplete="current-password" required />
        {fetcher.data?.error && <span className="ckx-inbox-error">{fetcher.data.error}</span>}
        <button type="submit">Sign in</button>
      </fetcher.Form>
    </div>
  );
}

function InboxView(d: Exclude<ReturnType<typeof useLoaderData<typeof loader>>, { signedIn: false }>) {
  const revalidator = useRevalidator();
  const reply = useFetcher<{ error?: string }>();
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // Poll for new chats and replies while the inbox is open (this also keeps the team "Online").
  useEffect(() => {
    const t = setInterval(() => revalidator.state === "idle" && revalidator.revalidate(), POLL_MS);
    return () => clearInterval(t);
  }, [revalidator]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [d.messages.length, d.shop]);

  const send = () => {
    if (!text.trim() || !d.shop) return;
    reply.submit({ intent: "reply", shop: d.shop, body: text }, { method: "post" });
    setText("");
  };

  const unreadTotal = d.conversations.reduce((n, c) => n + c.unread, 0);

  return (
    <div className="ckx-inbox">
      <header className="ckx-inbox-top">
        <strong>CartKit support inbox</strong>
        <span className="ckx-inbox-online">You&apos;re online{unreadTotal ? ` · ${unreadTotal} unread` : ""}</span>
        <Form method="post">
          <input type="hidden" name="intent" value="signout" />
          <button type="submit" className="ckx-inbox-link">Sign out</button>
        </Form>
      </header>
      <div className="ckx-inbox-main">
        <nav className="ckx-inbox-list" aria-label="Conversations">
          {d.conversations.length === 0 && <p className="ckx-inbox-empty">No chats yet.</p>}
          {d.conversations.map((c) => (
            <Link
              key={c.shop}
              to={`?shop=${encodeURIComponent(c.shop)}`}
              className={`ckx-inbox-conv${c.shop === d.shop ? " ckx-active" : ""}`}
            >
              <span className="ckx-inbox-shop">{c.shop.replace(".myshopify.com", "")}</span>
              {c.unread > 0 && <span className="ckx-inbox-badge">{c.unread}</span>}
              <span className="ckx-inbox-preview">
                {c.last ? `${c.last.sender === "agent" ? "You: " : ""}${c.last.body}` : ""}
              </span>
              {c.last && <span className="ckx-inbox-time">{time(c.last.createdAt)}</span>}
            </Link>
          ))}
        </nav>

        <section className="ckx-inbox-thread">
          {!d.shop ? (
            <p className="ckx-inbox-empty">Pick a conversation.</p>
          ) : (
            <>
              <div className="ckx-inbox-thread-head">
                <strong>{d.shop}</strong>
                <a href={`https://${d.shop}`} target="_blank" rel="noreferrer" className="ckx-inbox-link">
                  Open store ↗
                </a>
              </div>
              <div className="ckx-chat-list" ref={listRef}>
                {d.messages.map((m) => (
                  <div key={m.id} className={`ckx-chat-msg ckx-${m.sender === "agent" ? "me" : "them"}`}>
                    <div className="ckx-chat-bubble">{m.body}</div>
                    <span className="ckx-chat-time">{time(m.createdAt)}</span>
                  </div>
                ))}
              </div>
              <div className="ckx-chat-compose">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Reply… (Enter to send, Shift+Enter for a new line)"
                  rows={2}
                  maxLength={2000}
                  aria-label="Reply"
                />
                <button type="button" onClick={send} disabled={!text.trim()}>
                  Send
                </button>
              </div>
              {reply.data?.error && <span className="ckx-inbox-error">{reply.data.error}</span>}
            </>
          )}
        </section>

        {d.shop && (
          <aside className="ckx-inbox-side">
            <strong>Email requests</strong>
            {d.tickets.length === 0 && <p className="ckx-inbox-empty">None from this store.</p>}
            {d.tickets.map((t) => (
              <TicketRow key={t.id} shop={d.shop!} ticket={t} />
            ))}
          </aside>
        )}
      </div>
    </div>
  );
}

function TicketRow({ shop, ticket }: { shop: string; ticket: { id: string; subject: string; category: string; email: string; status: string; createdAt: string | Date } }) {
  const fetcher = useFetcher();
  return (
    <div className="ckx-inbox-ticket">
      <span className="ckx-ticket-subject">{ticket.subject}</span>
      <span className="ckx-ticket-meta">
        {SUPPORT_CATEGORIES[ticket.category as SupportCategory] ?? ticket.category} · {ticket.email}
      </span>
      <select
        aria-label="Status"
        value={ticket.status}
        onChange={(e) => fetcher.submit({ intent: "ticket-status", shop, id: ticket.id, status: e.target.value }, { method: "post" })}
      >
        <option value="open">Open</option>
        <option value="answered">Answered</option>
        <option value="closed">Closed</option>
      </select>
    </div>
  );
}
