import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "../src/db";
try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations complete.");
} finally {
  await pool.end();
}
