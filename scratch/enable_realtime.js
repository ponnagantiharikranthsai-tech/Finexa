const postgres = require("postgres");

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:%40Hari746992@db.kzeqckbcqykktdlidopd.supabase.co:6543/postgres";
const sql = postgres(connectionString);

async function run() {
  try {
    console.log("Enabling Supabase Realtime publication on tables...");
    
    // Check if the supabase_realtime publication exists
    const pubExists = await sql`
      SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    `;

    if (pubExists.length === 0) {
      console.log("Publication 'supabase_realtime' does not exist. Creating it...");
      await sql`CREATE PUBLICATION supabase_realtime;`;
    }

    // Enable realtime for our target tables
    console.log("Adding tables to publication...");
    await sql`ALTER PUBLICATION supabase_realtime ADD TABLE loans;`;
    await sql`ALTER PUBLICATION supabase_realtime ADD TABLE borrowers;`;
    await sql`ALTER PUBLICATION supabase_realtime ADD TABLE loan_applications;`;
    await sql`ALTER PUBLICATION supabase_realtime ADD TABLE payments;`;

    console.log("Realtime publication successfully enabled!");
  } catch (err) {
    console.error("Warning or Error enabling realtime (they might already be added):", err.message);
  } finally {
    await sql.end();
  }
}

run();
