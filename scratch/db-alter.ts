import { db } from "../src/db/client";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Altering DB schema...");
  try {
    // 1. Alter enum type
    console.log("Adding 'submitted' to loan_status enum...");
    await db.execute(sql`ALTER TYPE loan_status ADD VALUE IF NOT EXISTS 'submitted';`);
    
    // 2. Add father_mobile column
    console.log("Adding father_mobile column to borrowers table...");
    await db.execute(sql`ALTER TABLE "borrowers" ADD COLUMN IF NOT EXISTS "father_mobile" text;`);
    
    console.log("Successfully altered schema.");
  } catch (error) {
    console.error("Error altering schema:", error);
  }
  process.exit(0);
}

main();
