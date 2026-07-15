import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// Prevent multiple instances of postgres client in development
const globalForDb = globalThis as unknown as {
  postgresClient: any;
};

const isDev = process.env.NODE_ENV !== "production";

const client = globalForDb.postgresClient || postgres(connectionString, { 
  prepare: false,
  max: 20,          // Allow more concurrent connections for better performance
  idle_timeout: 20, 
  connect_timeout: 10
});

if (isDev) {
  globalForDb.postgresClient = client;
}

export const db = drizzle(client, { schema });
