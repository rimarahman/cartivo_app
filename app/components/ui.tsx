// Small presentational building blocks shared by admin pages.
import { useEffect, useId, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { CAMPAIGN_TYPES, type CampaignType } from "../lib/defaults";
import { canUse, planFor, planName, type PlanInfo } from "../lib/plans";

type Icon = Parameters<typeof SIcon>[0]["type"];

export const CAMPAIGN_META: Record<CampaignType, { icon: Icon; tint: string }> = {
  rewards: { icon: "gift-card", tint: "#dcfce7" },
  bxgy: { icon: "cart-sale", tint: "#fee2e2" },
  volume: { icon: "discount", tint: "#fef3c7" },
  announcement: { icon: "megaphone", tint: "#e0e7ff" },
  upsell: { icon: "product-add", tint: "#fce7f3" },
  addon: { icon: "plus-circle", tint: "#cffafe" },
};

function SIcon(props: { type: NonNullable<JSX.IntrinsicElements["s-icon"]["type"]>; tone?: JSX.IntrinsicElements["s-icon"]["tone"] }) {
  return <s-icon type={props.type} tone={props.tone} />;
}

// Plan-gated controls: greyed out and not interactive (inert), so they look and behave disabled (BFS 4.3.7).
// The caller shows which plan unlocks them next to it.
// `stacked` keeps the page's spacing when it wraps several s-sections.
export function Locked({ locked, stacked, children }: { locked: boolean; stacked?: boolean; children: ReactNode }) {
  if (!locked) return <>{children}</>;
  return (
    <div className={`ckx-locked${stacked ? " ckx-locked-stack" : ""}`} aria-disabled="true" {...{ inert: "" }}>
      {children}
    </div>
  );
}

// Without a plan every type is a link. With one, types the plan doesn't include are greyed out, not
// clickable, and name the plan that unlocks them, with a link to the Plans page (BFS 4.3.7).
export function CampaignTypeGrid({ plan }: { plan?: PlanInfo }) {
  return (
    <div className="ckx-grid" style={{ ["--ckx-min" as string]: "210px" }}>
      {(Object.keys(CAMPAIGN_TYPES) as CampaignType[]).map((type) => {
        const info = CAMPAIGN_TYPES[type];
        const meta = CAMPAIGN_META[type];
        const body = (
          <>
            <span className="ckx-type-icon" style={{ background: meta.tint }}>
              <SIcon type={meta.icon} />
            </span>
            <span className="ckx-type-title">{info.label}</span>
            <span className="ckx-type-desc">{info.description}</span>
          </>
        );
        if (plan && !canUse(plan, type)) {
          const needed = planName(planFor(type));
          return (
            <div key={type} className="ckx-type ckx-type-locked" aria-disabled="true">
              <div className="ckx-type-dim">{body}</div>
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-badge icon="lock">{`${needed} plan`}</s-badge>
                <s-link href="/app/pricing" accessibilityLabel={`See plans that include ${info.label}`}>
                  See plans
                </s-link>
              </s-stack>
            </div>
          );
        }
        return (
          <Link key={type} to={`/app/campaigns/new?type=${type}`} className="ckx-type">
            {body}
            <span className="ckx-type-cta">
              Create <span aria-hidden="true">→</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

// Opening a card tells the others on the page to close.
const ACC_EVENT = "ckx-accordion-open";

// Collapsible settings card with a smooth height animation. Fields stay mounted while collapsed.
export function Accordion(props: {
  title: string;
  description?: string;
  icon: Icon;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(!!props.defaultOpen);
  // Content is clipped only while animating, so popovers (e.g. color pickers) aren't cut off when open.
  const [settled, setSettled] = useState(!!props.defaultOpen);

  useEffect(() => {
    const onOther = (e: Event) => {
      if ((e as CustomEvent<string>).detail === id) return;
      setSettled(false);
      setOpen(false);
    };
    document.addEventListener(ACC_EVENT, onOther);
    return () => document.removeEventListener(ACC_EVENT, onOther);
  }, [id]);

  // Unclip once the 0.5s height animation is over (also works with reduced motion).
  useEffect(() => {
    const t = setTimeout(() => setSettled(open), 520);
    return () => clearTimeout(t);
  }, [open]);

  const toggle = () => {
    setSettled(false);
    if (!open) document.dispatchEvent(new CustomEvent(ACC_EVENT, { detail: id }));
    setOpen(!open);
  };

  return (
    <div className="ckx-card ckx-acc" data-open={open}>
      <button type="button" className="ckx-acc-summary" aria-expanded={open} aria-controls={id} onClick={toggle}>
        <span className="ckx-acc-head">
          <SIcon type={props.icon} />
          <span className="ckx-acc-title">{props.title}</span>
          <span className="ckx-acc-btn" aria-hidden="true">
            <SIcon type={open ? "minimize" : "maximize"} /> {open ? "Collapse" : "Expand"}
          </span>
        </span>
        {props.description && <span className="ckx-acc-desc">{props.description}</span>}
      </button>
      <div
        id={id}
        className="ckx-acc-panel"
        aria-hidden={!open}
      >
        <div className={`ckx-acc-inner${settled && open ? " ckx-settled" : ""}`}>
          <div className="ckx-acc-body">{props.children}</div>
        </div>
      </div>
    </div>
  );
}

// Two-column settings page: collapsible cards on the left, sticky status + live preview on the right.
export function SettingsLayout({ children, side }: { children: ReactNode; side?: ReactNode }) {
  return (
    <div className={`ckx-layout${side ? "" : " ckx-layout-single"}`}>
      <div className="ckx-cards">{children}</div>
      {side && <aside className="ckx-side">{side}</aside>}
    </div>
  );
}

export function SideCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="ckx-card ckx-side-card">
      <div className="ckx-side-head">
        <span className="ckx-acc-title">{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

export function StatCard({ icon, label, value, tint = "#eef2ff" }: { icon: Icon; label: string; value: ReactNode; tint?: string }) {
  return (
    <div className="ckx-stat">
      <span className="ckx-stat-icon" style={{ background: tint }}>
        <SIcon type={icon} />
      </span>
      <span className="ckx-stat-value">{value}</span>
      <span className="ckx-stat-label">{label}</span>
    </div>
  );
}
