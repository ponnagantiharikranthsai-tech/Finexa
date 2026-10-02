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
    max: 10,               // fewer connections to avoid overwhelming local PG
    idle_timeout: 30,      // close idle connections after 30s
    max_lifetime: 60 * 10, // recycle connections every 10 min
    connect_timeout: 15,   // allow 15s for initial connection
    // Keep TCP sockets alive so the OS doesn't silently drop them
    connection: {
      application_name: "finexa-dev",
    },
  });
  globalForDb.postgresClient = client;
  globalForDb.postgresUrl = connectionString;
}

export let db = drizzle(client, { schema });

// ── DB Retry Utility ──────────────────────────────────────────────────────────
// Wraps any async DB operation and retries on transient connection errors
// (ECONNRESET, ECONNREFUSED, etc.) that are common with local dev Postgres.
const RETRIABLE_CODES = new Set(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE", "ENOTFOUND"]);

function isRetriableError(err: any): boolean {
  const code = err?.code || err?.cause?.code || "";
  const msg = err?.message || "";
  return (
    RETRIABLE_CODES.has(code) ||
    msg.includes("Connection terminated") ||
    msg.includes("ECONNRESET") ||
    msg.includes("read ECONNRESET") ||
    msg.includes("Failed query")
  );
}

function rebuildConnection() {
  const newClient = postgres(connectionString, {
    prepare: false,
    max: 10,
    idle_timeout: 30,
    max_lifetime: 60 * 10,
    connect_timeout: 15,
    connection: { application_name: "finexa-dev" },
  });
  globalForDb.postgresClient = newClient;
  globalForDb.postgresUrl = connectionString;
  db = drizzle(newClient, { schema });
  console.log("[FINEXA DB] Reconnected to database after connection error.");
  return newClient;
}

export async function withDbRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (isRetriableError(err) && attempt < maxRetries) {
        console.warn(`[FINEXA DB] Connection error (attempt ${attempt + 1}/${maxRetries}), reconnecting...`, err.code || err.cause?.code || err.message?.slice(0, 80));
        rebuildConnection();
        // Brief delay before retry: 500ms, 1000ms, 2000ms
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
      } else {
        throw err;
      }
    }
  }
  throw lastError;
}

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
