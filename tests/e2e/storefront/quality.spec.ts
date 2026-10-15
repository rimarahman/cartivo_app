// Accessibility scan (axe-core) of the open drawer, and interaction timings measured in the harness.
// Timings are local-harness numbers (no network latency, no theme): they show Cartivo's own overhead only.
import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "./fixtures";

test("A11Y-04 axe: no serious or critical violations in the open drawer @p1", async ({ shop, page }, info) => {
  await shop.open("everything", "/products/shirt");
  await shop.addFromProductPage("shirt", { qty: 2 });
  const results = await new AxeBuilder({ page }).include(".ck-drawer").analyze();
  const summary = results.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help, targets: v.nodes.map((n) => `${n.target.join(" ")} — ${(n.any[0]?.message || "").slice(0, 160)}`) }));
  await info.attach("axe-violations.json", { body: JSON.stringify(summary, null, 2), contentType: "application/json" });
  const blocking = summary.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(blocking, JSON.stringify(blocking)).toEqual([]);
});

// BUG-08: the badge colour is merchant-configurable, and each one-click look sets its own. Badge, promo and
// savings text must stay readable in every look, light and dark.
for (const look of ["aurora", "glass", "sunset", "ocean", "forest", "midnight", "minimal"]) {
  test(`A11Y-05 axe: no colour-contrast violations in the "${look}" look @p1`, async ({ shop, page }) => {
    await shop.open(`everything_${look}`, "/products/shirt");
    await shop.addFromProductPage("shirt", { qty: 2 });
    const results = await new AxeBuilder({ page }).include(".ck-drawer").withRules(["color-contrast"]).analyze();
    const nodes = results.violations.flatMap((v) => v.nodes.map((n) => `${n.target.join(" ")} — ${(n.any[0]?.message || "").slice(0, 160)}`));
    expect(nodes).toEqual([]);
  });
}

test("PERF-01 drawer interaction timings and layout shift @p2", async ({ shop, page }, info) => {
  await page.addInitScript(() => {
    (window as any).__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as any[]) if (!e.hadRecentInput) (window as any).__cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  await shop.open("gift", "/products/shirt");
  const t0 = Date.now();
  await shop.addFromProductPage("shirt");
  const addToDrawer = Date.now() - t0;
  const t1 = Date.now();
  await page.locator(".ck-item:not(.ck-item-gift) [data-ck=inc]").click();
  await expect(page.locator(".ck-item")).toHaveCount(2); // goal reached: gift added
  await shop.settle();
  const qtyWithGift = Date.now() - t1;
  const cls = await page.evaluate(() => (window as any).__cls).catch(() => null);
  const timings = { addToDrawerOpenMs: addToDrawer, qtyChangeIncludingGiftMs: qtyWithGift, cumulativeLayoutShift: cls };
  await info.attach("timings.json", { body: JSON.stringify(timings, null, 2), contentType: "application/json" });
  console.log(`PERF ${info.project.name} ${JSON.stringify(timings)}`);
  expect(addToDrawer).toBeLessThan(5000);
});
