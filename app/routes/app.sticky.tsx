import { useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { settingsAction, settingsLoader } from "../models/actions.server";
import { Checkbox, ColorField, Grid, NumberField, Select, TextField } from "../components/fields";
import { StickyPreview } from "../components/Preview";
import { Accordion, SettingsLayout, SideCard } from "../components/ui";
import { useSave } from "../components/useSave";
import { SaveActions, SaveCard, isDirty } from "../components/SaveActions";
import type { Settings } from "../lib/defaults";

export const loader = ({ request }: LoaderFunctionArgs) => settingsLoader(request);
export const action = ({ request }: ActionFunctionArgs) => settingsAction(request, ["sticky", "floating"]);

export default function StickySettings() {
  const { settings } = useLoaderData<typeof loader>();
  const [sticky, setSticky] = useState(settings.sticky);
  const [floating, setFloating] = useState(settings.floating);
  const { save, saving } = useSave<Partial<Settings>>();
  const dirty = isDirty({ sticky, floating }, { sticky: settings.sticky, floating: settings.floating });
  const discard = () => {
    setSticky(settings.sticky);
    setFloating(settings.floating);
  };

  const s = <K extends keyof typeof sticky>(key: K) => ({
    value: sticky[key] as any,
    onChange: (v: any) => setSticky((x) => ({ ...x, [key]: v })),
  });
  const f = <K extends keyof typeof floating>(key: K) => ({
    value: floating[key] as any,
    onChange: (v: any) => setFloating((x) => ({ ...x, [key]: v })),
  });

  return (
    <s-page heading="Sticky add-to-cart & floating cart" inlineSize="large">
      <SaveActions dirty={dirty} saving={saving} onSave={() => save({ sticky, floating })} onDiscard={discard} />

      <SettingsLayout
        side={
          <>
            <SaveCard dirty={dirty} saving={saving} onSave={() => save({ sticky, floating })} onDiscard={discard} />
            <SideCard title="Status">
              <Select
                label="Sticky add-to-cart"
                options={[
                  { label: "Active", value: "active" },
                  { label: "Inactive", value: "inactive" },
                ]}
                value={sticky.enabled ? "active" : "inactive"}
                onChange={(v) => setSticky((x) => ({ ...x, enabled: v === "active" }))}
              />
              <Select
                label="Floating cart button"
                options={[
                  { label: "Active", value: "active" },
                  { label: "Inactive", value: "inactive" },
                ]}
                value={floating.enabled ? "active" : "inactive"}
                onChange={(v) => setFloating((x) => ({ ...x, enabled: v === "active" }))}
              />
            </SideCard>
            <SideCard title="Preview" action={<s-badge tone="info">Live</s-badge>}>
              <StickyPreview sticky={sticky} floating={floating} glass={settings.design.glass} />
            </SideCard>
          </>
        }
      >
      <Accordion
        title="Sticky add-to-cart bar"
        icon="layout-footer"
       
        description="Shows on product pages when the shopper scrolls past the theme's add to cart button."
      >
        <s-stack gap="base">
          <Grid>
            <Checkbox label="Show on desktop" {...s("showOnDesktop")} />
            <Checkbox label="Show on mobile" {...s("showOnMobile")} />
            <Checkbox label="Show product image" {...s("showImage")} />
            <Checkbox label="Show price" {...s("showPrice")} />
            <Checkbox label="Show variant selector" {...s("showVariantPicker")} />
            <Checkbox label="Show quantity selector" {...s("showQuantity")} />
          </Grid>
          <Grid>
            <Select
              label="Position"
              options={[
                { label: "Bottom of screen", value: "bottom" },
                { label: "Top of screen", value: "top" },
              ]}
              {...s("position")}
            />
            <TextField label="Button text" {...s("buttonText")} />
            <TextField label="Sold out text" {...s("soldOutText")} />
          </Grid>
        </s-stack>
      </Accordion>

      <Accordion title="Sticky bar colors" icon="color" description="Background, text and button colors of the sticky bar.">
          <Grid columns={3}>
            <ColorField label="Background" {...s("backgroundColor")} />
            <ColorField label="Text" {...s("textColor")} />
            <ColorField label="Button" {...s("buttonColor")} />
            <ColorField label="Button text" {...s("buttonTextColor")} />
          </Grid>
      </Accordion>

      <Accordion title="Floating cart button" icon="bag" description="Customize the floating icon which opens the cart.">
        <s-stack gap="base">
          <Grid>
            <Checkbox label="Hide when cart is empty" {...f("hideWhenEmpty")} />
            <Checkbox label="Show on desktop" {...f("showOnDesktop")} />
            <Checkbox label="Show on mobile" {...f("showOnMobile")} />
          </Grid>
          <Grid>
            <Select
              label="Position"
              options={[
                { label: "Bottom right", value: "bottom-right" },
                { label: "Bottom left", value: "bottom-left" },
                { label: "Top right", value: "top-right" },
                { label: "Top left", value: "top-left" },
              ]}
              {...f("position")}
            />
            <NumberField label="Size" suffix="px" min={40} max={80} {...f("size")} />
          </Grid>
        </s-stack>
      </Accordion>

      <Accordion title="Floating button colors" icon="color" description="Button, icon and item count badge colors.">
          <Grid columns={3}>
            <ColorField label="Button" {...f("backgroundColor")} />
            <ColorField label="Icon" {...f("iconColor")} />
            <ColorField label="Count badge" {...f("badgeColor")} />
            <ColorField label="Count text" {...f("badgeTextColor")} />
          </Grid>
      </Accordion>
      </SettingsLayout>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
