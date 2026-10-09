import { z } from "zod";
import {
  bankroll,
  cents,
  decimal,
  moneyString,
  type LedgerRecord,
  type Category,
  type RiskControls,
  strategyPlan,
  defaultControls,
  freeFunding,
} from "./operations";
export const rewardKinds = [
  "UNKNOWN",
  "NO_REWARD",
  "GC_ONLY",
  "SC_ONLY",
  "GC_AND_SC",
  "OTHER",
] as const;
export const nullableMoney = moneyString.nullable();
export const high5UpdateSchema = z
  .object({
    submissionKey: z.uuid(),
    accountId: z.uuid(),
    checkedReward: z.boolean(),
    rewardKind: z.enum(rewardKinds),
    legacyOfferId: z.uuid().nullable().default(null),
    rewardClaimed: z.enum(["UNKNOWN", "YES", "NO"]),
    rewardScope: z.enum(["SIGNUP", "RECURRING", "OTHER"]),
    rewardSC: nullableMoney,
    rewardGC: nullableMoney,
    otherReward: z.string().max(100).nullable(),
    gc: nullableMoney,
    sc: nullableMoney,
    playableSC: nullableMoney,
    redeemableSC: nullableMoney,
    playthroughRequired: nullableMoney,
    playthroughPlayed: nullableMoney,
    playthroughRemaining: nullableMoney,
    redemptionMinimum: nullableMoney,
    nextRewardAt: z.date().nullable(),
    minutes: z.number().min(0).max(240),
    freeOnly: z.literal(true),
    notes: z.string().max(500).nullable(),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      v.sc !== null &&
      cents(v.playableSC ?? "0") + cents(v.redeemableSC ?? "0") > cents(v.sc)
    )
      c.addIssue({
        code: "custom",
        message: "Playable plus redeemable SC cannot exceed total SC.",
      });
    if (
      v.rewardKind === "NO_REWARD" &&
      (v.rewardClaimed === "YES" || v.rewardSC !== null || v.rewardGC !== null)
    )
      c.addIssue({
        code: "custom",
        message: "No reward cannot contain a claimed grant.",
      });
    if (v.rewardSC !== null && !["SC_ONLY", "GC_AND_SC"].includes(v.rewardKind))
      c.addIssue({
        code: "custom",
        message: "Choose an SC reward outcome before recording SC.",
      });
    if (v.rewardGC !== null && !["GC_ONLY", "GC_AND_SC"].includes(v.rewardKind))
      c.addIssue({
        code: "custom",
        message: "Choose a GC reward outcome before recording GC.",
      });
    if (
      v.playthroughRequired !== null &&
      v.playthroughPlayed !== null &&
      v.playthroughRemaining !== null &&
      Math.max(0, cents(v.playthroughRequired) - cents(v.playthroughPlayed)) !==
        cents(v.playthroughRemaining)
    )
      c.addIssue({
        code: "custom",
        message: "Reported playthrough quantities are inconsistent.",
      });
  });
export type High5Update = z.infer<typeof high5UpdateSchema>;
export type ObservedLedger = LedgerRecord & { currency: string };
export function reconciliationTargets(
  records: ObservedLedger[],
  u: High5Update,
) {
  const b = bankroll(records.filter((e) => e.currency === "SC"));
  const targets: Partial<Record<Category, number>> = {};
  if (u.sc !== null) {
    const total = cents(u.sc);
    const played = cents(u.playableSC ?? "0"),
      redeem = u.redeemableSC === null ? b.reserved : cents(u.redeemableSC);
    if (played + redeem > total)
      throw new Error(
        "Balance is below reported allocations/pending redemption; reconcile the request first.",
      );
    targets.PROMOTIONAL = total - played - redeem;
    targets.PLAYABLE = played;
    targets.REDEEMABLE = redeem;
  } else if (u.playableSC !== null || u.redeemableSC !== null) {
    const play =
        u.playableSC === null ? b.balances.PLAYABLE : cents(u.playableSC),
      redeem =
        u.redeemableSC === null ? b.balances.REDEEMABLE : cents(u.redeemableSC);
    const previous =
      b.balances.PROMOTIONAL + b.balances.PLAYABLE + b.balances.REDEEMABLE;
    targets.PROMOTIONAL = Math.max(0, previous - play - redeem);
    targets.PLAYABLE = play;
    targets.REDEEMABLE = redeem;
  }
  if (targets.REDEEMABLE !== undefined && targets.REDEEMABLE < b.reserved)
    throw new Error(
      "Pending redeemable SC is reserved; record redemption before reconciling it away.",
    );
  return { sc: targets, gc: u.gc === null ? null : cents(u.gc) };
}
export function reconciliationEvents(
  current: ReturnType<typeof bankroll>["balances"],
  target: Partial<Record<Category, number>>,
) {
  return Object.entries(target)
    .map(([category, n]) => ({
      category: category as Category,
      delta: n! - current[category as Category],
    }))
    .filter((x) => x.delta !== 0)
    .sort((a, b) => a.delta - b.delta)
    .map((x) => ({
      eventType: "OBSERVATION_RECONCILIATION" as const,
      category: x.category,
      amount: decimal(Math.abs(x.delta)),
      direction: x.delta > 0 ? ("CREDIT" as const) : ("DEBIT" as const),
    }));
}
export const manualPlaySchema = z
  .object({
    submissionKey: z.uuid(),
    accountId: z.uuid(),
    game: z.string().trim().min(1).max(100),
    start: moneyString,
    wager: moneyString,
    result: z.enum(["WIN", "LOSS", "PUSH"]),
    end: moneyString,
    contribution: nullableMoney,
    minutes: z.number().min(0).max(240),
    freeOnly: z.literal(true),
  })
  .strict();
