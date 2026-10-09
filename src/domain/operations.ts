import { z } from "zod";

export const engines = ["CASINO", "SPORTSBOOK"] as const;
export type Engine = (typeof engines)[number];
export const stages = [
  "DISCOVERY",
  "AVAILABILITY",
  "BALANCE",
  "CLAIM",
  "GAMEPLAY",
  "REDEMPTION",
] as const;
export type Stage = (typeof stages)[number];
export const actionTypes = [
  "CLAIM_REWARD",
  "CHECK_REWARD",
  "PLAY_PROMOTIONAL_BALANCE",
  "CHECK_PLAYTHROUGH",
  "REQUEST_REDEMPTION",
  "CHECK_REDEMPTION",
  "MANUAL_VERIFICATION",
  "MANUAL_CLAIM",
] as const;
export type ActionType = (typeof actionTypes)[number];
export type Policy = "PERMITTED" | "PROHIBITED" | "UNKNOWN";
export type ExecutionMode = "AUTOMATIC" | "MANUAL_REQUIRED" | "BLOCKED";
export const balanceCategories = [
  "PROMOTIONAL",
  "PLAYABLE",
  "REDEEMABLE",
  "REDEEMED",
] as const;
export type Category = (typeof balanceCategories)[number];
export const eventTypes = [
  "FREE_REWARD_RECEIVED",
  "PROMOTIONAL_ACTIVATED",
  "PROMOTIONAL_WAGER",
  "PROMOTIONAL_WIN",
  "PROMOTIONAL_LOSS",
  "PLAYTHROUGH_COMPLETED",
  "BECAME_REDEEMABLE",
  "REDEMPTION_REQUESTED",
  "REDEMPTION_COMPLETED",
  "EXPIRED",
  "ADJUSTMENT",
  "OBSERVATION_RECONCILIATION",
  "REDEMPTION_CANCELLED",
  "REDEMPTION_VALUE_RECORDED",
] as const;
export type EventType = (typeof eventTypes)[number];
export const moneyString = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/);
export function cents(amount: string): number {
  moneyString.parse(amount);
  const [whole, fraction = ""] = amount.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export function decimal(amount: number) {
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw new Error("Invalid amount.");
  return `${Math.floor(amount / 100)}.${String(amount % 100).padStart(2, "0")}`;
}
export const hardControls = Object.freeze({
  NEVER_DEPOSIT_USER_FUNDS: true,
  NEVER_PURCHASE_COINS: true,
  NEVER_CHASE_LOSSES: true,
});
export const fundingSchema = z
  .object({
    userCashContribution: moneyString,
    depositRequired: z.boolean(),
    purchaseRequired: z.boolean(),
    paidWagerRequired: z.boolean(),
    subscriptionRequired: z.boolean(),
    entryFeeRequired: z.boolean(),
    monetaryContributionRequired: z.boolean(),
    bankrollOrigin: z.enum([
      "FREE_PROMOTIONAL",
      "PURCHASED",
      "USER_CASH",
      "UNKNOWN",
    ]),
  })
  .strict();
export type Funding = z.infer<typeof fundingSchema>;
export const freeFunding: Funding = Object.freeze({
  userCashContribution: "0",
  depositRequired: false,
  purchaseRequired: false,
  paidWagerRequired: false,
  subscriptionRequired: false,
  entryFeeRequired: false,
  monetaryContributionRequired: false,
  bankrollOrigin: "FREE_PROMOTIONAL",
});
export function enforceZeroMoney(input: unknown): Funding {
  const f = fundingSchema.parse(input);
  if (
    cents(f.userCashContribution) !== 0 ||
    f.depositRequired ||
    f.purchaseRequired ||
    f.paidWagerRequired ||
    f.subscriptionRequired ||
    f.entryFeeRequired ||
    f.monetaryContributionRequired ||
    f.bankrollOrigin !== "FREE_PROMOTIONAL"
  )
    throw new Error("Zero-user-money guard rejected this operation.");
  return f;
}
export function actionStage(type: ActionType): Stage {
  if (["CLAIM_REWARD", "MANUAL_CLAIM"].includes(type)) return "CLAIM";
  if (type === "PLAY_PROMOTIONAL_BALANCE") return "GAMEPLAY";
  if (type === "REQUEST_REDEMPTION") return "REDEMPTION";
  return "DISCOVERY";
}
export type PolicyEvidence = {
  stage: Stage;
  decision: Policy;
  sourceType: "official" | "observation" | "simulation";
  sourceUrl: string | null;
  excerpt: string;
  verifiedAt: Date;
  expiresAt: Date | null;
};
export function effectivePolicy(
  rows: PolicyEvidence[],
  stage: Stage,
  demo: boolean,
  now = new Date(),
): Policy {
  const current = rows.filter(
    (r) =>
      r.stage === stage &&
      r.verifiedAt <= now &&
      now.getTime() - r.verifiedAt.getTime() <= 30 * 86400000 &&
      (!r.expiresAt || r.expiresAt > now) &&
      r.excerpt.trim() &&
      (demo
        ? r.sourceType === "simulation"
        : r.sourceType === "official" && r.sourceUrl?.startsWith("https://")),
  );
  const decisions = new Set(current.map((r) => r.decision));
  return decisions.size === 1 ? current[0].decision : "UNKNOWN";
}
export function executionPlan(input: {
  type: ActionType;
  engine: Engine;
  policy: Policy;
  funding: unknown;
  eligible: boolean;
  excluded: boolean;
  demo: boolean;
}) {
  enforceZeroMoney(input.funding);
  if (input.excluded || !input.eligible)
    return {
      mode: "BLOCKED" as ExecutionMode,
      reason:
        "Current eligible $0 opportunity required; excluded platforms remain blocked.",
    };
  if (
    input.type === "PLAY_PROMOTIONAL_BALANCE" &&
    input.engine === "SPORTSBOOK"
  )
    return {
      mode: "BLOCKED" as ExecutionMode,
      reason: "Sportsbook wager execution is outside Phase 3.",
    };
  if (input.type === "PLAY_PROMOTIONAL_BALANCE" && !input.demo)
    return {
      mode: "MANUAL_REQUIRED" as ExecutionMode,
      reason: "Real casino gameplay execution is outside Phase 3.",
    };
  return input.policy === "PERMITTED"
    ? {
        mode: "AUTOMATIC" as ExecutionMode,
        reason:
          "Current action-specific affirmative policy evidence; executor availability is checked separately.",
      }
    : {
        mode: "MANUAL_REQUIRED" as ExecutionMode,
        reason: `MANUAL_ACTION_REQUIRED: automation ${input.policy.toLowerCase()} for ${actionStage(input.type)}.`,
      };
}

export const controlsSchema = z
  .object({
    maxPromotionalLossPerSession: moneyString.default("1.00"),
    maxPromotionalWager: moneyString.default("0.10"),
    maxSessionDuration: z.number().int().min(1).max(60).default(15),
    stopWhenRedeemable: z.literal(true).default(true),
    stopAtPromotionalBalance: moneyString.default("0.10"),
    minimumExpectedValue: moneyString.nullable().default(null),
  })
  .strict();
export const defaultControls = controlsSchema.parse({});
export type RiskControls = z.infer<typeof controlsSchema>;
export type GameTerms = {
  game: string;
  eligible: boolean | null;
  contributionPercent: number | null;
  minimumWager: string | null;
  maximumWager: string | null;
  rtp: number | null;
  volatility: string | null;
  redemptionThreshold: string | null;
  playthroughRemaining: string | null;
  expectedRedeemableValue: string | null;
  sourceUrl: string | null;
  verifiedAt: Date | null;
};
export function strategyPlan(input: {
  engine: Engine;
  funding: unknown;
  controls: RiskControls;
  terms: GameTerms;
  playable: number;
  redeemable: number;
  requestedWager: number;
  sessionLoss: number;
  minutes: number;
  now?: Date;
}) {
  enforceZeroMoney(input.funding);
  const c = controlsSchema.parse(input.controls),
    t = input.terms;
  const now = input.now ?? new Date();
  if (input.engine !== "CASINO")
    return {
      status: "BLOCKED",
      reason: "Sportsbook betting is user-directed; no wager plan.",
    };
  if (input.redeemable > 0)
    return {
      status: "STOP_REDEEM",
      reason:
        "Redeemable value exists: stop playing and prioritize redemption.",
    };
  if (
    input.requestedWager <= 0 ||
    input.requestedWager > cents(c.maxPromotionalWager) ||
    input.requestedWager > input.playable ||
    input.playable - input.requestedWager < cents(c.stopAtPromotionalBalance) ||
    input.sessionLoss + input.requestedWager >
      cents(c.maxPromotionalLossPerSession) ||
    input.minutes >= c.maxSessionDuration
  )
    return {
      status: "BLOCKED",
      reason:
        "Promotional balance, maximum loss/wager, stop balance or duration control reached.",
    };
  if (
    t.eligible !== true ||
    t.contributionPercent === null ||
    t.contributionPercent <= 0 ||
    t.contributionPercent > 100 ||
    t.minimumWager === null ||
    t.maximumWager === null ||
    t.redemptionThreshold === null ||
    t.playthroughRemaining === null ||
    !t.sourceUrl?.startsWith("https://") ||
    !t.verifiedAt ||
    t.verifiedAt > now ||
    now.getTime() - t.verifiedAt.getTime() > 30 * 86400000 ||
    t.expectedRedeemableValue === null ||
    c.minimumExpectedValue === null
  )
    return {
      status: "MANUAL_VERIFICATION",
      reason:
        "Game eligibility, contribution, wagering/redemption terms and expected value require current evidence. No expected profit assumed.",
    };
  if (cents(t.playthroughRemaining) === 0)
    return {
      status: "STOP_REDEEM",
      reason:
        "No required wagering remains; inspect redemption before further play.",
    };
  if (
    input.requestedWager < cents(t.minimumWager) ||
    input.requestedWager > cents(t.maximumWager) ||
    cents(t.expectedRedeemableValue) < cents(c.minimumExpectedValue)
  )
    return {
      status: "BLOCKED",
      reason: "Game wager limits or minimum expected value not met.",
    };
  return {
    status: "PLAN_ONLY",
    reason:
      "Eligible free promotional plan; uncertain outcomes, no gameplay execution.",
  };
}

export type LedgerRecord = {
  id?: string;
  eventType: EventType;
  amount: string;
  category: Category;
  relatedEventId: string | null;
  actualCashAmount: string | null;
  cashCurrency: string | null;
  notes: string | null;
  sessionId: string | null;
  occurredAt: Date;
  direction?: "CREDIT" | "DEBIT";
};
export function bankroll(records: LedgerRecord[]) {
  const balances: Record<Category, number> = {
    PROMOTIONAL: 0,
    PLAYABLE: 0,
    REDEEMABLE: 0,
    REDEEMED: 0,
  };
  const pending = new Map<string, number>();
  const wagers = new Map<string, number>();
  let freeReceived = 0,
    wagered = 0,
    wins = 0,
    losses = 0,
    becameRedeemable = 0;
  const cash = new Map<string, number>();
  for (const e of records) {
    const n = cents(e.amount);
    switch (e.eventType) {
      case "FREE_REWARD_RECEIVED":
        balances.PROMOTIONAL += n;
        freeReceived += n;
        break;
      case "PROMOTIONAL_ACTIVATED":
        balances.PROMOTIONAL -= n;
        balances.PLAYABLE += n;
        break;
      case "PROMOTIONAL_WAGER":
        balances.PLAYABLE -= n;
        wagered += n;
        if (e.id) wagers.set(e.id, n);
        break;
      case "PROMOTIONAL_WIN":
        balances.PLAYABLE += n;
        wins += Math.max(0, n - (wagers.get(e.relatedEventId ?? "") ?? 0));
        losses += Math.max(0, (wagers.get(e.relatedEventId ?? "") ?? 0) - n);
        wagers.delete(e.relatedEventId ?? "");
        break;
      case "PROMOTIONAL_LOSS":
        losses += wagers.get(e.relatedEventId ?? "") ?? 0;
        wagers.delete(e.relatedEventId ?? "");
        break;
      case "BECAME_REDEEMABLE":
        balances[e.category] -= n;
        balances.REDEEMABLE += n;
        becameRedeemable += n;
        break;
      case "REDEMPTION_REQUESTED":
        if (e.id) pending.set(e.id, n);
        break;
      case "REDEMPTION_COMPLETED":
        balances.REDEEMABLE -= n;
        balances.REDEEMED += n;
        pending.delete(e.relatedEventId ?? "");
        if (e.actualCashAmount !== null && e.cashCurrency)
          cash.set(
            e.cashCurrency,
            (cash.get(e.cashCurrency) ?? 0) + cents(e.actualCashAmount),
          );
        break;
      case "EXPIRED":
      case "ADJUSTMENT":
        balances[e.category] -= n;
        break;
      case "PLAYTHROUGH_COMPLETED":
        break;
      case "OBSERVATION_RECONCILIATION":
        balances[e.category] += e.direction === "CREDIT" ? n : -n;
        break;
      case "REDEMPTION_CANCELLED":
        pending.delete(e.relatedEventId ?? "");
        break;
      case "REDEMPTION_VALUE_RECORDED":
        if (e.actualCashAmount !== null && e.cashCurrency)
          cash.set(
            e.cashCurrency,
            (cash.get(e.cashCurrency) ?? 0) + cents(e.actualCashAmount),
          );
        break;
    }
  }
  const reserved = [...pending.values()].reduce((a, b) => a + b, 0);
  return {
    balances,
    reserved,
    availableRedeemable: balances.REDEEMABLE - reserved,
    pending,
    wagers,
    freeReceived,
    wagered,
    wins,
    losses,
    becameRedeemable,
    cash,
    userCashContributed: 0,
    realizedReturn: null,
  };
}
export function validateLedgerEvent(
  records: LedgerRecord[],
  e: LedgerRecord,
  funding: unknown,
  engine: Engine,
  demo: boolean,
  manualObservation = false,
) {
  enforceZeroMoney(funding);
  const b = bankroll(records),
    n = cents(e.amount);
  const categories: Partial<Record<EventType, Category>> = {
    FREE_REWARD_RECEIVED: "PROMOTIONAL",
    PROMOTIONAL_ACTIVATED: "PLAYABLE",
    PROMOTIONAL_WAGER: "PLAYABLE",
    PROMOTIONAL_WIN: "PLAYABLE",
    PROMOTIONAL_LOSS: "PLAYABLE",
    REDEMPTION_REQUESTED: "REDEEMABLE",
    REDEMPTION_COMPLETED: "REDEEMED",
  };
  if (categories[e.eventType] && e.category !== categories[e.eventType])
    throw new Error("Wrong balance category for ledger event.");
  if (e.eventType === "PLAYTHROUGH_COMPLETED" && n !== 0)
    throw new Error("Playthrough marker must not create a balance.");
  if (!Number.isFinite(e.occurredAt.getTime()))
    throw new Error("Invalid ledger timestamp.");
  if (
    e.actualCashAmount !== null &&
    !["REDEMPTION_COMPLETED", "REDEMPTION_VALUE_RECORDED"].includes(e.eventType)
  )
    throw new Error("Actual cash belongs only to a completed redemption.");
  if (
    [
      "PROMOTIONAL_ACTIVATED",
      "BECAME_REDEEMABLE",
      "REDEMPTION_REQUESTED",
      "REDEMPTION_COMPLETED",
      "PROMOTIONAL_WAGER",
    ].includes(e.eventType) &&
    n === 0
  )
    throw new Error("Positive amount required.");
  if (
    ["PROMOTIONAL_WAGER", "PROMOTIONAL_WIN", "PROMOTIONAL_LOSS"].includes(
      e.eventType,
    ) &&
    ((!demo && !manualObservation) || engine !== "CASINO")
  )
    throw new Error("Gameplay event execution is simulation-only in Phase 3.");
  if (e.eventType === "PROMOTIONAL_ACTIVATED" && n > b.balances.PROMOTIONAL)
    throw new Error("Insufficient free promotional balance.");
  if (
    e.eventType === "PROMOTIONAL_WAGER" &&
    (n > b.balances.PLAYABLE || b.balances.REDEEMABLE > 0)
  )
    throw new Error(
      "Stop playing: insufficient playable funds or redeemable value exists.",
    );
  if (
    ["PROMOTIONAL_WIN", "PROMOTIONAL_LOSS"].includes(e.eventType) &&
    (!e.relatedEventId || !b.wagers.has(e.relatedEventId))
  )
    throw new Error(
      "Settlement requires an unsettled wager in this account and currency.",
    );
  if (e.eventType === "PROMOTIONAL_LOSS" && n !== 0)
    throw new Error(
      "Loss closes the already-debited wager; amount must be zero.",
    );
  if (
    e.eventType === "BECAME_REDEEMABLE" &&
    (!["PROMOTIONAL", "PLAYABLE"].includes(e.category) ||
      n > b.balances[e.category] ||
      b.wagers.size ||
      !e.notes?.trim())
  )
    throw new Error(
      "Confirmed redemption requirements, settled wagers and sufficient free balance required.",
    );
  if (
    e.eventType === "REDEMPTION_REQUESTED" &&
    (n > b.availableRedeemable || b.wagers.size)
  )
    throw new Error("Insufficient unreserved redeemable balance.");
  if (
    e.eventType === "REDEMPTION_COMPLETED" &&
    (!e.relatedEventId ||
      b.pending.get(e.relatedEventId) !== n ||
      (!manualObservation && e.actualCashAmount === null) ||
      (e.actualCashAmount !== null && !e.cashCurrency) ||
      !e.notes?.trim())
  )
    throw new Error(
      "Completion must match an open request and record actual proceeds with evidence.",
    );
  if (e.actualCashAmount !== null) cents(e.actualCashAmount);
  if (
    [
      "OBSERVATION_RECONCILIATION",
      "REDEMPTION_CANCELLED",
      "REDEMPTION_VALUE_RECORDED",
    ].includes(e.eventType) &&
    (!manualObservation || !e.notes?.trim())
  )
    throw new Error("An explicit manual observation is required.");
  if (
    e.eventType === "OBSERVATION_RECONCILIATION" &&
    (e.category === "REDEEMED" ||
      (e.direction !== "CREDIT" && e.direction !== "DEBIT") ||
      (e.direction === "DEBIT" &&
        (n > b.balances[e.category] ||
          (e.category === "REDEEMABLE" && n > b.availableRedeemable))))
  )
    throw new Error("Invalid observation reconciliation or reserved funds.");
  if (
    e.eventType === "REDEMPTION_CANCELLED" &&
    (!e.relatedEventId || b.pending.get(e.relatedEventId) !== n)
  )
    throw new Error("Cancellation must match an open request.");
  if (
    e.eventType === "REDEMPTION_VALUE_RECORDED" &&
    (n !== 0 ||
      e.actualCashAmount === null ||
      !e.cashCurrency ||
      !records.some(
        (r) =>
          r.id === e.relatedEventId &&
          r.eventType === "REDEMPTION_COMPLETED" &&
          r.actualCashAmount === null,
      ) ||
      records.some(
        (r) =>
          r.eventType === "REDEMPTION_VALUE_RECORDED" &&
          r.relatedEventId === e.relatedEventId,
      ))
  )
    throw new Error(
      "Value update requires one completed redemption with previously unknown proceeds.",
    );
  if (
    ["EXPIRED", "ADJUSTMENT"].includes(e.eventType) &&
    (e.category === "REDEEMED" ||
      n > b.balances[e.category] ||
      (e.category === "REDEEMABLE" && n > b.availableRedeemable) ||
      !e.notes?.trim())
  )
    throw new Error(
      "Only evidenced downward corrections of unreserved balances are supported.",
    );
  const next = bankroll([...records, e]);
  if (Object.values(next.balances).some((v) => v < 0))
    throw new Error("Negative category balance rejected.");
  return next;
}

export function comparableConversion(
  redeemed: number,
  received: number,
  comparable: boolean,
) {
  return comparable && received > 0 ? redeemed / received : null;
}
