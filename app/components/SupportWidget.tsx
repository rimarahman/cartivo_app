// Floating "Help" button shown on every admin page. Opens a support panel in place: quick fixes and FAQ,
// live chat with the team, and an email form with past requests (/app/support and /app/chat resource routes).
import { useEffect, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import type { SupportActionData, SupportLoaderData } from "../routes/app.support";
import { Checkbox, Grid, Select, TextField } from "./fields";
import { LiveChat, useLiveChat } from "./LiveChat";
import { useEmbedStatus } from "./useEmbedStatus";

const ROUTE = "/app/support";
const EMPTY = { category: "setup", subject: "", message: "" };

const QUICK_LINKS = [
  { icon: "theme", title: "Cart doesn't open", to: "/app" },
  { icon: "code", title: "Theme compatibility", to: "/app/advanced" },
  { icon: "discount", title: "Discounts & gifts", to: "/app/campaigns" },
  { icon: "credit-card", title: "Plans & billing", to: "/app/pricing" },
] as const;

const FAQ = [
  {
    q: "The cart drawer doesn't appear on my store",
    a: "Open the theme editor → App embeds and turn on “Cartivo cart drawer”, then save. Check that the drawer is enabled on the Cart drawer page and that the page isn't listed under “Disable on these URL paths”.",
  },
  {
    q: "Clicking my theme's cart icon still goes to the cart page",
    a: "Some themes use a custom cart icon. Go to Custom code & languages → Theme compatibility and add its CSS selector under “Extra cart icon selectors”, and the count bubble under “Extra cart count selectors”.",
  },
  {
    q: "My campaign isn't showing on the storefront",
    a: "Campaigns need a paid plan (Essential or higher; Volume discounts need Premium) and the status “Active”. Also check the schedule and the countries it's limited to, then use “Republish to store” on the dashboard.",
  },
  {
    q: "Gift or volume prices aren't discounted at checkout",
    a: "Cartivo creates an automatic discount called “Cartivo rewards”. Make sure it's active under Discounts in your Shopify admin and that your other discounts can combine with it.",
  },
  {
    q: "How do I translate the cart for other languages or markets?",
    a: "Translate the drawer texts under Custom code & languages → Languages. Each campaign has its own Translations and Markets sections for per-country messages, products and currency thresholds.",
  },
  {
    q: "What happens if I uninstall Cartivo?",
    a: "The cart drawer disappears from your theme automatically and no code is left behind. 48 hours after you uninstall, Shopify asks us to erase your store's data, and Cartivo then deletes your settings, campaigns, analytics, chat and support requests. If you reinstall before then, everything is still there.",
  },
];

export function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"help" | "chat" | "contact">("help");
  const chat = useLiveChat(open && tab === "chat");
  const data = useFetcher<SupportLoaderData>();
  const send = useFetcher<SupportActionData>();
  const shopify = useAppBridge();
  const [form, setForm] = useState({ ...EMPTY, email: "" });
  const [diagnostics, setDiagnostics] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const info = data.data;
  const embed = useEmbedStatus(open);
  const sending = send.state !== "idle";
  const errors = send.data?.errors || {};
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  // Load (and refresh the request list) each time the panel opens.
  useEffect(() => {
    if (open) data.load(ROUTE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Prefill the reply address with the store's email once known.
  const [prefilled, setPrefilled] = useState(false);
  if (info && !prefilled) {
    setPrefilled(true);
    if (!form.email) setForm((f) => ({ ...f, email: info.email }));
  }

  // Clear the form once a message went through (keep the reply address).
  const [handled, setHandled] = useState<SupportActionData | null>(null);
  if (send.state === "idle" && send.data && send.data !== handled) {
    setHandled(send.data);
    if (send.data.ok) setForm((f) => ({ ...EMPTY, email: f.email }));
  }

  useEffect(() => {
    if (send.state !== "idle" || !send.data) return;
    // Errors stay in the panel (see sendError below); only success is a toast.
    if (send.data.ok) {
      shopify.toast.show("Message sent. We'll reply by email.");
      data.load(ROUTE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [send.state, send.data]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = () =>
    send.submit(
      { ...form, diagnostics: String(diagnostics), appEmbed: embed === null ? "unknown" : embed ? "on" : "off" },
      { method: "post", action: ROUTE },
    );
  const sendError = send.state === "idle" ? send.data?.error : undefined;
  const categories = info?.categories ?? { setup: "Setup & installation" };
  const status = (s: string) => (s === "closed" ? "Closed" : s === "answered" ? "Answered" : "Open");

  return (
    <>
      <button
        type="button"
        className={`ckx-help-fab${open ? " ckx-open" : ""}`}
        aria-expanded={open}
        aria-controls="ckx-help-panel"
        onClick={() => setOpen(!open)}
      >
        <span className="ckx-help-fab-icon" aria-hidden="true">
          {open ? "✕" : "?"}
        </span>
        <span className="ckx-help-fab-label">{open ? "Close" : "Help"}</span>
        {!open && chat.unread > 0 && (
          <span className="ckx-help-fab-badge" aria-label={`${chat.unread} new chat messages`}>
            {chat.unread}
          </span>
        )}
      </button>

      <div className={`ckx-help-overlay${open ? " ckx-open" : ""}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <div
        id="ckx-help-panel"
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Cartivo support"
        aria-hidden={!open}
        className={`ckx-help-panel${open ? " ckx-open" : ""}`}
      >
        <div className="ckx-help-head">
          <div>
            <strong>Hi there 👋</strong>
            <span>
              {chat.online
                ? "We're online now. Chat with us anytime."
                : info?.priority
                  ? "Pro support: we usually reply within a few hours."
                  : "We usually reply within 1 business day."}
            </span>
          </div>
          <div className="ckx-help-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "help"} onClick={() => setTab("help")}>
              Help
            </button>
            <button type="button" role="tab" aria-selected={tab === "chat"} onClick={() => setTab("chat")}>
              Live chat
              {chat.unread > 0 && <i className="ckx-help-dot" aria-label="New messages" />}
            </button>
            <button type="button" role="tab" aria-selected={tab === "contact"} onClick={() => setTab("contact")}>
              Email us
            </button>
          </div>
        </div>

        <div className={`ckx-help-body${tab === "chat" ? " ckx-help-body-chat" : ""}`} key={tab}>
          {tab === "chat" ? (
            <LiveChat chat={chat} onEmail={() => setTab("contact")} onNavigate={() => setOpen(false)} />
          ) : tab === "help" ? (
            <>
              {embed === false && (
                <div className="ckx-help-alert">
                  <s-icon type="alert-circle" tone="caution" />
                  <span>
                    The Cartivo app embed is off in your live theme, so the cart won&apos;t show.{" "}
                    <Link to="/app" onClick={() => setOpen(false)}>
                      Open setup guide
                    </Link>
                  </span>
                </div>
              )}
              <div className="ckx-help-quick">
                {QUICK_LINKS.map((l) => (
                  <Link key={l.title} to={l.to} onClick={() => setOpen(false)}>
                    <s-icon type={l.icon} />
                    {l.title}
                  </Link>
                ))}
              </div>
              <div className="ckx-help-section">Frequently asked questions</div>
              <Faq />
              <button type="button" className="ckx-help-cta" onClick={() => setTab(chat.allowed ? "chat" : "contact")}>
                {chat.allowed ? "Still need help? Chat with us →" : "Still need help? Send us a message →"}
              </button>
            </>
          ) : (
            <>
              <div className="ckx-help-form">
                <Grid>
                  <TextField label="Reply to" value={form.email} onChange={set("email")} placeholder="you@example.com" error={errors.email} />
                  <Select
                    label="Topic"
                    value={form.category}
                    onChange={set("category")}
                    options={Object.entries(categories).map(([value, label]) => ({ value, label }))}
                  />
                </Grid>
                <TextField
                  label="Subject"
                  value={form.subject}
                  onChange={set("subject")}
                  placeholder="e.g. Free gift isn't added on my product page"
                  maxLength={120}
                  error={errors.subject}
                />
                <TextField
                  label="Message"
                  value={form.message}
                  onChange={set("message")}
                  multiline={5}
                  placeholder="What happened, on which page, and what you expected. A product or page link helps."
                  maxLength={5000}
                  error={errors.message}
                />
                <Checkbox
                  label="Include store diagnostics"
                  details="Store domain, Shopify plan, app embed status, your Cartivo plan and enabled features. No customer or order data."
                  value={diagnostics}
                  onChange={setDiagnostics}
                />
                {sendError && (
                  <s-banner tone="critical" heading="Your message wasn't sent">
                    <s-paragraph>{sendError}</s-paragraph>
                  </s-banner>
                )}
                <s-button variant="primary" onClick={submit} {...(sending ? { loading: true } : {})}>
                  Send message
                </s-button>
                {info?.contact.email && (
                  <s-text color="subdued">
                    Or email us at <s-link href={`mailto:${info.contact.email}`}>{info.contact.email}</s-link>
                  </s-text>
                )}
              </div>

              <div className="ckx-help-section">Your requests</div>
              {!info ? (
                <s-spinner size="base" />
              ) : info.tickets.length === 0 ? (
                <s-text color="subdued">No requests yet. Anything you send shows up here.</s-text>
              ) : (
                <ul className="ckx-tickets">
                  {info.tickets.map((t) => (
                    <li key={t.id}>
                      <span className="ckx-ticket-subject">{t.subject}</span>
                      <span className="ckx-ticket-meta">
                        {(categories as Record<string, string>)[t.category] ?? t.category} · {new Date(t.createdAt).toLocaleDateString()}
                      </span>
                      <s-badge tone={t.status === "answered" ? "success" : t.status === "closed" ? "neutral" : "info"}>{status(t.status)}</s-badge>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// One answer open at a time; answers slide open with a height animation.
function Faq() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="ckx-help-faq">
      {FAQ.map((f, i) => (
        <div key={f.q} className="ckx-faq" data-open={open === i}>
          <button type="button" aria-expanded={open === i} aria-controls={`ckx-faq-${i}`} onClick={() => setOpen(open === i ? null : i)}>
            {f.q}
          </button>
          <div id={`ckx-faq-${i}`} className="ckx-faq-panel" aria-hidden={open !== i}>
            <div>
              <p>{f.a}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
