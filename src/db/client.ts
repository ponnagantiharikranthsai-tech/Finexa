import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const isVercelProd = process.env.VERCEL_ENV === "production";
const devDbUrl = process.env.DEV_DATABASE_URL?.trim();
const mainDbUrl = process.env.DATABASE_URL?.trim() || "";

// If DEV_DATABASE_URL is defined and we are running locally (not Vercel Production), use DEV_DATABASE_URL!
const connectionString = (devDbUrl && !isVercelProd) ? devDbUrl : mainDbUrl;

if (!connectionString) {
  throw new Error("CRITICAL: Development database is not configured. Please set DEV_DATABASE_URL in .env.local.");
}

// ─── PRODUCTION DATABASE SAFETY GUARD FOR LOCALHOST ──────────────────────────────
const PROD_PROJECT_REF = "kzeqckbcqykktdlidopd";

if (!isVercelProd) {
  const isTargetingProd = connectionString.includes(PROD_PROJECT_REF);
  
  if (isTargetingProd) {
    const safetyBanner = 
      "\n======================================================================\n" +
      "🚨 FINEXA DEVELOPMENT SAFETY ERROR 🚨\n" +
      "======================================================================\n" +
      "Local environment is attempting to connect to the PRODUCTION database!\n\n" +
      "Target Host: db.kzeqckbcqykktdlidopd.supabase.co\n\n" +
      "APPLICATION STARTUP HAS BEEN BLOCKED TO PROTECT PRODUCTION DATA.\n" +
      "Please configure a separate Development/Test database URL in .env.local:\n\n" +
      "  DEV_DATABASE_URL=postgresql://postgres:password@your-dev-db-host:5432/postgres\n\n" +
      "======================================================================\n";

    console.error("\x1b[31m" + safetyBanner + "\x1b[0m");
    throw new Error("CRITICAL SAFETY BLOCK: Localhost database connection to production was stopped to protect live financial records.");
  } else {
    const activeHost = connectionString.split("@")[1]?.split("/")[0] || "Unknown Host";
    console.log(`\x1b[32m[FINEXA DB ISOLATION]\x1b[0m LOCALHOST ACTIVE DB: ${activeHost} (DEVELOPMENT DATABASE)`);
  }
}

const globalForDb = globalThis as unknown as {
  postgresClient: any;
  postgresUrl: string;
};

let client = globalForDb.postgresClient;
if (!client || globalForDb.postgresUrl !== connectionString) {
  client = postgres(connectionString, { 
    prepare: false,
    max: 20,
    idle_timeout: 20, 
    connect_timeout: 10
  });
  if (!isVercelProd) {
    globalForDb.postgresClient = client;
    globalForDb.postgresUrl = connectionString;
  }
}

export const db = drizzle(client, { schema });

// Read-only development connection test
export async function testDatabaseConnection() {
  try {
    await client`SELECT 1 as connected;`;
    if (!isVercelProd) {
      console.log("\x1b[32m[FINEXA DB]\x1b[0m DATABASE CONNECTION: SUCCESS");
    }
    return { success: true };
  } catch (err: any) {
    console.error("\x1b[31m[FINEXA DB ERROR]\x1b[0m Connection Failed:", err.message);
    return { success: false, error: err.message };
  }
}
