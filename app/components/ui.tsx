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

// Without a plan the grid shows no plan badges; with one, types the plan doesn't include show the plan they need.
export function CampaignTypeGrid({ plan }: { plan?: PlanInfo }) {
  return (
    <div className="ckx-grid" style={{ ["--ckx-min" as string]: "210px" }}>
      {(Object.keys(CAMPAIGN_TYPES) as CampaignType[]).map((type) => {
        const info = CAMPAIGN_TYPES[type];
        const meta = CAMPAIGN_META[type];
        return (
          <Link key={type} to={`/app/campaigns/new?type=${type}`} className="ckx-type">
            <span className="ckx-type-icon" style={{ background: meta.tint }}>
              <SIcon type={meta.icon} />
            </span>
            <span className="ckx-type-title">
              {info.label}
              {plan && !canUse(plan, type) && <span className="ckx-pro">{planName(planFor(type)).toUpperCase()}</span>}
            </span>
            <span className="ckx-type-desc">{info.description}</span>
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
