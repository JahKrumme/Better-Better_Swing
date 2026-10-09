// Local production supervisor: owned children only; database volumes are never removed.
import { spawn, spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { resolve } from "node:path";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
const root = resolve(import.meta.dirname, ".."),
  envFile = resolve(process.env.FMF_ENV_FILE ?? resolve(root, ".env"));
process.chdir(root);
const stateDir = resolve(process.env.FMF_STATE_DIR ?? resolve(root, ".fmf"));
mkdirSync(stateDir, { recursive: true, mode: 0o700 });
const stateFile = resolve(stateDir, "state.json"),
  logFile = resolve(stateDir, "app.log");
function state() {
  try {
    return JSON.parse(readFileSync(stateFile, "utf8"));
  } catch {
    return null;
  }
}
function owned(s) {
  if (!s?.pid || !s.token) return false;
  const r = spawnSync("ps", ["-p", String(s.pid), "-o", "args="], {
    encoding: "utf8",
  });
  return (
    r.status === 0 &&
    r.stdout.includes("scripts/app-local.mjs") &&
    r.stdout.includes(s.token)
  );
}
if (process.argv.includes("--stop")) {
  const s = state();
  if (!owned(s)) {
    console.log("No owned local app is running.");
    process.exit(0);
  }
  process.kill(s.pid, "SIGTERM");
  for (let i = 0; i < 100 && owned(s); i++) await delay(100);
  if (owned(s))
    throw new Error("App is still shutting down; see the ignored local log.");
  console.log("Local app stopped. Database and saved data preserved.");
  process.exit(0);
}
if (owned(state()))
  throw new Error("The app is already running. Use pnpm app:stop first.");
if (process.argv.includes("--background")) {
  const { openSync, closeSync } = await import("node:fs");
  const fd = openSync(logFile, "a", 0o600),
    token = randomUUID();
  const child = spawn(
    process.execPath,
    ["scripts/app-local.mjs", `--owner=${token}`],
    { cwd: root, env: process.env, detached: true, stdio: ["ignore", fd, fd] },
  );
  child.unref();
  closeSync(fd);
  for (let i = 0; i < 1200; i++) {
    const s = state();
    if (s?.pid === child.pid && s.ready) {
      console.log(
        `Free Money Finder: ${s.url}\nBackground checks ON. Stop: pnpm app:stop`,
      );
      process.exit(0);
    }
    if (s?.pid === child.pid && s.error) throw new Error(s.error);
    try {
      process.kill(child.pid, 0);
    } catch {
      throw new Error(
        "Startup stopped. See ignored .fmf/app.log for the error.",
      );
    }
    await delay(100);
  }
  throw new Error(
    "Startup is taking longer than two minutes. See the local log; pnpm app:stop stops it safely.",
  );
}
if (!existsSync(envFile)) {
  const password = randomBytes(24).toString("hex");
  writeFileSync(
    envFile,
    `LOCAL_DB_PASSWORD=${password}\nDATABASE_URL=postgresql://finder:${password}@127.0.0.1:5432/free_money_finder\nPROFILE_AGE=\nPROFILE_STATE=KS\nPROFILE_COUNTRY=US\n`,
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Created ignored local database configuration. Age remains unknown; configure PROFILE_AGE to establish eligibility.",
  );
}
process.loadEnvFile(envFile);
const token =
  process.argv.find((v) => v.startsWith("--owner="))?.slice(8) ?? randomUUID();
// Tag foreground supervisors too, so stop can verify the process it owns.
if (!process.argv.some((v) => v.startsWith("--owner="))) {
  const child = spawn(
    process.execPath,
    ["scripts/app-local.mjs", `--owner=${token}`],
    { stdio: "inherit", env: process.env },
  );
  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
  child.on("exit", (code) => process.exit(code ?? 1));
  await new Promise(() => {});
}
const writeState = (extra = {}) =>
  writeFileSync(
    stateFile,
    JSON.stringify({ pid: process.pid, token, ...extra }),
    { mode: 0o600 },
  );
writeState({ ready: false });
const children = new Set();
let stopping = false;
async function available(port) {
  return new Promise((r) => {
    const server = createServer();
    server.once("error", () => r(false));
    server.listen(port, "127.0.0.1", () => server.close(() => r(true)));
  });
}
async function portFor(raw, start, label) {
  if (raw) {
    const p = Number(raw);
    if (!Number.isInteger(p) || p < 1024 || p > 65535)
      throw new Error(`${label} must be a port between 1024 and 65535.`);
    if (!(await available(p)))
      throw new Error(`${label} ${p} is busy. Choose another port.`);
    return p;
  }
  for (let p = start; p < start + 30; p++) if (await available(p)) return p;
  throw new Error(`No free ${label} port found; configure one explicitly.`);
}
function run(cmd, args, options = {}) {
  return new Promise((res, rej) => {
    const child = spawn(cmd, args, {
      env: process.env,
      detached: true,
      stdio: "inherit",
      ...options,
    });
    children.add(child);
    child.on("error", () =>
      rej(
        new Error(
          `${cmd} could not start. Install Node, pnpm and Docker Desktop.`,
        ),
      ),
    );
    child.on("exit", (code) => {
      children.delete(child);
      if (code === 0) res();
      else rej(new Error(`${cmd} failed (${code}). See the output above.`));
    });
  });
}
function signalChild(child, signal) {
  try {
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {}
  }
}
async function shutdown() {
  if (stopping) return;
  stopping = true;
  for (const child of children) signalChild(child, "SIGTERM");
  for (let i = 0; i < 80 && children.size; i++) await delay(100);
  for (const child of children) signalChild(child, "SIGKILL");
  if (state()?.pid === process.pid) unlinkSync(stateFile);
}
process.on("SIGTERM", () => void shutdown().then(() => process.exit(0)));
process.on("SIGINT", () => void shutdown().then(() => process.exit(0)));
try {
  const appPort = await portFor(process.env.APP_PORT, 3000, "APP_PORT");
  if (process.env.USE_EXISTING_DATABASE !== "true") {
    const docker = spawnSync("docker", ["info"], { stdio: "ignore" });
    if (docker.status !== 0)
      throw new Error(
        "Docker is unavailable. Install/start Docker Desktop, then run pnpm app:start again.",
      );
    const compose = ["compose", "--env-file", envFile];
    const current = spawnSync("docker", [...compose, "port", "db", "5432"], {
      encoding: "utf8",
    });
    const runningPort =
      current.status === 0
        ? Number(current.stdout.trim().split(":").at(-1))
        : 0;
    if (
      runningPort &&
      process.env.LOCAL_DB_PORT &&
      Number(process.env.LOCAL_DB_PORT) !== runningPort
    )
      throw new Error(
        `Existing app database uses port ${runningPort}. Preserve it; set LOCAL_DB_PORT=${runningPort}.`,
      );
    const dbPort =
      runningPort ||
      (await portFor(process.env.LOCAL_DB_PORT, 5432, "LOCAL_DB_PORT"));
    process.env.LOCAL_DB_PORT = String(dbPort);
    const uri = new URL(process.env.DATABASE_URL);
    if (!["localhost", "127.0.0.1"].includes(uri.hostname))
      throw new Error(
        "For an external DATABASE_URL, set USE_EXISTING_DATABASE=true. Local startup will not modify it.",
      );
    uri.port = String(dbPort);
    process.env.DATABASE_URL = uri.href;
    await run("docker", [...compose, "up", "-d", "--wait", "db"]);
  }
  for (const command of [
    "db:migrate",
    "db:seed",
    "research:import",
    ...(existsSync("research/product-public-captures.json")
      ? ["research:captures"]
      : []),
    "high5:init",
    "product:init",
    "build",
  ])
    await run("pnpm", [command]);
  if (stopping) process.exit(0);
  const app = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(appPort),
    ],
    { env: process.env, detached: true, stdio: "inherit" },
  );
  children.add(app);
  const runner = spawn(
    process.execPath,
    ["--import", "tsx", "scripts/operations-runner.ts"],
    { env: process.env, detached: true, stdio: "inherit" },
  );
  children.add(runner);
  for (const child of [app, runner]) {
    child.on("exit", () => {
      children.delete(child);
      if (!stopping) void shutdown().then(() => process.exit(1));
    });
    child.on("error", () => {
      if (!stopping) void shutdown().then(() => process.exit(1));
    });
  }
  const url = `http://127.0.0.1:${appPort}`;
  let ready = false;
  for (let i = 0; i < 150 && !stopping; i++) {
    try {
      const r = await fetch(`${url}/api/health`, {
        signal: AbortSignal.timeout(1000),
      });
      if (r.ok && (await r.json()).background === true) {
        ready = true;
        break;
      }
    } catch {}
    await delay(200);
  }
  if (!ready)
    throw new Error(
      "The app did not become ready. See local logs; saved data is preserved.",
    );
  writeState({ ready: true, url });
  console.log(
    `\nFree Money Finder: ${url}\nLocal background checks started. Keep this terminal open, or use pnpm app:background.\nStop: Ctrl+C or pnpm app:stop. Saved database data is preserved.`,
  );
} catch (e) {
  const message = e instanceof Error ? e.message : "Startup failed.";
  await shutdown();
  writeState({ ready: false, error: message });
  console.error(message);
  process.exit(1);
}
