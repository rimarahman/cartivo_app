import type { HeadersFunction, LinksFunction, LoaderFunctionArgs, ShouldRevalidateFunction } from "react-router";
import { Outlet, redirect, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
import { getPlan } from "../models/billing.server";
import adminStyles from "../styles/admin.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: "/storefront.css" },
  { rel: "stylesheet", href: adminStyles },
];

// Open while the merchant still has to pick a plan (the Plans page itself, and getting help).
const OPEN_WITHOUT_PLAN = ["/app/pricing", "/app/help", "/app/chat"];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);
  // Trial over and no plan picked yet: every page leads to the Plans page.
  const url = new URL(request.url);
  if (!OPEN_WITHOUT_PLAN.some((p) => url.pathname.startsWith(p)) && (await getPlan(billing, session.shop, admin)).id === "choose") {
    throw redirect(`/app/pricing${url.search}`);
  }

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

// Re-check on every navigation so the plan choice can't be skipped by moving between pages.
export const shouldRevalidate: ShouldRevalidateFunction = () => true;

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider apiKey={apiKey}>
      <s-app-nav>
        {/* rel="home": clicking the app name opens /app, and this link is hidden from the menu.
            Spread because @shopify/polaris-types doesn't type `rel` on s-link yet. */}
        <s-link href="/app" {...{ rel: "home" }}>Dashboard</s-link>
        <s-link href="/app/drawer">Cart drawer</s-link>
        <s-link href="/app/campaigns">Campaigns</s-link>
        <s-link href="/app/sticky">Sticky & floating cart</s-link>
        <s-link href="/app/advanced">Custom code & languages</s-link>
        <s-link href="/app/analytics">Analytics</s-link>
        <s-link href="/app/pricing">Plans</s-link>
        <s-link href="/app/help">Help</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
