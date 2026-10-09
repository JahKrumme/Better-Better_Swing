# Phase 2 implementation and validation

The existing Next.js/TypeScript/PostgreSQL/Drizzle architecture was extended, not replaced. All work is uncommitted for review. Phase 3 has not begun. The latest primary-source research findings are detailed in [PHASE_2_RESEARCH.md](PHASE_2_RESEARCH.md).

## Exact schema changes

`drizzle/0001_nervous_the_professor.sql` adds the Phase 2 schema and preserves/backfills Phase 1 data. `drizzle/0002_hesitant_fat_cobra.sql` expands source uniqueness to retain same-day facts/conflicts.

| Record                     | Added fields / changes                                                                                                                                                                                                                                                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Platform                   | `rulesUrl`, `kansasAvailability`, `minimumAge`, `freeSignupReward`, `recurringFreeReward`, `amoeAvailable`, `minimumRedemption`, `playthroughRequirement`, `identityVerificationRequired`, `researchNotes`, `lastVerifiedAt`, `researchState`                                                                                     |
| PlatformSource (new table) | `id`, `platformId` FK, `sourceUrl`, `sourceType`, `field`, `extractedText`, `normalizedValue`, `retrievedAt`, `outcome`, `notes`; unique platform/source/timestamp/field/coalesced fact identity                                                                                                                                  |
| Offer                      | `researchVersion`, `researchState`, `amoeAvailable`, `amoeMethod`, `amoeValuePerRequest`, `amoeRequestLimits`, `amoeFrequencyLimits`, `postageRequired`, `amoeOtherUserCost`, `entryFeeRequired`, `facePromotionalValue`, `estimatedRedeemableValue`, `valueMethod`, `valueEvidenceUrl`, `recurrenceTimezone`, `recurrenceAnchor` |
| OfferEvidence              | `normalizedValue`, `conflicting`, `supersededAt`                                                                                                                                                                                                                                                                                  |
| Claim                      | `periodKey`, `periodStart`, `opportunityEndsAt`, `claimState`, `estimatedRedeemableValue`, `actualRedeemedValue`; unique `(offerId, periodKey)` and nonnegative actual-cash check                                                                                                                                                 |
| Redemption                 | `claimId` optional FK to Claim for duplicate prevention                                                                                                                                                                                                                                                                           |
| Enums                      | Offer types add `amoe` and `giveaway`; new `research_state` has the six requested verification states; new `claim_state` has all seven manual states                                                                                                                                                                              |

No existing columns were removed. Fixture offers are backfilled to researchVersion 1; real offers default to version 2 with stricter evidence requirements. Face promotional values backfill from existing promotional amounts; no cash estimates were inferred. Legacy claims get distinct `legacy:<id>` period keys and compatible initial state mapping. Existing rows, source excerpts, and metadata are retained.

The evaluator remains centralized and returns canonical Phase 2 verification states alongside its legacy display status. Stored researchState is conservative metadata, not an override: UI results are computed from current evidence/profile. Primary evidence is required for acquisition, all monetary requirements (including entry fees), Kansas geography, age/identity, playthrough, redemption minimum, recurrence, and expiration when a date is specified. Conflicts and source/term contradictions remain uncertain. Fixture and third-party evidence cannot verify a real offer.

## Research and value findings

20 brand candidates were imported with actual blocked access receipts. Fliff is a separate permanent exclusion. Current legitimacy and legal/KS eligibility could not be established for any candidate. No real offers were invented or imported. All candidate automation policies are UNKNOWN; there are no verified permitted/prohibited policies. Zero established recurring opportunities means no supported daily/weekly/monthly earnings plan. Estimates remain unknown, and actual cash recorded is zero.

Postal AMOE requiring postage or other user cost is LOW_COST_AMOE / EXCLUDED_REQUIRES_MONEY. An online no-payment AMOE can qualify only with all required primary evidence. Promotional face value, documented estimated redeemable value, and actual cash remain distinct; user-entered received amounts are not automatically copied from advertised face value.

## UI and workflow changes

- Default research dashboard separates AVAILABLE NOW, DAILY / RECURRING, SIGNUP, NEEDS VERIFICATION, EXCLUDED, and AMOE.
- Real and fictional datasets have separate offer/platform views and totals.
- Cards expose verification state, promotional/estimated values, cadence, Kansas eligibility, playthrough, redemption minimum, manual status, verification date, claim period, and source passages under “Why is this considered free?”
- Platform registry displays qualification summaries, URLs, automation policy, and timestamped source/access observations; missing terms stay visibly unknown.
- Research forms add AMOE/entry-fee/value fields, platform qualification/policy fact review, multiple appended sources, typed primary offer-term updates, and evidence superseding with reasons.
- Manual claim-instance view and buttons record bookkeeping only. State transitions are validated. Claimed periods cannot be claimed twice, and claiming a recurring period inserts the next unclaimed instance atomically.
- Earnings keep promotional units separate from actual cash and avoid counting linked redemption records twice.

## Files changed or added in Phase 2

Changed: `README.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md`, `package.json`, `scripts/seed.ts`, `src/db/schema.ts`, `src/db/queries.ts`, `src/domain/eligibility.ts`, `src/domain/research.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/offer-card.tsx`, `src/app/offers/page.tsx`, `src/app/platforms/page.tsx`, `src/app/earnings/page.tsx`, `src/app/research/actions.ts`, `src/app/research/forms.tsx`, `src/app/research/page.tsx`. Next regenerated `next-env.d.ts` as part of normal startup/build.

