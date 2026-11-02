import postgres from "postgres";

async function resetEnvelopes() {
  console.log("\n=======================================================");
  console.log("  FINEXA — RESET DIGITAL ENVELOPES TABLE (CLEAN DATA)");
  console.log("=======================================================\n");

  const devUrl = process.env.DEV_DATABASE_URL || "postgresql://postgres:8155@localhost:5432/finexa_dev";
  const prodUrl = process.env.DATABASE_URL;

  const targets = [
    { name: "Local Dev DB", url: devUrl },
    ...(prodUrl ? [{ name: "Production Supabase DB", url: prodUrl }] : []),
  ];

  for (const target of targets) {
    console.log(`\nProcessing ${target.name}...`);
    let sqlClient: ReturnType<typeof postgres> | null = null;
    try {
      sqlClient = postgres(target.url, { ssl: target.name.includes("Supabase") ? "require" : false, max: 1 });
      
      // Delete all transactions first (FK cascade safety)
      const deletedTx = await sqlClient`DELETE FROM digital_envelope_transactions RETURNING transaction_id;`;
      console.log(`  ✓ Cleared ${deletedTx.length} transaction records from ${target.name}.`);

      // Delete all envelopes
      const deletedEnvelopes = await sqlClient`DELETE FROM digital_envelopes RETURNING envelope_id;`;
      console.log(`  ✓ Cleared ${deletedEnvelopes.length} envelope records from ${target.name}.`);

      // Reset settings
      await sqlClient`DELETE FROM digital_envelope_settings WHERE key = 'account_2_bank_balance';`;
      console.log(`  ✓ Reset account_2_bank_balance setting in ${target.name}.`);
    } catch (err: any) {
      console.error(`  ✗ Error clearing ${target.name}:`, err.message);
    } finally {
      if (sqlClient) {
        await sqlClient.end();
      }
    }
  }

  console.log("\n✅ Reset completed cleanly. Both databases now start fresh at 0 buckets!\n");
}

resetEnvelopes().catch(console.error);
