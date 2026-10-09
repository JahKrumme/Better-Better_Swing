# Phase 4 — High 5 integration

Phase 4 integrates High 5 only, within the existing Next/Drizzle application, ledger, task queue, scheduler and adapter registry. All Phase 0–4 changes remain uncommitted. No Phase 5 work or real platform execution is included.

## What now works

Today links to `/high5` for a quick manual account update, recording already-performed play and recording redemption. `/high5/experiment` presents actual observations and conditional performance metrics. The main three account fields are total free SC, playable free SC and operator-confirmed redeemable SC. Blank means UNKNOWN. Reward outcomes are NO_REWARD, GC_ONLY, SC_ONLY, GC_AND_SC, OTHER or UNKNOWN; amounts and claimed status are independent. Advanced fields include GC, signup/recurring/other classification, next displayed reward time, total/progress/remaining playthrough, minimum redemption, effort and an observation note. Dates use America/Chicago.

Confirm values shown in High 5 before submitting; prefilled balances are conveniences, not live reads. The common check/update needs only a few fields, designed for roughly 10–20 seconds; this is not a measured usability result. No password, token, cookie, ID document or banking credential field exists. The free-only attestation is mandatory. Notes are for non-sensitive observations.

A user-entered current balance reconciles holdings without inventing a reward. Re-entering the same balance produces no extra credit. Signed OBSERVATION_RECONCILIATION events are separate from receipt/win/loss events and do not inflate reward or play metrics. Unknown allocations stay unknown in account metadata; conservatively unallocated SC is promotional rather than playable or redeemable. Current GC is its own non-cash promotional ledger currency. Real and demo accounts remain separate.

## Adapter and permission

| Capability              | High 5 support   | Present behavior                                |
| ----------------------- | ---------------- | ----------------------------------------------- |
| discoverOffers          | SUPPORTED_MANUAL | User starts bounded official public sync/review |
| checkRewardAvailability | SUPPORTED_MANUAL | User checks inbox/reward panel                  |
| readPromotionalBalance  | SUPPORTED_MANUAL | User reports GC/SC/playable SC                  |
| readRedeemableBalance   | SUPPORTED_MANUAL | User reports operator-confirmed redeemable SC   |
| claimReward             | SUPPORTED_MANUAL | Record a reward actually claimed by the user    |
| executePromotionalPlay  | UNAVAILABLE      | No executor; record past manual play only       |
| requestRedemption       | SUPPORTED_MANUAL | Record a request/result handled by the user     |

Every automatic capability flag is false. Discovery and claiming have no affirmative current authorization. Official rules prohibit automated/systematic play and redemption; terms also prohibit software-assisted game participation. Registering the adapter does not grant permission. Public-sync button/CLI operation is an explicit research action, not an unattended adapter or authenticated interface.

## Official public evidence

The reviewed baseline is `research/high5-public-review.json`. It retains official URLs, retrieved times, scoped excerpts, whole-readable-document digests where accessible, fingerprints and review notes. Six fixed HTTPS sources are read: sweepstakes rules, free Sweeps Coins help, redemption help, playthrough help, public games catalogue and terms. The fetcher has bounded document sizes/timeouts, an origin-restricted redirect handler, no login/cookies, no browser impersonation and no retries or control circumvention. The UI/CLI imposes a 15-minute repeat-read cooldown.

The rules establish US/21+ eligibility and an excluded-state list that does not include Kansas; free account entry and first-daily-login SC; at least one play, with sponsor discretion to require more; and 50 SC non-cash / 100 SC cash minimums. The published signup FAQ says 55 SC. None of these facts credits the user's wallet or proves the four-hour amount/currency. The help article's 3x illustration is not a universal requirement.

Prizeout explicitly supports verified players without a prior purchase. Trustly help contradicts itself: its detailed eligibility section says no prior purchase is needed, while the menu FAQ conditions visibility on earlier purchases. This ambiguity remains visible. Skrill expressly requires a prior purchase and is excluded. The 1 SC:$1 statement applies to redemption only, not expected cash or a wallet conversion.

Public game pages provide marketing/catalogue information but no complete reliable per-game SC eligibility, contribution, wager limits and expected redeemable-value model. There are no verified game records or real-game recommendations. Planner status is **INSUFFICIENT VERIFIED GAME DATA** when requirements are known but games are not; unknown requirements first require an account check. The planner can evaluate fully reviewed hypothetical terms through the existing risk controls, but cannot infer expected redeemable value from RTP alone. Redeemable funds always override play planning.

