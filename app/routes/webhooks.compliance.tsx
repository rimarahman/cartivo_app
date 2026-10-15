// Mandatory privacy webhooks. Cartivo stores no customer data; shop/redact deletes all shop data.
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { deleteShopData } from "../models/store.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);
  if (String(topic).toUpperCase().replace("/", "_") === "SHOP_REDACT") await deleteShopData(shop);
  return new Response();
};
