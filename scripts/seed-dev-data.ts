import { db, isDevDbIsolated } from "../src/db/client";
import { borrowersTable, loansTable, fundersTable, paymentsTable, capitalAllocationsTable } from "../src/db/schema";
import { encrypt } from "../src/lib/encryption";
import { eq } from "drizzle-orm";

async function seedDevData() {
  console.log("\n=======================================================");
  console.log("  FINEXA — ISOLATED LOCALHOST TEST DATA SEEDER");
  console.log("=======================================================\n");

  // Safety check: Never run this against production!
  if (!isDevDbIsolated()) {
    console.error(`
\x1b[41m\x1b[37m\x1b[1m CRITICAL SAFETY ABORT! \x1b[0m
Seeder detected that you are connected to the PRODUCTION database!
Seeder will NOT create test data in production.
Please configure DEV_DATABASE_URL to an isolated development database.
    `);
    process.exit(1);
  }

  try {
    console.log("1. Creating Test Capital Person: 'X Test' (₹50,000)...");
    const todayStr = new Date().toISOString().split("T")[0]!;
    const nextYearStr = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!;
    
    const [funder] = await db.insert(fundersTable).values({
      name: "X Test",
      mobile: "9000000001",
      address: "Dev Sandbox, Localhost",
      capitalAmount: "50000",
      investmentDate: todayStr,
      returnDueDate: nextYearStr,
      notes: "Development test funder",
    }).returning();
    console.log(`   ✓ Capital Person Created: ${funder.name} (${funder.funderId})`);

    console.log("\n2. Creating Test Borrower: 'Jagadeesh Test'...");
    const [borrower] = await db.insert(borrowersTable).values({
      name: "Jagadeesh Test",
      mobile: "9000000002",
      email: "jagadeesh.test@local.dev",
      panEncrypted: encrypt("ABCDE1234F"),
      aadhaarEncrypted: encrypt("123456789012"),
      address: "123 Localhost Dev St",
    }).returning();
    console.log(`   ✓ Borrower Created: ${borrower.name} (${borrower.borrowerId})`);

    console.log("\n3. Creating Test Loan: ₹10,000...");
    const [loan] = await db.insert(loansTable).values({
      borrowerId: borrower.borrowerId,
      principal: "10000.00",
      interestType: "monthly",
      interestRate: "2.00",
      dateGiven: todayStr,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!,
      status: "active",
      internalNotes: "Development isolated test loan",
    }).returning();
    console.log(`   ✓ Loan Created: ₹${loan.principal} (ID: ${loan.loanId})`);

    console.log("\n4. Allocating Capital from 'X Test' to 'Jagadeesh Test' Loan (₹10,000)...");
    const [allocation] = await db.insert(capitalAllocationsTable).values({
      funderId: funder.funderId,
      loanId: loan.loanId,
      amount: "10000.00",
      allocationDate: todayStr,
      status: "active",
      notes: "Dev test allocation linking X Test to Jagadeesh Test loan",
    }).returning();
    console.log(`   ✓ Capital Allocation Linked: ₹${allocation.amount}`);

    console.log("\n5. Creating Test Payment: ₹2,000 Principal Repayment...");
    const [payment] = await db.insert(paymentsTable).values({
      loanId: loan.loanId,
      amount: "2000.00",
      paymentType: "principal",
      paymentDate: todayStr,
      notes: "Dev test repayment",
    }).returning();

    console.log(`   ✓ Payment Recorded: ₹${payment.amount} (Recorded to loans ledger)`);

    console.log("\n=======================================================");
    console.log("  ✓ TEST DATA SEEDED SUCCESSFULLY IN LOCALHOST DB!");
    console.log("=======================================================\n");
  } catch (err: any) {
    console.error("Seeding error:", err.message);
    process.exit(1);
  }
}

seedDevData();
