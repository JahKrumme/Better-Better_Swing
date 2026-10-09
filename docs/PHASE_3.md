# Phase 3 — operational foundation

Implemented October 8, 2026 (America/Chicago). Existing Phase 0–2B research, evidence, claims, fixtures and validation remain intact. Changes are uncommitted. This phase implements local operational bookkeeping and simulation, not a real platform integration.

## Usable screens and workflow

- **Today (`/`)**: verified casino/sportsbook offers ready, separately labeled recorded balances, manual tasks, completed-today records in Central time. **Refresh local queue** evaluates local evidence/schedules and imports known manual receipts; it makes no platform requests.
- **Research overview (`/overview`)**: the previous dashboard, including exclusions, uncertain records, AMOE and the incomplete known promotional subtotal, preserved separately.
- **Casinos (`/casinos`)**: verified programs, balances, required tasks, editable conservative strategy/game inputs and a planning result. No real gameplay execution.
- **Sports betting (`/sportsbook`)**: verified $0 offers, recorded free bets, balance, expired credits/tasks, manual tasks. Current research has no verified free sportsbook offer; no offer is invented to fill the view. Betting is user-directed.
- **Bankroll (`/bankroll`)**: append-only events, category balances, performance, manual transfer/redemption forms and separate observations.
- **Simulation (`/demo`)**: persistent, deterministic runs with two clearly labeled fictional accounts. Step through a recurring reward, free claim, activation, two wagers, a win/loss, completed playthrough, redeemable value, request and redemption. Fictional 10 DEMO SC becomes 9.95 redeemed DEMO SC / simulated 9.95 USD. The sportsbook's fictional 5 free-bet units remain available; no sportsbook wager occurs. These are test outcomes, not predictions.

For real bookkeeping: manually use an eligible platform yourself, record the actual received amount on **Offers**, then refresh Today. A known actual receipt is imported once, keyed by claim instance; advertised 55 SC is never substituted for an unknown actual grant. Record confirmed activation, completed playthrough, redemption eligibility, request and completed proceeds on Bankroll. Choose the exact account/currency and retain manual evidence. Refresh to update follow-up tasks. Actual account balances may differ until all offline events are reconciled. Gameplay recording/execution is simulation-only in this phase; downward adjustments can reconcile observed losses but do not count as measured wager-level performance.

## Architecture and schema

One Next.js/TypeScript application and PostgreSQL/Drizzle remain. Eight additive tables: `bankroll_accounts`, `bankroll_ledger`, `manual_observations`, `action_policy_evidence`, `reward_schedules`, `operational_actions`, `casino_strategies`, `demo_runs`. No Redis, worker fleet, credentials or external client dependencies. Migrations 0003–0005 add the tables, stable event sequence and stronger funding checks without modifying old records.

The account's platform, CASINO/SPORTSBOOK engine and demo flag determine all report scopes. Existing PlatformAccount login metadata is unchanged. Ledger/source/claim links retain the old offer and instance context. Aggregate balances are projections of ordered events, not editable wallet totals. Decimal strings convert to integer cents for calculations.

## Guards and policy

`enforceZeroMoney` requires every funding decision explicitly false, zero contribution and FREE_PROMOTIONAL origin. Deposits, purchases, subscriptions, paid wagers, entries, cash or unknown/purchased origin fail. Services validate before mutations, and SQL constraints also reject nonzero contributions, purchased origins or paid action funding. Hard deposit/purchase/loss-chasing controls cannot be configured off.

Policies are scoped to DISCOVERY, CLAIM, GAMEPLAY and REDEMPTION. Passive checks fall under DISCOVERY, never inherit gameplay/redemption execution permission. Fresh reviewed official evidence is required; stale, future, expired, missing, observational or conflicting proof becomes UNKNOWN. Existing narrow prohibitions are retained for High 5 gameplay/redemption, Stake acquisition/gameplay and RealPrize gameplay. Other action scopes remain UNKNOWN. Simulation permission cannot authorize a real account.

UNKNOWN/PROHIBITED automation creates MANUAL_REQUIRED tasks; exclusions/paid plans and sportsbook play are BLOCKED. Affirmative permission may enter the automatic queue, but execution additionally needs a registered, capability-enabled adapter and current eligibility/time/cost/policy revalidation. **No real adapters are registered.** There is no real automatic executor button, login, claiming, wagering or redemption path. Interfaces are preparation only. See [automation policy](AUTOMATION_POLICY.md).

## Scheduling

Supports HOURLY_INTERVAL, DAILY, EVERY_N_HOURS, WEEKLY and explicit nonoverlapping CUSTOM windows. Interval slots use a stored anchor; calendar days/weeks honor Chicago DST. Unique schedule/period keys and claim-instance keys prevent duplicates. Only the current window is generated: missed periods are not claimed retroactively. Freshness is 30 days; expiration clips windows. A refresh re-evaluates pending task modes and expires old tasks without reviving completed ones.

