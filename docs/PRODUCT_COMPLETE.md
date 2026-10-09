# Free Money Finder product completion

The consumer workflow is Home → official platform → Quick update → redemption when available. Navigation is HOME / CASINOS / SPORTSBOOKS / HISTORY / ADVANCED. Existing research, evidence, ledger, controls, experiments, claims and fictional simulation remain available under Advanced; their historical routes still work.

## Dashboard and accounting

Home has one GET MY FREE MONEY action; separate free promotional, redeemable and actually redeemed summaries; the $0 contribution invariant; a short Needs you list; casino cards; a distinct sportsbook section; local runner status; and recorded progress. Currency and issuer remain separate. SC and GC are not cash. Free promotional balances include still-held redeemable promotional currency; the redeemable summary is its available subset, excluding pending reservations. Actual redeemed value uses confirmed cash/prize receipts only. Unknown account balances stay unknown. Research quantities and old user observations never become current balances automatically.

Cards show a recorded balance, known redeemable amount, free-reward status, next-check reminder, expiry when known, actual integration mode and an official HTTPS button. Redeemable value puts REDEEM NOW first and says STOP PLAYING. Details, quick updates and already-performed manual play/redemption recording are available on the account page. There is no new game recommendation based on an assumed RTP, EV or playthrough contribution.

## Actual platform coverage

For the known US/Kansas user aged at least 21, current eligible platforms are **High 5 Casino** and **RealPrize**. Four current reviewed free offers: High 5 daily login (amount unknown), High 5 signup (published 55 SC), RealPrize daily login (amount unknown), RealPrize signup (amount unknown). These are offer facts, not received balances. The historical 3 SC High 5 observation is not a current account balance. Its observed four-hour inbox reminder stays uncertain in currency/amount and is separate from the official daily reward.

The 20-candidate registry remains intact. Unresolved Kansas, redemption, balance-threshold, geography, primary-access and promotional-term questions keep other candidates in research. Purchase/deposit/paid-wager/paid-postage offers stay excluded. Fliff stays excluded. No verified genuinely $0 sportsbook credit is currently available. Public refresh captures retain their actual outcomes; blocked or redirected pages are not bypassed and do not grant eligibility.

## Automation and manual workflow

Current cards say MANUAL. Account checks, balances, claiming, gameplay and redemption need the user because no supported authorized private interfaces were established. The periodic runner performs local evaluation, not private platform actions. The shared capability engine requires affirmative, fresh, independent permission and a supported implementation. Tests use synthetic permitted integrations to prove the automatic branch, actual-receipt validation, failed storage, deduplication and manual fallback. No real automatic interface was fabricated.

A quick update starts with promotional balance, optional redeemable amount, claimed yes/no/unknown and actual received amount if yes (unknown permitted). Additional GC, playable currency, playthrough, reward occasion, check time, effort and notes stay behind More details. One free-only attestation is mandatory. A changed balance without an explicit actual receipt is a correction, never a fabricated reward or profit. Submission keys and reward windows prevent replay/double recording. High 5 retains its established bonus/instance rules; generic casino snapshots and redemptions reuse the same ledger arithmetic and controls. Known legacy receipt keys bridge old claim records without counting them twice.

Manual play records what already happened. It checks exact balance arithmetic and settlement linkage; unknown contribution remains unknown. Redeemable holdings block play. Redemption requests reserve promotional currency; cancellation/failure releases it without cash. Completion removes the reservation and separately records actual USD/prize proceeds or unknown. A previously unknown actual value can be filled once; a finalized request cannot reopen or change its reserved amount. GC never enters cash/redemption accounting. Sportsbook wagering has no automatic executor.

History uses human descriptions of checks, receipts, balance corrections, manual results and redemptions. Analytics show confirmed received promotional quantities, currently redeemable amounts, actual redemption receipts, recorded minutes and actual redeemed value per recorded hour when data exists. They do not calculate ROI using a zero denominator, infer monthly returns or price promotional currency as cash.

## Persistence and local use

See [Local operations](LOCAL_OPERATIONS.md). The production supervisor safely starts required services and preserves database volumes. The runner stores last/next run and heartbeat, uses concurrency locks and drains on shutdown. Sleeping/stopping the machine means no checks run. The attention model persists FREE_MONEY_READY, ACTION_NEEDED, REDEEM_NOW, EXPIRING_SOON, CHECK_FAILED and INTEGRATION_NEEDS_ATTENTION statuses for future notification delivery; no OS push is implemented or claimed.

