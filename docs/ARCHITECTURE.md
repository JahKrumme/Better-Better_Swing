# Architecture — Phase 3

Retain Next.js App Router, strict TypeScript, PostgreSQL/Drizzle and the existing evidence-first eligibility domain. Two operational engines (CASINO and SPORTSBOOK) share guarded services but keep accounts, currencies, balances, tasks and analytics separate. Server components read local projections; validated server actions record manual facts or run an explicitly isolated simulation.

`domain/operations.ts` holds exact monetary arithmetic, zero-money invariant, category transitions, policy decisions, strategy and risk controls. `domain/scheduler.ts` computes interval/calendar/custom windows. `domain/adapters.ts` defines capability-specific future adapters and execution-time authorization; its real registry is empty. `db/operations-service.ts` handles transactions, stable idempotency keys, account row locks, task re-evaluation, receipt imports, observations, strategy persistence and demo state transitions.

Eight additive tables store bookkeeping accounts, ordered ledger events, manual observations, scoped policy evidence, reward schedules, actions, strategies and demo runs. Old schemas and evidence are retained. Constraints enforce zero cash/free provenance and forbid paid action funding; category balances derive from events. Simulation is an account-level scope and is filtered from every real operations query. Ledger source/claim links prevent receipt duplication. Legacy Earnings and new ledger analytics are separate projections and are never summed together.

Refresh is explicit via Today or an idempotent CLI command. It generates current opportunities, imports actual recorded receipts, marks claims complete, creates balance follow-up tasks, expires windows and re-evaluates policy/eligibility. No background network job, public-site scraper, platform account client or real executor exists. Current clocks display America/Chicago; anchored intervals use elapsed hours and calendar schedules retain DST semantics.

Manual observations are separate from primary evidence. High 5's observed four-hour message schedules CHECK_REWARD with a finite review deadline, not confirmed claims/amounts. Snapshot balances do not mint receipt events. Offline play requires manual reconciliation; terminal legacy balances are never inferred from original received quantities.

See [Phase 3](PHASE_3.md) for screens, detailed controls and limitations; [policy](AUTOMATION_POLICY.md) for automatic/manual boundaries; [ledger](PROMOTIONAL_BANKROLL.md) for event semantics. All services remain local and unauthenticated, bound to loopback. No secrets or gambling account credentials are stored.

## Preserved historical architecture (Phases 0–2)

Descriptions of future queues/adapters below are historical; the current additions above supersede those boundaries without discarding earlier implementation.

# Architecture

A single Next.js App Router application with strict TypeScript, Tailwind, Zod validation, PostgreSQL, and Drizzle. Server components read the database; a server action handles local manual research entry. Domain eligibility is independent of UI and database. pnpm locks dependencies. No queues, Redis, or service decomposition.

## Data model

Platform records store category, status, availability/restrictions, official URLs, exclusion, and affirmative automation-policy evidence with verification timestamps. Offers store reward and estimated value separately, all five monetary requirements as nullable booleans, signup/identity/age/geography, dates, cadence, playthrough and redemption terms, discovery and verification state. OfferEvidence stores URL, source type, extracted text, supported field, timestamp, notes. Claims store manual/automatic metadata (execution never supported here). Redemptions store actual amounts and dates. PlatformAccount stores optional identifiers and verification metadata, never credentials.

## Verification

A centralized evaluator first rejects exclusions, monetary requirements, explicit geographic mismatches, and expired offers. It then requires explicit false values and fresh official evidence for all five monetary requirements, plus age, geography, and reward/redemption terms. Unknowns return Needs Verification. A local profile defaults to US/Kansas and unknown age; configure age without storing birthday or identity. Evidence freshness is 30 days. Fictional seed evidence is explicitly marked and only supports fixture demonstrations, never live Verified Free offers. Estimated cash value is an estimate, not earnings.

## Ingestion and future extension

