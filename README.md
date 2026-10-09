# Free Money Finder

A local personal research foundation for $0-out-of-pocket promotional rewards. Research and real published programs are separate from **fictional development fixtures**, and Fliff is always excluded. An explicit bounded High 5 public-source research sync is available. No external login, automated claims or gameplay executor is implemented.

## Stack and layout

Next.js 16 App Router, React 19, strict TypeScript 6 (compatible with the current lint parser), Tailwind 4, PostgreSQL 17, Drizzle, Zod, Vitest. One application with a local persisted action queue; no external worker or platform executor. ESLint 9 is pinned because the current Next lint plugins do not declare ESLint 10 support; update when upstream compatibility is available.

- `src/domain/`: centralized evidence-first eligibility, profile, input validation, unit tests.
- `src/db/`: additive PostgreSQL schema, transactional ledger/actions, connection and read queries.
- `src/app/`: overview, offers/filtering, platforms, earnings, local research forms.
- `scripts/`: explicit migration and non-destructive fixture seed.
- `drizzle/`: checked-in SQL migration and migration metadata.
- `docs/PRD.md`, `docs/ARCHITECTURE.md`: scope, model, future phases and safety boundaries.

## Exact local setup

Requires Node.js 24 (or compatible Node 22.13+), pnpm 11.19.0, and Docker Compose. Use the existing checkout; no worktree is needed.

