import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useState } from "react";
import { Form, redirect, useActionData, useLoaderData, useNavigation, useSubmit } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { billingDisabled, chooseFree, devPlan, getPlan, isTestBilling, paidPlanName } from "../models/billing.server";
import { trySync } from "../models/sync.server";
import { ErrorBanner } from "../components/ErrorBanner";
import { FREE_FEATURES, FREE_PLAN, PAID_PLANS, PLAN_ORDER, TRIAL_DAYS, type BillingCycle, type PaidPlanId } from "../lib/plans";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);
  const plan = await getPlan(billing, session.shop, admin);
  // Returning from the billing confirmation page: publish the new plan's campaigns right away.
  if (new URL(request.url).searchParams.get("upgraded")) await trySync(admin, session.shop, plan);
  return { plan, billingDisabled: billingDisabled(), devPlan: devPlan() };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = form.get("intent");
  if (intent === "subscribe") {
    const id = String(form.get("plan")) as PaidPlanId;
    const cycle: BillingCycle = form.get("cycle") === "yearly" ? "yearly" : "monthly";
    if (!PAID_PLANS[id]) return { error: "Unknown plan" };
    const shopHandle = session.shop.replace(".myshopify.com", "");
    // Paid plans have no trial: billing starts when the merchant approves the charge.
    try {
      await billing.request({
        plan: paidPlanName(id, cycle) as any,
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
  const { plan, billingDisabled, devPlan } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  // Billing errors stay until dismissed (BFS 4.2.4); a new result brings the banner back.
  const [dismissed, setDismissed] = useState<unknown>(null);
  const error = result && result !== dismissed ? result.error : null;
  const nav = useNavigation();
  const submit = useSubmit();
  const busy = (value: string) => nav.state !== "idle" && (nav.formData?.get("plan") ?? nav.formData?.get("intent")) === value;
  const paid = PLAN_ORDER.includes(plan.id as PaidPlanId) && !billingDisabled;
  // Prices shown monthly or yearly; opens on the cycle of the current subscription.
  const [cycle, setCycle] = useState<BillingCycle>(plan.cycle ?? "monthly");
  const yearly = cycle === "yearly";
  // current: the plan the store is on (any cycle); exact: that plan on the cycle being shown.
  const current = (id: string) => plan.id === id && !billingDisabled;
  const exact = (id: string) => current(id) && (id === "free" || plan.cycle === cycle);

  const card = (id: "free" | PaidPlanId, action: JSX.Element) => {
    const info = id === "free" ? null : PAID_PLANS[id];
    return (
      <div key={id} className={`ckx-plan${id === "grow" ? " ckx-plan-pro" : ""}${current(id) ? " ckx-plan-current" : ""}`}>
        {info?.badge && !current(id) && <span className={`ckx-plan-ribbon${id === "pro" ? " ckx-plan-ribbon-best" : ""}`}>{info.badge}</span>}
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-heading>{info ? info.name : FREE_PLAN.name}</s-heading>
          {current(id) && (
            <s-badge tone="success">{info && plan.cycle ? `Current plan, ${plan.cycle}` : "Current plan"}</s-badge>
          )}
        </s-stack>
        <div className="ckx-plan-price">
          ${info ? (yearly ? info.yearlyPrice : info.price) : 0} <small>/ {info && yearly ? "year" : "month"}</small>
        </div>
        {info && yearly && (
          <span className="ckx-plan-tagline">
            ${(info.yearlyPrice / 12).toFixed(2)} a month, 2 months free
          </span>
        )}
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
        <s-button type="submit" {...(busy("free") ? { loading: true } : {})} {...(billingDisabled || devPlan ? { disabled: true } : {})}>
          {label}
        </s-button>
      </Form>
    );
  };

  const paidAction = (id: PaidPlanId) => {
    const name = PAID_PLANS[id].name;
    if (exact(id)) return <s-text color="subdued">You&apos;re on {name}, billed {cycle}.</s-text>;
    const label = current(id)
      ? `Switch to ${cycle} billing`
      : paid
        ? PLAN_ORDER.indexOf(id) > PLAN_ORDER.indexOf(plan.id as PaidPlanId)
          ? `Upgrade to ${name}`
          : `Switch to ${name}`
        : `Choose ${name}`;
    return (
      <Form method="post">
        <input type="hidden" name="intent" value="subscribe" />
        <input type="hidden" name="plan" value={id} />
        <input type="hidden" name="cycle" value={cycle} />
        <s-button
          type="submit"
          variant={id === "grow" ? "primary" : "secondary"}
          {...(billingDisabled || devPlan ? { disabled: true } : {})}
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
      {devPlan && !billingDisabled && (
        <s-banner tone="info">
          Development: the app runs as {plan.name} (DEV_PLAN={devPlan} in .env), so no Shopify charge is needed. Remove
          DEV_PLAN to test real billing.
        </s-banner>
      )}
      {billingDisabled && (
        <s-banner tone="info">Billing is disabled (BILLING_DISABLED=true), so every feature is unlocked.</s-banner>
      )}
      {!billingDisabled && !devPlan && plan.id === "trial" && (
        <s-banner tone="info" heading={`Free trial: ${plan.trialDaysLeft} day${plan.trialDaysLeft === 1 ? "" : "s"} left`}>
          Every feature is unlocked for your first {TRIAL_DAYS} days. When the trial ends you&apos;ll pick a plan here:
          Starter (free), Essential, Growth or Premium.
        </s-banner>
      )}
      {!billingDisabled && !devPlan && plan.id === "choose" && (
        <s-banner tone="warning" heading="Your 7-day free trial has ended">
          Choose a plan to continue. Starter (free) keeps your cart drawer; paid plans add sticky add-to-cart, the floating
          cart and campaigns. Your settings and campaigns are saved.
        </s-banner>
      )}

      <s-section>
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-button variant={yearly ? "secondary" : "primary"} onClick={() => setCycle("monthly")}>
            Monthly
          </s-button>
          <s-button variant={yearly ? "primary" : "secondary"} onClick={() => setCycle("yearly")}>
            Yearly (2 months free)
          </s-button>
        </s-stack>
        <div className="ckx-plans">
          {card("free", freeAction())}
          {PLAN_ORDER.map((id) => card(id, paidAction(id)))}
        </div>
      </s-section>

      {paid && (
        <s-modal id="downgrade-modal" heading={`Switch to ${FREE_PLAN.name}?`}>
          <s-paragraph>
            Your {plan.name} subscription is cancelled. Your campaigns, sticky add-to-cart, floating cart, custom code and
            translations stop showing on your store, and the cart drawer switches to the Minimal look. Your settings and
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
          <s-paragraph>
            <s-text type="strong">How does yearly billing work?</s-text> You pay for 12 months at once and get 2 months free.
            You can switch between monthly and yearly billing anytime; Shopify shows what you&apos;ll pay before you
            approve the change.
          </s-paragraph>
          <s-paragraph>
            <s-text type="strong">Which cart designs come with each plan?</s-text> Starter has the Minimal look. Essential adds
            Ocean and Forest, Growth adds Sunset and Midnight, and Premium adds Aurora and Liquid glass. On every plan you can
            fine-tune the colors of your look.
          </s-paragraph>
          <s-paragraph>
            <s-text type="strong">What happens if I move to a lower plan?</s-text> Nothing is deleted. Features your new plan
            doesn&apos;t include stop showing on your store, and a cart design above your plan switches to Minimal. Choose a
            higher plan again and they come back.
          </s-paragraph>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
