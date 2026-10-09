# High 5 free-only experiment

Determine whether manually collecting free High 5 rewards, with user cash contribution exactly $0, produces meaningful actual redeemable value. The app cannot answer this until the user records observations; public reward advertisements and the earlier 3.00 SC account observation are not receipts or performance data.

## Daily use

1. Open Today; follow CHECK REWARD when the expected check is due. Check High 5 manually.
2. Enter current free SC/playable/redeemable amounts if shown. Leave unknown fields blank. Choose the actual reward outcome and claimed status, entering only known exact GC/SC received. Confirm the free-only attestation and save.
3. Enter any operator-shown playthrough/minimum details. Unknown game terms result in INSUFFICIENT VERIFIED GAME DATA; do not interpret it as a play recommendation.
4. If you independently perform free-only play, record the game, start, wager, result, end and known contribution. No purchased funds belong in this experiment.
5. If High 5 confirms redeemability, STOP PLAYING. Manually verify the redemption method/minimum and complete any operator requirements, then record the request/result and actual proceeds.

The four-hour cadence is an observed reminder, not proof of reward availability, SC currency or an amount. The observed schedule expires rather than permanently establishing a platform promise. A user-entered next reward time takes precedence in Today guidance.

## What is measured

Start is the earliest dated actual account observation or compatible legacy manual claim, not source import/setup. Legacy manual claims contribute actual receipt totals without duplicating linked reward instances; unknown claim dates block projections. Distinct days use America/Chicago; elapsed days count complete 24-hour periods since the earliest dated observation. The tracker counts recorded reward checks, claimed reward instances, known signup/recurring/other SC received, actual recorded SC wagers, wins/losses, pending/redeemed SC, actual recorded USD/prize value and manual effort. GC is excluded from cash and SC totals.

Confirmed redeemable SC increases are measured only between two known reported balances. An initial or previously unknown balance is not assumed to start at zero. Redemptions reduce holdings; their proceeds are separately recorded. This metric is a conservative known-to-known observed increase, not independently verified causal generation or a second earnings total. Unexplained balance reconciliation never counts as reward/win/loss.

The user may omit quantities. Known receipt/proceeds subtotals are shown alongside unknown counts rather than falsely reporting a complete total. Imported nonzero user cash or a non-free origin triggers CRITICAL INTEGRITY ERROR and withholds experiment metrics. The database and service reject user-funded writes; this guard also handles inconsistent imported rows.

## Minimum sample and projections

SC average/day/week and monthly projection require **at least 7 elapsed days and 7 distinct days with actual observations**, with no unknown relevant claimed SC amounts. One old observation plus a week of waiting does not qualify. Daily/weekly observed SC averages include actually received signup SC; the 30-day recurring SC projection excludes signup and other one-time rewards.

Redeemed-value/day and value/manual minute additionally require a completed redemption and known actual proceeds for all completed redemptions. A monthly USD/prize-value projection is withheld if signup SC is present: the current model cannot attribute redemption proceeds between one-time and recurring rewards, so it does not repeat signup value as monthly cash. With a sample of recurring-only receipts and known redemptions it projects the observed rate over 30 days. Value/minute also requires positive recorded effort.

Every projection is conditional on observed reward availability, continued eligibility, unchanged operator requirements and similar future outcomes. It is not guaranteed profit, an RTP-to-cash calculation, or a reason to play when redemption is available. Missing days/effort, selective observation, manual transcription, changing offers and a small sample can bias the result.

## Current experiment result

No current Phase 4 account observations, real receipts, wagers or redemptions were invented during implementation. The real account starts with UNKNOWN balances and no eligible projection. Temporary synthetic integration and HTTP records are removed. The earlier user report of 3.00 SC remains historical USER_OBSERVATION and does not establish today's holdings.

See [PHASE_4_HIGH5.md](PHASE_4_HIGH5.md) for official-source findings, adapter permissions, exact manual actions, automation prerequisites, replay safeguards and validation commands.
