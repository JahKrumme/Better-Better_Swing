# Free Money Finder — current Phase 3 product direction

Current consumer behavior and production local operations are documented in [Product completion](PRODUCT_COMPLETE.md) and [Local operations](LOCAL_OPERATIONS.md). Historical implementation sections below are retained for context.

A personal Kansas/US application with two engines sharing evidence, a strict $0 guard and local operational bookkeeping. Preserve all Phase 0–2B records. Fliff is permanently excluded. User cash contributed must remain exactly zero; never purchase, deposit, subscribe, pay an entry fee or replenish a loss.

## Engine A — sweepstakes casino free value

Discover a genuinely free reward, manually claim unless separately authorized, record actual free promotional units, determine bonus/game/redemption requirements, plan eligible promotional play, track results, stop at controls and prioritize redemption as soon as possible. Objective: maximize expected redeemable value from free promotional funds subject to $0 cash contribution. Outcomes and expected values remain uncertain; casino play is never guaranteed profit. Phase 3 gameplay execution is simulation-only.

## Engine B — sportsbook free bets

Discover, verify $0 acquisition and user eligibility, generate manual claim tasks unless affirmative action-specific automation/API authorization exists, record received free bets and present the balance to the user. Exclude all deposit matches, paid qualifying bets, subscriptions and entries. No sportsbook wager execution. The user decides how to use free credits.

## Phase 3 requirements and boundaries

Provide Today, separate engine views, a category/provenance ledger, action queue, freshness-aware recurrence (including four-hour checks), conservative strategy planning, redemption-first controls, compatible-unit analytics and a complete isolated demo. Promotional/playable/redeemable/redeemed funds remain separate by account and currency. Current official policy is reviewed separately for discovery, claims, gameplay and redemption; UNKNOWN is never permission. Execution additionally needs an enabled supported capability and execution-time checks. No real executor is implemented.

Record the user-reported High 5 3.00 SC and four-hour inbox display separately from primary evidence. Do not infer per-interval currency, amount, permanent recurrence or monthly value. Published High 5/RealPrize verified programs remain preserved; the High 5 advertised 55 SC and reported actual 3 SC describe different evidence and are not forced into a guaranteed actual grant.

No account creation, passwords/sessions, security bypass or real automated gameplay/claiming/redemption. Local-only service; manual platform interactions stay with the user. See [Phase 3](PHASE_3.md), [architecture](ARCHITECTURE.md), [bankroll](PROMOTIONAL_BANKROLL.md) and [policy](AUTOMATION_POLICY.md) for implementation, limitations and integration prerequisites.

## Preserved historical Phase 0–2 requirements

The following records the earlier phases and roadmap. Current Phase 3 scope above supersedes historical statements that scheduling/tracking were future work or Phase 3 had not begun.

# Free Money Finder — Phase 0/1

A personal research application for a United States user in Kansas to identify legitimate promotional rewards requiring no deposit, purchase, paid wager, subscription, or monetary contribution. Refundable deposits also fail. Free promotional credit that requires playthrough can qualify, but credit is never represented as cash.

Included categories: sportsbooks, prediction platforms, sweepstakes casinos, and related redeemable gaming rewards. Include free signup, daily, weekly, and limited-time rewards. Exclude paid qualifying offers and Fliff permanently. Fixtures are fictional and must be labeled throughout the UI.

## Integrity and safety

Prefer false negatives. Unknown requirements, geography, age eligibility, or unsupported determinations produce Needs Verification. Verified Free requires current official evidence for each qualifying determination. Explicit geographic restrictions and expiry reject eligibility. No automatic claims, wagering, account creation, browser/login automation, CAPTCHA bypass, geographic circumvention, or credentials/cookies storage. Automation policy is research metadata only, never permission to execute an action in this phase.

## Requirements

Provide overview totals, offer filters, platform registry, earnings with distinct promotional/estimated/cash amounts, and internal manual research entry. Store structured terms and timestamped evidence. Use a configurable local profile with Kansas/US defaults and unknown age until configured. Store account metadata only. Manual claims and redemptions have schema support; advanced tracking workflows remain future work. No real platform scraping or invented live promotions.

## Success criteria

All required-money cases rejected; uncertain terms never Verified Free; Fliff always excluded; fictional offers visibly identified; migrations, typecheck, lint, tests, production build, and functional local requests succeed. No secrets committed.

## Future phases

2. Real registry and manually verified real offers.
3. Public promotion monitoring.
4. Terms extraction and change detection.
5. Scheduling, notifications, calendar.
6. Personal claim tracking and redemption analytics.
7. Explicitly permitted automatic claiming.
8. Promotional-credit optimization recommendations.
9. Official authorized API wagering only.

Each phase requires its own implementation and review. Phase 1 does not execute external actions.

## Phase 2 addition

Real research is separated from fixtures. Candidate registration is not qualification. Require primary evidence for acquisition, Kansas eligibility, age/identity, monetary requirements including entry fees, playthrough, redemption minimum, and recurrence. Use VERIFIED_FREE, NEEDS_VERIFICATION, EXCLUDED_REQUIRES_MONEY, EXCLUDED_GEOGRAPHY, EXCLUDED_PLATFORM, and EXPIRED. Conflicting terms remain uncertain.

AMOE records include method, reward per valid request, request/frequency limits, postage, and other user costs. Postal/user-paid AMOE is LOW_COST_AMOE and never literally $0. Online payment-free AMOE may qualify with current primary proof.

Manual claim instances track UNCLAIMED, READY_TO_CLAIM, CLAIMED, PLAYTHROUGH_REQUIRED, REDEEMABLE, REDEEMED, and EXPIRED. Recording a claim is personal bookkeeping, never an external platform action. Recurring periods are independent; no background scheduler is introduced. Actual received promotional value is entered explicitly, rather than assumed from advertised value. Unknown received amounts and estimates remain unknown.

Phase 2 succeeds as research infrastructure when source access is unavailable, but real qualifying opportunities cannot be claimed until primary research is complete. See PHASE_2_RESEARCH.md for actual findings and blockers. Phase 3 has not begun.

## Phase 4 — High 5 only

High 5 is the first registered real adapter, with six manual capabilities and unavailable gameplay execution. Today and `/high5` provide manual free-only account observations, variable-currency four-hour reward checks, play/result recording, operator-confirmed redeemability and redemption-first tasks. `/high5/experiment` reports actual observations, separate GC/SC/actual proceeds and conservative projections after seven elapsed and observed days. Public-source sync is an explicit bounded official read; changed critical facts block affected offers until deliberate primary-source re-verification. No new platform, external login/claim/play/redemption executor or Phase 5 work is included. Details: [PHASE_4_HIGH5.md](PHASE_4_HIGH5.md), [HIGH5_EXPERIMENT.md](HIGH5_EXPERIMENT.md).

## Consumer completion

The primary experience is Home with separate issuer/currency balances, Needs you, official buttons and minimal free-only account updates. Navigation is Home, Casinos, Sportsbooks, History and Advanced. Redemption takes precedence over play. No verified $0 sportsbook credits currently exist. See PRODUCT_COMPLETE.md for the completed workflow and LOCAL_OPERATIONS.md for normal production local use.