export function manualPlayAmounts(
  input: unknown,
  available: number,
  redeemable: number,
) {
  const v = manualPlaySchema.parse(input),
    start = cents(v.start),
    wager = cents(v.wager),
    end = cents(v.end),
    payout = end - start + wager;
  if (redeemable > 0) throw new Error("STOP PLAYING: redeemable funds exist.");
  if (start !== available || wager <= 0 || wager > start || payout < 0)
    throw new Error(
      "Impossible or stale promotional balances; update the account first.",
    );
  if (
    (v.result === "LOSS" && end >= start) ||
    (v.result === "WIN" && end <= start) ||
    (v.result === "PUSH" && end !== start)
  )
    throw new Error("Result does not match the balance change.");
  if (v.contribution !== null && cents(v.contribution) > wager)
    throw new Error(
      "Playthrough contribution cannot exceed the recorded wager; no extra credit inferred.",
    );
  return { ...v, payout: decimal(payout) };
}
export function high5Recommendation(input: {
  redeemable: number | null;
  remaining: string | null;
  playable: string | null;
  termsCurrent: boolean;
  controls?: RiskControls;
  redemptionMinimum?: string | null;
  now?: Date;
  verifiedGames: {
    game: string;
    eligible: boolean | null;
    contributionPercent: number | null;
    minimumWager: string | null;
    maximumWager: string | null;
    rtp: number | null;
    volatility: string | null;
    primaryCurrent: boolean;
    restrictionsReviewed?: boolean;
    sourceUrl?: string | null;
    verifiedAt?: Date | null;
    expectedRedeemableValue?: string | null;
  }[];
}) {
  if (input.redeemable !== null && input.redeemable > 0)
    return { status: "STOP PLAYING", action: "REDEEM", game: null };
  if (!input.termsCurrent)
    return {
      status: "PUBLIC TERMS REQUIRE RE-VERIFICATION",
      action: "CHECK",
      game: null,
    };
  if (input.remaining === null || input.playable === null)
    return { status: "REDEMPTION STATUS UNKNOWN", action: "CHECK", game: null };
  if (cents(input.remaining) === 0)
    return {
      status: "STOP PLAYING — CHECK REDEMPTION",
      action: "CHECK",
      game: null,
    };
  if (
    !input.verifiedGames.some(
      (g) =>
        g.primaryCurrent &&
        g.eligible === true &&
        g.contributionPercent !== null &&
        g.contributionPercent > 0 &&
        g.contributionPercent <= 100 &&
        g.restrictionsReviewed === true &&
        g.minimumWager !== null &&
        g.maximumWager !== null &&
        g.rtp !== null &&
        g.rtp > 0 &&
        g.rtp <= 100,
    )
  )
    return {
      status: "INSUFFICIENT VERIFIED GAME DATA",
      action: "CHECK",
      game: null,
    };
  const controls = input.controls ?? defaultControls;
  const evaluated = input.verifiedGames
    .filter(
      (g) =>
        g.primaryCurrent &&
        g.restrictionsReviewed === true &&
        g.rtp !== null &&
        g.rtp > 0 &&
        g.rtp <= 100,
    )
    .map((g) => {
      const wager = g.minimumWager === null ? 0 : cents(g.minimumWager);
      const plan = strategyPlan({
        engine: "CASINO",
        funding: freeFunding,
        controls,
        terms: {
          ...g,
          redemptionThreshold: input.redemptionMinimum ?? null,
          playthroughRemaining: input.remaining,
          expectedRedeemableValue: g.expectedRedeemableValue ?? null,
          sourceUrl: g.sourceUrl ?? null,
          verifiedAt: g.verifiedAt ?? null,
        },
        playable: cents(input.playable!),
        redeemable: input.redeemable ?? 0,
        requestedWager: wager,
        sessionLoss: 0,
        minutes: 0,
        now: input.now,
      });
      return { g, plan, wager };
    })
    .filter((x) => x.plan.status === "PLAN_ONLY")
    .sort(
      (a, b) =>
        cents(b.g.expectedRedeemableValue!) -
        cents(a.g.expectedRedeemableValue!),
    );
  if (evaluated[0])
    return {
      status: "MANUAL PLAN ONLY — OUTCOMES UNCERTAIN",
      action: "PLAY",
      game: evaluated[0].g.game,
      wager: decimal(evaluated[0].wager),
    };
  return {
    status: "EXPECTED REDEEMABLE VALUE REQUIRES REVIEW",
    action: "CHECK",
    game: null,
  };
}
export function high5Integrity(
  events: { userCashContribution: string; origin: string }[],
) {
  try {
    return events.every(
      (e) =>
        cents(e.userCashContribution) === 0 && e.origin === "FREE_PROMOTIONAL",
    );
  } catch {
    return false;
  }
}
export function experimentMetrics(input: {
  start: Date | null;
  now: Date;
  updates: {
    occurredAt: Date;
    checkedReward: boolean;
    minutes: number;
    payload: High5Update;
  }[];
  rewards: {
    claimed: boolean;
    sc: string | null;
    kind: string;
    scope: string;
    occurredAt: Date | null;
  }[];
  events: ObservedLedger[];
  redemptions: {
    status: string;
    receivedUSD: string | null;
    completedAt: Date | null;
  }[];
}) {
  const day = (d: Date) =>
    d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const days = new Set(input.updates.map((u) => day(u.occurredAt))),
    received = input.rewards.filter((r) => r.claimed),
    unknownSC = received.filter(
      (r) =>
        ["SC_ONLY", "GC_AND_SC", "UNKNOWN", "OTHER"].includes(r.kind) &&
        r.sc === null,
    ).length;
  const sc = received.reduce(
      (n, r) => n + (r.sc === null ? 0 : cents(r.sc)),
      0,
    ),
    b = bankroll(input.events.filter((e) => e.currency === "SC"));
  const complete = input.redemptions.filter((r) => r.status === "COMPLETED"),
    unknownCash = complete.filter((r) => r.receivedUSD === null).length,
    cash = complete.reduce(
      (n, r) => n + (r.receivedUSD === null ? 0 : cents(r.receivedUSD)),
      0,
    );
  const minutes = input.updates.reduce((n, u) => n + u.minutes, 0);
  const elapsed = input.start
    ? Math.max(
        0,
        Math.floor((input.now.getTime() - input.start.getTime()) / 86400000),
      )
    : 0;
  const sampled =
    elapsed >= 7 &&
    days.size >= 7 &&
    unknownSC === 0 &&
    received.every((r) => r.occurredAt !== null && r.occurredAt <= input.now);
  let generated = 0;
  let previous: string | null = null;
  for (const u of input.updates) {
    const current = u.payload.redeemableSC;
    if (previous !== null && current !== null)
      generated += Math.max(0, cents(current) - cents(previous));
    previous = current;
  }
  const recurringSC = received
    .filter((r) => r.scope === "RECURRING")
    .reduce((n, r) => n + cents(r.sc ?? "0"), 0);
  const cashSampled = sampled && unknownCash === 0 && complete.length > 0;
  return {
    start: input.start,
    elapsedDays: elapsed,
    daysObserved: days.size,
    rewardChecks: input.updates.filter((u) => u.checkedReward).length,
    rewardsReceived: received.length,
    freeSC: sc,
    unknownSC,
    wagered: b.wagered,
    wins: b.wins,
    losses: b.losses,
    currentlyRedeemable: b.balances.REDEEMABLE,
    pending: b.reserved,
    redeemedSC: b.balances.REDEEMED,
    actualUSD: cash,
    unknownCash,
    minutes,
    redeemableGenerated: generated,
    signupSC: received
      .filter((r) => r.scope === "SIGNUP")
      .reduce((n, r) => n + cents(r.sc ?? "0"), 0),
    recurringSC,
    otherSC: received
      .filter((r) => r.scope === "OTHER")
      .reduce((n, r) => n + cents(r.sc ?? "0"), 0),
    scPerDay: sampled ? sc / elapsed : null,
    scPerWeek: sampled ? (sc / elapsed) * 7 : null,
    projectedMonthlySC: sampled ? (recurringSC / elapsed) * 30 : null,
    redeemedPerDay: cashSampled ? cash / elapsed : null,
    projectedMonthlyUSD:
      cashSampled &&
      !received.some(
        (r) => r.scope === "SIGNUP" && (r.sc === null || cents(r.sc) > 0),
      )
        ? (cash / elapsed) * 30
        : null,
    valuePerMinute: cashSampled && minutes > 0 ? cash / minutes : null,
  };
}
export function chicagoTime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(value))
    throw new Error("Use a Central date/time or leave UNKNOWN.");
  const wall = Date.parse(
    value.length === 10 ? value + "T00:00:00Z" : value + ":00Z",
  );
  if (!Number.isFinite(wall)) throw new Error("Invalid date/time.");
  let epoch = wall;
  for (let i = 0; i < 4; i++) {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Chicago",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(new Date(epoch))
        .map((p) => [p.type, p.value]),
    );
    const represented = Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour),
      Number(p.minute),
    );
    epoch += wall - represented;
  }
  return new Date(epoch);
}
