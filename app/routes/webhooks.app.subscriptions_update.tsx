// A plan was approved, changed or cancelled: republish so the storefront matches the plan, even when the
// merchant never comes back to the app after approving the charge.
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getPlanFromAdmin } from "../models/billing.server";
import { trySync } from "../models/sync.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, admin } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);
  if (admin) {
    try {
      await trySync(admin, shop, await getPlanFromAdmin(admin, shop));
    } catch (e) {
      console.error("Plan sync after subscription update failed", e);
    }
  }
  return new Response();
};
