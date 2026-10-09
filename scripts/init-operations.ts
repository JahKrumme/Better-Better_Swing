import { refreshOperations } from "../src/db/operations-service";
import { pool } from "../src/db";
try {
  await refreshOperations();
  console.log(
    "Phase 3 local queue initialized. No platform requests or claims executed.",
  );
} finally {
  await pool.end();
}
