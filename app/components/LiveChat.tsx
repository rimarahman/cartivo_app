// Live chat with the CartKit team inside the Help panel. Polls /app/chat: every few seconds while the chat
// is on screen, slowly otherwise (for the unread badge on the Help button).
import { useEffect, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";
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

export function LiveChat({ chat, onEmail, onNavigate }: { chat: ReturnType<typeof useLiveChat>; onEmail?: () => void; onNavigate?: () => void }) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const count = chat.messages.length + chat.pending.length;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [count]);

  const send = () => {
    if (chat.submit(text)) setText("");
  };

  if (!chat.allowed) {
    return (
      <div className="ckx-chat-locked">
        <span className="ckx-chat-locked-icon" aria-hidden="true">💬</span>
        <strong>Live chat is part of Growth and Premium</strong>
        <p>Chat with the CartKit team in real time. Email support stays free on every plan.</p>
        <Link to="/app/pricing" className="ckx-chat-locked-cta" onClick={onNavigate}>
          See plans
        </Link>
        {onEmail && (
          <button type="button" className="ckx-inbox-link" onClick={onEmail}>
            Email us instead
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="ckx-chat">
      <div className={`ckx-chat-status${chat.online ? " ckx-online" : ""}`}>
        {chat.online ? "Online · we usually reply in a few minutes" : "Away · leave a message and we'll reply here soon"}
      </div>
      <div className="ckx-chat-list" ref={listRef} aria-live="polite">
        <div className="ckx-chat-msg ckx-them">
          <div className="ckx-chat-bubble">Hi! 👋 Ask us anything about CartKit: setup, your theme, campaigns or billing.</div>
        </div>
        {chat.messages.map((m) => (
          <div key={m.id} className={`ckx-chat-msg ckx-${m.sender === "merchant" ? "me" : "them"}`}>
            <div className="ckx-chat-bubble">{m.body}</div>
            <span className="ckx-chat-time">
              {m.sender === "agent" ? "CartKit team · " : ""}
              {time(m.createdAt)}
            </span>
          </div>
        ))}
        {chat.pending.map((m) => (
          <div key={m.id} className={`ckx-chat-msg ckx-me${m.failed ? " ckx-failed" : " ckx-pending"}`}>
            <div className="ckx-chat-bubble">{m.body}</div>
            <span className="ckx-chat-time">{m.failed ? chat.error || "Not sent" : "Sending…"}</span>
          </div>
        ))}
        {!chat.loaded && <div className="ckx-chat-loading">Loading conversation…</div>}
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
          placeholder="Write a message…"
          rows={1}
          maxLength={2000}
          aria-label="Message"
        />
        <button type="button" onClick={send} disabled={!text.trim() || chat.sending} aria-label="Send">
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
            <path d="M3 10l14-7-5 14-2-6-7-1z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  );
}
