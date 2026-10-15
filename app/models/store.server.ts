import db from "../db.server";
import {
  DEFAULT_CAMPAIGN_CONFIG,
  DEFAULT_SETTINGS,
  deepMerge,
  type CampaignType,
  type Settings,
} from "../lib/defaults";

export async function getSettings(shop: string): Promise<Settings> {
  const row = await db.shopSettings.findUnique({ where: { shop } });
  if (!row) return DEFAULT_SETTINGS;
  try {
    return deepMerge(DEFAULT_SETTINGS, JSON.parse(row.data));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// Saves a partial settings object (e.g. only `{ sticky, floating }`) on top of the current one.
export async function saveSettings(shop: string, partial: Partial<Settings>) {
  const current = await getSettings(shop);
  const next = { ...current, ...partial };
  await db.shopSettings.upsert({
    where: { shop },
    create: { shop, data: JSON.stringify(next) },
    update: { data: JSON.stringify(next) },
  });
  return next;
}

export type CampaignRecord = {
  id: string;
  type: CampaignType;
  name: string;
  status: string;
  priority: number;
  config: any;
  startsAt: string | null;
  endsAt: string | null;
  updatedAt: string;
};

function toRecord(row: any): CampaignRecord {
  let config: any = {};
  try {
    config = JSON.parse(row.config);
  } catch {
    /* keep defaults */
  }
  const type = row.type as CampaignType;
  return {
    id: row.id,
    type,
    name: row.name,
    status: row.status,
    priority: row.priority,
    config: deepMerge(DEFAULT_CAMPAIGN_CONFIG[type] ?? {}, config),
    startsAt: row.startsAt ? row.startsAt.toISOString() : null,
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listCampaigns(shop: string) {
  const rows = await db.campaign.findMany({
    where: { shop },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toRecord);
}

export async function getCampaign(shop: string, id: string) {
  const row = await db.campaign.findFirst({ where: { shop, id } });
  return row ? toRecord(row) : null;
}

const isObject = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);

// The `payload` form field the admin pages post: a JSON object, or null when it's missing or malformed.
export function parsePayload(raw: FormDataEntryValue | null): Record<string, any> | null {
  try {
    const value = JSON.parse(String(raw || "{}"));
    return isObject(value) ? value : null;
  } catch {
    return null;
  }
}

export const MAX_CAMPAIGN_NAME = 255;

// Checks what the editor can't guarantee (direct posts, hand-typed dates). Returns a message for the merchant.
export function campaignInputError(input: Record<string, any>): string | null {
  if (!isObject(input.config)) return "The campaign settings couldn't be read. Reload the page and try again.";
  if (typeof input.name === "string" && input.name.length > MAX_CAMPAIGN_NAME) {
    return `Keep the campaign name under ${MAX_CAMPAIGN_NAME} characters.`;
  }
  const date = (v: unknown) => (v ? new Date(String(v)) : null);
  const starts = date(input.startsAt);
  const ends = date(input.endsAt);
  if ((starts && isNaN(+starts)) || (ends && isNaN(+ends))) return "Enter a valid start and end date.";
  if (starts && ends && ends <= starts) return "The end date must be after the start date, or the campaign never runs.";
  return null;
}

export async function saveCampaign(
  shop: string,
  id: string | null,
  input: Omit<CampaignRecord, "id" | "updatedAt">,
) {
  const data = {
    shop,
    type: input.type,
    name: input.name || "Untitled campaign",
    status: input.status === "active" ? "active" : "draft",
    priority: Number(input.priority) || 0,
    config: JSON.stringify(input.config ?? {}),
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
  };
  if (!id) return toRecord(await db.campaign.create({ data }));
  // Scoped to the shop: an id from another shop (they're public in storefront page source) updates nothing.
  const { count } = await db.campaign.updateMany({ where: { id, shop }, data });
  if (!count) return null;
  return getCampaign(shop, id);
}

export async function deleteCampaign(shop: string, id: string) {
  await db.campaign.deleteMany({ where: { shop, id } });
}

export async function setCampaignStatus(shop: string, id: string, status: string) {
  await db.campaign.updateMany({ where: { shop, id }, data: { status } });
}

export async function deleteShopData(shop: string) {
  await db.campaign.deleteMany({ where: { shop } });
  await db.event.deleteMany({ where: { shop } });
  await db.shopSettings.deleteMany({ where: { shop } });
  await db.supportTicket.deleteMany({ where: { shop } });
  await db.chatMessage.deleteMany({ where: { shop } });
  await db.shopTrial.deleteMany({ where: { shop } });
}
