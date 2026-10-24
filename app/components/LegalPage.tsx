// Shared layout for the public legal pages (/privacy, /terms). Plain HTML outside the Shopify admin, so the
// App Store listing and merchants can link to it without signing in.
import type { ReactNode } from "react";

export const LEGAL_UPDATED = "October 24, 2026";
export const LEGAL_CONTACT = "softique71@gmail.com";

const css = `
  .legal { max-width: 760px; margin: 0 auto; padding: 40px 16px 64px; font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1f2124; }
  .legal h1 { font-size: 30px; line-height: 1.2; margin: 0 0 6px; }
  .legal h2 { font-size: 19px; margin: 32px 0 8px; }
  .legal p, .legal li { margin: 0 0 10px; }
  .legal ul { padding-left: 22px; }
  .legal .meta { color: #616a75; margin-bottom: 28px; }
  .legal a { color: #005bd3; }
  .legal nav { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e3e3e3; color: #616a75; font-size: 14px; }
  body { margin: 0; background: #fff; }
`;

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="legal">
      <style>{css}</style>
      <h1>{title}</h1>
      <p className="meta">Cartivo by Softique Commerce · Last updated {LEGAL_UPDATED}</p>
      {children}
      <nav>
        <a href="/privacy">Privacy policy</a> · <a href="/terms">Terms of service</a> · Contact:{" "}
        <a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>
      </nav>
    </main>
  );
}
