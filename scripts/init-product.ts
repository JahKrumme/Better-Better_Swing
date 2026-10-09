import { initializeProduct } from "../src/db/product-service";
import { pool } from "../src/db";
try {
  await initializeProduct();
  console.log("Local operations ready.");
} finally {
  await pool.end();
}
