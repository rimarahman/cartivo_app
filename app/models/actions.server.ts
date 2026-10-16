import { authenticate } from "../shopify.server";
import { getSettings, parsePayload, saveSettings } from "./store.server";
import { getPlan } from "./billing.server";
import { trySync } from "./sync.server";
import { DESIGN_PRESETS, GLASS_TIER, designForPlan, presetTier, type Settings } from "../lib/defaults";
import { designTierPlan } from "../lib/plans";

const CUSTOM_CODE_KEYS = ["customHtmlTop", "customHtmlBottom", "customJs"] as const;

// Pages see what the storefront actually gets: a look above the plan shows as Minimal, and on Starter the sticky bar
// and floating cart as off.
export async function settingsLoader(request: Request) {
  const { admin, session, billing } = await authenticate.admin(request);
  const [settings, plan] = await Promise.all([getSettings(session.shop), getPlan(billing, session.shop, admin)]);
  const sticky = plan.features.stickyCart;
  return {
    settings: {
      ...settings,
      design: designForPlan(settings.design, plan.features.designTier),
      sticky: { ...settings.sticky, enabled: settings.sticky.enabled && sticky },
      floating: { ...settings.floating, enabled: settings.floating.enabled && sticky },
    },
    plan,
  };
}

// Saves the given top-level settings sections and republishes the storefront config.
export async function settingsAction(request: Request, sections: (keyof Settings)[]) {
  const { admin, session, billing } = await authenticate.admin(request);
  const form = await request.formData();
  const payload = parsePayload(form.get("payload"));
  if (!payload) return { error: "Your changes couldn't be read. Reload the page and try again." };
  const partial: any = {};
  for (const key of sections) if (payload[key] !== undefined) partial[key] = payload[key];
  // Every settings section is an object; anything else would break the admin pages and the published config.
  if (Object.values(partial).some((v) => !v || typeof v !== "object" || Array.isArray(v))) {
    return { error: "Your changes couldn't be read. Reload the page and try again." };
  }
  const plan = await getPlan(billing, session.shop, admin);
  // Plan-gated looks can't be saved (BFS 4.3.7); the editor locks them too.
  const preset = partial.design?.preset;
  if (preset && preset !== "custom" && presetTier(preset) > plan.features.designTier) {
    const label = DESIGN_PRESETS.find((p) => p.id === preset)?.label ?? preset;
    return { error: `The ${label} look is part of the ${designTierPlan(presetTier(preset))} plan and higher.` };
  }
  if (partial.design?.glass && plan.features.designTier < GLASS_TIER) {
    return { error: `Liquid glass is part of the ${designTierPlan(GLASS_TIER)} plan.` };
  }
  // Sticky add-to-cart and the floating cart are part of Essential and higher; on Starter their page is locked
  // and the storefront keeps them off, so there is nothing to save.
  if (!plan.features.stickyCart) {
    delete partial.sticky;
    delete partial.floating;
  }
  // Custom CSS is part of Essential and higher; languages (Markets) and custom HTML/JS of Growth and higher.
  // Their sections are locked too.
  const lockedTranslations = !plan.features.markets && partial.translations !== undefined;
  const lockedCss = !plan.features.customCss && partial.advanced !== undefined;
  const lockedCode = !plan.features.customCode && partial.advanced !== undefined;
  if (lockedTranslations || lockedCss || lockedCode) {
    const stored = await getSettings(session.shop);
    if (lockedTranslations) {
      if (JSON.stringify(partial.translations) !== JSON.stringify(stored.translations || {})) {
        return { error: "Languages are part of the Growth plan and higher." };
      }
      delete partial.translations;
    }
    if (lockedCss && (partial.advanced.customCss ?? "") !== (stored.advanced.customCss ?? "")) {
      return { error: "Custom CSS is part of the Essential plan and higher." };
    }
    if (lockedCode) {
      const changed = CUSTOM_CODE_KEYS.some((k) => (partial.advanced[k] ?? "") !== (stored.advanced[k] ?? ""));
      if (changed) return { error: "Custom HTML and JavaScript are part of the Growth plan and higher." };
    }
  }
  await saveSettings(session.shop, partial);
  const sync = await trySync(admin, session.shop, plan);
  return { saved: true, syncError: sync.error };
}
