import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";
import { manualLoginAllowed } from "../auth.login/manual.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  // App Store requirement 2.3.1: merchants install and open the app from Shopify, never by typing a shop domain.
  return { showForm: Boolean(login) && manualLoginAllowed() };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Cartivo: Slide Cart &amp; Upsells</h1>
        <p className={styles.text}>
          A slide cart with free gifts, cart goals and upsells for your Shopify store.
        </p>
        {showForm ? (
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
        ) : (
          <p className={styles.text}>
            Install Cartivo from the Shopify App Store, then open it from the Apps section of your Shopify admin.
          </p>
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
            <strong>Upsells &amp; promotions</strong>. Product recommendations,
            Buy X Get Y, volume discounts, countdowns and one-click add-ons.
          </li>
        </ul>
      </div>
    </div>
  );
}
