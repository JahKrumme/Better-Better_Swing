import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
const password = randomBytes(24).toString("hex");
try {
  writeFileSync(
    ".env",
    `LOCAL_DB_PASSWORD=${password}\nDATABASE_URL=postgresql://finder:${password}@127.0.0.1:5432/free_money_finder\nPROFILE_AGE=\nPROFILE_STATE=KS\nPROFILE_COUNTRY=US\n`,
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Created ignored local database configuration. Age remains unknown.",
  );
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.log("Existing .env preserved.");
}
