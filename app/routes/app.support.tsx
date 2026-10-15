// Resource route behind the floating Help button (components/SupportWidget): no page of its own.
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getPlan } from "../models/billing.server";
import { getSettings, listCampaigns } from "../models/store.server";
import {
  SUPPORT_CATEGORIES,
  collectDiagnostics,
  createTicket,
  listTickets,
  shopEmail,
  supportContact,
  validateTicket,
  type TicketInput,
} from "../models/support.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);
  const [tickets, email, plan] = await Promise.all([listTickets(session.shop), shopEmail(admin), getPlan(billing, session.shop)]);
  return { tickets, email, priority: plan.features.prioritySupport, contact: supportContact(), categories: SUPPORT_CATEGORIES };
};

export type SupportLoaderData = Awaited<ReturnType<typeof loader>>;
export type SupportActionData = { ok?: boolean; error?: string; errors?: Partial<Record<keyof TicketInput, string>> };

export const action = async ({ request }: ActionFunctionArgs): Promise<SupportActionData> => {
  const { admin, session, billing } = await authenticate.admin(request);
  const form = await request.formData();
  const input: TicketInput = {
    email: String(form.get("email") || ""),
    category: String(form.get("category") || ""),
    subject: String(form.get("subject") || ""),
    message: String(form.get("message") || ""),
  };
  const errors = validateTicket(input);
  if (Object.keys(errors).length) return { errors };

  let diagnostics: Record<string, unknown> | null = null;
  if (form.get("diagnostics") === "true") {
    const [plan, settings, campaigns] = await Promise.all([
      getPlan(billing, session.shop),
      getSettings(session.shop),
      listCampaigns(session.shop),
    ]);
    diagnostics = await collectDiagnostics(admin, {
      cartkitPlan: plan.name,
      // Read in the browser with App Bridge (useEmbedStatus) and sent with the form.
      appEmbed: ["on", "off"].includes(String(form.get("appEmbed"))) ? String(form.get("appEmbed")) : "unknown",
      drawer: settings.drawer.enabled,
      sticky: settings.sticky.enabled,
      floating: settings.floating.enabled,
      activeCampaigns: campaigns.filter((c) => c.status === "active").map((c) => c.type),
      browser: request.headers.get("user-agent"),
    });
  }
  const result = await createTicket(session.shop, input, diagnostics);
  if ("error" in result) return { error: result.error };
  return { ok: true };
};
