// Read-only full export of the dev store's campaigns and settings (isolated dev DB only, same guard as
// tests/e2e/live/dev-state.mjs). Run before recording so any demo change can be undone exactly:
//   node app-store-assets/source/capture/dev-backup.mjs > <scratchpad>/dev-backup-before.json
import { loadTestEnv } from "../../../tests/e2e/server/env.mjs";
const env = loadTestEnv();
process.env.DATABASE_URL = env.DATABASE_URL;
const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();
const shop = "cartivo-app-test.myshopify.com";
try {
  const campaigns = await db.campaign.findMany({ where: { shop }, orderBy: { createdAt: "asc" } });
  const settings = await db.shopSettings.findUnique({ where: { shop } });
  console.log(JSON.stringify({ at: new Date(), shop, campaigns, settings }, null, 1));
} finally { await db.$disconnect(); }
