import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { StatCard } from "../components/ui";
import { useEmbedStatus } from "../components/useEmbedStatus";
import { getSettings } from "../models/store.server";

const EVENT_LABELS: Record<string, string> = {
  drawer_open: "Cart drawer opens",
  item_add: "Products added (via Cartivo)",
  upsell_add: "Upsells added",
  gift_added: "Free gifts unlocked",
  bxgy_added: "Buy X Get Y items added",
  addon_add: "Add-ons selected",
  sticky_add: "Sticky add-to-cart clicks",
  discount_applied: "Discount codes applied",
  checkout_click: "Checkouts started",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const days = Math.min(90, Math.max(1, Number(new URL(request.url).searchParams.get("days")) || 30));
  const since = new Date(Date.now() - days * 864e5);
  // Counted in Postgres: a busy store can have millions of events in 90 days, too many to load into memory.
  const [grouped, dailyRows] = await Promise.all([
    db.event.groupBy({
      by: ["type"],
      where: { shop: session.shop, createdAt: { gte: since } },
      _count: { _all: true },
      _sum: { value: true },
    }),
    db.$queryRaw<{ day: string; count: number }[]>`
      SELECT to_char("createdAt", 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
      FROM "Event"
      WHERE shop = ${session.shop} AND type = 'drawer_open' AND "createdAt" >= ${since}
      GROUP BY 1`,
  ]);

  const totals: Record<string, { count: number; value: number }> = {};
  for (const g of grouped) totals[g.type] = { count: g._count._all, value: g._sum.value || 0 };
  const daily: Record<string, number> = Object.fromEntries(dailyRows.map((d) => [d.day, d.count]));
  const series = Array.from({ length: days }, (_, i) => {
    const day = new Date(Date.now() - (days - 1 - i) * 864e5).toISOString().slice(0, 10);
    return { day, count: daily[day] || 0 };
  });
  // Storefront events reach us through the app proxy at /apps/cartivo. If another app already holds that path,
  // or the merchant changed it in Settings → Apps, events silently go nowhere: flag that once the drawer has
  // been on for a day without a single event in the last week.
  const [settings, firstSeen, recent] = await Promise.all([
    getSettings(session.shop),
    db.shopTrial.findUnique({ where: { shop: session.shop }, select: { startedAt: true } }),
    db.event.findFirst({ where: { shop: session.shop, createdAt: { gte: new Date(Date.now() - 7 * 864e5) } }, select: { id: true } }),
  ]);
  const noData = settings.drawer.enabled && !recent && !!firstSeen && firstSeen.startedAt.getTime() < Date.now() - 864e5;
  return { days, totals, series, noData, storeHandle: session.shop.replace(".myshopify.com", "") };
};

export default function Analytics() {
  const { days, totals, series, noData, storeHandle } = useLoaderData<typeof loader>();
  // Only warn when the app embed is on: with it off, no data is expected (the Dashboard covers that case).
  const embed = useEmbedStatus(noData);
  const [, setParams] = useSearchParams();
  const max = Math.max(1, ...series.map((s) => s.count));
  const opens = totals.drawer_open?.count || 0;
  const checkouts = totals.checkout_click?.count || 0;
  // Upsell values are reported in cents of the shopper's currency.
  const upsellValue = (totals.upsell_add?.value || 0) / 100;

  const total = series.reduce((s, x) => s + x.count, 0);

  return (
    <s-page heading="Analytics">
      {noData && embed === true && (
        <s-banner tone="warning" heading="We're not receiving data from your store">
          <s-paragraph>
            Cartivo is live on your store, but no cart activity has reached us in the last 7 days. This usually means
            another app uses the same app proxy URL. In Settings → Apps → Cartivo, set the App proxy URL to
            /apps/cartivo.
          </s-paragraph>
          <s-button slot="secondary-actions" href={`https://admin.shopify.com/store/${storeHandle}/settings/apps`} target="_blank">
            Open app settings
          </s-button>
        </s-banner>
      )}
      <s-section>
        <s-stack direction="inline" gap="small-200">
          {[7, 30, 90].map((d) => (
            <s-button key={d} variant={d === days ? "primary" : "secondary"} onClick={() => setParams({ days: String(d) })}>
              Last {d} days
            </s-button>
          ))}
        </s-stack>
      </s-section>

      <s-section heading="Highlights">
        <div className="ckx-grid" style={{ ["--ckx-min" as string]: "180px" }}>
          <StatCard icon="cart" label="Cart opens" value={opens} />
          <StatCard
            icon="chart-funnel"
            label="Cart to checkout rate"
            value={opens ? `${((checkouts / opens) * 100).toFixed(1)}%` : "–"}
            tint="#cffafe"
          />
          <StatCard icon="cash-dollar" label="Upsell value added" value={upsellValue.toFixed(2)} tint="#fce7f3" />
          <StatCard icon="gift-card" label="Gifts unlocked" value={totals.gift_added?.count || 0} tint="#dcfce7" />
        </div>
      </s-section>

      <s-section heading="Cart opens per day">
        <s-stack gap="small-200">
          <div className={`ckx-chart${total ? "" : " ckx-chart-empty"}`}>
            {series.map((s) => (
              <div key={s.day} title={`${s.day}: ${s.count}`} style={{ height: `${total ? (s.count / max) * 100 : 6}%` }} />
            ))}
          </div>
          {!total && <s-text color="subdued">No cart opens yet. Data appears here once shoppers use the cart drawer.</s-text>}
        </s-stack>
      </s-section>

      <s-section heading="All events" padding="none">
        <s-table>
          <s-table-header-row>
            <s-table-header>Event</s-table-header>
            <s-table-header format="numeric">Count</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {Object.entries(EVENT_LABELS).map(([type, label]) => (
              <s-table-row key={type}>
                <s-table-cell>{label}</s-table-cell>
                <s-table-cell>{totals[type]?.count || 0}</s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