A changed non-game critical document fingerprint sets `high5PublicReviewRequired` on High 5 offers. Eligibility and new claim linking fail closed; public sync never clears flags. Failed reads retain unverified source status. Failed core terms block rules-dependent planning; inaccessible game data keeps game recommendations unavailable. Whole-document digests make added/changed clauses require review even when scoped excerpts stay identical; formatting or marketing changes can conservatively trigger review too. The final bounded read retained five readable documents and an ACCESS_FAILED games-catalogue result after a redirect outside the allowed origin; it did not follow that redirect or retry. The earlier readable catalogue review still supplies no verified game tuple. Thirty-day-old or future source timestamps fail freshness. Public snapshots never become USER_OBSERVATION or affirmative automation permission.

Re-verification is deliberate: review the current primary documents, correct typed offer terms and append/supersede evidence in the existing research workflow, update the curated baseline if appropriate, and sync matching current core documents. A failed catalogue read keeps games unavailable but does not block re-verification of independently established free-offer rules. Then explicitly run `pnpm high5:review`. It clears only flagged independently eligible offers, records the curator review and refreshes local tasks; it cannot make paid/excluded/unsupported offers eligible. This command is a manual review attestation, not automated legal interpretation. Historical snapshots are retained.

## Reward checks, claims and replay

The existing observation-based EVERY_N_HOURS schedule remains a four-hour CHECK_REWARD reminder, with its existing expiry. It is not an automatic claim or a guaranteed grant. Today says “High 5 displayed a free-coins-every-4-hours promotion. Reward currency and amount may vary.” It displays last check, next expected check, current reported SC, playthrough, redeemability and CHECK/WAIT/REDEEM guidance. No fixed inbox SC amount is advertised.

Successful checks complete current due CHECK_REWARD tasks. Account-scoped reward instances identify each check interval; signup is counted once. Repeated identical submissions use a unique submission key, stable canonical JSON comparison and account locking. Re-reporting the same claimed instance cannot create another receipt or alter a known amount. A previously unknown receipt can be clarified with its current currency balance so it is not added twice. Known claimed rewards create FREE_REWARD_RECEIVED events; unknown amounts create an instance but no inferred ledger credit.

When the actual source is a verified published offer, selecting it links the current legacy claim instance as well. The known offer classification overrides the category field, so a published signup grant cannot be projected as recurring SC. UNKNOWN/four-hour inbox is the default; do not mislabel an inbox grant as published signup/daily rewards. The ledger receipt shares the legacy claim receipt key. Refresh checks existing actual receipts instead of reimporting them. Known/unknown legacy manual claims are included in the actual experiment without repeating linked High 5 reward instances. Generic High 5 ledger edits redirect the user to the account/play/redemption forms to keep state and metrics consistent. High 5's old `SC (promotional)` research label is normalized narrowly to the SC ledger unit; GC and other platforms are not converted.

## Playthrough, play and redemption

Total/progress/remaining playthrough are optional observations. The form validates consistency when all are known; no universal multiplier, contribution or redeemability is invented. Wagered SC is actual recorded play, not automatically eligible contribution. SC requiring playthrough and potentially redeemable value remain unknown where the operator has not established them. If contribution or earlier progress is unknown, updated progress/remaining remains UNKNOWN. Recorded completion of a known requirement still requires operator confirmation of actual redeemability.

RECORD PLAY accepts game, starting playable free SC, wager, WIN/LOSS/PUSH, ending playable free SC and contribution. Starting holdings must match the reconciled ledger; wager and resulting payout must be possible; result must agree with the net balance change. Contribution cannot exceed wager. Wager/settlement events calculate actual net wins/losses and progress, without executing a game. Session controls govern any plan, not a fabricated rejection of an otherwise honest historical record. No additional play is accepted while confirmed redeemable funds exist.

Operator-confirmed redeemable SC immediately creates a manual REQUEST_REDEMPTION action, displayed before other pending tasks, and **STOP PLAYING**. A manual request reserves the amount; another request or downward correction cannot consume reserved funds. Completion transfers the SC units to redeemed and records actual USD/prize value separately. Unknown actual proceeds remain unknown; one explicit later fill is permitted without redeeming the SC twice. Cancellation/failure releases the reservation and creates no proceeds. Known completed proceeds cannot be rewritten or a closed request reopened.

The redemption form records amount, actual proceeds, request/completion dates, method and status. Prizeout/Trustly/UNKNOWN are bookkeeping labels; Trustly ambiguity is disclosed, not resolved by a historical record. No payment credential is stored and no external request is sent. Gift-card face value and cash are both disclosed as actual cash/prize value, not guaranteed liquid cash.

## Evidence needed before any external automation

