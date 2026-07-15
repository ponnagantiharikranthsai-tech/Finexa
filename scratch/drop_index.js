const postgres = require("postgres");

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:%40Hari746992@db.kzeqckbcqykktdlidopd.supabase.co:6543/postgres";
const sql = postgres(connectionString);

async function run() {
  try {
    console.log("Dropping index idx_loans_active_due_date if exists...");
    await sql`DROP INDEX IF EXISTS idx_loans_active_due_date;`;
    console.log("Success! Index dropped successfully.");
  } catch (err) {
    console.error("Error dropping index:", err);
  } finally {
    await sql.end();
  }
}

run();
