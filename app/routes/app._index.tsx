import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Link, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { getSettings, listCampaigns } from "../models/store.server";
import { getPlan } from "../models/billing.server";
import { PAID_PLANS } from "../lib/plans";
import { METAFIELD_NAMESPACE, trySync } from "../models/sync.server";
import { CampaignTypeGrid, StatCard } from "../components/ui";
import { EMBED_HANDLE, embedEnabled } from "../models/theme.server";
import { useSave } from "../components/useSave";

async function configPublished(admin: any) {
  try {
    const res = await admin.graphql(`#graphql
      query {
        currentAppInstallation {
          metafield(namespace: "${METAFIELD_NAMESPACE}", key: "config") { id }
        }
      }`);
    const json: any = await res.json();
    return Boolean(json.data?.currentAppInstallation?.metafield);
  } catch {
    return null;
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);
  const since = new Date(Date.now() - 30 * 864e5);
  const [
    campaigns,
    plan,
    enabled,
    events,
    published,
    settingsRow,
    settings,
  ] = await Promise.all([
    listCampaigns(session.shop),
    getPlan(billing, session.shop),
    embedEnabled(admin),
    db.event.groupBy({
      by: ["type"],
      where: { shop: session.shop, createdAt: { gte: since } },
      _count: { _all: true },
    }),
    configPublished(admin),
    db.shopSettings.findUnique({
      where: { shop: session.shop },
      select: { data: true },
    }),
    getSettings(session.shop),
  ]);
  // Fresh install: the app embed renders nothing until the config metafield exists.
  if (published === false) await trySync(admin, session.shop, plan);
  const counts = Object.fromEntries(events.map((e) => [e.type, e._count._all]));
  return {
    shop: session.shop,
    apiKey: process.env.SHOPIFY_API_KEY || "",
    embedHandle: EMBED_HANDLE,
    enabled,
    plan,
    activeCampaigns: campaigns.filter((c) => c.status === "active").length,
    campaignCount: campaigns.length,
    // Settings are stored the first time the merchant saves any settings page.
    customized: Boolean(settingsRow && settingsRow.data !== "{}"),
    stickyOrFloating: settings.sticky.enabled || settings.floating.enabled,
    counts,
  };
};

// "Republish" button: pushes the current configuration to the storefront again.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);
  const plan = await getPlan(billing, session.shop);
  const sync = await trySync(admin, session.shop, plan);
  return { saved: sync.ok, syncError: sync.error };
};

