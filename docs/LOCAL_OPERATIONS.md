# Running Free Money Finder locally

Requires Node 24+, pnpm 11.19+, Docker Desktop with Compose, and an initial `pnpm install --frozen-lockfile`. Python 3 is needed for explicit public research and HTTP smoke tests, not normal startup.

```sh
pnpm app:start
```

This creates an ignored, mode-0600 `.env` only if absent, generates a random database password, starts PostgreSQL, safely applies additive migrations, imports preserved fixtures and reviewed research, initializes operations, builds the production app, and starts Next plus the operations runner. Open the loopback URL printed by the command. The initial age is unknown; confirm age eligibility and state on Home. Your existing environment and database records are preserved. Database initialization never renews old evidence timestamps or overwrites newer facts.

Keep the terminal open. Ctrl+C stops the web app and runner while preserving PostgreSQL and its named data volume. Closing the terminal, sleeping the Mac or shutting it down interrupts checks; nothing claims rewards while offline.

```sh
pnpm app:background
pnpm app:stop
```

Background mode detaches the same production supervisor and reports the ready URL. Logs and owned-process state live in ignored `.fmf/`. `app:stop` verifies its process token before signaling it; it does not kill another project or remove database volumes. To stop PostgreSQL too, run `docker compose stop db` for this project. Never use `down -v` on a database containing saved observations.

## Ports and existing databases

Default ports are selected from available loopback ports starting at 3000 (app) and 5432 (database). An already-running app database retains its existing published port. Explicit busy ports produce a useful error rather than stopping unrelated services:

```sh
APP_PORT=3010 LOCAL_DB_PORT=5438 pnpm app:start
```

You can put these values in ignored `.env`. A different database port is applied to the child process's local DATABASE_URL without printing its password. If this app's database already runs on a different port, startup asks you to retain that port. Docker Desktop must be running. Password authentication failures generally mean `.env` no longer matches the password used when the volume was first initialized; restore the original password, do not discard the volume.

For your own existing PostgreSQL service, set DATABASE_URL and `USE_EXISTING_DATABASE=true`. Startup skips Docker and still applies migrations/imports to that selected database. Choose the database deliberately; it must belong to this application.

Advanced options: `FMF_ENV_FILE`, `FMF_STATE_DIR`, `COMPOSE_PROJECT_NAME` for isolated workspaces; `OPERATIONS_INTERVAL_SECONDS` (60–3600, default 300). No cloud, external analytics or public-network exposure is enabled by startup.

## What the runner does

A dedicated worker runs local schedule/evidence checks every five minutes. It holds a PostgreSQL advisory lock so two workers cannot run concurrently. Manual and background checks share a second lock to prevent overlapping runs. Checks persist their result and the attention queue. A heartbeat updates every 15 seconds; the UI reports OFF when disabled, future-dated or more than 45 seconds stale. Hard crashes can therefore take up to 45 seconds plus the UI refresh interval to appear OFF. Graceful shutdown sets OFF immediately. The UI refreshes local data every 30 seconds.

Current real integrations have no affirmative permission plus supported private executor. The runner never logs in, claims, plays, deposits, purchases or redeems on your behalf. It evaluates the local data and tells you what needs you. An observed High 5 four-hour reminder or a RealPrize daily reminder does not prove a reward is ready or credit an amount. No operating-system notifications are sent; the persisted attention queue is prepared for a future delivery mechanism.

## Public research

```sh
pnpm research:refresh
pnpm high5:sync
```

These are explicit manual research operations, separate from unattended checks. The general refresh reads bounded, fixed official registry URLs, records timestamps/excerpts/fingerprints and failures, and imports captures. It has no authentication, cookies, retries, browser impersonation or access-control bypass. Reachability alone never verifies an offer or renews eligibility facts. Changed previously captured passages flag the platform's offers for re-verification. No automatic clearing occurs. High 5 additionally compares curated critical rules and help passages with its reviewed baseline. Advanced retains its manual public-sync controls.

GET MY FREE MONEY checks all supported, currently authorized capabilities. Since there is currently no independently authorized automatic public-discovery or private-account adapter, its real path checks local records and creates manual follow-up. Permission is evaluated independently for discovery, availability, balance, claim, gameplay and redemption. Unknown, prohibited, stale, conflicted or unsupported permissions cannot execute.

## Validation

Unit/static checks: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`.

Use a disposable local database for integration and HTTP tests. They create synthetic observations, never actual platform activity. Legacy checks remain `pnpm test:integration`, `pnpm db:smoke`, `pnpm test:http`, `pnpm test:http:high5`. Consumer HTTP smoke requires `FMF_ALLOW_ISOLATED_SMOKE=true` and a Compose project beginning `fmf_product_verification`; run via `pnpm test:http:consumer`. The complete disposable production/restart/port smoke is `pnpm test:startup` and cleans up only the unique project it creates.
