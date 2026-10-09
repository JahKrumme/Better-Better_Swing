import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { High5Adapter, high5Capabilities } from "./high5-adapter";
import {
  high5UpdateSchema,
  reconciliationTargets,
  reconciliationEvents,
  manualPlayAmounts,
  high5Recommendation,
  high5Integrity,
  experimentMetrics,
  chicagoTime,
  type High5Update,
} from "./high5";
import { bankroll, freeFunding } from "./operations";
import { scheduledOpportunity } from "./scheduler";
export const update = (extra: Partial<High5Update> = {}): High5Update => ({
  accountId: randomUUID(),
  submissionKey: randomUUID(),
  legacyOfferId: null,
  checkedReward: true,
  rewardKind: "UNKNOWN",
  rewardClaimed: "UNKNOWN",
  rewardScope: "RECURRING",
  rewardSC: null,
  rewardGC: null,
  otherReward: null,
  gc: null,
  sc: null,
  playableSC: null,
  redeemableSC: null,
  playthroughRequired: null,
  playthroughPlayed: null,
  playthroughRemaining: null,
  redemptionMinimum: null,
  nextRewardAt: null,
  minutes: 0,
  freeOnly: true,
  notes: null,
  ...extra,
});
const play = (extra: object = {}) => ({
  accountId: randomUUID(),
  submissionKey: randomUUID(),
  game: "Synthetic game",
  start: "1",
  wager: "0.10",
  end: "0.90",
  result: "LOSS",
  contribution: null,
  minutes: 1,
  freeOnly: true,
  ...extra,
});
const plan = (extra: object = {}) =>
  high5Recommendation({
    redeemable: null,
    remaining: "1",
    playable: "1",
    termsCurrent: true,
    verifiedGames: [],
    ...extra,
  });
