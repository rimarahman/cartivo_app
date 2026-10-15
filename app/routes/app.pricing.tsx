import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useState } from "react";
import { Form, redirect, useActionData, useLoaderData, useNavigation, useSubmit } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { billingDisabled, chooseFree, getPlan, isTestBilling, paidPlanName } from "../models/billing.server";
import { trySync } from "../models/sync.server";
import { ErrorBanner } from "../components/ErrorBanner";
import { FREE_FEATURES, FREE_PLAN, PAID_PLANS, PLAN_ORDER, TRIAL_DAYS, type PaidPlanId } from "../lib/plans";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);
  const plan = await getPlan(billing, session.shop, admin);
  // Returning from the billing confirmation page: publish the new plan's campaigns right away.
  if (new URL(request.url).searchParams.get("upgraded")) await trySync(admin, session.shop, plan);
  return { plan, billingDisabled: billingDisabled() };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = form.get("intent");
  if (intent === "subscribe") {
    const id = String(form.get("plan")) as PaidPlanId;
    if (!PAID_PLANS[id]) return { error: "Unknown plan" };
    const shopHandle = session.shop.replace(".myshopify.com", "");
    // Paid plans have no trial: billing starts when the merchant approves the charge.
    try {
      await billing.request({
        plan: paidPlanName(id) as any,
        isTest: await isTestBilling(admin, session.shop),
        returnUrl: `https://admin.shopify.com/store/${shopHandle}/apps/${process.env.SHOPIFY_API_KEY}/app/pricing?upgraded=1`,
      });
    } catch (e) {
      // Success is a thrown redirect to the charge approval page; anything else is a billing error.
      if (e instanceof Response) throw e;
      console.error("Billing request failed", e);
      return { error: "Shopify couldn't start the subscription. Please try again, or contact us from the Help page if it keeps happening." };
    }
  }
  if (intent === "free") {
    // Picking Starter (free): after the trial, or switching down from a paid plan (cancels the subscription).
    const plan = await getPlan(billing, session.shop, admin);
    if (plan.subscriptionId) {
      try {
        await billing.cancel({ subscriptionId: plan.subscriptionId, isTest: await isTestBilling(admin, session.shop), prorate: true });
      } catch (e) {
        if (e instanceof Response) throw e;
        console.error("Billing cancel failed", e);
        return { error: `Shopify couldn't cancel your ${plan.name} subscription, so your plan is unchanged. Please try again.` };
      }
    }
    await chooseFree(session.shop);
    await trySync(admin, session.shop, await getPlan(billing, session.shop, admin));
    return redirect("/app");
  }
  return null;
};

