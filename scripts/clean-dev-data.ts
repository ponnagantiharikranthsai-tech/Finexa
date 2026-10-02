import { db, isDevDbIsolated } from "../src/db/client";
import {
  borrowersTable,
  loansTable,
  fundersTable,
  paymentsTable,
  capitalAllocationsTable,
  capitalFundingTransactionsTable,
} from "../src/db/schema";
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
    console.log("Cleaning test allocations & funding transactions...");
    await db.delete(capitalAllocationsTable);
    await db.delete(capitalFundingTransactionsTable);

    console.log("Cleaning test payments...");
    await db.delete(paymentsTable);

    console.log("Cleaning test loans...");
    await db.delete(loansTable);

    console.log("Cleaning test borrowers...");
    await db.delete(borrowersTable).where(
      or(
        like(borrowersTable.name, "%Test%"),
        like(borrowersTable.name, "Jagadeesh%"),
        like(borrowersTable.name, "Ravi%"),
        like(borrowersTable.name, "Sanjana%"),
        like(borrowersTable.name, "Multi%")
      )
    );

    console.log("Cleaning test funders...");
    await db.delete(fundersTable).where(
      or(
        like(fundersTable.name, "%Test%"),
        like(fundersTable.name, "X%"),
        like(fundersTable.name, "Y%")
      )
    );

    console.log("\n✓ Test data cleaned successfully.\n");
  } catch (err: any) {
    console.error("Clean error:", err.message);
  }
}

cleanDevData();
