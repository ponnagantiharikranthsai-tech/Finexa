import { db, isDevDbIsolated } from "../src/db/client";
import {
  borrowersTable,
  loansTable,
  fundersTable,
  paymentsTable,
  capitalAllocationsTable,
  capitalFundingTransactionsTable,
} from "../src/db/schema";
import { encrypt } from "../src/lib/encryption";

async function seedDevData() {
  console.log("\n=======================================================");
  console.log("  FINEXA — ON-DEMAND CAPITAL TEST DATA SEEDER");
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
    const todayStr = new Date().toISOString().split("T")[0]!;

    console.log("1. Creating On-Demand Capital Person: 'X' (No fake balance)...");
    const [funder] = await db.insert(fundersTable).values({
      name: "X",
      mobile: "9000000001",
      address: "Visakhapatnam, AP",
      capitalAmount: "0.00",
      investmentDate: todayStr,
      status: "active",
      fundingModel: "on_demand",
      notes: "On-demand emergency capital provider",
    }).returning();
    console.log(`   ✓ Capital Person Created: ${funder.name} (${funder.funderId}) [On-Demand]`);

    console.log("\n2. Creating Test Borrower: 'Jagadeesh'...");
    const [borrower] = await db.insert(borrowersTable).values({
      name: "Jagadeesh",
      mobile: "9000000002",
      email: "jagadeesh@finexa.local",
      panEncrypted: encrypt("ABCDE1234F"),
      aadhaarEncrypted: encrypt("123456789012"),
      address: "123 Localhost St, Visakhapatnam",
    }).returning();
    console.log(`   ✓ Borrower Created: ${borrower.name} (${borrower.borrowerId})`);

    console.log("\n3. Creating Test Loan: ₹10,000...");
    const [loan] = await db.insert(loansTable).values({
      borrowerId: borrower.borrowerId,
      principal: "10000.00",
      interestType: "monthly",
      interestRate: "20.00",
      dateGiven: todayStr,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!,
      status: "active",
      internalNotes: "Loan for Jagadeesh",
    }).returning();
    console.log(`   ✓ Loan Created: ₹${loan.principal} (ID: ${loan.loanId})`);

    console.log("\n4. Recording Capital Funding Transaction: CF-001 (X → ₹10,000 → Jagadeesh)...");
    const [fundingTx] = await db.insert(capitalFundingTransactionsTable).values({
      transactionCode: "CF-001",
      funderId: funder.funderId,
      loanId: loan.loanId,
      amount: "10000.00",
      fundingDate: todayStr,
      status: "allocated",
      notes: "On-demand funding for Jagadeesh loan",
    }).returning();
    console.log(`   ✓ Funding Transaction Created: ${fundingTx.transactionCode} (₹${fundingTx.amount})`);

    console.log("\n5. Linking Capital Allocation to Loan...");
    const [allocation] = await db.insert(capitalAllocationsTable).values({
      funderId: funder.funderId,
      loanId: loan.loanId,
      fundingTransactionId: fundingTx.transactionId,
      amount: "10000.00",
      allocationDate: todayStr,
      status: "active",
      notes: "On-demand allocation",
    }).returning();
    console.log(`   ✓ Capital Allocation Linked: ₹${allocation.amount}`);

    console.log("\n6. Creating Test Payment: ₹2,000 Principal Repayment...");
    const [payment] = await db.insert(paymentsTable).values({
      loanId: loan.loanId,
      amount: "2000.00",
      paymentType: "principal",
      paymentDate: todayStr,
      notes: "Regular principal installment",
    }).returning();
    console.log(`   ✓ Payment Recorded: ₹${payment.amount}`);

    console.log("\n=======================================================");
    console.log("  ✓ ON-DEMAND CAPITAL TEST DATA SEEDED SUCCESSFULLY!");
    console.log("=======================================================\n");
  } catch (err: any) {
    console.error("Seeding error:", err.message);
    process.exit(1);
  }
}

seedDevData();