export default function Pricing() {
  const { plan, billingDisabled } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  // Billing errors stay until dismissed (BFS 4.2.4); a new result brings the banner back.
  const [dismissed, setDismissed] = useState<unknown>(null);
  const error = result && result !== dismissed ? result.error : null;
  const nav = useNavigation();
  const submit = useSubmit();
  const busy = (value: string) => nav.state !== "idle" && (nav.formData?.get("plan") ?? nav.formData?.get("intent")) === value;
  const paid = PLAN_ORDER.includes(plan.id as PaidPlanId) && !billingDisabled;
  const current = (id: string) => plan.id === id && !billingDisabled;

  const card = (id: "free" | PaidPlanId, action: JSX.Element) => {
    const info = id === "free" ? null : PAID_PLANS[id];
    return (
      <div key={id} className={`ckx-plan${id === "grow" ? " ckx-plan-pro" : ""}${current(id) ? " ckx-plan-current" : ""}`}>
        {info?.badge && !current(id) && <span className={`ckx-plan-ribbon${id === "pro" ? " ckx-plan-ribbon-best" : ""}`}>{info.badge}</span>}
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-heading>{info ? info.name : FREE_PLAN.name}</s-heading>
          {current(id) && <s-badge tone="success">Current plan</s-badge>}
        </s-stack>
        <div className="ckx-plan-price">
          ${info ? info.price : 0} <small>/ month</small>
        </div>
        <span className="ckx-plan-tagline">{info ? info.tagline : FREE_PLAN.tagline}</span>
        <ul>
          {(info ? info.features : FREE_FEATURES).map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        {action}
      </div>
    );
  };

  const freeAction = () => {
    if (current("free")) return <s-text color="subdued">You&apos;re on {FREE_PLAN.name}.</s-text>;
    if (plan.id === "trial") return <s-text color="subdued">Available when your trial ends.</s-text>;
    const label = plan.id === "choose" ? `Continue with ${FREE_PLAN.name}` : `Switch to ${FREE_PLAN.name}`;
    // Leaving a paid plan cancels the subscription, so it's confirmed in a modal first.
    if (paid) {
      return (
        <s-button commandFor="downgrade-modal" command="--show" {...(busy("free") ? { loading: true } : {})}>
          {label}
        </s-button>
      );
    }
    return (
      <Form method="post">
        <input type="hidden" name="intent" value="free" />
        <s-button type="submit" {...(busy("free") ? { loading: true } : {})} {...(billingDisabled ? { disabled: true } : {})}>
          {label}
        </s-button>
      </Form>
    );
  };

  const paidAction = (id: PaidPlanId) => {
    if (current(id)) return <s-text color="subdued">You&apos;re on {PAID_PLANS[id].name}.</s-text>;
    const label = paid
      ? PAID_PLANS[id].price > PAID_PLANS[plan.id as PaidPlanId].price
        ? `Upgrade to ${PAID_PLANS[id].name}`
        : `Switch to ${PAID_PLANS[id].name}`
      : `Choose ${PAID_PLANS[id].name}`;
    return (
      <Form method="post">
        <input type="hidden" name="intent" value="subscribe" />
        <input type="hidden" name="plan" value={id} />
        <s-button
          type="submit"
          variant={id === "grow" ? "primary" : "secondary"}
          {...(billingDisabled ? { disabled: true } : {})}
          {...(busy(id) ? { loading: true } : {})}
        >
          {label}
        </s-button>
      </Form>
    );
  };

  return (
    <s-page heading="Plans">
      {error && <ErrorBanner message={error} onDismiss={() => setDismissed(result)} />}
      {billingDisabled && (
        <s-banner tone="info">Billing is disabled (BILLING_DISABLED=true), so every feature is unlocked.</s-banner>
      )}
      {!billingDisabled && plan.id === "trial" && (
        <s-banner tone="info" heading={`Free trial: ${plan.trialDaysLeft} day${plan.trialDaysLeft === 1 ? "" : "s"} left`}>
          Every feature is unlocked for your first {TRIAL_DAYS} days. When the trial ends you&apos;ll pick a plan here:
          Starter (free), Essential, Growth or Premium.
        </s-banner>
      )}
      {!billingDisabled && plan.id === "choose" && (
        <s-banner tone="warning" heading="Your 7-day free trial has ended">
          Choose a plan to continue. Starter (free) keeps your cart drawer, sticky add-to-cart and floating cart; paid plans add
          campaigns. Your settings and campaigns are saved.
        </s-banner>
      )}

      <s-section>
        <div className="ckx-plans">
          {card("free", freeAction())}
          {PLAN_ORDER.map((id) => card(id, paidAction(id)))}
        </div>
      </s-section>

      {paid && (
        <s-modal id="downgrade-modal" heading={`Switch to ${FREE_PLAN.name}?`}>
          <s-paragraph>
            Your {plan.name} subscription is cancelled and your campaigns stop showing on your store. Your settings and
            campaigns are kept, so you can pick a paid plan again anytime.
          </s-paragraph>
          <s-button slot="secondary-actions" commandFor="downgrade-modal" command="--hide">
            Keep {plan.name}
          </s-button>
          <s-button
            slot="primary-action"
            variant="primary"
            tone="critical"
            commandFor="downgrade-modal"
            command="--hide"
            onClick={() => submit({ intent: "free" }, { method: "post" })}
          >
            Switch to {FREE_PLAN.name}
          </s-button>
        </s-modal>
      )}

      <s-section heading="Questions">
        <s-stack gap="small-200">
          <s-paragraph>
            <s-text type="strong">How does the trial work?</s-text> Every feature is free for your first {TRIAL_DAYS} days. After
            that you choose Starter (free) or a paid plan. Paid plans are billed from the day you choose them.
          </s-paragraph>
          <s-paragraph>
            <s-text type="strong">Can I change plans later?</s-text> Yes, anytime. Shopify prorates the difference and bills you
            with your Shopify invoice.
          </s-paragraph>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