Added: both Phase 2 migration SQL files and associated Drizzle metadata; `research/candidates.json`, `research/access-results.json`; `scripts/import-research.ts`, `scripts/http-smoke.py`; `src/domain/verification.ts`, `amoe.ts`, `value.ts`, `recurrence.ts`, `registry.ts`, `offer-filters.ts`, `offer-fact.ts`, `platform-fact.ts`, `earnings.ts`, `phase2.test.ts`; `src/db/claim-service.ts`, `src/db/phase2.integration.test.ts`; `src/app/claims/actions.ts`, `forms.tsx`, `page.tsx`; `src/app/research/evidence-actions.ts`, `evidence-forms.tsx`; `vitest.config.ts`, `vitest.integration.config.ts`; this report and `docs/PHASE_2_RESEARCH.md`.

The two original Phase 1 test files were retained unchanged. No dependency additions were needed; the existing lockfile remains valid.

## Tests and commands

- `pnpm db:generate`: generated additive migrations.
- `pnpm db:migrate`: applied both Phase 2 migrations and repeated successfully.
- `pnpm research:import`: imported 20 candidates plus Fliff exclusion and 20 blocked receipts; rerun preserved records without duplicates.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with zero warnings.
- `pnpm test`: **78 passed**, including all 35 original Phase 1 tests and 43 new Phase 2 tests.
- `pnpm test:integration`: **10 passed** against PostgreSQL. Covers registry/fixture separation, missing evidence, same-day facts, policy conflicts, concurrent claims, independent next-day instances, transitions, actual value separation, linked redemption duplication, and conflict history.
- `pnpm db:smoke`: passed; five fictional offers and 50 fixture passages remain, two free/three rejected under a synthetic adult profile, with no fabricated earnings left behind.
- `pnpm format:check`: passed.
- `pnpm build`: passed with overview, offers, platforms, research, earnings, and claims routes.
- `PROFILE_AGE=25 pnpm start` and `pnpm test:http`: local production smoke passed for nine page/filter views and live manual platform/offer entry, claim logging, duplicate rejection, next instance, conflicting evidence, superseding, typed term review, same-day platform facts, and online/postal AMOE. The age override was synthetic test setup only. All temporary records were deleted.
- `git diff --check`: passed. No commits or pushes made.

No assertions were weakened. Validation found and fixed transformed-default handling (unknown must stay null), decimal normalized-value comparison, same-day source uniqueness, and explicit received-amount bookkeeping. The existing lint compatibility pins are unchanged. No visual-browser or screen-reader audit was run.

## Remaining limitations

Official public-page access is the real research blocker; saved domain additions require environment-settings review/save to affect access. Redirect/help hosts remain unobserved. No claim of current platform legitimacy, legal availability, reward value, or automation policy is made without source content. Candidate names/websites are discovery leads rather than endorsements.

The user profile has unknown age by default. Source authenticity/interpretation is manually researched; matching an official domain alone does not prove a passage's accuracy. Short source excerpts are capped at 1,000 characters. Evidence freshness is 30 days. Conflicting active facts block verification until reviewed.

Chicago calendar-day/Monday-week tracking is a simple configurable model, not an inferred official reset policy. Nonstandard rolling windows/reset rules require additional modeling before reliable availability tracking. The recurrence anchor column is reserved for that work; no scheduler is implemented. Historical platform facts cannot yet be individually superseded through the UI (offer evidence can); conflicting platform facts remain uncertain until a later explicit review workflow or freshness expiry. Platform policy research does not enable external actions. No claim/account/login/wager automation, credential storage, authenticated collection, or Phase 3 monitoring was introduced.

The local application still has no authentication and binds to loopback. Database volumes need independent backups. All source changes remain uncommitted for review. Complete primary research before evaluating whether Phase 3 is worthwhile.

## Reusable environment configuration

The cloud draft now saves an updated `install_script` (including static `research:import`) and `start_skill` for the Phase 2 workflow. The complete installation script was executed successfully, preserving credentials and research rows. Twenty required public-site hostnames were added to the draft network allowlist without dropping package-manager presets. No secret values were saved. Draft persistence is confirmed; runtime network application, publication, and fresh-task restoration are not claimed. Review and save environment settings, then publish through the product. Resume primary research only after runtime access actually changes.

## Resumed primary-source research (October 8, 2026)

The static reviewed snapshot now imports 19 real offers across the original registry, plus short official facts and retrieval outcomes. Sixteen accessible candidates were investigated; four access-blocked candidates remain visibly uncertain. Existing eligibility logic and fixture data were retained. No migrations, dependencies, monitoring or platform actions were added. See PHASE_2_RESEARCH.md and PHASE_2_OPPORTUNITY_ANALYSIS.md for current findings; earlier blocked-only findings above describe the initial implementation, not the current data.

The additive importer validates source origins and short excerpts, uses stable identities, preserves later platform reviews and existing manual offer edits, and does not refresh research timestamps on replay. Functional smoke assertions now cover populated real research, exact excluded/uncertain sections and retained fixtures instead of assuming the real dataset is empty. Original unit assertions are unchanged; integration coverage adds replay/edit preservation.

Validation of the resumed dataset: migrations repeated successfully; 78 unit tests and 11 PostgreSQL integration tests passed; typecheck, lint, formatting and production build passed. The production HTTP smoke passed all nine page/filter views, populated/excluded/uncertain research sections and blocked-policy visibility, plus the existing synthetic bookkeeping workflow and cleanup. No real claims or redemptions were created. Database fixture smoke and whitespace checks passed.
