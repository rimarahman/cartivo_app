import { authenticate } from "../shopify.server";
import { getSettings, saveSettings } from "./store.server";
import { getPlan } from "./billing.server";
import { trySync } from "./sync.server";
import { DESIGN_PRESETS, FREE_DESIGN_PRESET, designForPlan, type Settings } from "../lib/defaults";

// Pages see the design the storefront actually gets: on Starter a locked look shows as Minimal.
export async function settingsLoader(request: Request) {
  const { admin, session, billing } = await authenticate.admin(request);
  const [settings, plan] = await Promise.all([getSettings(session.shop), getPlan(billing, session.shop, admin)]);
  return { settings: { ...settings, design: designForPlan(settings.design, plan.features.designPresets) }, plan };
}

// Saves the given top-level settings sections and republishes the storefront config.
export async function settingsAction(request: Request, sections: (keyof Settings)[]) {
  const { admin, session, billing } = await authenticate.admin(request);
  const form = await request.formData();
  const payload = JSON.parse(String(form.get("payload") || "{}"));
  const partial: any = {};
  for (const key of sections) if (payload[key] !== undefined) partial[key] = payload[key];
  const plan = await getPlan(billing, session.shop, admin);
  // Plan-gated looks can't be saved (BFS 4.3.7); the editor locks them too.
  const preset = partial.design?.preset;
  if (!plan.features.designPresets && preset && preset !== FREE_DESIGN_PRESET && preset !== "custom") {
    const label = DESIGN_PRESETS.find((p) => p.id === preset)?.label ?? preset;
    return { error: `The ${label} look is part of the Essential plan and higher. Starter includes the Minimal look.` };
  }
  await saveSettings(session.shop, partial);
  const sync = await trySync(admin, session.shop, plan);
  return { saved: true, syncError: sync.error };
}
