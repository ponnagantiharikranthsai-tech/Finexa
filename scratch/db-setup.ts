import { db } from "../src/db/client";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Dropping old loan_applications table...");
  try {
    await db.execute(sql`DROP TABLE IF EXISTS loan_applications CASCADE;`);
    console.log("Successfully dropped table.");
  } catch (error) {
    console.error("Error dropping table:", error);
  }
  process.exit(0);
}

main();
