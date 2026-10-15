import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";

import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";
import { manualLoginAllowed } from "./manual.server";

// Requests from Shopify carry ?shop=..., and login() redirects them straight into OAuth. Only a bare visit
// (or the dev-only form) reaches the page below.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));

  return { errors, showForm: manualLoginAllowed() };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (!manualLoginAllowed()) return { errors: {} };
  const errors = loginErrorMessage(await login(request));

  return {
    errors,
  };
};

export default function Auth() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [shop, setShop] = useState("");
  const { errors } = actionData || loaderData;

  return (
    <>
      <script src="https://cdn.shopify.com/shopifycloud/polaris.js" />
      <s-page>
        {loaderData.showForm ? (
          <Form method="post">
            <s-section heading="Log in">
              <s-text-field
                name="shop"
                label="Shop domain"
                details="example.myshopify.com"
                value={shop}
                onChange={(e) => setShop(e.currentTarget.value)}
                autocomplete="on"
                error={errors.shop}
              ></s-text-field>
              <s-button type="submit">Log in</s-button>
            </s-section>
          </Form>
        ) : (
          <s-section heading="Open SC Cartivo from Shopify">
            <s-paragraph>
              Open SC Cartivo from the Apps section of your Shopify admin. If it isn&apos;t installed yet, install it from
              the Shopify App Store.
            </s-paragraph>
          </s-section>
        )}
      </s-page>
    </>
  );
}