Daily/weekly schedules are created only from currently eligible researched recurring offers. Calendar boundaries are local reminder approximations until an operator's exact reset is verified; the old manual-claim calendar remains unchanged. The every-four-hour High 5 observation creates **CHECK_REWARD**, never a verified four-hour claim. Its anchor is the report/initialization time, not an inferred platform reset; its seven-day review deadline limits reminder persistence and is not a promotion expiry claim. No repeating amount, currency or monthly value is inferred. Observed 3.00 SC is not inserted into the receipt ledger. Observation time remains unknown.

Refresh is explicit on Today or `pnpm operations:refresh`; no unattended polling, cron service or external discovery has been installed. Every-N-hour and custom schedule models are available to future reviewed integrations, not an unverified claim editor.

## Strategy and risk

The planning model includes game eligibility, wagering contribution, game wager limits, RTP, volatility, playthrough remaining, redemption threshold, rules source/date and supported expected-value input. Unknown inputs remain null. RTP alone is not a redemption-value estimate. Planning validates current source, contribution, limits, expected-value floor and available free balance. Defaults: maximum promotional loss 1.00 per session, wager 0.10, duration 15 minutes, stop balance 0.10, unknown minimum expected value (requires review), immutable stop-when-redeemable. These are account-currency units, not presumed dollars.

Redeemable value always returns STOP_REDEEM. No wager debits REDEEMABLE or REDEEMED. No required playthrough remaining triggers redemption review. The demo applies session loss/wager/duration controls before each fictional wager; a demo left open beyond its duration limit must be restarted. Real strategy previews are pre-session plans, not a live session monitor or execution authorization.

## Performance and historical compatibility

New performance panels report free receipts, stakes, net wins/losses, value made redeemable, promotional units redeemed, and separately recorded actual USD. Conversion compares redeemed promotional units to received units within the same account/currency; no SC-to-USD ratio is inferred. Cash/coin comparison is unknown. ROI is not applicable because the denominator is zero. Existing Earnings remains the Phase 2 claim/redemption report; its totals are not added to ledger analytics, avoiding duplicate receipt/cash accounting.

Legacy claims already marked REDEEMABLE/REDEEMED are not imported as fresh held funds. They create manual reconciliation tasks because their remaining promotional amount cannot be inferred from their original receipt. Unknown received amounts similarly produce verification tasks. Explicit legacy and new ledger reports remain available.

## Before a first real integration

Obtain current official permission for each proposed capability; establish exact reward/reset/expiry, free acquisition and purchase-free prize paths, account eligibility and reconciliation semantics. Implement an official supported interface without storing passwords/cookies or circumventing security; register only the reviewed capabilities. Add sandbox/contract tests for zero-money provenance, immutable risk controls, live balance freshness, session limits, reservations, idempotency, errors and policy withdrawal. Revalidate at execution, not just queue creation. Gameplay remains outside this phase; sportsbook wagering remains excluded.

## Validation

Passed: **134 unit tests**, **23 PostgreSQL integration tests**, typecheck, ESLint (zero warnings), Prettier, production build, database smoke, all 14 HTTP route checks, and functional manual-research/claim/ledger/redemption/full-demo workflows. All original 85 unit tests and 12 integration tests remain unchanged; new tests cover operational invariants and concurrency. Old tests remain intact; the previous overview HTTP assertions now target `/overview`. Synthetic integration and HTTP accounts/claims/events/runs are cleaned up. No real platform action, account creation, credential storage or security bypass is performed.

## Files added or changed in Phase 3

- `src/domain/operations.ts`, `scheduler.ts`, `adapters.ts`, `operations.test.ts`.
- `src/db/schema.ts`, `operations-service.ts`, `operations.integration.test.ts`.
- `src/app/page.tsx`, `layout.tsx`, `overview/page.tsx`; new `casinos/page.tsx`, `sportsbook/page.tsx`, `bankroll/page.tsx`, `demo/page.tsx`; `operations/actions.ts`, `forms.tsx`, `display.tsx`.
- `drizzle/0003_yummy_talos.sql`, `0004_nappy_dark_phoenix.sql`, `0005_busy_triathlon.sql`; corresponding snapshots and migration journal.
- `scripts/init-operations.ts`, `scripts/http-smoke.py`, `package.json`.
- `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/PHASE_3.md`, `docs/AUTOMATION_POLICY.md`, `docs/PROMOTIONAL_BANKROLL.md`, `README.md`.

Existing reviewed research JSON, eligibility evaluator, claim service, fixture seed, original test files and credential files were not changed in this phase. No dependencies were added. Repository baseline files were already untracked; no commit/staging/push was performed.
