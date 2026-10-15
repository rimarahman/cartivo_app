import { authenticate } from "../shopify.server";
import { getSettings, saveSettings } from "./store.server";
import { getPlan } from "./billing.server";
import { trySync } from "./sync.server";
import type { Settings } from "../lib/defaults";

export async function settingsLoader(request: Request) {
  const { admin, session, billing } = await authenticate.admin(request);
  const [settings, plan] = await Promise.all([getSettings(session.shop), getPlan(billing, session.shop, admin)]);
  return { settings, plan };
}

// Saves the given top-level settings sections and republishes the storefront config.
export async function settingsAction(request: Request, sections: (keyof Settings)[]) {
  const { admin, session, billing } = await authenticate.admin(request);
  const form = await request.formData();
  const payload = JSON.parse(String(form.get("payload") || "{}"));
  const partial: any = {};
  for (const key of sections) if (payload[key] !== undefined) partial[key] = payload[key];
  await saveSettings(session.shop, partial);
  const plan = await getPlan(billing, session.shop, admin);
  const sync = await trySync(admin, session.shop, plan);
  return { saved: true, syncError: sync.error };
}
