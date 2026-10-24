// Public terms of service for the App Store listing: https://<app url>/terms
import type { MetaFunction } from "react-router";
import { LEGAL_CONTACT, LegalPage } from "../components/LegalPage";

export const meta: MetaFunction = () => [{ title: "Terms of service · Cartivo" }];

export default function Terms() {
  const mail = <a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>;
  return (
    <LegalPage title="Terms of service">
      <p>
        These terms apply to Cartivo ("the app"), a Shopify app made by Softique Commerce ("we", "us"). By installing or
        using the app you ("the merchant") agree to these terms and to our <a href="/privacy">privacy policy</a>.
      </p>

      <h2>The service</h2>
      <p>
        Cartivo adds a slide cart, cart goals, upsells, cart offers and a sticky add-to-cart to your Shopify store. It
        requires an Online Store 2.0 theme that supports app embeds. Features may change as we improve the app.
      </p>

      <h2>Plans and billing</h2>
      <ul>
        <li>The app offers a free Starter plan and paid plans, as listed on the Shopify App Store and in the app.</li>
        <li>New stores get a 7-day free trial of all features, then choose the Starter plan or a paid plan.</li>
        <li>
          Paid plans are billed by Shopify every 30 days, starting when you approve the charge, and appear on your
          Shopify invoice. Prices are in US dollars, and taxes may apply.
        </li>
        <li>
          You can change or cancel your plan at any time from the app's Plans page. Uninstalling the app cancels the
          subscription.
        </li>
        <li>Refunds follow Shopify's billing rules. Contact us if you think you were charged by mistake.</li>
      </ul>

      <h2>Your responsibilities</h2>
      <ul>
        <li>Use the app in line with Shopify's terms and the laws that apply to your store.</li>
        <li>
          Check that your campaigns, discounts, prices and storefront text are correct before you publish them. You are
          responsible for the offers you show to shoppers.
        </li>
        <li>Don't misuse the app, try to break it, or reach data that isn't yours.</li>
      </ul>

      <h2>Discounts and orders</h2>
      <p>
        Cart offers use Shopify's discount features. Final prices are calculated by Shopify at checkout. We are not
        responsible for orders, payments, shipping or refunds between you and your customers.
      </p>

      <h2>Availability and support</h2>
      <p>
        We work to keep the app available and fix problems quickly, but we can't promise it will always run without
        interruption or errors. Support is available from the app's Help page and at {mail}.
      </p>

      <h2>Intellectual property</h2>
      <p>
        The app, its code and design belong to Softique Commerce. Your store content, products and data stay yours.
      </p>

      <h2>Disclaimer and limitation of liability</h2>
      <p>
        The app is provided "as is". To the extent the law allows, we make no warranties beyond those stated here, and
        we are not liable for indirect or consequential losses, such as lost sales or profits. Our total liability is
        limited to the amount you paid for the app in the 12 months before the claim.
      </p>

      <h2>Ending use</h2>
      <p>
        You can stop using the app at any time by uninstalling it. We may suspend access if these terms are broken.
        After uninstalling, your data is deleted as described in our <a href="/privacy">privacy policy</a>.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms. The date at the top shows the latest change. Continuing to use the app after a change
        means you accept the updated terms.
      </p>

      <h2>Contact</h2>
      <p>Softique Commerce · {mail}</p>
    </LegalPage>
  );
}
