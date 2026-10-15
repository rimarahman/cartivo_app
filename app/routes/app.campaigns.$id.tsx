import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { campaignInputError, getCampaign, parsePayload, saveCampaign } from "../models/store.server";
import { getPlan } from "../models/billing.server";
import { canUse, planFor, planName } from "../lib/plans";
import { trySync } from "../models/sync.server";
import { Locked } from "../components/ui";
import {
  CAMPAIGN_TYPES,
  DEFAULT_CAMPAIGN_CONFIG,
  uid,
  type CampaignType,
  type RewardTier,
} from "../lib/defaults";
import {
  Checkbox,
  ColorField,
  DateTimeField,
  Grid,
  NumberField,
  ProductPicker,
  Select,
  TextField,
} from "../components/fields";
import { useSave } from "../components/useSave";
import { SaveActions, SaveCard, isDirty } from "../components/SaveActions";
import { CampaignTranslations, CountryTargeting } from "../components/Markets";
import { getMarketsInfo } from "../models/markets.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);
  const [plan, markets] = await Promise.all([getPlan(billing, session.shop, admin), getMarketsInfo(admin)]);
  if (params.id === "new") {
    const type = (new URL(request.url).searchParams.get("type") || "rewards") as CampaignType;
    // Types outside the plan can't be created (BFS 4.3.7); the Campaigns page shows which plan unlocks them.
    if (!Object.hasOwn(CAMPAIGN_TYPES, type) || !canUse(plan, type)) throw redirect("/app/campaigns");
    return {
      plan,
      markets,
      campaign: {
        id: null as string | null,
        type,
        name: CAMPAIGN_TYPES[type].label,
        status: "active",
        priority: 0,
        config: structuredClone(DEFAULT_CAMPAIGN_CONFIG[type]),
        startsAt: null as string | null,
        endsAt: null as string | null,
      },
    };
  }
  const campaign = await getCampaign(session.shop, params.id!);
  if (!campaign) throw redirect("/app/campaigns");
  return { plan, markets, campaign };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);
  const form = await request.formData();
  const payload = parsePayload(form.get("payload"));
  if (!payload) return { error: "The campaign couldn't be read. Reload the page and try again." };
  const type = payload.type as CampaignType;
  if (!Object.hasOwn(CAMPAIGN_TYPES, type)) return { error: "Unknown campaign type" };
  const invalid = campaignInputError(payload);
  if (invalid) return { error: invalid };
  const plan = await getPlan(billing, session.shop, admin);
  // Plan-gated types are read-only (BFS 4.3.7): the editor disables saving, and the server refuses it too.
  if (!canUse(plan, type)) {
    return {
      error: `${CAMPAIGN_TYPES[type].label} campaigns are part of the ${planName(planFor(type))} plan. Choose that plan or higher to edit this campaign.`,
    };
  }
  const saved = await saveCampaign(session.shop, params.id === "new" ? null : params.id!, payload as Parameters<typeof saveCampaign>[2]);
  if (!saved) return { error: "This campaign doesn't exist anymore." };
  const sync = await trySync(admin, session.shop, plan);
  return { saved: true, syncError: sync.error, id: saved.id };
};

type Props = { config: any; set: (patch: any) => void };

type EditableCampaign = {
  id: string | null;
  type: CampaignType;
  name: string;
  status: string;
  priority: number;
  config: any;
  startsAt: string | null;
  endsAt: string | null;
};

const bind = (config: any, set: Props["set"], key: string) => ({
  value: config[key],
  onChange: (v: any) => set({ [key]: v }),
});

