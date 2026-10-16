// Live previews of the storefront UI. They render the same markup as cartkit.js and use the real
// storefront stylesheet (linked in app.tsx), so what merchants see here is what shoppers get.
import type { CSSProperties, ReactNode } from "react";
import type { Settings } from "../lib/defaults";

type Partial3 = Pick<Settings, "design" | "drawer" | "upsells">;

export function previewVars(s: Partial<Settings>): CSSProperties {
  const d = s.design;
  const vars: Record<string, string | number> = {};
  if (d) {
    const gradient = d.checkoutStyle !== "solid";
    Object.assign(vars, {
      "--ck-grad-from": gradient ? d.gradientFrom : d.accentColor,
      "--ck-grad-to": gradient ? d.gradientTo : d.accentColor,
      "--ck-checkout-text": gradient ? d.checkoutTextColor : d.accentTextColor,
      "--ck-accent": d.accentColor,
      "--ck-accent-text": d.accentTextColor,
      "--ck-bg": d.backgroundColor,
      "--ck-text": d.textColor,
      "--ck-muted": d.mutedColor,
      "--ck-border": d.borderColor,
      "--ck-progress": d.progressColor,
      "--ck-progress-bg": d.progressBackground,
      "--ck-badge": d.badgeColor,
      "--ck-radius": `${Number(d.borderRadius) || 0}px`,
      "--ck-font-size": `${Number(d.fontSize) || 14}px`,
    });
  }
  if (s.sticky) {
    Object.assign(vars, {
      "--ck-sticky-bg": s.sticky.backgroundColor,
      "--ck-sticky-text": s.sticky.textColor,
      "--ck-sticky-btn": s.sticky.buttonColor,
      "--ck-sticky-btn-text": s.sticky.buttonTextColor,
    });
  }
  if (s.floating) {
    Object.assign(vars, {
      "--ck-float-size": `${Number(s.floating.size) || 56}px`,
      "--ck-float-bg": s.floating.backgroundColor,
      "--ck-float-icon": s.floating.iconColor,
      "--ck-float-badge": s.floating.badgeColor,
      "--ck-float-badge-text": s.floating.badgeTextColor,
    });
  }
  return vars as CSSProperties;
}

