// Help page in the app nav: quick fixes and FAQ, live chat with the team, and an email form with past requests.
// A regular Polaris page instead of a floating widget, so support looks and behaves like the rest of the admin (BFS 4.1.1).
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getPlan } from "../models/billing.server";
import { getSettings, listCampaigns } from "../models/store.server";
import {
  SUPPORT_CATEGORIES,
  collectDiagnostics,
  createTicket,
  listTickets,
  shopEmail,
  supportContact,
  validateTicket,
  type TicketInput,
} from "../models/support.server";
import { Checkbox, Grid, Select, TextField } from "../components/fields";
import { LiveChat, useLiveChat } from "../components/LiveChat";
import { useEmbedStatus } from "../components/useEmbedStatus";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);
  const [tickets, email, plan] = await Promise.all([listTickets(session.shop), shopEmail(admin), getPlan(billing, session.shop, admin)]);
  return { tickets, email, priority: plan.features.prioritySupport, contact: supportContact(), categories: SUPPORT_CATEGORIES };
};

export type SupportActionData = { ok?: boolean; error?: string; errors?: Partial<Record<keyof TicketInput, string>> };

export const action = async ({ request }: ActionFunctionArgs): Promise<SupportActionData> => {
  const { admin, session, billing } = await authenticate.admin(request);
  const form = await request.formData();
  const input: TicketInput = {
    email: String(form.get("email") || ""),
    category: String(form.get("category") || ""),
    subject: String(form.get("subject") || ""),
    message: String(form.get("message") || ""),
  };
  const errors = validateTicket(input);
  if (Object.keys(errors).length) return { errors };

  let diagnostics: Record<string, unknown> | null = null;
  if (form.get("diagnostics") === "true") {
    const [plan, settings, campaigns] = await Promise.all([
      getPlan(billing, session.shop, admin),
      getSettings(session.shop),
      listCampaigns(session.shop),
    ]);
    diagnostics = await collectDiagnostics(admin, {
      cartkitPlan: plan.name,
      // Read in the browser with App Bridge (useEmbedStatus) and sent with the form.
      appEmbed: ["on", "off"].includes(String(form.get("appEmbed"))) ? String(form.get("appEmbed")) : "unknown",
      drawer: settings.drawer.enabled,
      sticky: settings.sticky.enabled,
      floating: settings.floating.enabled,
      activeCampaigns: campaigns.filter((c) => c.status === "active").map((c) => c.type),
      browser: request.headers.get("user-agent"),
    });
  }
  const result = await createTicket(session.shop, input, diagnostics);
  if ("error" in result) return { error: result.error };
  return { ok: true };
};

const EMPTY = { category: "setup", subject: "", message: "" };

const QUICK_LINKS = [
  { title: "Turn on the app embed", to: "/app" },
  { title: "Theme compatibility", to: "/app/advanced" },
  { title: "Discounts & gifts", to: "/app/campaigns" },
  { title: "Plans & billing", to: "/app/pricing" },
];

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

const STATUS: Record<string, { label: string; tone: "success" | "neutral" | "info" }> = {
  answered: { label: "Answered", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
  open: { label: "Open", tone: "info" },
};

export default function Help() {
  const info = useLoaderData<typeof loader>();
  const chat = useLiveChat(true);
  const send = useFetcher<SupportActionData>();
  const shopify = useAppBridge();
  const embed = useEmbedStatus();
  const [form, setForm] = useState({ ...EMPTY, email: info.email });
  const [diagnostics, setDiagnostics] = useState(true);
  const sending = send.state !== "idle";
  const errors = send.data?.errors || {};
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  // Clear the form once a message went through (keep the reply address).
  const [handled, setHandled] = useState<SupportActionData | null>(null);
  if (send.state === "idle" && send.data && send.data !== handled) {
    setHandled(send.data);
    if (send.data.ok) setForm((f) => ({ ...EMPTY, email: f.email }));
  }

  // Errors stay on the page (sendError below); only success is a toast. The request list reloads by itself.
  useEffect(() => {
    if (send.state === "idle" && send.data?.ok) shopify.toast.show("Message sent. We'll reply by email.");
  }, [send.state, send.data, shopify]);

  const submit = () =>
    send.submit(
      { ...form, diagnostics: String(diagnostics), appEmbed: embed === null ? "unknown" : embed ? "on" : "off" },
      { method: "post" },
    );
  const sendError = send.state === "idle" ? send.data?.error : undefined;

  return (
    <s-page heading="Help">
      {embed === false && (
        <s-banner tone="warning" heading="The Cartivo app embed is off">
          <s-paragraph>The cart drawer won&apos;t show on your store until you turn on the app embed in your live theme.</s-paragraph>
          <s-button slot="secondary-actions" href="/app">
            Open setup guide
          </s-button>
        </s-banner>
      )}

      <s-section heading="Frequently asked questions">
        <s-stack gap="base">
          {FAQ.map((f, i) => (
            <s-stack key={f.q} gap="small-200">
              {i > 0 && <s-divider />}
              <s-heading>{f.q}</s-heading>
              <s-paragraph>{f.a}</s-paragraph>
            </s-stack>
          ))}
        </s-stack>
      </s-section>

      <s-section heading="Live chat">
        <LiveChat chat={chat} />
      </s-section>

      <s-section heading="Email us">
        <s-stack gap="base">
          <Grid>
            <TextField label="Reply to" value={form.email} onChange={set("email")} placeholder="you@example.com" error={errors.email} />
            <Select
              label="Topic"
              value={form.category}
              onChange={set("category")}
              options={Object.entries(info.categories).map(([value, label]) => ({ value, label }))}
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
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-button variant="primary" onClick={submit} {...(sending ? { loading: true } : {})}>
              Send message
            </s-button>
            {info.contact.email && (
              <s-text color="subdued">
                Or email us at <s-link href={`mailto:${info.contact.email}`}>{info.contact.email}</s-link>
              </s-text>
            )}
          </s-stack>
        </s-stack>
      </s-section>

      <s-section heading="Your requests" padding={info.tickets.length ? "none" : "base"}>
        {info.tickets.length === 0 ? (
          <s-text color="subdued">No requests yet. Anything you send shows up here.</s-text>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Subject</s-table-header>
              <s-table-header>Topic</s-table-header>
              <s-table-header>Sent</s-table-header>
              <s-table-header>Status</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {info.tickets.map((t) => {
                const status = STATUS[t.status] ?? STATUS.open;
                return (
                  <s-table-row key={t.id}>
                    <s-table-cell>{t.subject}</s-table-cell>
                    <s-table-cell>{(info.categories as Record<string, string>)[t.category] ?? t.category}</s-table-cell>
                    <s-table-cell>{new Date(t.createdAt).toLocaleDateString()}</s-table-cell>
                    <s-table-cell>
                      <s-badge tone={status.tone}>{status.label}</s-badge>
                    </s-table-cell>
                  </s-table-row>
                );
              })}
            </s-table-body>
          </s-table>
        )}
      </s-section>

      <s-section slot="aside" heading="Quick fixes">
        <s-stack gap="small-200">
          {QUICK_LINKS.map((l) => (
            <s-link key={l.title} href={l.to}>
              {l.title}
            </s-link>
          ))}
        </s-stack>
      </s-section>
      <s-section slot="aside" heading="Response times">
        <s-text color="subdued">
          {info.priority ? "Priority support: we usually reply within a few hours." : "We usually reply within 1 business day."}
        </s-text>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