function RewardsEditor({ config, set }: Props) {
  const tiers: RewardTier[] = config.tiers;
  const setTier = (i: number, patch: Partial<RewardTier>) =>
    set({ tiers: tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  const isQty = config.basis === "quantity";

  return (
    <>
      <s-section heading="Goal settings">
        <s-stack gap="base">
          <Grid>
            <Select
              label="Progress based on"
              options={[
                { label: "Cart value", value: "subtotal" },
                { label: "Number of items", value: "quantity" },
              ]}
              {...bind(config, set, "basis")}
            />
            <TextField
              label="Progress message"
              details="Variables: {{remaining}}, {{reward}}"
              {...bind(config, set, "progressText")}
            />
            <TextField label="All rewards unlocked message" {...bind(config, set, "completeText")} />
            <TextField label="Gift picker title" {...bind(config, set, "giftPickerTitle")} />
          </Grid>
        </s-stack>
      </s-section>

      <s-section heading="Reward tiers">
        <s-stack gap="base">
          <s-paragraph>
            Each tier unlocks when the cart reaches its goal. Gifts are added to the cart automatically and
            discounted to free at checkout — you don't need to create $0 gift products.
          </s-paragraph>
          {tiers.map((tier, i) => (
            <s-box key={tier.id} padding="base" borderWidth="base" borderRadius="base">
              <s-stack gap="base">
                <s-stack direction="inline" gap="small-200" alignItems="center">
                  <s-heading>Tier {i + 1}</s-heading>
                  <s-button
                    variant="tertiary"
                    tone="critical"
                    onClick={() => set({ tiers: tiers.filter((_, j) => j !== i) })}
                  >
                    Remove
                  </s-button>
                </s-stack>
                <Grid>
                  <NumberField
                    label={isQty ? "Minimum items" : "Minimum cart value"}
                    details={isQty ? undefined : "In your store currency. Converted automatically for other currencies."}
                    min={0}
                    value={tier.threshold}
                    onChange={(v) => setTier(i, { threshold: v })}
                  />
                  <Select
                    label="Reward"
                    options={[
                      { label: "Free shipping", value: "free_shipping" },
                      { label: "Free gift", value: "free_gift" },
                      { label: "Percentage off order", value: "percent_off" },
                      { label: "Fixed amount off order", value: "fixed_off" },
                    ]}
                    value={tier.type}
                    onChange={(v) => setTier(i, { type: v as RewardTier["type"] })}
                  />
                  {(tier.type === "percent_off" || tier.type === "fixed_off") && (
                    <NumberField
                      label={tier.type === "percent_off" ? "Discount %" : "Discount amount"}
                      min={0}
                      max={tier.type === "percent_off" ? 100 : undefined}
                      value={tier.value}
                      onChange={(v) => setTier(i, { value: v })}
                    />
                  )}
                  <TextField
                    label="Reward name shown to customers"
                    value={tier.label}
                    onChange={(v) => setTier(i, { label: v })}
                  />
                  {!isQty && (
                    <TextField
                      label="Fixed amounts in other currencies (optional)"
                      placeholder="EUR 45, GBP 40"
                      details="Shopify Markets: a round goal per currency. Other currencies are converted automatically."
                      value={tier.currencyThresholds || ""}
                      onChange={(v) => setTier(i, { currencyThresholds: v })}
                    />
                  )}
                </Grid>
                {tier.type === "free_gift" && (
                  <ProductPicker
                    label="Gift products"
                    details="Pick one variant to add it automatically, or several to let the customer choose."
                    variants
                    value={tier.gifts || []}
                    onChange={(gifts) => setTier(i, { gifts })}
                  />
                )}
              </s-stack>
            </s-box>
          ))}
          <s-button
            onClick={() =>
              set({
                tiers: [
                  ...tiers,
                  {
                    id: uid(),
                    threshold: (tiers[tiers.length - 1]?.threshold || 0) + 50,
                    type: "free_gift",
                    value: 100,
                    label: "Free gift",
                    gifts: [],
                  },
                ],
              })
            }
          >
            Add tier
          </s-button>
        </s-stack>
      </s-section>
    </>
  );
}

function BxgyEditor({ config, set }: Props) {
  // Only free items can be added for the shopper; a partly discounted item needs their consent (App Store 1.1.9).
  const free = Number(config.percent) >= 100;
  return (
    <s-section heading="Buy X Get Y">
      <s-stack gap="base">
        <ProductPicker label="Customer buys" value={config.buyProducts} onChange={(v) => set({ buyProducts: v })} />
        <NumberField label="Quantity to buy" min={1} {...bind(config, set, "buyQuantity")} />
        <ProductPicker
          label="Customer gets"
          variants
          details="When the item is free and 'auto-add' is on, the first variant is added for the shopper."
          value={config.getProducts}
          onChange={(v) => set({ getProducts: v })}
        />
        <Grid>
          <NumberField label="Quantity they get" min={1} {...bind(config, set, "getQuantity")} />
          <NumberField label="Discount on those items" suffix="%" min={1} max={100} details="100% = free" {...bind(config, set, "percent")} />
        </Grid>
        <Checkbox
          label="Automatically add the free 'get' product to the cart"
          details={
            free
              ? "Shoppers can remove it from the cart."
              : "Only free items (100% off) are added automatically. With a partial discount, shoppers add the item themselves so the cart total never goes up without their consent."
          }
          disabled={!free}
          {...bind(config, set, "autoAdd")}
        />
        <Grid>
          <TextField
            label="Promo message"
            details="Variables: {{buyQuantity}}, {{getQuantity}}, {{discount}}"
            {...bind(config, set, "message")}
          />
          <TextField label="Unlocked message" {...bind(config, set, "unlockedMessage")} />
        </Grid>
      </s-stack>
    </s-section>
  );
}

function VolumeEditor({ config, set }: Props) {
  const tiers: { minQuantity: number; percent: number }[] = config.tiers;
  const setTier = (i: number, patch: any) => set({ tiers: tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  return (
    <s-section heading="Volume discount">
      <s-stack gap="base">
        <ProductPicker
          label="Products"
          details="Leave empty to apply to all products."
          value={config.products}
          onChange={(v) => set({ products: v })}
        />
        <Checkbox
          label="Combine quantities across all selected products (mix & match)"
          {...bind(config, set, "combineProducts")}
        />
        {tiers.map((t, i) => (
          <s-stack key={i} direction="inline" gap="base" alignItems="end">
            <NumberField label="Minimum quantity" min={1} value={t.minQuantity} onChange={(v) => setTier(i, { minQuantity: v })} />
            <NumberField label="Discount" suffix="%" min={1} max={100} value={t.percent} onChange={(v) => setTier(i, { percent: v })} />
            <s-button variant="tertiary" tone="critical" onClick={() => set({ tiers: tiers.filter((_, j) => j !== i) })}>
              Remove
            </s-button>
          </s-stack>
        ))}
        <s-button
          onClick={() =>
            set({
              tiers: [
                ...tiers,
                { minQuantity: (tiers[tiers.length - 1]?.minQuantity || 1) + 1, percent: (tiers[tiers.length - 1]?.percent || 5) + 5 },
              ],
            })
          }
        >
          Add tier
        </s-button>
        <Grid>
          <TextField label="Product page table title" {...bind(config, set, "tableTitle")} />
          <TextField
            label="Cart upsell message"
            details="Variables: {{quantity}}, {{percent}}"
            {...bind(config, set, "nextTierText")}
          />
        </Grid>
        <s-paragraph>
          Show the discount table on product pages by adding the "Volume discount table" app block in your
          theme editor.
        </s-paragraph>
      </s-stack>
    </s-section>
  );
}

function AnnouncementEditor({ config, set }: Props) {
  const messages: string[] = config.messages;
  return (
    <>
      <s-section heading="Announcements">
        <s-stack gap="base">
          {messages.map((m, i) => (
            <s-stack key={i} direction="inline" gap="small-200" alignItems="end">
              <TextField
                label={`Message ${i + 1}`}
                value={m}
                onChange={(v) => set({ messages: messages.map((x, j) => (j === i ? v : x)) })}
              />
              <s-button variant="tertiary" tone="critical" onClick={() => set({ messages: messages.filter((_, j) => j !== i) })}>
                Remove
              </s-button>
            </s-stack>
          ))}
          <s-button onClick={() => set({ messages: [...messages, ""] })}>Add message</s-button>
          <Grid columns={3}>
            <NumberField label="Rotate every" suffix="sec" min={2} {...bind(config, set, "rotateSeconds")} />
            <ColorField label="Background" {...bind(config, set, "backgroundColor")} />
            <ColorField label="Text" {...bind(config, set, "textColor")} />
          </Grid>
        </s-stack>
      </s-section>
      <s-section heading="Countdown timer">
        <s-stack gap="base">
          <Checkbox label="Show a countdown timer" {...bind(config, set, "timerEnabled")} />
          {config.timerEnabled && (
            <>
              {/* Only real deadlines: per-visitor "evergreen" timers were removed as fake urgency (App Store 1.1.4). */}
              <DateTimeField
                label="Offer ends at"
                details="The real end of your offer. Without a date, no timer is shown."
                {...bind(config, set, "timerEnd")}
              />
              <TextField label="Timer text" details="Variable: {{timer}}" {...bind(config, set, "timerText")} />
              <Checkbox label="Hide when the timer reaches zero" {...bind(config, set, "hideWhenExpired")} />
            </>
          )}
        </s-stack>
      </s-section>
    </>
  );
}

function UpsellEditor({ config, set }: Props) {
  return (
    <s-section heading="In-cart upsell">
      <s-stack gap="base">
        <ProductPicker
          label="When any of these products are in the cart"
          details="Leave empty to show for every cart."
          value={config.triggerProducts}
          onChange={(v) => set({ triggerProducts: v })}
        />
        <ProductPicker
          label="Recommend these products"
          value={config.upsellProducts}
          onChange={(v) => set({ upsellProducts: v })}
        />
        <TextField label="Section title" {...bind(config, set, "title")} />
        <s-paragraph>
          Make sure "Upsells" is enabled with source "Manual" or "Manual first, then automatic" on the{" "}
          <s-link href="/app/drawer">Cart drawer</s-link> page.
        </s-paragraph>
      </s-stack>
    </s-section>
  );
}

function AddonEditor({ config, set }: Props) {
  return (
    <s-section heading="One-click add-on">
      <s-stack gap="base">
        <ProductPicker
          label="Add-on product"
          details="E.g. a gift wrapping or shipping protection product."
          multiple={false}
          variants
          value={config.product ? [config.product] : []}
          onChange={(v) => set({ product: v[0] || null })}
        />
        <Grid>
          <TextField label="Checkbox label" details="Variable: {{price}}" {...bind(config, set, "label")} />
          <TextField label="Description" {...bind(config, set, "description")} />
        </Grid>
        <s-paragraph>
          The checkbox always starts unticked: the add-on is only added when the shopper ticks it.
        </s-paragraph>
      </s-stack>
    </s-section>
  );
}

const EDITORS: Record<CampaignType, (p: Props) => JSX.Element> = {
  rewards: RewardsEditor,
  bxgy: BxgyEditor,
  volume: VolumeEditor,
  announcement: AnnouncementEditor,
  upsell: UpsellEditor,
  addon: AddonEditor,
};

export default function CampaignEditor() {
  const { campaign: initial, plan, markets } = useLoaderData<typeof loader>();
  const needed = canUse(plan, initial.type as CampaignType) ? null : planName(planFor(initial.type as CampaignType));
  const [campaign, setCampaign] = useState<EditableCampaign>(initial);
  const { save, saving, fetcher, errorBanner } = useSave<typeof campaign>();
  const navigate = useNavigate();

  // After creating a campaign, move to its permanent URL.
  useEffect(() => {
    const data = fetcher.data as any;
    if (fetcher.state === "idle" && data?.id && !initial.id) navigate(`/app/campaigns/${data.id}`, { replace: true });
  }, [fetcher.state, fetcher.data, initial.id, navigate]);

  // A newly created campaign arrives with its id: continue editing the saved version.
  const [loadedId, setLoadedId] = useState(initial.id);
  if (initial.id !== loadedId) {
    setLoadedId(initial.id);
    setCampaign(initial);
  }
  // updatedAt changes on every save, so it is not an edit.
  const dirty = isDirty({ ...campaign, updatedAt: null }, { ...initial, updatedAt: null });
  const canSave = !needed && (dirty || !initial.id);

  const Editor = EDITORS[campaign.type as CampaignType];
  const setConfig = (patch: any) => setCampaign((c) => ({ ...c, config: { ...c.config, ...patch } }));

  return (
    <s-page heading={initial.id ? campaign.name : `New ${CAMPAIGN_TYPES[campaign.type as CampaignType].label.toLowerCase()}`}>
      <s-link slot="breadcrumb-actions" href="/app/campaigns">
        Campaigns
      </s-link>
      <SaveActions
        dirty={dirty}
        canSave={canSave}
        saving={saving}
        onSave={() => save(campaign)}
        onDiscard={() => setCampaign(initial)}
      />
      <div className="ckx-campaign-save">
        <SaveCard
          dirty={dirty}
          canSave={canSave}
          saving={saving}
          onSave={() => save(campaign)}
          onDiscard={() => setCampaign(initial)}
        />
      </div>
      {errorBanner}

      {needed && (
        <s-banner tone="info" heading={`Needs the ${needed} plan`}>
          <s-paragraph>
            {CAMPAIGN_TYPES[campaign.type as CampaignType].label} campaigns aren&apos;t part of your {plan.name} plan, so this
            campaign can&apos;t be edited and doesn&apos;t show on your store. You can still deactivate or delete it on the
            Campaigns page.
          </s-paragraph>
          <s-button slot="secondary-actions" href="/app/pricing">
            See plans
          </s-button>
        </s-banner>
      )}

      {/* Plan-gated campaign: greyed out and not interactive, saving disabled (BFS 4.3.7). */}
      <Locked locked={!!needed} stacked>

      <s-section heading="Campaign">
        <Grid>
          <TextField label="Name (internal)" value={campaign.name} onChange={(name) => setCampaign((c) => ({ ...c, name }))} />
          <Select
            label="Status"
            options={[
              { label: "Active", value: "active" },
              { label: "Draft", value: "draft" },
            ]}
            value={campaign.status}
            onChange={(status) => setCampaign((c) => ({ ...c, status }))}
          />
          <NumberField
            label="Priority"
            details="When several campaigns of the same type match, the highest priority wins."
            value={campaign.priority}
            onChange={(priority) => setCampaign((c) => ({ ...c, priority }))}
          />
        </Grid>
      </s-section>

      <Editor config={campaign.config} set={setConfig} />

      <s-section heading="Markets">
        {!plan.features.markets && (
          <s-banner tone="info">
            Country targeting, translations and per-currency amounts are available on the{" "}
            <s-link href="/app/pricing">Growth plan</s-link> and higher. Until then this campaign shows in every country.
          </s-banner>
        )}
        <Locked locked={!plan.features.markets}>
          <CountryTargeting
            countries={markets.countries}
            value={campaign.config.countries || []}
            onChange={(countries) => setConfig({ countries })}
          />
        </Locked>
      </s-section>

      <s-section heading="Translations">
        {!plan.features.markets && (
          <s-text color="subdued">
            Available on the <s-link href="/app/pricing">Growth plan</s-link> and higher.
          </s-text>
        )}
        <Locked locked={!plan.features.markets}>
          <CampaignTranslations
            type={campaign.type as CampaignType}
            config={campaign.config}
            locales={markets.locales}
            onChange={(translations) => setConfig({ translations })}
          />
        </Locked>
      </s-section>

      <s-section heading="Schedule">
        <Grid>
          <DateTimeField label="Start (optional)" value={campaign.startsAt} onChange={(startsAt) => setCampaign((c) => ({ ...c, startsAt }))} />
          <DateTimeField label="End (optional)" value={campaign.endsAt} onChange={(endsAt) => setCampaign((c) => ({ ...c, endsAt }))} />
        </Grid>
      </s-section>
      </Locked>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
