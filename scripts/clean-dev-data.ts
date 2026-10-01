import { db, isDevDbIsolated } from "../src/db/client";
import { borrowersTable, loansTable, fundersTable, paymentsTable, capitalAllocationsTable } from "../src/db/schema";
import { like, or } from "drizzle-orm";

async function cleanDevData() {
  console.log("\n=======================================================");
  console.log("  FINEXA — CLEAN LOCALHOST TEST DATA");
  console.log("=======================================================\n");

  if (!isDevDbIsolated()) {
    console.error(`
\x1b[41m\x1b[37m\x1b[1m CRITICAL SAFETY ABORT! \x1b[0m
Cleaner detected that you are connected to the PRODUCTION database!
Cleaner will NOT touch production records.
    `);
    process.exit(1);
  }

  try {
    console.log("Cleaning test allocations...");
    await db.delete(capitalAllocationsTable).where(like(capitalAllocationsTable.notes, "%Dev test%"));
    
    console.log("Cleaning test payments...");
    await db.delete(paymentsTable).where(like(paymentsTable.notes, "%Dev test%"));

    console.log("Cleaning test loans...");
    await db.delete(loansTable).where(like(loansTable.internalNotes, "%Development isolated test loan%"));

    console.log("Cleaning test borrowers ('Jagadeesh Test')...");
    await db.delete(borrowersTable).where(like(borrowersTable.name, "%Test%"));

    console.log("Cleaning test funders ('X Test')...");
    await db.delete(fundersTable).where(like(fundersTable.name, "%Test%"));

    console.log("\n✓ Test data cleaned successfully.\n");
  } catch (err: any) {
    console.error("Clean error:", err.message);
  }
}

cleanDevData();
