// Pushes the saved configuration to the storefront again (no settings change). Every save already publishes;
// this is the recovery path when that publish failed: "Retry publishing" in the save error banner, and
// "Republish to store" under Help → Quick fixes.
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getPlan } from "../models/billing.server";
import { trySync } from "../models/sync.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);
  const plan = await getPlan(billing, session.shop, admin);
  const sync = await trySync(admin, session.shop, plan);
  return { ok: sync.ok, error: sync.error };
};