Phase 1 uses manual platform/offer/evidence forms with atomic transactions and Zod validation. Future platform adapters may produce normalized candidate offers and evidence; they cannot mark unknown facts verified. Later scheduled discovery calls those adapters and re-evaluates on evidence or term changes. Raw extracted text remains available for audit. Retain historical evidence rather than overwriting it.

## Boundaries

No external account login, scraping, claims, or wagers. Automation policy never triggers actions. Local-only use: bind to loopback; no authentication layer yet, so do not expose the server publicly. Credentials stay in environment variables outside Git. Migration and seed commands are explicit; seed uses stable IDs and never overwrites research records. Live processes must restart in each cloud task. Use the existing checkout; do not create worktrees unless requested.

## Phase 2 extensions

The original application and PostgreSQL architecture are retained. Additive migrations add platform qualification summaries, a platform_sources audit table, offer AMOE/value/recurrence fields, evidence normalized facts/conflicts/superseding timestamps, and manual claim-instance metadata. Legacy Phase 1 columns remain for compatibility. All persisted real offers default to researchVersion 2; fixtures keep version 1. The evaluator returns the six Phase 2 verification states while retaining the old display status for compatibility with the unchanged Phase 1 tests.

The registry importer consumes validated local JSON and does not discover or scrape sites. Access receipts are separate from reviewed primary facts. A blocked attempt never verifies a platform, offer, automation policy, or geography. Manual evidence may update typed offer terms atomically; replacing old terms does not discard old evidence. Conflicts require explicit source review and retained superseding reasons.

Recurring instances have a unique (offerId, periodKey), period start, availability date, opportunity end, and claim state. Daily and weekly boundaries use the configured timezone; Chicago is the default. DST is handled as calendar time, not fixed 24-hour durations. Weekly defaults to Monday-based calendar weeks; a platform with another reset/window must have its schedule modeled before relying on this simplified period model. The schema retains a recurrence anchor for future support. Claiming the current period atomically records that instance and inserts the next unclaimed period. Future instances become ready on read, without a background worker. Duplicate submissions serialize under a row lock and unique index. Offer records remain active after recurring claims.

A manual claim requires currently verified real eligibility. User-entered received promotional amounts remain separate from advertised face value. Cash can be recorded only through valid manual claim transitions; redemptions can link a claim to prevent double counting. Value estimates require a documented method and current primary supporting value evidence; there is no inferred EV or automatic coin-to-dollar conversion.

Server actions validate identifiers, types, normalized facts, source domains, and state transitions. Everything remains local and unauthenticated; no account credentials or platform sessions are introduced. Public-site research was one-off Phase 2 investigation; there are no adapters, monitoring jobs, or Phase 3 discovery loops.

## Phase 4 — High 5 within the existing application

The existing adapter registry now registers a manual-only High5Adapter. `domain/high5.ts` centralizes observation/reconciliation arithmetic, manual play validation, conservative strategy evaluation and actual experiment metrics. `db/high5-service.ts` writes account-locked transactions using the existing ledger and queue; it never executes a platform action. Server Actions power `/high5` and `/high5/experiment`; Today exposes the quick daily workflow.

Four additive tables retain ordered USER_OBSERVATION updates, account-scoped reward instances, reviewed public-source snapshots and manual redemption states. Ledger provenance links events to observations; signed OBSERVATION_RECONCILIATION events do not count as rewards or play returns. Redemption cancellation releases reservations; a single proceeds-fill event supports unknown completed proceeds without redeeming units twice. Existing legacy High 5 claims share the same receipt key; historical `SC (promotional)` is narrowly normalized to SC. All other platforms retain their existing unit behavior.

An explicit Python stdlib fetcher reads six fixed official HTTPS public documents, within size/time/origin bounds. Critical changes set an eligibility review flag. The curated baseline and existing typed research/evidence workflow support deliberate manual re-verification; sync never clears flags or grants permissions. No worker, private scraper, credential store or new dependency is introduced. The existing demo and sportsbook remain separate. See [PHASE_4_HIGH5.md](PHASE_4_HIGH5.md).
