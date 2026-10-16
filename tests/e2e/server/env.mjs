// Environment for server tests: the isolated dev database from .env, plus throwaway Shopify credentials that
// exist only in these tests (nothing here can reach a real Shopify app or the production database).
import { existsSync } from "node:fs";

// Verified development Neon endpoint (production uses a different endpoint). Anything else is refused.
const DEV_DB_HOST_PREFIX = "ep-lucky-bonus-";

export function loadTestEnv() {
  if (existsSync(".env")) process.loadEnvFile(".env");
  const host = (() => { try { return new URL(process.env.DATABASE_URL || "").hostname; } catch { return ""; } })();
  if (!host.startsWith(DEV_DB_HOST_PREFIX)) {
    throw new Error(`Refusing to run server tests: DATABASE_URL is not the isolated dev database (${host || "unset"}).`);
  }
  return {
    ...process.env,
    NODE_ENV: "development",
    PORT: "4600",
    HOST: "localhost",
    SHOPIFY_API_KEY: "qa-test-api-key",
    SHOPIFY_API_SECRET: "qa-test-api-secret",
    SHOPIFY_APP_URL: "http://localhost:4600",
    SCOPES: "read_locales,read_products,write_discounts",
    // Plan for this server: Essential. Billing is never called (DEV_PLAN short-circuits it outside production).
    BILLING_DISABLED: "false",
    DEV_PLAN: "basic",
    SUPPORT_INBOX_KEY: "qa-inbox-key-0123456789",
    SUPPORT_WEBHOOK_URL: "",
  };
}
