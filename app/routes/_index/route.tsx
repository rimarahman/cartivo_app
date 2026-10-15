import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>CartKit – Cart Drawer &amp; Free Gift</h1>
        <p className={styles.text}>
          A slide cart with free gifts, cart goals and upsells that raises your average order value.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Slide cart drawer</strong>. Sticky add-to-cart, floating
            mini cart, notes, discount codes and terms checkbox.
          </li>
          <li>
            <strong>Free gifts &amp; cart goals</strong>. Multi-tier progress
            bar that unlocks free shipping, gifts and discounts.
          </li>
          <li>
            <strong>Upsells &amp; promotions</strong>. AI recommendations, Buy X
            Get Y, volume discounts, timers and one-click add-ons.
          </li>
        </ul>
      </div>
    </div>
  );
}
