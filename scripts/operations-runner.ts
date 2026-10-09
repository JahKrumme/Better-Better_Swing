import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/db";
import { localRuntime } from "../src/db/schema";
import { initializeProduct, runProductCheck } from "../src/db/product-service";
const owner = randomUUID();
const seconds = Number(process.env.OPERATIONS_INTERVAL_SECONDS ?? 300);
if (!Number.isInteger(seconds) || seconds < 60 || seconds > 3600)
  throw new Error("OPERATIONS_INTERVAL_SECONDS must be 60–3600.");
const client = await pool.connect();
const lock = await client.query(
  "SELECT pg_try_advisory_lock(7439013) AS locked",
);
if (!lock.rows[0].locked) {
  client.release();
  await pool.end();
  console.log("A local operations runner is already active.");
  process.exit(1);
}
await initializeProduct();
let stopping = false;
let working = false;
let next = new Date();
async function heartbeat() {
  await db
    .update(localRuntime)
    .set({ enabled: true, owner, heartbeatAt: new Date(), nextRunAt: next })
    .where(eq(localRuntime.key, "runner"));
}
async function tick() {
  if (stopping || working) return;
  working = true;
  try {
    await runProductCheck("BACKGROUND");
    await db
      .update(localRuntime)
      .set({ lastRunAt: new Date() })
      .where(eq(localRuntime.key, "runner"));
  } catch {
    console.error(
      "Local check failed; see Advanced diagnostics. Saved balances preserved.",
    );
  } finally {
    next = new Date(Date.now() + seconds * 1000);
    await heartbeat();
    working = false;
  }
}
await heartbeat();
await tick();
const hb = setInterval(() => {
  heartbeat().catch(() => console.error("Runner heartbeat failed."));
}, 15000);
const timer = setInterval(() => {
  if (new Date() >= next) void tick();
}, 1000);
async function stop() {
  if (stopping) return;
  stopping = true;
  clearInterval(hb);
  clearInterval(timer);
  while (working) await new Promise((r) => setTimeout(r, 100));
  await db
    .update(localRuntime)
    .set({ enabled: false, nextRunAt: null })
    .where(eq(localRuntime.owner, owner));
  await client.query("SELECT pg_advisory_unlock(7439013)");
  client.release();
  await pool.end();
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
