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
  const row = id
    ? await db.campaign.update({ where: { id }, data })
    : await db.campaign.create({ data });
  return toRecord(row);
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