export default function Dashboard() {
  const data = useLoaderData<typeof loader>();
  const { save, saving } = useSave<Record<string, never>>();
  const editorUrl = `https://${data.shop}/admin/themes/current/editor?context=apps&activateAppId=${data.apiKey}/${data.embedHandle}`;
  const live = data.enabled === true;

  const steps = [
    {
      done: live,
      title: "Turn on the Cartivo app embed",
      text: "Theme editor → App embeds → Cartivo cart drawer → Save.",
      action: (
        <s-button
          href={editorUrl}
          target="_blank"
          variant={live ? "tertiary" : "primary"}
        >
          {live ? "Open theme editor" : "Enable"}
        </s-button>
      ),
    },
    {
      done: data.customized,
      title: "Pick a style for your cart",
      text: "Choose a ready-made look or match your brand colors.",
      action: (
        <s-button href="/app/drawer" variant="tertiary">
          Customize
        </s-button>
      ),
    },
    {
      done: data.campaignCount > 0,
      title: "Create a free shipping or free gift goal",
      text: "A progress bar in the cart that raises your average order value.",
      action: (
        <s-button href="/app/campaigns/new?type=rewards" variant="tertiary">
          Create goal
        </s-button>
      ),
    },
    {
      done: data.stickyOrFloating,
      title: "Turn on the sticky add-to-cart and floating cart",
      text: "A buy button that follows shoppers on product pages, and a cart button on every page.",
      action: (
        <s-button href="/app/sticky" variant="tertiary">
          {data.stickyOrFloating ? "Adjust" : "Turn on"}
        </s-button>
      ),
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  return (
    <s-page heading="Dashboard">
      <s-button
        slot="primary-action"
        onClick={() => save({})}
        {...(saving ? { loading: true } : {})}
      >
        Republish to store
      </s-button>

      <s-section padding="none">
        <div className="ckx-hero">
          <div>
            <span className={`ckx-status${live ? " ckx-live" : ""}`}>
              {live
                ? "Live on your store"
                : data.enabled === false
                  ? "Not enabled yet"
                  : "Status unknown"}
            </span>
            <h2>
              {live
                ? "Your cart is working hard for you"
                : "Welcome to Cartivo"}
            </h2>
            <p>
              {live
                ? "Slide cart, goals, upsells and sticky add-to-cart are running. Fine-tune them anytime."
                : "Turn on the app embed and your store gets a beautiful slide cart with a gradient checkout button, ready out of the box."}
            </p>
            <div className="ckx-hero-actions">
              {!live && (
                <a
                  className="ckx-hero-btn ckx-solid"
                  href={editorUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Enable in theme editor ↗
                </a>
              )}
              <Link
                className={`ckx-hero-btn${live ? " ckx-solid" : ""}`}
                to="/app/drawer"
              >
                Customize cart
              </Link>
              <Link className="ckx-hero-btn" to="/app/campaigns">
                Campaigns
              </Link>
            </div>
          </div>
          <div className="ckx-hero-art" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
      </s-section>

{data.plan.id === "trial" && (
        <s-banner tone="info" heading={`Free trial: ${data.plan.trialDaysLeft} day${data.plan.trialDaysLeft === 1 ? "" : "s"} left`}>
          <s-paragraph>
            Every feature is unlocked. When the trial ends you'll pick a plan: Starter (free), Essential, Growth or Premium.
          </s-paragraph>
          <s-button href="/app/pricing" variant="primary">
            Choose a plan
          </s-button>
        </s-banner>
      )}

      {data.enabled === false && (
        <s-banner
          tone="warning"
          heading="Cart drawer is not enabled on your theme"
        >
          <s-paragraph>
            Turn on the Cartivo app embed in your theme editor to show the cart
            drawer on your store.
          </s-paragraph>
          <s-button href={editorUrl} target="_blank" variant="primary">
            Enable in theme editor
          </s-button>
        </s-banner>
      )}

      {/* Always visible: once everything is done it stays as a checklist to revisit each part. */}
      <s-section heading={allDone ? "Setup complete 🎉" : "Setup guide"}>
        <s-stack gap="base">
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-text color="subdued">
              {allDone
                ? "Everything is set up. Use these links to fine-tune anytime."
                : `${doneCount} of ${steps.length} steps done`}
            </s-text>
          </s-stack>
          <div className="ckx-progress">
            <div style={{ width: `${(doneCount / steps.length) * 100}%` }} />
          </div>
          <div className="ckx-steps">
            {steps.map((step) => (
              <div
                key={step.title}
                className={`ckx-step${step.done ? " ckx-step-done" : ""}`}
              >
                <s-icon
                  type={step.done ? "check-circle-filled" : "circle-dashed"}
                  tone={step.done ? "success" : "neutral"}
                />
                <div>
                  <div className="ckx-step-title">{step.title}</div>
                  <s-text color="subdued">{step.text}</s-text>
                </div>
                {step.action}
              </div>
            ))}
          </div>
        </s-stack>
      </s-section>

      <s-section heading="Last 30 days">
        <div className="ckx-grid" style={{ ["--ckx-min" as string]: "140px" }}>
          <StatCard
            icon="cart"
            label="Cart opens"
            value={data.counts.drawer_open || 0}
          />
          <StatCard
            icon="product-add"
            label="Upsells added"
            value={data.counts.upsell_add || 0}
            tint="#fce7f3"
          />
          <StatCard
            icon="gift-card"
            label="Gifts unlocked"
            value={data.counts.gift_added || 0}
            tint="#dcfce7"
          />
          <StatCard
            icon="bolt"
            label="Sticky cart adds"
            value={data.counts.sticky_add || 0}
            tint="#fef3c7"
          />
          <StatCard
            icon="credit-card"
            label="Checkouts started"
            value={data.counts.checkout_click || 0}
            tint="#cffafe"
          />
        </div>
      </s-section>

      <s-section heading="Grow your average order value">
        <CampaignTypeGrid plan={data.plan} />
      </s-section>

      <s-section slot="aside" heading="Plan">
        <s-stack gap="small-200">
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-text type="strong">{data.plan.name}</s-text>
            <s-badge tone={data.plan.id === "trial" ? "info" : data.plan.id === "free" ? "neutral" : "success"}>
              {data.plan.id === "trial" ? `${data.plan.trialDaysLeft} days left` : data.plan.id === "free" ? "Current" : "Active"}
            </s-badge>
          </s-stack>
          <s-text color="subdued">
            {data.plan.id === "trial"
              ? "Every feature is unlocked. When the trial ends you pick a plan: Starter (free), Essential, Growth or Premium."
              : data.plan.id === "free" || data.plan.id === "choose"
                ? "Cart drawer, sticky add-to-cart and floating cart. Campaigns start at $10/month."
                : PAID_PLANS[data.plan.id].tagline + "."}
          </s-text>
          {data.plan.id !== "pro" && (
            <s-button href="/app/pricing" variant="primary">
              {data.plan.id === "trial" ? "See plans" : data.plan.id === "free" ? "Choose a plan" : "Upgrade"}
            </s-button>
          )}
        </s-stack>
      </s-section>
      <s-section slot="aside" heading="Campaigns">
        <s-stack gap="small-200">
          <s-text>
            <s-text type="strong">{data.activeCampaigns}</s-text> active of{" "}
            {data.campaignCount}
          </s-text>
          <s-link href="/app/campaigns">Manage campaigns</s-link>
        </s-stack>
      </s-section>
      <s-section slot="aside" heading="Help">
        <s-stack gap="small-200">
          <s-text color="subdued">
            Cart not opening on your theme? Add your cart icon selector under
            custom code.
          </s-text>
          <s-link href="/app/advanced">Theme compatibility</s-link>
          <s-text color="subdued">
            Questions? Use the Help button in the bottom corner of any page.
          </s-text>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
