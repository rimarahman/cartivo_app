import { useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { settingsAction, settingsLoader } from "../models/actions.server";
import { authenticate } from "../shopify.server";
import { getMarketsInfo } from "../models/markets.server";
import { Checkbox, Grid, TextField } from "../components/fields";
import { useSave } from "../components/useSave";
import { SaveActions, SaveCard, isDirty } from "../components/SaveActions";
import { Accordion, Locked, SettingsLayout } from "../components/ui";
import { TRANSLATABLE_KEYS, type Settings } from "../lib/defaults";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const [data, markets] = await Promise.all([settingsLoader(request), getMarketsInfo(admin)]);
  return { ...data, locales: markets.locales };
};
export const action = ({ request }: ActionFunctionArgs) => settingsAction(request, ["advanced", "translations"]);

function defaultText(settings: Settings, key: string) {
  const [section, field] = key.split(".");
  return String((settings as any)[section]?.[field] ?? "");
}

const PlanHint = ({ plan }: { plan: "Essential" | "Growth" }) => (
  <s-text color="subdued">
    Available on the <s-link href="/app/pricing">{plan} plan</s-link> and higher.
  </s-text>
);

export default function AdvancedSettings() {
  const { settings, plan, locales } = useLoaderData<typeof loader>();
  const localeName = (code: string) => locales.find((l) => l.locale === code)?.name || code;
  const [advanced, setAdvanced] = useState(settings.advanced);
  const [translations, setTranslations] = useState<Record<string, Record<string, string>>>(settings.translations || {});
  // Store languages (Shopify Markets) that don't have translations yet.
  const missingLocales = locales.filter((l) => !l.primary && !translations[l.locale]);
  const [newLocale, setNewLocale] = useState("");
  const [activeLocale, setActiveLocale] = useState(Object.keys(settings.translations || {})[0] || "");
  const { save, saving, errorBanner } = useSave<Partial<Settings>>();
  const dirty = isDirty({ advanced, translations }, { advanced: settings.advanced, translations: settings.translations || {} });
  const discard = () => {
    setAdvanced(settings.advanced);
    setTranslations(settings.translations || {});
    setActiveLocale(Object.keys(settings.translations || {})[0] || "");
  };

  const a = <K extends keyof typeof advanced>(key: K) => ({
    value: advanced[key] as any,
    onChange: (v: any) => setAdvanced((x) => ({ ...x, [key]: v })),
  });

  const addLocale = () => {
    const code = newLocale.trim().toLowerCase();
    if (!code || translations[code]) return;
    setTranslations((t) => ({ ...t, [code]: {} }));
    setActiveLocale(code);
    setNewLocale("");
  };

  return (
    <s-page heading="Custom code & languages">
      <SaveActions dirty={dirty} saving={saving} onSave={() => save({ advanced, translations })} onDiscard={discard} />
      {errorBanner}

      <SettingsLayout>
      <SaveCard dirty={dirty} saving={saving} onSave={() => save({ advanced, translations })} onDiscard={discard} />

      <Accordion title="Custom CSS" icon="code" description="Style any Cartivo element. All class names start with .ck-">
        <s-stack gap="base">
          {!plan.features.customCss && <PlanHint plan="Essential" />}
          <Locked locked={!plan.features.customCss}>
            <TextField
              label="CSS"
              multiline={8}
              placeholder=".ck-drawer { font-family: inherit; }"
              details="All Cartivo elements use class names starting with .ck-"
              {...a("customCss")}
            />
          </Locked>
        </s-stack>
      </Accordion>

      <Accordion title="Custom HTML" icon="text-block" description="Add your own content above the items or above the checkout button">
        <s-stack gap="base">
          {!plan.features.customCode && <PlanHint plan="Growth" />}
          <Locked locked={!plan.features.customCode}>
            <Grid>
              <TextField label="HTML above cart items" multiline={5} {...a("customHtmlTop")} />
              <TextField label="HTML above checkout button" multiline={5} {...a("customHtmlBottom")} />
            </Grid>
          </Locked>
        </s-stack>
      </Accordion>

      <Accordion title="Custom JavaScript" icon="code-add" description="Run code with the Cartivo API and events">
        <s-stack gap="base">
          {!plan.features.customCode && <PlanHint plan="Growth" />}
          <Locked locked={!plan.features.customCode}>
            <TextField
              label="JavaScript"
              multiline={8}
              placeholder={"Cartivo.on('cart:updated', (cart) => console.log(cart));"}
              details="Runs after Cartivo loads. Available API: Cartivo.open(), Cartivo.close(), Cartivo.refresh(), Cartivo.on(event, fn). Events: open, close, cart:updated, item:added."
              {...a("customJs")}
            />
          </Locked>
        </s-stack>
      </Accordion>

      <Accordion title="Theme compatibility" icon="theme" description="Cart icon, count and theme drawer selectors, paths to skip, Google Analytics">
        <s-stack gap="base">
          <Grid>
            <TextField
              label="Extra cart icon selectors"
              placeholder=".header__cart, #my-cart-button"
              details="Clicks on these elements open the drawer."
              {...a("cartIconSelector")}
            />
            <TextField
              label="Extra cart count selectors"
              placeholder=".cart-count"
              details="Cartivo keeps these in sync with the cart item count."
              {...a("cartCountSelector")}
            />
            <TextField
              label="Theme cart drawer selector"
              placeholder="#theme-cart-drawer"
              details="If your theme's own cart still opens next to Cartivo's, add its drawer here and Cartivo closes it."
              {...a("themeDrawerSelector")}
            />
            <TextField
              label="Disable on these URL paths"
              placeholder="/pages/wholesale, /cart"
              details="Comma separated path prefixes."
              {...a("disableOnPaths")}
            />
          </Grid>
          <Checkbox
            label="Send events to Google Analytics (gtag)"
            details="add_to_cart, view_cart and begin_checkout events from the drawer."
            {...a("googleAnalytics")}
          />
        </s-stack>
      </Accordion>

      <Accordion title="Languages" icon="language" description="Translate every storefront text per language">
        <s-stack gap="base">
          <s-paragraph>
            Texts are shown in your default settings unless a translation exists for the shopper's language
            (e.g. fr, de, es, pt-br).
          </s-paragraph>
          {!plan.features.markets && <PlanHint plan="Growth" />}
          <Locked locked={!plan.features.markets} stacked>
          <s-stack gap="base">
          {missingLocales.length > 0 && (
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <s-text color="subdued">Your store languages:</s-text>
              {missingLocales.map((l) => (
                <s-button
                  key={l.locale}
                  icon="plus"
                  onClick={() => {
                    setTranslations((t) => ({ ...t, [l.locale]: {} }));
                    setActiveLocale(l.locale);
                  }}
                >
                  {l.name}
                </s-button>
              ))}
            </s-stack>
          )}
          <s-stack direction="inline" gap="small-200" alignItems="end">
            <TextField label="Language code" placeholder="fr" value={newLocale} onChange={setNewLocale} />
            <s-button onClick={addLocale}>Add language</s-button>
          </s-stack>
          {Object.keys(translations).length > 0 && (
            <s-stack direction="inline" gap="small-200">
              {Object.keys(translations).map((code) => (
                <s-button
                  key={code}
                  variant={code === activeLocale ? "primary" : "secondary"}
                  onClick={() => setActiveLocale(code)}
                >
                  {localeName(code)}
                </s-button>
              ))}
            </s-stack>
          )}
          {activeLocale && translations[activeLocale] && (
            <s-stack gap="base">
              <Grid>
                {TRANSLATABLE_KEYS.map((key) => (
                  <TextField
                    key={activeLocale + key}
                    label={key}
                    placeholder={defaultText(settings, key)}
                    value={translations[activeLocale][key] || ""}
                    onChange={(v) =>
                      setTranslations((t) => ({ ...t, [activeLocale]: { ...t[activeLocale], [key]: v } }))
                    }
                  />
                ))}
              </Grid>
              <s-button
                tone="critical"
                variant="tertiary"
                onClick={() => {
                  setTranslations((t) => {
                    const next = { ...t };
                    delete next[activeLocale];
                    return next;
                  });
                  setActiveLocale("");
                }}
              >
                Remove {activeLocale}
              </s-button>
            </s-stack>
          )}
          </s-stack>
          </Locked>
        </s-stack>
      </Accordion>
      </SettingsLayout>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