```sh
cd /workspace/Better-Better_Swing # or your local checkout
pnpm install --frozen-lockfile
pnpm local:env # creates ignored .env with a random local database password; preserves existing files
# Alternatively copy .env.example and choose matching passwords manually.
# Leave PROFILE_AGE blank unless you want to configure your known age.
docker compose up -d --wait
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open the application locally on port 3000. Bind only to loopback. There is no authentication; do not expose this personal research app publicly. For a remote PostgreSQL database, set DATABASE_URL and skip Compose. `.env` is ignored; no platform passwords, cookies, or identity documents belong in this application.

The cloud machine redirects pnpm storage to writable paths if needed:

```sh
export XDG_DATA_HOME=/workspace/.local/share
export XDG_CACHE_HOME=/workspace/.cache
```

Compose uses a digest-pinned PostgreSQL image with a named volume. Data survives container restarts; do not remove the volume unless you intend to delete the database. Docker processes/volumes may not survive a fresh cloud machine; installation initializes fictional examples again where needed. Back up real research using PostgreSQL's supported backup tools.

## Development and validation

```sh
pnpm db:generate # after a deliberate schema change; review generated SQL
pnpm db:migrate
pnpm db:seed     # repeatable; stable fixture IDs; does not overwrite records
pnpm typecheck
pnpm lint
pnpm test
pnpm db:smoke # validates the five fictional seed examples
pnpm format:check
pnpm build
pnpm start
```

`pnpm format` applies Prettier. Database scripts load `.env` via Node. Next loads it automatically. A missing database shows a recoverable error view.

Research: add a non-fixture platform, then an offer. Unknown decisions are the default. Provide separate exact supporting excerpts for every qualifying field and a capture date; dates older than 30 days no longer establish eligibility. In this initial version one evidence source is captured per submission; multiple sources and editing/append-only reverification UI are future improvements. Official-source classification and interpretation are manual assertions, not automated source validation. The stored verification status is research metadata; current eligibility is always recomputed. Age defaults to unknown, so even free fixtures stay Needs Verification until a known eligible age is configured. Fixture evidence never verifies a live offer.

Overview and earnings exclude fixtures. Units are kept separate. Promotional amounts are never added to cash earnings. Estimated cash value may remain unknown. Claims and redemption schema exist, but ledger-entry UI and a true recurring due-date calendar are reserved for later phases. Automation policy is metadata only; every Phase 1 claim method is manual.

## Next step

Phase 2: build a manually verified real platform registry and real offer evidence, plus evidence editing/reverification ergonomics. Do not start automated collection or external actions yet.

## Phase 2 research and manual claims

The default dashboard and platform registry now show real research only. Development examples remain on the separate fixture views. Twenty candidates and their actual proxy-blocked source attempts can be imported without inventing offers:

```sh
pnpm db:migrate
pnpm db:seed
pnpm research:import
pnpm test
pnpm test:integration
pnpm db:smoke
```

`research:import` consumes the checked-in candidate/access JSON; it does not contact public sites or update old timestamps. All candidate terms, Kansas eligibility, rewards, and automation policies remain unknown until supported by official evidence. See `docs/PHASE_2_RESEARCH.md` and `docs/PHASE_2_IMPLEMENTATION.md`.

Research forms now support short primary passages, platform facts/policy research, appended offer evidence, typed offer fact updates, and source superseding with a review reason. Boolean normalized facts use `true`, `false`, or `unknown`; monetary quantities use nonnegative decimal values; age is an integer. Geography uses JSON such as `{"countries":["US"],"states":["KS"],"excludedStates":[]}`. Preserve conflicting evidence until it is reviewed. Official classification is a manual assertion; no live semantic verification is performed.

Postal AMOE costs are explicitly separate from $0 rewards. Documented estimates are separate from promotional amounts and actual cash; unsupported estimates stay unknown. Recording a manual claim contacts no gaming platform. The amount actually received must be entered explicitly or stays unknown. A claimed daily instance does not disable tomorrow's instance. Chicago calendar days/Monday weeks are defaults, not inferred platform reset policies. No background scheduling is built.

The local HTTP smoke suite requires Python 3 and the default Docker database. It creates clearly labeled temporary synthetic records and removes them afterward. Run against a production server using an explicitly synthetic test age, not as a statement of your real age:

```sh
pnpm build
PROFILE_AGE=25 pnpm start  # dedicated smoke-test process only
# In a second terminal from this checkout:
pnpm test:http
# Stop the smoke-test server, then run pnpm dev without the override.
```

The integration and HTTP suites are intended for this local development database, and must not run against unrelated production data. No new real offer is verified while official sources remain inaccessible. Stay in Phase 2 until evidence supports a real Kansas collection plan.

Current primary-source findings and the product recommendation are in [Phase 2 research](docs/PHASE_2_RESEARCH.md) and [opportunity analysis](docs/PHASE_2_OPPORTUNITY_ANALYSIS.md). `pnpm research:import` imports the manually reviewed static snapshot without network requests; real offers remain distinct from fictional fixtures.

## Phase 3 local operations

After the existing migration/seed/research setup, run `pnpm operations:refresh`. Open Today at `/`, casinos at `/casinos`, sports credits at `/sportsbook`, the ledger at `/bankroll`, and the isolated demo at `/demo`. The previous research dashboard is preserved at `/overview`.

Refresh evaluates only local evidence/schedules and imports known manually recorded receipts once. It never contacts a platform. Real claims/requirements/KYC/redemption remain manual. The 3.00 SC High 5 observation and four-hour inbox display are stored separately; they do not mint free receipts or recurring value estimates. Demo balances/proceeds are fictional and excluded from all real totals. No real adapter, gameplay or sportsbook wager executor is enabled.

See `docs/PHASE_3.md`, `docs/AUTOMATION_POLICY.md` and `docs/PROMOTIONAL_BANKROLL.md`. Earlier setup/research instructions remain useful; statements above reserving tracking/scheduling for future phases describe the prior versions. All changes remain local and uncommitted.

## Phase 4: High 5 daily workflow

Apply `pnpm db:migrate`, then `pnpm high5:init` to initialize the manual High 5 integration without inventing account balances. Today links to `/high5` for quick free-only reward/account observations, already-performed play and manual redemption recording; `/high5/experiment` reports actual observations and conditional rates. `pnpm high5:sync` explicitly reads official public documents. Critical changes require manual review; `pnpm high5:review` is used only after reviewing/correcting primary evidence and typed terms, updating the curated baseline and syncing matching current sources. No permission is inferred from technical access.

Run `pnpm test:http:high5` against the loopback production server alongside the existing HTTP smoke. It uses a temporary isolated bookkeeping account and removes its records. See [Phase 4 implementation](docs/PHASE_4_HIGH5.md) and [experiment protocol](docs/HIGH5_EXPERIMENT.md). All code remains uncommitted; Phase 5 is not started.