// Simple product illustrations so the preview never depends on store data.
const art = (bg: string, fg: string, shape: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/>${shape.replaceAll("FG", fg)}</svg>`,
  )}`;
const TEE = art("#e0e7ff", "#6366f1", '<path fill="FG" d="M36 22 23 29l-9 15 12 6 4-6v36h40V44l4 6 12-6-9-15-13-7c-3 6-8 9-14 9s-11-3-14-9z"/>');
const MUG = art("#fce7f3", "#db2777", '<rect x="28" y="32" width="36" height="42" rx="7" fill="FG"/><path d="M64 42h6a9 9 0 0 1 0 18h-6" fill="none" stroke="FG" stroke-width="6"/>');
const CANDLE = art("#fef3c7", "#d97706", '<rect x="36" y="40" width="28" height="38" rx="6" fill="FG"/><path fill="#f59e0b" d="M50 18c6 8 7 13 0 18-7-5-6-10 0-18z"/>');

const money = (n: number) => `$${n.toFixed(2)}`;

const ICON_PROPS = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "aria-hidden": true } as const;
const Icons = {
  close: (
    <svg {...ICON_PROPS} width="20" height="20" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
  bag: (
    <svg {...ICON_PROPS} width="24" height="24" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M5 8h14l-1 12H6L5 8z" />
      <path d="M9 8V6a3 3 0 016 0v2" />
    </svg>
  ),
  trash: (
    <svg {...ICON_PROPS} width="16" height="16" strokeWidth="1.8">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  ),
  truck: (
    <svg {...ICON_PROPS} width="14" height="14" strokeWidth="2">
      <path d="M3 6h11v9H3zM14 9h4l3 3v3h-7" />
      <circle cx="7" cy="17" r="1.6" />
      <circle cx="17" cy="17" r="1.6" />
    </svg>
  ),
  gift: (
    <svg {...ICON_PROPS} width="14" height="14" strokeWidth="2">
      <path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0" />
    </svg>
  ),
  check: (
    <svg {...ICON_PROPS} width="14" height="14" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  ),
  next: (
    <svg {...ICON_PROPS} width="16" height="16" strokeWidth="2">
      <path d="M9 6l6 6-6 6" />
    </svg>
  ),
  lock: (
    <svg {...ICON_PROPS} width="16" height="16" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  ),
  arrow: (
    <svg {...ICON_PROPS} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path className="ck-arrow-shaft" d="M4 12h14" />
      <path className="ck-arrow-head" d="M12 6l6 6-6 6" />
    </svg>
  ),
};

function Frame({ caption, children, glass }: { caption: ReactNode; children: ReactNode; glass?: boolean }) {
  return (
    <div className={`ckx-preview-bg${glass ? " ckx-preview-bg-glass" : ""}`}>
      <div className="ckx-preview-caption">{caption}</div>
      <div className="ckx-preview">{children}</div>
    </div>
  );
}

export function DrawerPreview({ settings }: { settings: Partial3 }) {
  const { drawer: d, upsells } = settings;
  const items = [
    { title: "Organic cotton tee", variant: "Sand / M", image: TEE, qty: 2, price: 58, compare: 0 },
    { title: "Ceramic coffee mug", variant: "", image: MUG, qty: 1, price: 18, compare: 24 },
  ];
  const subtotal = items.reduce((s, i) => s + i.price, 0);
  const savings = items.reduce((s, i) => s + (i.compare ? i.compare - i.price : 0), 0);
  // Two goals at even steps: free shipping at 50 (reached, half way) and a free gift at 100 (the end).
  const goal = 100;
  const pct = Math.min(100, (subtotal / goal) * 100);

  return (
    <Frame
      glass={settings.design.glass}
      caption={
        <>
          <span>Live preview</span>
          <span>Hover the checkout button</span>
        </>
      }
    >
      <div className={`ck-root ck-open${settings.design.glass ? " ck-glass" : ""}`} style={previewVars(settings)}>
        <aside className="ck-drawer" aria-label="Cart drawer preview">
          <header className="ck-header">
            <h2 className="ck-title">
              {d.title || "Your cart"} <span className="ck-count">3</span>
            </h2>
            <button type="button" className="ck-close" aria-label="Close" tabIndex={-1}>
              {Icons.close}
            </button>
          </header>
          <div className="ck-goals">
            <div className="ck-goal-message">
              You&apos;re <strong>{money(goal - subtotal)}</strong> away from <strong>Free gift</strong>
            </div>
            <div className="ck-goal-track" style={{ ["--n" as string]: 2 }}>
              <div className="ck-progress">
                <span className="ck-progress-fill" style={{ width: `${pct}%` }} />
                <span className="ck-milestone ck-done" style={{ left: "50%" }} />
                <span className="ck-milestone" style={{ left: "100%" }} />
              </div>
              <div className="ck-milestone-labels">
                <span className="ck-done">Free shipping</span>
                <span>Free gift</span>
              </div>
            </div>
          </div>
          <div className="ck-body">
            {items.map((item) => (
              <div className="ck-item" key={item.title}>
                <a className="ck-item-image" href="#preview">
                  <img src={item.image} alt="" />
                </a>
                <div className="ck-item-info">
                  {d.showVendor && <div className="ck-vendor">Cartivo Co.</div>}
                  <a className="ck-item-title" href="#preview">
                    {item.title}
                  </a>
                  {item.variant && <div className="ck-variant">{item.variant}</div>}
                  {item.compare > 0 && <span className="ck-badge">SPRING (-{money(item.compare - item.price)})</span>}
                  <div className="ck-item-row">
                    <div className="ck-qty">
                      <button type="button" tabIndex={-1}>
                        −
                      </button>
                      <span>{item.qty}</span>
                      <button type="button" tabIndex={-1}>
                        +
                      </button>
                    </div>
                    <div className="ck-price">
                      {item.compare > 0 && d.showCompareAt && <s className="ck-compare">{money(item.compare)}</s>}
                      <span>{money(item.price)}</span>
                    </div>
                  </div>
                </div>
                <button type="button" className="ck-remove" aria-label="Remove" tabIndex={-1}>
                  {Icons.trash}
                </button>
              </div>
            ))}
            {upsells.enabled && (
              <div className="ck-upsells">
                <div className="ck-section-head">
                  <div className="ck-section-title">{upsells.title}</div>
                </div>
                <div className="ck-upsell-list ck-list">
                  <div className="ck-upsell">
                    <a className="ck-upsell-image" href="#preview">
                      <img src={CANDLE} alt="" />
                    </a>
                    <div className="ck-upsell-info">
                      <a className="ck-upsell-title" href="#preview">
                        Soy wax candle
                      </a>
                      <div className="ck-upsell-price">{money(14)}</div>
                      <button type="button" className="ck-btn ck-btn-small" tabIndex={-1}>
                        {upsells.buttonText}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <footer className="ck-footer">
            {(d.showNote || d.showDiscountField) && (
              <div className="ck-extras">
                {d.showNote && (
                  <button type="button" className="ck-toggle ck-note-toggle" tabIndex={-1} aria-expanded="false">
                    <span>{d.noteLabel}</span>
                    {Icons.next}
                  </button>
                )}
                {d.showDiscountField && (
                  <button type="button" className="ck-toggle" tabIndex={-1} aria-expanded="false">
                    <span>{d.discountPlaceholder}</span>
                    {Icons.next}
                  </button>
                )}
              </div>
            )}
            <div className="ck-totals">
              {d.showSubtotal ? (
                <div className="ck-total-row ck-subtotal">
                  <span>
                    {d.subtotalText}
                    {d.showSavings && savings > 0 && (
                      <>
                        {" "}
                        <small className="ck-savings">
                          {d.savingsText} {money(savings)}
                        </small>
                      </>
                    )}
                  </span>
                  <span>{money(subtotal)}</span>
                </div>
              ) : (
                d.showSavings &&
                savings > 0 && (
                  <div className="ck-total-row ck-savings">
                    <span>
                      {d.savingsText} {money(savings)}
                    </span>
                  </div>
                )
              )}
              {d.showTaxesText && <div className="ck-taxes">{d.taxesText}</div>}
            </div>
            {d.showTerms && (
              <label className="ck-terms">
                <input type="checkbox" tabIndex={-1} readOnly />
                <span>I agree to the terms and conditions</span>
              </label>
            )}
            <button type="button" className="ck-btn ck-checkout">
              <span className="ck-checkout-label">
                <span className="ck-checkout-lock">{Icons.lock}</span>
                {d.checkoutText}
                {d.showSubtotal ? "" : ` · ${money(subtotal)}`}
              </span>
              <span className="ck-checkout-arrow">{Icons.arrow}</span>
            </button>
            {(d.showContinueShopping || d.showViewCart) && (
              <div className="ck-links">
                {d.showContinueShopping && (
                  <button type="button" className="ck-link" tabIndex={-1}>
                    {d.continueShoppingText}
                  </button>
                )}
                {d.showViewCart && (
                  <button type="button" className="ck-link" tabIndex={-1}>
                    {d.viewCartText}
                  </button>
                )}
              </div>
            )}
          </footer>
        </aside>
      </div>
    </Frame>
  );
}

export function StickyPreview({ sticky, floating, glass }: Pick<Settings, "sticky" | "floating"> & { glass?: boolean }) {
  const vars = previewVars({ sticky, floating });
  const g = glass ? " ck-glass" : "";
  return (
    <Frame glass={glass} caption={<span>Live preview</span>}>
      <s-stack gap="base">
        <div className="ckx-preview-page" aria-hidden="true">
          <i style={{ width: "40%" }} />
          <i />
          <i style={{ width: "80%" }} />
        </div>
        {sticky.enabled ? (
          <div className={`ck-sticky ck-visible${g}`} style={vars}>
            <div className="ck-sticky-inner">
              {sticky.showImage && <img className="ck-sticky-image" src={TEE} alt="" />}
              <div className="ck-sticky-info">
                <div className="ck-sticky-title">Organic cotton tee</div>
                {sticky.showPrice && (
                  <div className="ck-sticky-price">
                    <s>{money(39)}</s> {money(29)}
                  </div>
                )}
              </div>
              {sticky.showQuantity && <input className="ck-sticky-qty" type="number" defaultValue={1} tabIndex={-1} aria-label="Quantity" />}
              <button type="button" className="ck-sticky-btn">
                {sticky.buttonText}
              </button>
            </div>
          </div>
        ) : (
          <s-text color="subdued">Sticky add-to-cart is off.</s-text>
        )}
        {floating.enabled && (
          <div className={`ckx-preview-float-row${floating.position.endsWith("left") ? " ckx-left" : ""}`}>
            <button type="button" className={`ck-float${g}`} style={vars} aria-label="Floating cart preview">
              {Icons.bag}
              <span className="ck-float-count">3</span>
            </button>
          </div>
        )}
      </s-stack>
    </Frame>
  );
}