describe("High 5 manual capability and observation boundaries", () => {
  it.each(Object.keys(high5Capabilities))("rejects automatic %s", (cap) =>
    expect(() =>
      new High5Adapter("high5").assertAutomatic(
        cap as keyof typeof high5Capabilities,
      ),
    ).toThrow("Unsupported automatic"),
  );
  it("all private capabilities fail closed", async () => {
    const a = new High5Adapter("high5");
    expect(Object.values(a.capabilities).every((v) => !v)).toBe(true);
    expect((await a.claimReward()).executionMode).toBe("MANUAL_REQUIRED");
    await expect(a.executePromotionalPlay()).rejects.toThrow("UNAVAILABLE");
  });
  it.each([
    "NO_REWARD",
    "GC_ONLY",
    "SC_ONLY",
    "GC_AND_SC",
    "OTHER",
    "UNKNOWN",
  ] as const)("accepts %s with unknown values", (rewardKind) =>
    expect(high5UpdateSchema.parse(update({ rewardKind })).rewardSC).toBeNull(),
  );
  it("rejects contradictory reward currencies and no-reward grants", () => {
    expect(() =>
      high5UpdateSchema.parse(update({ rewardKind: "GC_ONLY", rewardSC: "1" })),
    ).toThrow();
    expect(() =>
      high5UpdateSchema.parse(
        update({ rewardKind: "NO_REWARD", rewardClaimed: "YES" }),
      ),
    ).toThrow();
  });
  it("rejects purchased funds and impossible allocations", () => {
    expect(() =>
      high5UpdateSchema.parse({ ...update(), freeOnly: false }),
    ).toThrow();
    expect(() =>
      high5UpdateSchema.parse(
        update({ sc: "1", playableSC: "1", redeemableSC: "1" }),
      ),
    ).toThrow();
  });
  it("unknown allocations remain unknown; corrections are not rewards", () => {
    const u = update({ sc: "3" });
    const t = reconciliationTargets([], u);
    expect(t.sc).toEqual({ PROMOTIONAL: 300, PLAYABLE: 0, REDEEMABLE: 0 });
    const rows = reconciliationEvents(bankroll([]).balances, t.sc);
    expect(rows[0].eventType).toBe("OBSERVATION_RECONCILIATION");
    expect(u.redeemableSC).toBeNull();
    expect(reconciliationTargets([], update()).sc).toEqual({});
    expect(reconciliationTargets([], update({ gc: "1000" })).gc).toBe(100000);
  });
  it("a repeated known balance produces no additional correction", () => {
    const rows = [
      {
        eventType: "OBSERVATION_RECONCILIATION" as const,
        category: "PROMOTIONAL" as const,
        amount: "3",
        currency: "SC",
        direction: "CREDIT" as const,
        userCashContribution: "0",
        origin: "FREE_PROMOTIONAL",
        relatedEventId: null,
        sessionId: null,
        occurredAt: new Date(),
        notes: null,
        actualCashAmount: null,
        cashCurrency: null,
      },
    ];
    expect(
      reconciliationEvents(
        bankroll(rows).balances,
        reconciliationTargets(rows, update({ sc: "3" })).sc,
      ),
    ).toEqual([]);
    expect(bankroll(rows).freeReceived).toBe(0);
  });
  it("checks every four hours without establishing a grant", () => {
    const now = new Date("2026-10-09T12:00:00Z");
    const o = scheduledOpportunity(
      {
        kind: "EVERY_N_HOURS",
        hours: 4,
        anchor: "2026-10-09T00:00:00Z",
        timezone: "America/Chicago",
        windows: [],
      },
      now,
      now,
      null,
      "observation",
      "CHECK_REWARD",
    );
    expect(o?.availableAt.toISOString()).toBe(now.toISOString());
    expect(o?.expiresAt?.toISOString()).toBe("2026-10-09T16:00:00.000Z");
    expect(freeFunding.monetaryContributionRequired).toBe(false);
  });
  it("unknown playthrough and stale evidence block recommendations", () => {
    expect(plan({ remaining: null }).status).toBe("REDEMPTION STATUS UNKNOWN");
    expect(plan({ termsCurrent: false }).status).toContain("RE-VERIFICATION");
    expect(plan().status).toBe("INSUFFICIENT VERIFIED GAME DATA");
  });
  it("redeemable funds override any gameplay guidance", () =>
    expect(plan({ redeemable: 1, termsCurrent: false }).status).toBe(
      "STOP PLAYING",
    ));
  it.each([
    ["LOSS", "0.90", "0.00"],
    ["PUSH", "1", "0.10"],
    ["WIN", "1.10", "0.20"],
  ])("records %s arithmetic", (result, end, payout) =>
    expect(manualPlayAmounts(play({ result, end }), 100, 0).payout).toBe(
      payout,
    ),
  );
  it("rejects impossible play, stale balances, excessive contribution and funding", () => {
    for (const extra of [
      { end: "0.80" },
      { start: "2" },
      { result: "WIN" },
      { contribution: "0.11" },
      { freeOnly: false },
    ])
      expect(() => manualPlayAmounts(play(extra), 100, 0)).toThrow();
    expect(() => manualPlayAmounts(play(), 100, 1)).toThrow("STOP PLAYING");
  });
  it("validates only free zero-contribution integrity", () => {
    expect(
      high5Integrity([
        { origin: "FREE_PROMOTIONAL", userCashContribution: "0" },
      ]),
    ).toBe(true);
    for (const e of [
      { origin: "FREE_PROMOTIONAL", userCashContribution: "1" },
      { origin: "PURCHASED", userCashContribution: "0" },
      { origin: "FREE_PROMOTIONAL", userCashContribution: "bad" },
    ])
      expect(high5Integrity([e])).toBe(false);
  });
  it("stores Central dates as actual UTC instants", () => {
    expect(chicagoTime("2026-10-09").toISOString()).toBe(
      "2026-10-09T05:00:00.000Z",
    );
    expect(chicagoTime("2026-12-09T10:30").toISOString()).toBe(
      "2026-12-09T16:30:00.000Z",
    );
    expect(() => chicagoTime("bad")).toThrow();
  });
});
const sample = (count: number, unknown = false) => {
  const start = new Date("2026-10-01T12:00:00Z");
  return {
    start,
    now: new Date("2026-10-08T12:00:00Z"),
    updates: Array.from({ length: count }, (_, i) => ({
      occurredAt: new Date(start.getTime() + i * 86400000),
      checkedReward: true,
      minutes: 2,
      payload: update({ redeemableSC: String(i) }),
    })),
    events: [],
    redemptions: [],
    rewards: [
      {
        claimed: true,
        sc: "55",
        kind: "SC_ONLY",
        scope: "SIGNUP",
        occurredAt: start,
      },
      ...Array.from({ length: count }, (_, i) => ({
        claimed: true,
        sc: unknown && i === 0 ? null : "1",
        kind: "SC_ONLY",
        scope: "RECURRING",
        occurredAt: start,
      })),
    ],
  };
};
describe("actual High 5 experiment metrics", () => {
  it("elapsed time alone does not meet observation minimum", () =>
    expect(experimentMetrics(sample(1)).projectedMonthlySC).toBeNull());
  it("seven distinct observed days permit conditional recurring projection, excluding signup", () => {
    const m = experimentMetrics(sample(7));
    expect(m.daysObserved).toBe(7);
    expect(m.freeSC).toBe(6200);
    expect(m.projectedMonthlySC).toBe((700 / 7) * 30);
    expect(m.actualUSD).toBe(0);
    expect(m.projectedMonthlyUSD).toBeNull();
    expect(m.redeemableGenerated).toBe(600);
  });
  it("seven calendar observation days still require seven complete elapsed days", () => {
    const s = sample(7);
    expect(
      experimentMetrics({ ...s, now: new Date("2026-10-07T12:00:00Z") })
        .projectedMonthlySC,
    ).toBeNull();
  });
  it("an unknown reward amount blocks misleading projections", () =>
    expect(experimentMetrics(sample(7, true)).scPerDay).toBeNull());
  it("GC-only rewards never create cash or SC", () => {
    const s = sample(7);
    s.rewards = [
      {
        claimed: true,
        sc: null,
        kind: "GC_ONLY",
        scope: "RECURRING",
        occurredAt: s.start,
      },
    ];
    const m = experimentMetrics(s);
    expect(m.freeSC).toBe(0);
    expect(m.unknownSC).toBe(0);
    expect(m.actualUSD).toBe(0);
  });
});

