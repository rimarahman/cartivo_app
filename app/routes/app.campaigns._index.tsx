import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { deleteCampaign, listCampaigns, setCampaignStatus } from "../models/store.server";
import { getPlan } from "../models/billing.server";
import { planCampaigns, trySync } from "../models/sync.server";
import { canUse, planFor, planName, type PlanInfo } from "../lib/plans";
import { CAMPAIGN_TYPES } from "../lib/defaults";
import { CAMPAIGN_META, CampaignTypeGrid } from "../components/ui";
import { ErrorBanner } from "../components/ErrorBanner";
import { saveErrorMessage } from "../components/useSave";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);
  const [campaigns, plan] = await Promise.all([listCampaigns(session.shop), getPlan(billing, session.shop, admin)]);
  const live = planCampaigns(campaigns, plan).map((c) => c.id);
  return { campaigns, plan, live };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);
  const form = await request.formData();
  const id = String(form.get("id"));
  const intent = form.get("intent");
  if (intent === "delete") await deleteCampaign(session.shop, id);
  if (intent === "activate") await setCampaignStatus(session.shop, id, "active");
  if (intent === "deactivate") await setCampaignStatus(session.shop, id, "draft");
  const plan = await getPlan(billing, session.shop, admin);
  const sync = await trySync(admin, session.shop, plan);
  return { saved: true, syncError: sync.error };
};

function scheduleText(c: { startsAt: string | null; endsAt: string | null }) {
  const fmt = (s: string) => new Date(s).toLocaleString();
  if (c.startsAt && c.endsAt) return `${fmt(c.startsAt)} → ${fmt(c.endsAt)}`;
  if (c.endsAt) return `Until ${fmt(c.endsAt)}`;
  if (c.startsAt) return `From ${fmt(c.startsAt)}`;
  return "Always";
}

export default function Campaigns() {
  const { campaigns, plan, live } = useLoaderData<typeof loader>();
  const blocked = campaigns.filter((c) => c.status === "active" && !live.includes(c.id));
  const fetcher = useFetcher<typeof action>();
  // Campaign waiting for confirmation in the delete modal.
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);
  // Publishing errors stay on the page until dismissed (BFS 4.2.4); a new result brings the banner back.
  const [dismissed, setDismissed] = useState<unknown>(null);
  const error = fetcher.state === "idle" && fetcher.data !== dismissed ? saveErrorMessage(fetcher.data) : null;

  const act = (id: string, intent: string) => fetcher.submit({ id, intent }, { method: "post" });

  return (
    <s-page heading="Campaigns">
      <s-button slot="primary-action" variant="primary" href="/app/campaigns/new?type=rewards">
        Create campaign
      </s-button>

      {error && <ErrorBanner message={error} onDismiss={() => setDismissed(fetcher.data)} />}

      {plan.id === "free" && (
        <s-banner tone="info" heading="Campaigns are part of the paid plans">
          <s-paragraph>
            You can build campaigns on Starter; they show on your store once you <s-link href="/app/pricing">choose a plan</s-link>{" "}
            (from $10/month).
          </s-paragraph>
        </s-banner>
      )}
      {plan.id !== "free" && blocked.length > 0 && (
        <s-banner tone="warning" heading={`${blocked.length} active campaign${blocked.length > 1 ? "s are" : " is"} not live`}>
          <s-paragraph>
            Your {plan.name} plan doesn't include {blocked.length > 1 ? "them" : "it"} or its active-campaign limit is reached.{" "}
            <s-link href="/app/pricing">Compare plans</s-link>
          </s-paragraph>
        </s-banner>
      )}

      {campaigns.length === 0 ? (
        <s-section>
          <s-stack gap="base">
            <s-stack gap="small-200">
              <s-heading>Create your first campaign</s-heading>
              <s-text color="subdued">
                Most stores start with a free shipping goal: shoppers see how close they are and add one more item.
              </s-text>
            </s-stack>
            <CampaignTypeGrid plan={plan} />
          </s-stack>
        </s-section>
      ) : (
      <s-section padding="none">
          <s-table>
            <s-table-header-row>
              <s-table-header>Name</s-table-header>
              <s-table-header>Type</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Schedule</s-table-header>
              <s-table-header>Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {campaigns.map((c) => (
                <s-table-row key={c.id}>
                  <s-table-cell>
                    <s-link href={`/app/campaigns/${c.id}`}>{c.name}</s-link>
                  </s-table-cell>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small-200" alignItems="center">
                      {CAMPAIGN_META[c.type] && <s-icon type={CAMPAIGN_META[c.type].icon} tone="neutral" />}
                      {CAMPAIGN_TYPES[c.type]?.label ?? c.type}
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>
                    <StatusBadge status={c.status} live={live.includes(c.id)} type={c.type} plan={plan} />
                  </s-table-cell>
                  <s-table-cell>{scheduleText(c)}</s-table-cell>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small-200">
                      <s-button href={`/app/campaigns/${c.id}`} variant="tertiary">
                        Edit
                      </s-button>
                      <s-button
                        variant="tertiary"
                        onClick={() => act(c.id, c.status === "active" ? "deactivate" : "activate")}
                      >
                        {c.status === "active" ? "Deactivate" : "Activate"}
                      </s-button>
                      <s-button
                        variant="tertiary"
                        tone="critical"
                        commandFor="delete-campaign-modal"
                        command="--show"
                        onClick={() => setToDelete({ id: c.id, name: c.name })}
                      >
                        Delete
                      </s-button>
                    </s-stack>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
      </s-section>
      )}

      <s-modal id="delete-campaign-modal" heading="Delete campaign?">
        <s-paragraph>
          {toDelete ? `"${toDelete.name}" ` : "This campaign "}is removed from your store and can't be restored.
        </s-paragraph>
        <s-button slot="secondary-actions" commandFor="delete-campaign-modal" command="--hide">
          Cancel
        </s-button>
        <s-button
          slot="primary-action"
          variant="primary"
          tone="critical"
          commandFor="delete-campaign-modal"
          command="--hide"
          onClick={() => toDelete && act(toDelete.id, "delete")}
        >
          Delete campaign
        </s-button>
      </s-modal>

      {campaigns.length > 0 && (
        <s-section heading="Create another campaign">
          <CampaignTypeGrid plan={plan} />
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);

function StatusBadge({ status, live, type, plan }: { status: string; live: boolean; type: string; plan: PlanInfo }) {
  if (status !== "active") return <s-badge tone="neutral">Draft</s-badge>;
  if (live) return <s-badge tone="success">Live</s-badge>;
  const t = type as Parameters<typeof canUse>[1];
  return <s-badge tone="warning">{canUse(plan, t) ? "Over plan limit" : `Needs ${planName(planFor(t))}`}</s-badge>;
}