| Manual action                        | Required evidence and supported capability                                                                                                                                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public discovery/sync                | Current official affirmative permission for unattended programmatic public reads, supported stable official feed/API, reviewed change schema and rate limits                                                                      |
| Reward checks                        | Official authorization for authenticated passive checks and a supported scoped reward/inbox endpoint; exact cadence, availability and currency semantics                                                                          |
| GC/SC/playable balance reads         | Official authorized read-only balance endpoint with currency/bonus provenance and purchase-free separation; reviewed authentication mechanism that does not require secrets in forms                                              |
| Redeemable balance/playthrough reads | Authorized operator endpoint explicitly defining eligible vs pending vs playable amounts and bonus-specific requirements                                                                                                          |
| Reward claiming                      | Fresh affirmative permission specifically for automated free claims, a supported claim endpoint, eligibility/zero-cost/idempotency limits and execution-time rechecks                                                             |
| Gameplay                             | Current official terms replacing/resolving the explicit prohibition, affirmative action-specific permission, a supported gameplay API, verified game restrictions/EV and hard risk controls; no executor exists today             |
| Redemption                           | Current official terms replacing/resolving automated-redemption prohibition, affirmative permission, supported redemption endpoint, verified purchase-free method/minimum/KYC rules and safe idempotency; never a credential form |

Login/signup, checking bonus terms, actual claims, any gameplay, KYC and actual redemption remain manual. Missing permission cannot be replaced by browser automation, account observation or technical reachability.

## Setup and validation

With the Phase 3 database running, apply `pnpm db:migrate` and run `pnpm high5:init`. Initialization is repeatable and imports public reviewed research only; the real wallet starts UNKNOWN. `pnpm high5:sync` is the same explicit public research read as the UI button. No new npm dependency, worker, authenticated integration or platform is added.

Checks: `pnpm test`, `pnpm test:integration`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`, `pnpm db:smoke`, and both `pnpm test:http` and `pnpm test:http:high5` against a loopback production server. High 5 integration/HTTP tests use separately labelled temporary bookkeeping accounts under the existing platform, then remove them and their ledger data. Synthetic source-change tests restore original flags/evidence. They never open a real High 5 account or perform an external claim/play/redemption.

The existing Phase 0–3 test files and assertions are preserved. Final run results and actual sample limitations are recorded in the delivery report.

## Validation completed — 2026-10-09

- 169 unit tests passed (134 existing + 35 High 5 tests).
- 40 PostgreSQL integration tests passed (23 existing + 17 High 5 tests).
- Typecheck, ESLint with zero warnings, Prettier check and production build passed.
- Database smoke passed: five preserved fixtures, 50 fixture evidence records and no fabricated earnings.
- Existing HTTP smoke passed all 14 legacy route cases and research/claim/ledger/redemption/demo workflows. High 5 HTTP smoke passed both new routes, Today guidance and real manual forms, including receipt replay, funded-input rejection, play arithmetic/progress, STOP PLAYING and manual redemption.
- Temporary synthetic rows/evidence were removed and original review flags restored. Final audit: 20 real research offers, zero actual claims, zero real ledger events, zero High 5 account updates and zero temporary High 5 accounts. The user's balances and projections therefore remain UNKNOWN until actual observations are entered.
- Latest real public capture: five matching reviewed documents; games catalogue ACCESS_FAILED after the strict redirect guard rejected a different origin. No redirect bypass, authenticated request or real claim/play/redemption was attempted.

## Exact Phase 4 file inventory

- `src/domain/high5.ts`, `high5-adapter.ts`, `high5.test.ts`; modified `adapters.ts`, `operations.ts`, `eligibility.ts`.
- `src/db/high5-service.ts`, `high5.integration.test.ts`; modified `schema.ts`, `operations-service.ts`.
- `src/app/high5/actions.ts`, `forms.tsx`, `display.tsx`, `page.tsx`, `experiment/page.tsx`; modified `src/app/page.tsx`, `layout.tsx`, `operations/display.tsx`.
- `scripts/high5.ts`, `high5-public-fetch.py`, `high5-http-smoke.py`; modified `package.json`.
- `research/high5-public-review.json`.
- `drizzle/0006_new_tusk.sql`, `0007_empty_zaladane.sql`, their `meta/0006_snapshot.json`, `0007_snapshot.json`, and updated `meta/_journal.json`.
- This document, `HIGH5_EXPERIMENT.md`; updated `PRD.md`, `ARCHITECTURE.md`, `AUTOMATION_POLICY.md` and repository `README.md`.

The repository was already an uncommitted/untracked Phase 0–3 tree. Git status therefore cannot identify a conventional tracked Phase 4 diff; this inventory distinguishes the current phase's files.
