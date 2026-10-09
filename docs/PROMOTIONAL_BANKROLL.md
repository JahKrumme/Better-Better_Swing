# Promotional bankroll ledger

Invariant: **USER_CASH_CONTRIBUTED = $0**. The only accepted origin is FREE_PROMOTIONAL. Purchased currency, deposits, subscriptions, user-paid wagers/entries and unknown acquisition costs never enter a plan. `enforceZeroMoney` runs below the UI and SQL provides a second funding barrier.

Accounts are bookkeeping identities linked to a platform and CASINO/SPORTSBOOK engine, with an explicit demo flag. They contain no platform login information. Account/currency/demo scopes never merge; a USD-labelled free bet is still a promotional credit, not actual cash.

Events retain platform through account, currency, amount, timestamp, source offer, claim instance, category, notes, related event, session, zero contribution and free origin. `sequence` provides stable commit-order replay. Monetary values are decimal strings calculated as integer cents. Events are append-only through application services; corrections are new records. No generic update/delete endpoint exists. Database owners can still administer their database.

| Event                 | Effect                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| FREE_REWARD_RECEIVED  | Credit PROMOTIONAL; real receipt must match a recorded claim and explicitly received amount                        |
| PROMOTIONAL_ACTIVATED | Transfer PROMOTIONAL → PLAYABLE after manual requirements review                                                   |
| PROMOTIONAL_WAGER     | Debit PLAYABLE; open a uniquely linked wager (casino simulation only)                                              |
| PROMOTIONAL_WIN       | Settle open wager; credit gross payout to PLAYABLE; analytics calculate net profit/loss against stake              |
| PROMOTIONAL_LOSS      | Close already-debited wager with zero payout; no second debit                                                      |
| PLAYTHROUGH_COMPLETED | Zero-amount marker; never creates a balance                                                                        |
| BECAME_REDEEMABLE     | Transfer confirmed PROMOTIONAL/PLAYABLE units → REDEEMABLE; requires notes and no unsettled wagers                 |
| REDEMPTION_REQUESTED  | Reserve REDEEMABLE units; total balance stays visible, available amount decreases                                  |
| REDEMPTION_COMPLETED  | Match one full open request; transfer REDEEMABLE → REDEEMED; separately record actual USD/prize value and evidence |
| EXPIRED / ADJUSTMENT  | Evidenced downward correction of an unreserved, non-redeemed category                                              |

All categories remain mutually exclusive. Transfers conserve funds; only sourced free receipts and settled simulated wins increase free bankroll. No overdraft, cross-account/currency wager settlement, duplicate settlement, double redemption or unsupported cash credit. Partial request completion/cancellation and positive corrections are not implemented; they need explicit models before integration.

Idempotency keys identify claim imports and form submissions. Per-account row locks serialize writers; duplicates return the existing event and different reuse fails. Ledger projections use insertion sequence even when an actual receipt's reported timestamp is earlier. Observational snapshots and advertised amounts never create receipt events.

Redeemable value triggers STOP PLAYING. No operation stakes REDEEMABLE/REDEEMED. Hard controls cannot be turned off: never deposit, purchase or chase losses. Defaults and planning limits are described in [Phase 3](PHASE_3.md). Real casino gameplay is not executed or journaled as wagers in this phase; manual evidenced downward corrections reconcile losses without fabricating wager-level analytics.

Statistics are per account/currency: total free receipts, promotional stakes, net wins/losses, became-redeemable units, redeemed units and separately actual USD/prize proceeds. Promo conversion is redeemed units / free units received when comparable; unknown or zero denominators are not a rate. Actual cash is not inferred from coin units. Realized return divided by user cash is undefined at zero; display total contributed $0 and actual recorded proceeds instead.

Existing Phase 2 Earnings stays available without being added to ledger totals. Known active claim amounts can import once; terminal/redeemable legacy claims require reconciliation instead of inventing a current balance. Ledger balances represent recorded history, not automatically synchronized operator wallets. Demo projections and simulated proceeds are completely excluded from real totals.
