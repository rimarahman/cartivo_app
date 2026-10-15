// Live chat with the Cartivo team on the Help page. Polls /app/chat every few seconds while the page is open.
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { TextField } from "./fields";
import type { ChatActionData, ChatLoaderData } from "../routes/app.chat";
import type { ChatMessageView } from "../models/chat.server";

const ROUTE = "/app/chat";
const FAST = 4000;
const SLOW = 30000;

type Pending = { id: string; body: string; failed?: boolean };

export function useLiveChat(active: boolean) {
  const poll = useFetcher<ChatLoaderData>();
  const send = useFetcher<ChatActionData>();
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [online, setOnline] = useState(false);
  const [unread, setUnread] = useState(0);
  const [pending, setPending] = useState<Pending[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [allowed, setAllowed] = useState(true); // false on plans without live chat
  const last = messages[messages.length - 1]?.createdAt;
  const lastRef = useRef(last);
  const activeRef = useRef(active);
  useEffect(() => {
    lastRef.current = last;
    activeRef.current = active;
  });

  // Merge polled messages (render-time, keyed on the response object).
  const [seenPoll, setSeenPoll] = useState<ChatLoaderData | null>(null);
  if (poll.data && poll.data !== seenPoll) {
    setSeenPoll(poll.data);
    setLoaded(true);
    setAllowed(poll.data.allowed);
    setOnline(poll.data.online);
    setUnread(active ? 0 : poll.data.unread);
    if (poll.data.messages.length) setMessages((m) => merge(m, poll.data!.messages));
  }

  // Swap the optimistic bubble for the stored message (or mark it failed).
  const [seenSend, setSeenSend] = useState<ChatActionData | null>(null);
  if (send.state === "idle" && send.data && send.data !== seenSend) {
    setSeenSend(send.data);
    const sent = send.data.message;
    setPending((p) => (sent ? p.slice(1) : p.map((x, i) => (i === 0 ? { ...x, failed: true } : x))));
    if (sent) setMessages((m) => merge(m, [sent]));
  }

  useEffect(() => {
    const load = () => {
      if (poll.state !== "idle") return;
      const q = new URLSearchParams();
      if (lastRef.current) q.set("since", lastRef.current);
      if (activeRef.current) q.set("read", "1");
      poll.load(`${ROUTE}?${q}`);
    };
    // Locked plans: only re-check when the chat is opened (e.g. after upgrading), no background polling.
    if (allowed || active) load();
    if (!allowed) return;
    const t = setInterval(load, active ? FAST : SLOW);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, allowed]);

  const submit = (body: string) => {
    const text = body.trim();
    if (!text || send.state !== "idle") return false;
    setPending((p) => [...p.filter((x) => !x.failed), { id: `tmp-${Date.now()}`, body: text }]);
    send.submit({ body: text }, { method: "post", action: ROUTE });
    return true;
  };

  return { allowed, messages, pending, online, unread, loaded, sending: send.state !== "idle", error: send.data?.error, submit };
}

function merge(current: ChatMessageView[], incoming: ChatMessageView[]) {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

// Merchant side of the chat, on the Help page. Polaris components only; the bubbles are s-box cards.
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
        <s-stack gap="small-200">
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
        </s-stack>
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
    <div className={`ckx-chat-row${mine ? " ckx-me" : ""}`}>
      <s-box padding="small-200" borderRadius="base" borderWidth="base" background={mine ? "subdued" : "base"} maxInlineSize="80%">
        <s-stack gap="small-300">
          <s-text>{body}</s-text>
          {meta && (
            <s-text color="subdued" {...(failed ? { tone: "critical" } : {})}>
              {meta}
            </s-text>
          )}
        </s-stack>
      </s-box>
    </div>
  );
}
