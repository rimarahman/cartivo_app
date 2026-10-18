import { useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { settingsAction, settingsLoader } from "../models/actions.server";
import { Checkbox, ColorField, Grid, NumberField, Select, Switch, TextField } from "../components/fields";
import { DrawerPreview } from "../components/Preview";
import { Accordion, Locked, SettingsLayout, SideCard } from "../components/ui";
import { useSave } from "../components/useSave";
import { SaveActions, SaveCard, isDirty } from "../components/SaveActions";
import { DESIGN_PRESETS, GLASS_TIER, type Design, type DesignTier, type Settings } from "../lib/defaults";
import { designTierPlan } from "../lib/plans";

export const loader = ({ request }: LoaderFunctionArgs) => settingsLoader(request);
export const action = ({ request }: ActionFunctionArgs) => settingsAction(request, ["drawer", "design", "upsells"]);

// Looks the plan doesn't include are greyed out, not clickable and labeled with the plan (BFS 4.3.7).
function PresetPicker({ design, onPick, tier }: { design: Design; onPick: (id: string) => void; tier: DesignTier }) {
  return (
    <div className="ckx-presets">
      {DESIGN_PRESETS.map((p) => {
        const d = { ...design, ...p.design };
        const button =
          d.checkoutStyle === "solid" ? d.accentColor : `linear-gradient(100deg, ${d.gradientFrom}, ${d.gradientTo})`;
        const swatch = (
          <span className="ckx-preset-swatch" style={{ background: d.backgroundColor }}>
            <i style={{ width: "55%", background: d.textColor, opacity: 0.85 }} />
            <i style={{ width: "80%", background: d.progressBackground }}>
              <i style={{ width: "65%", height: "100%", background: d.progressColor }} />
            </i>
            <i style={{ width: "40%", background: d.mutedColor, opacity: 0.5 }} />
            <b style={{ background: button }} />
          </span>
        );
        if (p.tier > tier) {
          return (
            <div key={p.id} className="ckx-preset ckx-preset-locked" aria-disabled="true" title={`${p.label}: ${designTierPlan(p.tier)} plan and higher`}>
              {swatch}
              <span className="ckx-preset-name">
                {p.label} <s-badge icon="lock">{designTierPlan(p.tier)}</s-badge>
              </span>
            </div>
          );
        }
        return (
          <button
            key={p.id}
            type="button"
            className="ckx-preset"
            aria-pressed={design.preset === p.id}
            onClick={() => onPick(p.id)}
          >
            {swatch}
            <span className="ckx-preset-name">{p.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function DrawerSettings() {
  const { settings, plan } = useLoaderData<typeof loader>();
  const [drawer, setDrawer] = useState(settings.drawer);
  const [design, setDesign] = useState(settings.design);
  const [upsells, setUpsells] = useState(settings.upsells);
  const { save, saving, errorBanner } = useSave<Partial<Settings>>();
  const dirty = isDirty({ drawer, design, upsells }, { drawer: settings.drawer, design: settings.design, upsells: settings.upsells });
  const discard = () => {
    setDrawer(settings.drawer);
    setDesign(settings.design);
    setUpsells(settings.upsells);
  };

  const d = <K extends keyof typeof drawer>(key: K) => ({
    value: drawer[key] as any,
    onChange: (v: any) => setDrawer((s) => ({ ...s, [key]: v })),
  });
  // Any manual design change turns the look into a custom one.
  const ds = <K extends keyof typeof design>(key: K) => ({
    value: design[key] as any,
    onChange: (v: any) => setDesign((s) => (s[key] === v ? s : { ...s, [key]: v, preset: "custom" })),
  });
  // The glass effect layers on top of any look, so it keeps the picked look selected.
  const glassSwitch = {
    value: design.glass,
    onChange: (v: boolean) => setDesign((s) => ({ ...s, glass: v })),
  };
  const u = <K extends keyof typeof upsells>(key: K) => ({
    value: upsells[key] as any,
    onChange: (v: any) => setUpsells((s) => ({ ...s, [key]: v })),
  });
  const pickPreset = (id: string) => {
    const preset = DESIGN_PRESETS.find((p) => p.id === id);
    if (preset) setDesign((s) => ({ ...s, ...preset.design, preset: id }));
  };

  return (
    <s-page heading="Cart drawer" inlineSize="large">
      <SaveActions dirty={dirty} saving={saving} onSave={() => save({ drawer, design, upsells })} onDiscard={discard} />
      {errorBanner}

      <SettingsLayout
        side={
          <>
            <SaveCard dirty={dirty} saving={saving} onSave={() => save({ drawer, design, upsells })} onDiscard={discard} />
            <SideCard title="Status">
              <Select
                label="Cart drawer"
                options={[
                  { label: "Active", value: "active" },
                  { label: "Inactive", value: "inactive" },
                ]}
                value={drawer.enabled ? "active" : "inactive"}
                onChange={(v) => setDrawer((s) => ({ ...s, enabled: v === "active" }))}
              />
            </SideCard>
            <SideCard title="Preview" action={<s-badge tone="info">Live</s-badge>}>
              <DrawerPreview settings={{ drawer, design, upsells }} />
            </SideCard>
          </>
        }
      >

      <Accordion title="Style" icon="paint-brush-round" description="One-click looks, liquid glass and the checkout button">
        <s-stack gap="base">
          <s-paragraph>Pick a look in one click, then fine-tune the colors below if you like.</s-paragraph>
          {plan.features.designTier < 3 && (
            <s-text color="subdued">
              Each plan adds more looks: Essential 3, Growth 5, Premium all of them with liquid glass.{" "}
              <s-link href="/app/pricing">See plans</s-link>
            </s-text>
          )}
          <PresetPicker design={design} onPick={pickPreset} tier={plan.features.designTier} />
          <s-divider />
          <Locked locked={plan.features.designTier < GLASS_TIER}>
            <Switch
              label="Glass effect (works with any look)"
              details={
                plan.features.designTier < GLASS_TIER
                  ? `Part of the ${designTierPlan(GLASS_TIER)} plan.`
                  : "Frosted, translucent drawer floating over your store, with a glossy pill checkout button. Keeps the colors of the look you picked."
              }
              {...glassSwitch}
            />
          </Locked>
          <Grid>
            <Select
              label="Checkout button"
              options={[
                { label: "Gradient", value: "gradient" },
                { label: "Solid (accent color)", value: "solid" },
              ]}
              {...ds("checkoutStyle")}
            />
            {design.checkoutStyle !== "solid" && (
              <>
                <ColorField label="Gradient start" {...ds("gradientFrom")} />
                <ColorField label="Gradient end" {...ds("gradientTo")} />
                <ColorField label="Checkout text" {...ds("checkoutTextColor")} />
              </>
            )}
            <NumberField label="Corner radius" suffix="px" min={0} max={30} {...ds("borderRadius")} />
          </Grid>
        </s-stack>
      </Accordion>

      <Accordion title="Behavior" icon="settings" description="When the drawer opens, position and width">
        <s-stack gap="base">
          <Switch label="Open the drawer when a product is added to cart" {...d("openOnAdd")} />
          <Switch
            label="Open the drawer when the cart icon is clicked"
            details="Replaces your theme's cart page/drawer with Cartivo."
            {...d("interceptCartLinks")}
          />
          <Grid>
            <Select
              label="Drawer position"
              options={[
                { label: "Right", value: "right" },
                { label: "Left", value: "left" },
              ]}
              {...d("position")}
            />
            <NumberField label="Drawer width (desktop)" suffix="px" min={320} max={640} {...d("width")} />
          </Grid>
        </s-stack>
      </Accordion>

      <Accordion title="Cart content" icon="text-block" description="Texts and what is shown in the cart">
        <s-stack gap="base">
          <Grid>
            <TextField label="Cart title" {...d("title")} />
            <TextField label="Checkout button" {...d("checkoutText")} />
            <TextField label="Empty cart text" {...d("emptyText")} />
            <TextField label="Empty cart button" {...d("emptyButtonText")} />
            <TextField label="Empty cart button link" {...d("emptyButtonUrl")} />
          </Grid>
          <Grid>
            <Checkbox label="Show subtotal" {...d("showSubtotal")} />
            <Checkbox label="Show total savings" {...d("showSavings")} />
            <Checkbox label="Show original price when discounted" {...d("showCompareAt")} />
            <Checkbox label="Show product vendor" {...d("showVendor")} />
            <Checkbox label="Show taxes & shipping note" {...d("showTaxesText")} />
            <Checkbox label="Show 'Continue shopping' link" {...d("showContinueShopping")} />
            <Checkbox label="Show 'View cart' link" {...d("showViewCart")} />
          </Grid>
          <Grid>
            <TextField label="Subtotal label" {...d("subtotalText")} />
            <TextField label="Savings label" {...d("savingsText")} />
            <TextField label="Taxes note" {...d("taxesText")} />
            <TextField label="Continue shopping text" {...d("continueShoppingText")} />
            <TextField label="View cart text" {...d("viewCartText")} />
          </Grid>
        </s-stack>
      </Accordion>

      <Accordion title="Order notes, discount codes & terms" icon="discount-code" description="Note field, discount code box and terms checkbox">
        <s-stack gap="base">
          <Switch label="Show order note field" {...d("showNote")} />
          {drawer.showNote && (
            <Grid>
              <TextField label="Note label" {...d("noteLabel")} />
              <TextField label="Note placeholder" {...d("notePlaceholder")} />
            </Grid>
          )}
          <Switch label="Show discount code field" {...d("showDiscountField")} />
          {drawer.showDiscountField && (
            <Grid>
              <TextField label="Placeholder" {...d("discountPlaceholder")} />
              <TextField label="Apply button" {...d("discountApplyText")} />
              <TextField label="Invalid code message" {...d("discountInvalidText")} />
            </Grid>
          )}
          <Switch label="Require terms & conditions checkbox before checkout" {...d("showTerms")} />
          {drawer.showTerms && (
            <Grid>
              <TextField label="Checkbox text (HTML allowed)" {...d("termsText")} />
              <TextField label="Error message" {...d("termsError")} />
            </Grid>
          )}
        </s-stack>
      </Accordion>

      <Accordion title="Upsells & recommendations" icon="product-add" description="Recommend products inside the cart">
        <s-stack gap="base">
          <Switch label="Show product recommendations in the cart" {...u("enabled")} />
          {upsells.enabled && (
            <Grid>
              <Select
                label="Source"
                details="Automatic uses Shopify's product recommendations. Manual uses your upsell campaigns."
                options={[
                  { label: "Automatic (Shopify recommendations)", value: "auto" },
                  { label: "Manual (upsell campaigns)", value: "manual" },
                  { label: "Manual first, then automatic", value: "both" },
                ]}
                {...u("mode")}
              />
              <Select
                label="Recommendation type"
                options={[
                  { label: "Related products", value: "related" },
                  { label: "Complementary products", value: "complementary" },
                ]}
                {...u("intent")}
              />
              <Select
                label="Layout"
                options={[
                  { label: "Carousel", value: "carousel" },
                  { label: "List", value: "list" },
                ]}
                {...u("layout")}
              />
              <NumberField label="Max products" min={1} max={10} {...u("limit")} />
              <TextField label="Title" {...u("title")} />
              <TextField label="Button text" {...u("buttonText")} />
            </Grid>
          )}
        </s-stack>
      </Accordion>

      <Accordion title="Colors & typography" icon="color" description="Every color, font size and overlay">
        <Grid columns={3}>
          <ColorField label="Accent / button color" {...ds("accentColor")} />
          <ColorField label="Button text color" {...ds("accentTextColor")} />
          <ColorField label="Background" {...ds("backgroundColor")} />
          <ColorField label="Text color" {...ds("textColor")} />
          <ColorField label="Secondary text" {...ds("mutedColor")} />
          <ColorField label="Borders" {...ds("borderColor")} />
          <ColorField label="Progress bar" {...ds("progressColor")} />
          <ColorField label="Progress bar background" {...ds("progressBackground")} />
          <ColorField label="Badges (gift / savings)" {...ds("badgeColor")} />
          <NumberField label="Font size" suffix="px" min={11} max={20} {...ds("fontSize")} />
          <NumberField label="Overlay darkness" suffix="%" min={0} max={90} {...ds("overlayOpacity")} />
        </Grid>
      </Accordion>
      </SettingsLayout>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
