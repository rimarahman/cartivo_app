// Public privacy policy for the App Store listing: https://<app url>/privacy
import type { MetaFunction } from "react-router";
import { LEGAL_CONTACT, LegalPage } from "../components/LegalPage";

export const meta: MetaFunction = () => [{ title: "Privacy policy · Cartivo" }];

export default function Privacy() {
  const mail = <a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>;
  return (
    <LegalPage title="Privacy policy">
      <p>
        Cartivo ("the app") is a Shopify app made by Softique Commerce ("we", "us"). It adds a slide cart, upsells and
        cart offers to Shopify stores. This policy explains what information the app collects when a merchant installs
        it, how we use it and how it is deleted.
      </p>

      <h2>Information we collect</h2>
      <p>When a merchant installs Cartivo, Shopify lets the app access the following store information:</p>
      <ul>
        <li>
          <strong>Store details:</strong> the store's myshopify.com domain, name, primary domain, currency, Shopify plan,
          languages and the store email (used only to prefill the reply address on the Help page).
        </li>
        <li>
          <strong>Products:</strong> product titles, images, prices and variants, so the app can show upsells and gifts
          in the cart.
        </li>
        <li>
          <strong>Discounts:</strong> the app creates and updates the automatic discounts that power its cart offers.
        </li>
        <li>
          <strong>Access token:</strong> the credential Shopify issues to the app, stored so the app can work on the
          store's behalf.
        </li>
      </ul>
      <p>The app also stores information the merchant creates or sends:</p>
      <ul>
        <li>App settings, cart design and campaigns.</li>
        <li>
          Support requests and live chat messages, including the email address the merchant enters for replies and
          basic store diagnostics (store domain, Shopify plan, currency).
        </li>
        <li>The plan the store is on and when its free trial started.</li>
      </ul>
      <p>
        Subscriptions are billed through Shopify. We never receive or store payment card details. The app doesn't store
        the names or email addresses of the store's staff accounts. Like most web services, our hosting provider keeps
        short-lived technical logs (such as IP address, browser type and request time) to run and secure the app.
      </p>

      <h2>Shoppers and customer data</h2>
      <p>
        Cartivo does not collect, store or process personal information about the store's customers. It does not read
        customer or order records. On the storefront it counts anonymous events (for example "cart opened" or "upsell
        added") with the store and campaign they belong to, and no shopper identifier, IP address or cookie is saved. The
        cart uses the browser's session storage only to remember, during a visit, which offers were already shown and a
        pending discount code. That information stays in the shopper's browser.
      </p>

      <h2>How we use information</h2>
      <ul>
        <li>To provide the app's features in the store and the Shopify admin.</li>
        <li>To show the merchant analytics about how the cart and offers perform.</li>
        <li>To manage the subscription plan through Shopify Billing.</li>
        <li>To answer support requests and live chat messages.</li>
      </ul>
      <p>
        We do not sell information, we do not use it for advertising, and we do not use merchant or store data to
        train artificial intelligence or machine learning models.
      </p>

      <h2>Service providers</h2>
      <p>We share information only with the providers that run the app:</p>
      <ul>
        <li>Shopify: platform, authentication and billing.</li>
        <li>Render: application hosting.</li>
        <li>Neon: database hosting.</li>
        <li>Resend: delivery of support request emails to our support inbox.</li>
      </ul>
      <p>
        These providers may only use the information to provide their services to us. They may process it outside your
        country, including in the United States. We may also disclose information when the law requires it, for
        example to respond to a court order, or to protect our rights.
      </p>

      <h2>Retention and deletion</h2>
      <ul>
        <li>Anonymous storefront events are deleted after about 120 days.</li>
        <li>When a merchant uninstalls the app, its access token is deleted right away.</li>
        <li>
          About 48 hours after uninstalling, Shopify sends a shop data deletion request, and the app then deletes all of
          the store's data: settings, campaigns, events, support requests, chat messages and trial records.
        </li>
        <li>
          The app responds to Shopify's customer data requests and customer deletion requests. Because it holds no
          customer data, there is nothing to return or delete.
        </li>
      </ul>

      <h2>Security</h2>
      <p>
        Data is sent over HTTPS and stored with our hosting providers. Requests from Shopify are verified with Shopify's
        signatures, and only our support team can reach support messages.
      </p>

      <h2>Your rights</h2>
      <p>
        Merchants can ask to access, correct or delete their information at any time by emailing {mail}. We reply
        within 30 days.
      </p>
      <p>
        If you are in the European Economic Area or the United Kingdom, you have these rights under the GDPR. We
        process your information to perform our agreement with you (providing the app) and for our legitimate interest
        in supporting and securing the app. You can also complain to your local data protection authority.
      </p>

      <h2>Changes to this policy</h2>
      <p>We may update this policy. The date at the top shows the latest change.</p>

      <h2>Contact</h2>
      <p>Softique Commerce · {mail}</p>
    </LegalPage>
  );
}
