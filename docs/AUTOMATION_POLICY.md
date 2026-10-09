# Action-specific automation policy

Current consumer behavior and production local operations are documented in [Product completion](PRODUCT_COMPLETE.md) and [Local operations](LOCAL_OPERATIONS.md). Historical implementation sections below are retained for context.

Four independently reviewed scopes: DISCOVERY, CLAIM, GAMEPLAY, REDEMPTION. Checking reward/balance/playthrough/redemption status is passive DISCOVERY; actually claiming, playing or requesting a prize requires its corresponding scope. Permission in one scope never grants another. Adapters must also enable each individual capability, so a read endpoint does not enable a claim or play endpoint.

| Current platform | Discovery | Claim      | Gameplay   | Redemption |
| ---------------- | --------- | ---------- | ---------- | ---------- |
| High 5           | UNKNOWN   | UNKNOWN    | PROHIBITED | PROHIBITED |
| RealPrize        | UNKNOWN   | UNKNOWN    | PROHIBITED | UNKNOWN    |
| Stake.us         | UNKNOWN   | PROHIBITED | PROHIBITED | UNKNOWN    |

These scoped statements retain the Phase 2 source excerpts and original verification dates. They are not inferred from the platform-wide summary. Unreviewed scopes remain UNKNOWN; freshness/conflict evaluation can turn a stored decision UNKNOWN. The existing 20-platform summary remains separate and unchanged.

Only fresh (30 days), nonempty, reviewed official HTTPS evidence can support real permission. Observations and simulation permissions cannot. Future/expired timestamps and contradictory decisions fail closed. `executionPlan` requires affirmative permission for AUTOMATIC; otherwise MANUAL_REQUIRED, or BLOCKED for excluded/paid/out-of-scope actions. Zero-money checks always apply. `authorizeAutomatic` re-evaluates policy, eligibility, funds, availability and adapter capability at execution.

**Current automatic behavior:** local schedule evaluation, idempotent task creation, importing amounts already recorded by the user, ledger projections and the explicitly fictional demo executor. These do not operate a gaming platform. There is no background public monitoring.

**Current manual behavior:** real reward discovery/checks, account signup/login, claims, checking bonus-specific requirements, any gameplay outside this application, KYC and redemption. Local task completion is bookkeeping. A manual claim task is completed through the existing manual claim record, not by pressing a fake auto-claim button. Ledger transfers/redemption records require manual evidence and do not request external prizes.

No real adapters are registered, even for hypothetical permitted actions. Real gameplay remains planning-only; sportsbook wagers cannot enter execution plans. Never evade bot detection, imitate humans to conceal automation, bypass CAPTCHA, limits, geolocation, identity or platform security. No passwords, cookies or session tokens are requested/stored.

The adapter interface declares future discovery, reward checks, promotional/redeemable balance reads, claims, promotional play and redemption. Method existence is never permission. A first real adapter requires action-specific official authorization, exact interface/terms review, execution-time revalidation and tests. An official interface only supports the capabilities it expressly exposes.

## Phase 4 — registered manual High 5 adapter

The earlier “no real adapters” statement describes Phase 3. High5Adapter is now registered, with discovery, reward checks, promotional/redeemable balance reads, claims and redemption all SUPPORTED_MANUAL. Gameplay execution is UNAVAILABLE. Every automatic flag remains false; unsupported automatic calls fail closed even if a hypothetical policy record says PERMITTED. Official rules/terms currently prohibit automated/systematic gameplay and redemption. Discovery/claims have no affirmative authorization.

The explicit public-sync button/CLI reads six fixed official public HTTPS documents without authentication or retries. It is a user-triggered research workflow, not unattended monitoring or permission to access account data. Fresh matching primary snapshots may refresh prohibition evidence, never grant permission. Material changes require curator re-verification; unknown/failed/stale sources cannot enable external actions. Manual observations remain USER_OBSERVATION.

All login/signup, inbox/balance checks, claims, bonus/game verification, gameplay, KYC and actual redemption remain outside automation. Local observation saving, ledger reconciliation, task generation and metric calculation are internal bookkeeping. The exact official authorization/interface requirements for each manual capability are listed in [PHASE_4_HIGH5.md](PHASE_4_HIGH5.md). No browser concealment, CAPTCHA/bot/security/geo/KYC circumvention, deposits, coin purchases or user-funded bankroll are supported.

## Current consumer execution policy

Every automatic capability requires its own current affirmative official permission and a supported implementation. Discovery permission cannot authorize private availability/balance reads. All current real integrations remain MANUAL; the runtime performs local checks. Mock authorized branches exist only in tests. No real automatic wager or redemption interface is implemented. GET MY FREE MONEY cannot override UNKNOWN/PROHIBITED/unsupported capabilities. Explicit public research is bounded, unauthenticated and does not bypass blocked sources. The persisted local attention queue sends no OS notifications. See PRODUCT_COMPLETE.md and LOCAL_OPERATIONS.md.
