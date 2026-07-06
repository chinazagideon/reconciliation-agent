// CLI seeder: `npm run seed`. Generates synthetic data + writes seed-manifest.json.
// Same code path the POST /seed endpoint uses, so the demo tool and the API agree.
import { PgTransactionRepository } from "./adapters/outbound/postgres/transaction.repository.js";
import { Seeder } from "./application/seed/seeder.js";
import { pool } from "./adapters/outbound/postgres/pool.js";

async function main() {
  const seeder = new Seeder(new PgTransactionRepository());
  const result = await seeder.run();
  if (!result.ok) {
    console.error("seed failed:", result.error.message);
    process.exitCode = 1;
  } else {
    const m = result.value;
    console.log(`seeded ${m.total_records} records into ${m.patterns.length} patterns`);
    console.log("expected_results:", JSON.stringify(m.expected_results));
  }
  await pool.end();
}

main();
