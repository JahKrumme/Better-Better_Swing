import {
  initializeHigh5,
  syncHigh5PublicSources,
  reviewHigh5PublicSources,
} from "../src/db/high5-service";
import { pool } from "../src/db";
try {
  const result = process.argv.includes("--sync")
    ? await syncHigh5PublicSources()
    : process.argv.includes("--review")
      ? await reviewHigh5PublicSources()
      : await initializeHigh5();
  console.log(
    result ??
      "High 5 manual integration initialized; no account actions executed.",
  );
} finally {
  await pool.end();
}
