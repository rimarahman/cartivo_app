// Storefront analytics endpoint: POST https://{shop}/apps/cartkit/track
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

const ALLOWED = new Set([
  "drawer_open",
  "item_add",
  "upsell_add",
  "gift_added",
  "bxgy_added",
  "addon_add",
  "sticky_add",
  "discount_applied",
  "checkout_click",
]);

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  if (!session) return new Response(null, { status: 204 });

  let body: any = {};
  try {
    body = JSON.parse(await request.text());
  } catch {
    return new Response(null, { status: 400 });
  }
  const events = (Array.isArray(body.events) ? body.events : [body]).slice(0, 20);
  const rows = events
    .filter((e: any) => ALLOWED.has(e?.type))
    .map((e: any) => ({
      shop: session.shop,
      type: e.type,
      campaignId: typeof e.campaignId === "string" ? e.campaignId.slice(0, 40) : null,
      value: Number.isFinite(Number(e.value)) ? Number(e.value) : null,
    }));
  if (rows.length) await db.event.createMany({ data: rows });
  return new Response(null, { status: 204 });
};

export const loader = () => new Response(null, { status: 405 });
