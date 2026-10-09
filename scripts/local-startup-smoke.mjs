// Complete clean production/restart validation in one uniquely owned disposable project.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
const dir = mkdtempSync(join(tmpdir(), "fmf-startup-smoke-")),
  envFile = join(dir, ".env");
const project = `fmf_product_verification_${Date.now()}`;
async function free(start) {
  for (let p = start; p < start + 100; p++) {
    const ok = await new Promise((r) => {
      const s = createServer();
      s.once("error", () => r(false));
      s.listen(p, "127.0.0.1", () => s.close(() => r(true)));
    });
    if (ok) return p;
  }
  throw Error("No free smoke port");
}
const appPort = await free(3020),
  dbPort = await free(55480),
  password = randomBytes(24).toString("hex");
const env = {
  ...process.env,
  FMF_ENV_FILE: envFile,
  FMF_STATE_DIR: join(dir, "state"),
  COMPOSE_PROJECT_NAME: project,
  APP_PORT: String(appPort),
  LOCAL_DB_PORT: String(dbPort),
  LOCAL_DB_PASSWORD: password,
  DATABASE_URL: `postgresql://finder:${password}@127.0.0.1:${dbPort}/free_money_finder`,
  PROFILE_AGE: "",
  PROFILE_STATE: "KS",
  PROFILE_COUNTRY: "US",
  SMOKE_BASE_URL: `http://127.0.0.1:${appPort}`,
  FMF_ALLOW_ISOLATED_SMOKE: "true",
};
writeFileSync(
  envFile,
  Object.entries(env)
    .filter(([k]) =>
      [
        "LOCAL_DB_PASSWORD",
        "DATABASE_URL",
        "PROFILE_AGE",
        "PROFILE_STATE",
        "PROFILE_COUNTRY",
        "APP_PORT",
        "LOCAL_DB_PORT",
      ].includes(k),
    )
    .map(([k, v]) => `${k}=${v}`)
    .join("\n") + "\n",
  { mode: 0o600 },
);
function run(command, args, extra = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(command, args, {
      env: { ...env, ...extra },
      stdio: "inherit",
    });
    p.on("error", reject);
    p.on("exit", (code) =>
      code === 0 ? resolve() : reject(Error(`${command} exited ${code}`)),
    );
  });
}
async function capture(command, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(command, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "",
      error = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (error += d));
    p.on("error", reject);
    p.on("exit", (code) =>
      code === 0 ? resolve(out.trim()) : reject(Error(error)),
    );
  });
}
const sql = (q) =>
  capture("docker", [
    "compose",
    "--env-file",
    envFile,
    "exec",
    "-T",
    "db",
    "psql",
    "-U",
    "finder",
    "-d",
    "free_money_finder",
    "-At",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    q,
  ]);
try {
  await run("pnpm", ["app:background"]);
  const url = env.SMOKE_BASE_URL;
  assert.equal((await fetch(`${url}/api/health`)).status, 200);
  const first = await (await fetch(url)).text();
  assert(first.includes("Check your eligibility"));
  assert(first.includes("$0"));
  await run("pnpm", ["db:smoke"]);
  // Consumer smoke confirms eligibility once and exercises manual observations in this clean DB.
  await run("pnpm", ["test:http:consumer"]);
  const before = await sql("SELECT count(*) FROM bankroll_ledger");
  assert(Number(before) > 0);
  await run("pnpm", ["app:stop"]);
  assert.equal(
    await sql("SELECT enabled FROM local_runtime WHERE key='runner'"),
    "f",
  );
  await run("pnpm", ["app:background"]);
  assert.equal(await sql("SELECT count(*) FROM bankroll_ledger"), before);
  const restarted = await (await fetch(url)).text();
  assert(restarted.includes("1.80"));
  assert(restarted.includes("RealPrize"));
  assert(restarted.includes("Local background checks"));
  assert.equal(
    await sql('SELECT sum("userCashContribution") FROM bankroll_ledger'),
    "0.00",
  );
  // Explicit occupied app port must fail without terminating the existing service.
  let rejected = false;
  try {
    await run("node", ["scripts/app-local.mjs"], {
      FMF_STATE_DIR: join(dir, "busy-app-test"),
    });
  } catch {
    rejected = true;
  }
  assert(rejected);
  assert.equal((await fetch(`${url}/api/health`)).status, 200);
  // An unrelated occupied DB port must fail before migrations or volume replacement.
  const blocker = createServer();
  const occupied = await free(dbPort + 1);
  await new Promise((r) => blocker.listen(occupied, "127.0.0.1", r));
  try {
    let failed = false;
    try {
      await run("node", ["scripts/app-local.mjs"], {
        APP_PORT: String(await free(appPort + 1)),
        LOCAL_DB_PORT: String(occupied),
        COMPOSE_PROJECT_NAME: project + "_port_test",
        FMF_STATE_DIR: join(dir, "busy-db-test"),
      });
    } catch {
      failed = true;
    }
    assert(failed);
  } finally {
    blocker.close();
  }
  console.log(
    "PASS clean production startup, first-run eligibility, consumer actions, graceful OFF, restart persistence, zero contribution and both port conflicts.",
  );
} finally {
  await run("pnpm", ["app:stop"]).catch(() => {});
  // Only the randomly named disposable project created by this script is removed.
  await run("docker", [
    "compose",
    "--env-file",
    envFile,
    "down",
    "--volumes",
  ]).catch(() => {});
  rmSync(dir, { recursive: true, force: true });
}