Additive migrations introduce consumer snapshots/redemptions, checks, heartbeat, attention, public captures and eligibility settings. Initial unknown-age setup can confirm a minimum age and state without editing database records. Demo data stays exclusively behind Advanced and outside consumer totals. All local credentials, process state, logs and build artifacts remain ignored. No platform credentials are stored and no external analytics are added.

## Verification record

Completed on 2026-10-09:

- 190 unit tests, including independent permission/freshness checks, automatic mock receipt confirmation, failed storage, deduplication, issuer/currency separation and material-change eligibility gates.
- 53 database integration tests, including the preserved Phase 2/operations/High 5 cases and 13 consumer bookkeeping/check cases.
- TypeScript, ESLint, Prettier, diff whitespace checks and production builds passed.
- Database smoke passed; 14 preserved legacy HTTP routes and research/claim/ledger/full-demo actions passed; High 5 HTTP observations/play/redemption checks passed.
- A uniquely named clean PostgreSQL project completed the full production initialization, unknown-age first-run confirmation, Home/High 5/RealPrize/category separation/Advanced checks, GET MY FREE MONEY, corrections and actual receipts, receipt-key replay, legacy receipt bridge plus local re-check, free-only rejection, failed-integrity attention without rewriting balances, redemption-first/manual-play blocking, actual redemption/history, graceful OFF, restart persistence and occupied app/database port checks.
- Disposable verification projects were stopped and removed by exact project identity. Existing application data was not reset. All activity records in tests were synthetic; no real external claim, wager, purchase, deposit or redemption occurred.
- Explicit public research reviewed all 20 candidates through 31 fixed official-source reads: 3 readable, 28 blocked/inaccessible/unsupported documents. Eligibility facts were not renewed from reachability. A separate High 5 critical-source sync reported six source outcomes and no critical baseline changes. No other candidate gained sufficient verified free evidence.
- A scan of all 154 tracked-or-unignored candidate files found no local secrets, private keys, tokens, env files or generated artifacts eligible for inclusion. The working tree is intentionally dirty and no commit or push was made.

All new observations used by verification were synthetic and confined to disposable local databases. Product-completion changes remain uncommitted for review.

## Changed files

Consumer screens, shared services/domain rules, additive migrations, local startup/runner/research tools, smoke tests and documentation:

```text
.env.example
.gitignore
README.md
compose.yaml
docs/ARCHITECTURE.md
docs/AUTOMATION_POLICY.md
docs/LOCAL_OPERATIONS.md
docs/PRD.md
docs/PRODUCT_COMPLETE.md
drizzle/0008_concerned_revanche.sql
drizzle/0009_furry_grandmaster.sql
drizzle/0010_square_dragon_man.sql
drizzle/meta/0008_snapshot.json
drizzle/meta/0009_snapshot.json
drizzle/meta/0010_snapshot.json
drizzle/meta/_journal.json
package.json
research/product-public-captures.json
scripts/app-local.mjs
scripts/consumer-http-smoke.py
scripts/high5-http-smoke.py
scripts/http-smoke.py
scripts/import-public-captures.ts
scripts/init-product.ts
scripts/local-startup-smoke.mjs
scripts/operations-runner.ts
scripts/public-research-fetch.py
src/app/accounts/[slug]/page.tsx
src/app/advanced/casinos/page.tsx
src/app/advanced/page.tsx
src/app/advanced/sportsbook/page.tsx
src/app/advanced/today/page.tsx
src/app/api/health/route.ts
src/app/casinos/page.tsx
src/app/error.tsx
src/app/globals.css
src/app/history/page.tsx
src/app/layout.tsx
src/app/loading.tsx
src/app/page.tsx
src/app/product/actions.ts
src/app/product/display.tsx
src/app/product/forms.tsx
src/app/sportsbook/page.tsx
src/db/operations-service.ts
src/db/product-service.ts
src/db/product.integration.test.ts
src/db/queries.ts
src/db/schema.ts
src/domain/adapters.ts
src/domain/eligibility.test.ts
src/domain/eligibility.ts
src/domain/operations.ts
src/domain/product.test.ts
src/domain/product.ts
src/domain/realprize-adapter.ts
```
