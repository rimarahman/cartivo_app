// Development store only: restarts the 7-day all-features trial so the demo shows every feature, or puts the
// original trial dates back. Same guard as tests/e2e/live/dev-state.mjs (refuses any DB but the isolated dev DB).
//   node app-store-assets/source/capture/dev-trial.mjs start            # trial starts now (saves the old row)
//   node app-store-assets/source/capture/dev-trial.mjs restore <file>   # puts the saved row back
import { readFileSync, writeFileSync } from "node:fs";
import { loadTestEnv } from "../../../tests/e2e/server/env.mjs";
const env = loadTestEnv();
process.env.DATABASE_URL = env.DATABASE_URL;
const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();
const shop = "cartivo-app-test.myshopify.com";
const [cmd, file] = process.argv.slice(2);
try {
  const before = await db.shopTrial.findUnique({ where: { shop } });
  if (cmd === "start") {
    const save = file || "app-store-assets/reports/evidence/dev-trial-before.json";
    writeFileSync(save, JSON.stringify(before, null, 1));
    const row = await db.shopTrial.update({ where: { shop }, data: { startedAt: new Date(), freeChosenAt: null } });
    console.log("trial restarted:", JSON.stringify(row), "| previous row saved to", save);
  } else if (cmd === "restore") {
    const old = JSON.parse(readFileSync(file, "utf8"));
    const row = await db.shopTrial.update({ where: { shop }, data: { startedAt: new Date(old.startedAt), freeChosenAt: old.freeChosenAt ? new Date(old.freeChosenAt) : null } });
    console.log("trial restored:", JSON.stringify(row));
  } else {
    console.log(JSON.stringify(before));
  }
} finally { await db.$disconnect(); }