describe("verified High5 planning and redeemed projections", () => {
  it("ranks fully verified hypothetical games by reviewed expected redeemable value within existing controls", () => {
    const now = new Date();
    const game = {
      game: "Synthetic verified game",
      eligible: true,
      contributionPercent: 100,
      minimumWager: "0.05",
      maximumWager: "0.10",
      rtp: 96,
      volatility: null,
      primaryCurrent: true,
      restrictionsReviewed: true,
      sourceUrl: "https://synthetic.example/game",
      verifiedAt: now,
      expectedRedeemableValue: "1",
    };
    const p = high5Recommendation({
      redeemable: 0,
      remaining: "1",
      playable: "3",
      termsCurrent: true,
      redemptionMinimum: "50",
      controls: {
        maxPromotionalLossPerSession: "1",
        maxPromotionalWager: "0.10",
        maxSessionDuration: 15,
        stopWhenRedeemable: true,
        stopAtPromotionalBalance: "0.10",
        minimumExpectedValue: "0.50",
      },
      now,
      verifiedGames: [
        game,
        {
          ...game,
          game: "Synthetic higher reviewed value",
          expectedRedeemableValue: "2",
        },
      ],
    });
    expect(p.action).toBe("PLAY");
    expect(p.game).toBe("Synthetic higher reviewed value");
    expect(p.status).toContain("MANUAL PLAN ONLY");
  });
  it("a known RTP alone never creates expected cash or a game recommendation", () =>
    expect(
      high5Recommendation({
        redeemable: 0,
        remaining: "1",
        playable: "3",
        termsCurrent: true,
        redemptionMinimum: "50",
        verifiedGames: [
          {
            game: "Synthetic incomplete EV",
            eligible: true,
            contributionPercent: 100,
            minimumWager: "0.05",
            maximumWager: "0.10",
            rtp: 96,
            volatility: null,
            primaryCurrent: true,
            restrictionsReviewed: true,
          },
        ],
      }).game,
    ).toBeNull());
  it("known recurring-only redemptions can project; signup-related proceeds cannot be repeated", () => {
    const s = sample(7);
    const redemptions = [
      { status: "COMPLETED", receivedUSD: "5", completedAt: s.now },
    ];
    expect(
      experimentMetrics({ ...s, redemptions }).projectedMonthlyUSD,
    ).toBeNull();
    const m = experimentMetrics({
      ...s,
      rewards: s.rewards.filter((r) => r.scope === "RECURRING"),
      redemptions,
    });
    expect(m.projectedMonthlyUSD).toBe((500 / 7) * 30);
    expect(m.valuePerMinute).toBe(500 / 14);
    expect(
      experimentMetrics({
        ...s,
        rewards: s.rewards.filter((r) => r.scope === "RECURRING"),
        redemptions: [{ ...redemptions[0], receivedUSD: null }],
      }).redeemedPerDay,
    ).toBeNull();
  });
});
