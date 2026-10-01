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

export const PROD_SUPABASE_PROJECT_REF = "kzeqckbcqykktdlidopd";

export function isDevDbIsolated(): boolean {
  if (isVercelProd) return true;
  return !connectionString.includes(PROD_SUPABASE_PROJECT_REF);
}

const activeHost = connectionString.split("@")[1]?.split("/")[0] || "Supabase Pooler";
if (!isVercelProd) {
  if (connectionString.includes(PROD_SUPABASE_PROJECT_REF)) {
    console.error(`
\x1b[41m\x1b[37m\x1b[1m ================================================================================ \x1b[0m
\x1b[31m\x1b[1m 🚨 WARNING: LOCALHOST IS CONNECTED TO PRODUCTION DATA! 🚨 \x1b[0m
\x1b[33m Database Target:\x1b[0m ${activeHost} (Project: ${PROD_SUPABASE_PROJECT_REF})
\x1b[33m Safety Protection:\x1b[0m To protect live borrowers, loans, and capital from being
 modified during local testing, set DEV_DATABASE_URL in .env.local to an isolated
 local database (e.g. postgresql://postgres:postgres@localhost:5432/finexa_dev).
\x1b[41m\x1b[37m\x1b[1m ================================================================================ \x1b[0m
    `);
  } else {
    console.log(`\x1b[32m[FINEXA DB]\x1b[0m Connected to ISOLATED DEVELOPMENT DATABASE: ${activeHost} (SAFE MODE)`);
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
    connect_timeout: 5
  });
  globalForDb.postgresClient = client;
  globalForDb.postgresUrl = connectionString;
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
