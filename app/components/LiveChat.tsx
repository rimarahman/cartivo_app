// Live chat with the Cartivo team on the Help page. Polls /app/chat every few seconds while the page is open.
// Plain fetch (App Bridge adds the session token), not useFetcher: a fetcher's network error ("Failed to fetch"
// after the tab slept or the server spun down) throws to the route ErrorBoundary and replaces the whole app.
import { useEffect, useRef, useState } from "react";
import { TextField } from "./fields";
import type { ChatActionData, ChatLoaderData } from "../routes/app.chat";
import type { ChatMessageView } from "../models/chat.server";

const ROUTE = "/app/chat";
const FAST = 4000;
const SLOW = 30000;

type Pending = { id: string; body: string; failed?: boolean };

export function useLiveChat(active: boolean) {
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [online, setOnline] = useState(false);
  const [unread, setUnread] = useState(0);
  const [pending, setPending] = useState<Pending[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [allowed, setAllowed] = useState(true); // false on plans without live chat
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const last = messages[messages.length - 1]?.createdAt;
  const lastRef = useRef(last);
  const activeRef = useRef(active);
  const polling = useRef(false);
  useEffect(() => {
    lastRef.current = last;
    activeRef.current = active;
  });

  useEffect(() => {
    let alive = true;
    const load = async () => {
      // Skip while the tab is in the background; it re-polls as soon as it's visible again.
      if (polling.current || document.hidden) return;
      polling.current = true;
      const q = new URLSearchParams();
      if (lastRef.current) q.set("since", lastRef.current);
      if (activeRef.current) q.set("read", "1");
      try {
        const res = await fetch(`${ROUTE}?${q}`);
        if (!res.ok || !alive) return;
        const data: ChatLoaderData = await res.json();
        if (!alive) return;
        setLoaded(true);
        setAllowed(data.allowed);
        setOnline(data.online);
        setUnread(activeRef.current ? 0 : data.unread);
        if (data.messages.length) setMessages((m) => merge(m, data.messages));
      } catch {
        // Offline, asleep or the server waking up: try again on the next tick.
      } finally {
        polling.current = false;
      }
    };
    const onVisible = () => {
      if (!document.hidden) load();
    };
    // Locked plans: only re-check when the chat is opened (e.g. after upgrading), no background polling.
    if (allowed || active) load();
    if (!allowed) return () => {
      alive = false;
    };
    const t = setInterval(load, active ? FAST : SLOW);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active, allowed]);

  const submit = (body: string) => {
    const text = body.trim();
    if (!text || sending) return false;
    setPending((p) => [...p.filter((x) => !x.failed), { id: `tmp-${Date.now()}`, body: text }]);
    setSending(true);
    setError(undefined);
    (async () => {
      let result: ChatActionData;
      try {
        const res = await fetch(ROUTE, { method: "POST", body: new URLSearchParams({ body: text }) });
        result = res.ok ? await res.json() : { error: "Message not sent. Please try again." };
      } catch {
        result = { error: "Message not sent. Check your connection and try again." };
      }
      // Swap the optimistic bubble for the stored message (or mark it failed).
      const sent = result.message;
      setPending((p) => (sent ? p.slice(1) : p.map((x, i) => (i === 0 ? { ...x, failed: true } : x))));
      if (sent) setMessages((m) => merge(m, [sent]));
      setError(result.error);
      setSending(false);
    })();
    return true;
  };

  return { allowed, messages, pending, online, unread, loaded, sending, error, submit };
}

function merge(current: ChatMessageView[], incoming: ChatMessageView[]) {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

// Merchant side of the chat, on the Help page: Polaris controls, chat bubbles styled like the support inbox.
export function LiveChat({ chat }: { chat: ReturnType<typeof useLiveChat> }) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const count = chat.messages.length + chat.pending.length;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [count]);

  const send = () => {
    if (chat.submit(text)) setText("");
  };

  // Plan-gated: no chat controls, just what unlocks it (BFS 4.3.7).
  if (!chat.allowed) {
    return (
      <s-stack gap="base">
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-badge icon="lock">Growth plan</s-badge>
          <s-text color="subdued">Live chat is part of the Growth and Premium plans. Email support is included in every plan.</s-text>
        </s-stack>
        <s-stack direction="inline">
          <s-button href="/app/pricing">See plans</s-button>
        </s-stack>
      </s-stack>
    );
  }

  return (
    <s-stack gap="base">
      <s-stack direction="inline" gap="small-200" alignItems="center">
        <s-badge tone={chat.online ? "success" : "neutral"}>{chat.online ? "Online" : "Away"}</s-badge>
        <s-text color="subdued">
          {chat.online ? "We usually reply in a few minutes." : "Leave a message and we'll reply here soon."}
        </s-text>
      </s-stack>
      <div className="ckx-chat-scroll" ref={listRef} aria-live="polite">
        <Bubble mine={false} body="Hi! Ask us anything about Cartivo: setup, your theme, campaigns or billing." />
        {chat.messages.map((m) => (
          <Bubble
            key={m.id}
            mine={m.sender === "merchant"}
            body={m.body}
            meta={`${m.sender === "agent" ? "Cartivo team · " : ""}${time(m.createdAt)}`}
          />
        ))}
        {chat.pending.map((m) => (
          <Bubble key={m.id} mine body={m.body} meta={m.failed ? chat.error || "Not sent" : "Sending…"} failed={m.failed} />
        ))}
        {!chat.loaded && <s-spinner size="base" accessibilityLabel="Loading conversation" />}
    </div>
      <TextField label="Message" multiline={2} maxLength={2000} value={text} onChange={setText} />
      <s-stack direction="inline">
        <s-button variant="primary" onClick={send} {...(!text.trim() || chat.sending ? { disabled: true } : {})}>
          Send
        </s-button>
      </s-stack>
    </s-stack>
  );
}

function Bubble({ mine, body, meta, failed }: { mine: boolean; body: string; meta?: string; failed?: boolean }) {
  return (
    <div className={`ckx-chat-msg ${mine ? "ckx-me" : "ckx-them"}${failed ? " ckx-failed" : ""}`}>
      <div className="ckx-chat-bubble">{body}</div>
      {meta && <span className="ckx-chat-time">{meta}</span>}
    </div>
  );
}
