import { describe, it, expect } from "vitest";
import {
  bankroll,
  cents,
  decimal,
  comparableConversion,
  enforceZeroMoney,
  freeFunding,
  hardControls,
  defaultControls,
  controlsSchema,
  effectivePolicy,
  executionPlan,
  strategyPlan,
  validateLedgerEvent,
  type LedgerRecord,
  type GameTerms,
  type PolicyEvidence,
} from "./operations";
import { authorizeAutomatic } from "./adapters";
import { scheduledOpportunity, type ScheduleSpec } from "./scheduler";
const now = new Date("2026-10-08T18:00:00Z");
const proof: PolicyEvidence = {
  stage: "CLAIM",
  decision: "PERMITTED",
  sourceType: "official",
  sourceUrl: "https://example.com/api-terms",
  excerpt: "Synthetic test permission only for automatic claims.",
  verifiedAt: now,
  expiresAt: null,
};
const plan = {
  type: "CLAIM_REWARD" as const,
  engine: "CASINO" as const,
  funding: freeFunding,
  eligible: true,
  excluded: false,
  demo: false,
};
function event(
  eventType: LedgerRecord["eventType"],
  amount: string,
  extra: Partial<LedgerRecord> = {},
): LedgerRecord {
  return {
    id: eventType,
    eventType,
    amount,
    category:
      eventType === "REDEMPTION_REQUESTED"
        ? "REDEEMABLE"
        : eventType === "REDEMPTION_COMPLETED"
          ? "REDEEMED"
          : "PLAYABLE",
    occurredAt: now,
    relatedEventId: null,
    actualCashAmount: null,
    cashCurrency: null,
    notes: "Synthetic evidence",
    sessionId: "test",
    ...extra,
  };
}
const receipt = event("FREE_REWARD_RECEIVED", "10", {
  category: "PROMOTIONAL",
});
const active = event("PROMOTIONAL_ACTIVATED", "10");
describe("Phase 3 $0 invariant and policy gate", () => {
  it("accepts strictly free funds and immutable hard controls", () => {
    expect(enforceZeroMoney(freeFunding)).toEqual(freeFunding);
    expect(Object.isFrozen(hardControls)).toBe(true);
  });
  it.each([
    "depositRequired",
    "purchaseRequired",
    "paidWagerRequired",
    "subscriptionRequired",
    "entryFeeRequired",
    "monetaryContributionRequired",
  ])("rejects %s below the UI", (field) => {
    expect(() => enforceZeroMoney({ ...freeFunding, [field]: true })).toThrow(
      "Zero-user-money",
    );
  });
  it.each(["0.01", "100", "-1", "NaN", "Infinity"])(
    "rejects cash contribution %s",
    (amount) => {
      expect(() =>
        enforceZeroMoney({ ...freeFunding, userCashContribution: amount }),
      ).toThrow();
    },
  );
  it.each(["USER_CASH", "PURCHASED", "UNKNOWN"])(
    "rejects %s origin",
    (origin) =>
      expect(() =>
        enforceZeroMoney({ ...freeFunding, bankrollOrigin: origin }),
      ).toThrow(),
  );
  it("does not accept unknown cost booleans", () =>
    expect(() =>
      enforceZeroMoney({ ...freeFunding, purchaseRequired: null }),
    ).toThrow());
  it("supports exact cents without floating point drift", () => {
    expect(cents("0.10") + cents("0.20")).toBe(30);
    expect(decimal(30)).toBe("0.30");
    expect(() => cents("0.001")).toThrow();
  });
  it.each(["UNKNOWN", "PROHIBITED"] as const)(
    "%s creates a manual task and cannot execute automatically",
    (policy) => {
      expect(executionPlan({ ...plan, policy }).mode).toBe("MANUAL_REQUIRED");
      expect(() =>
        authorizeAutomatic({
          ...plan,
          policies: [{ ...proof, decision: policy }],
          adapterEnabled: true,
          availableAt: now,
          expiresAt: null,
          now,
        }),
      ).toThrow("Automatic execution rejected");
    },
  );
  it("affirmative permission can enter the automatic queue but needs an enabled executor", () => {
    expect(executionPlan({ ...plan, policy: "PERMITTED" }).mode).toBe(
      "AUTOMATIC",
    );
    expect(() =>
      authorizeAutomatic({
        ...plan,
        policies: [proof],
        adapterEnabled: false,
        availableAt: now,
        expiresAt: null,
        now,
      }),
    ).toThrow("executor");
    expect(
      authorizeAutomatic({
        ...plan,
        policies: [proof],
        adapterEnabled: true,
        availableAt: now,
        expiresAt: null,
        now,
      }),
    ).toBe(true);
  });
  it("permission for one action does not grant permission for another", () => {
    expect(effectivePolicy([proof], "GAMEPLAY", false, now)).toBe("UNKNOWN");
    expect(effectivePolicy([proof], "REDEMPTION", false, now)).toBe("UNKNOWN");
  });
  it("stale, future, expired, observational, HTTP and conflicting evidence fail closed", () => {
    for (const p of [
      { ...proof, verifiedAt: new Date("2026-08-01") },
      { ...proof, verifiedAt: new Date("2026-10-09") },
      { ...proof, expiresAt: now },
      { ...proof, sourceType: "observation" as const },
      { ...proof, sourceUrl: "http://example.com" },
    ])
      expect(effectivePolicy([p], "CLAIM", false, now)).toBe("UNKNOWN");
    expect(
      effectivePolicy(
        [proof, { ...proof, decision: "PROHIBITED" }],
        "CLAIM",
        false,
        now,
      ),
    ).toBe("UNKNOWN");
  });
  it("simulation permission never authorizes a real action", () => {
    expect(
      effectivePolicy(
        [{ ...proof, sourceType: "simulation" }],
        "CLAIM",
        false,
        now,
      ),
    ).toBe("UNKNOWN");
  });
  it("excluded platforms and uncertain offers are blocked despite permission", () => {
    expect(
      executionPlan({ ...plan, excluded: true, policy: "PERMITTED" }).mode,
    ).toBe("BLOCKED");
    expect(
      executionPlan({ ...plan, eligible: false, policy: "PERMITTED" }).mode,
    ).toBe("BLOCKED");
  });
  it("real gameplay remains manual and sportsbook wagering blocked even with permission", () => {
    expect(
      executionPlan({
        ...plan,
        type: "PLAY_PROMOTIONAL_BALANCE",
        policy: "PERMITTED",
      }).mode,
    ).toBe("MANUAL_REQUIRED");
    expect(
      executionPlan({
        ...plan,
        type: "PLAY_PROMOTIONAL_BALANCE",
        engine: "SPORTSBOOK",
        policy: "PERMITTED",
        demo: true,
      }).mode,
    ).toBe("BLOCKED");
  });
  it("expired and future actions cannot execute", () => {
    for (const times of [
      { availableAt: new Date(now.getTime() + 1), expiresAt: null },
      { availableAt: now, expiresAt: now },
    ])
      expect(() =>
        authorizeAutomatic({
          ...plan,
          policies: [proof],
          adapterEnabled: true,
          ...times,
          now,
        }),
      ).toThrow("available");
  });
});
describe("Category ledger and redemption", () => {
  it("receipt, activation, wager and settlement preserve separate balances", () => {
    const records = [receipt];
    expect(bankroll(records).balances).toEqual({
      PROMOTIONAL: 1000,
      PLAYABLE: 0,
      REDEEMABLE: 0,
      REDEEMED: 0,
    });
    records.push(active);
    expect(bankroll(records).balances.PROMOTIONAL).toBe(0);
    const wager = event("PROMOTIONAL_WAGER", "1", { id: "w1" });
    validateLedgerEvent(records, wager, freeFunding, "CASINO", true);
    records.push(
      wager,
      event("PROMOTIONAL_WIN", "1.25", { relatedEventId: "w1" }),
    );
    const b = bankroll(records);
    expect(b.balances.PLAYABLE).toBe(1025);
    expect(b.wagered).toBe(100);
    expect(b.wins).toBe(25);
    expect(b.losses).toBe(0);
  });
  it("loss settles an already-debited wager without double debit", () => {
    const r = [receipt, active, event("PROMOTIONAL_WAGER", "1", { id: "w" })];
    const loss = event("PROMOTIONAL_LOSS", "0", { relatedEventId: "w" });
    validateLedgerEvent(r, loss, freeFunding, "CASINO", true);
    const b = bankroll([...r, loss]);
    expect(b.balances.PLAYABLE).toBe(900);
    expect(b.losses).toBe(100);
    expect(b.wagers.size).toBe(0);
    expect(() =>
      validateLedgerEvent([...r, loss], loss, freeFunding, "CASINO", true),
    ).toThrow("unsettled");
  });
  it("rejects cross-currency/account or fabricated settlement links", () =>
    expect(() =>
      validateLedgerEvent(
        [receipt, active],
        event("PROMOTIONAL_WIN", "50", { relatedEventId: "other-account" }),
        freeFunding,
        "CASINO",
        true,
      ),
    ).toThrow("unsettled"));
  it("rejects overdraw, wager of redeemable value and unsettled redemption", () => {
    expect(() =>
      validateLedgerEvent(
        [receipt],
        event("PROMOTIONAL_ACTIVATED", "11"),
        freeFunding,
        "CASINO",
        true,
      ),
    ).toThrow("Insufficient");
    const r = [receipt, active, event("BECAME_REDEEMABLE", "5")];
    expect(() =>
      validateLedgerEvent(
        r,
        event("PROMOTIONAL_WAGER", "1"),
        freeFunding,
        "CASINO",
        true,
      ),
    ).toThrow("Stop playing");
    expect(() =>
      validateLedgerEvent(
        [receipt, active, event("PROMOTIONAL_WAGER", "1", { id: "w" })],
        event("BECAME_REDEEMABLE", "1"),
        freeFunding,
        "CASINO",
        true,
      ),
    ).toThrow("settled");
  });
  it("request reserves funds and completion moves units exactly once, records distinct actual cash", () => {
    const r = [
      receipt,
      active,
      event("BECAME_REDEEMABLE", "5"),
      event("REDEMPTION_REQUESTED", "5", {
        id: "request",
        category: "REDEEMABLE",
      }),
    ];
    expect(bankroll(r).availableRedeemable).toBe(0);
    expect(() =>
      validateLedgerEvent(
        r,
        event("REDEMPTION_REQUESTED", "1"),
        freeFunding,
        "CASINO",
        true,
      ),
    ).toThrow("unreserved");
    const complete = event("REDEMPTION_COMPLETED", "5", {
      category: "REDEEMED",
      relatedEventId: "request",
      actualCashAmount: "2",
      cashCurrency: "USD",
    });
    validateLedgerEvent(r, complete, freeFunding, "CASINO", true);
    const b = bankroll([...r, complete]);
    expect(b.balances).toEqual({
      PROMOTIONAL: 0,
      PLAYABLE: 500,
      REDEEMABLE: 0,
      REDEEMED: 500,
    });
    expect(b.cash.get("USD")).toBe(200);
    expect(b.realizedReturn).toBeNull();
    expect(() =>
      validateLedgerEvent(
        [...r, complete],
        complete,
        freeFunding,
        "CASINO",
        true,
      ),
    ).toThrow("open request");
  });
  it("unknown proceeds cannot count as cash and incompatible units have no conversion", () => {
    expect(() =>
      validateLedgerEvent(
        [receipt, active],
        event("REDEMPTION_COMPLETED", "1"),
        freeFunding,
        "CASINO",
        true,
      ),
    ).toThrow();
    expect(comparableConversion(100, 1000, false)).toBeNull();
    expect(comparableConversion(100, 0, true)).toBeNull();
    expect(comparableConversion(100, 1000, true)).toBe(0.1);
  });
  it("expiry and adjustments reduce only available evidenced funds", () => {
    const r = [receipt, active];
    expect(
      validateLedgerEvent(r, event("EXPIRED", "2"), freeFunding, "CASINO", true)
        .balances.PLAYABLE,
    ).toBe(800);
    expect(() =>
      validateLedgerEvent(
        r,
        event("ADJUSTMENT", "11"),
        freeFunding,
        "CASINO",
        true,
      ),
    ).toThrow();
    expect(() =>
      validateLedgerEvent(
        r,
        event("ADJUSTMENT", "1", { notes: null }),
        freeFunding,
        "CASINO",
        true,
      ),
    ).toThrow();
  });
  it("real gameplay cannot be executed via ledger and sportsbook simulation cannot wager", () => {
    expect(() =>
      validateLedgerEvent(
        [receipt, active],
        event("PROMOTIONAL_WAGER", "1"),
        freeFunding,
        "CASINO",
        false,
      ),
    ).toThrow("simulation-only");
    expect(() =>
      validateLedgerEvent(
        [receipt, active],
        event("PROMOTIONAL_WAGER", "1"),
        freeFunding,
        "SPORTSBOOK",
        true,
      ),
    ).toThrow("simulation-only");
  });
});
describe("Recurring schedule windows", () => {
  const base: ScheduleSpec = {
    kind: "EVERY_N_HOURS",
    hours: 4,
    anchor: "2026-10-08T16:00:00Z",
    timezone: "America/Chicago",
    windows: [],
  };
  it("four-hour periods are deterministic and independent", () => {
    const a = scheduledOpportunity(
      base,
      now,
      now,
      null,
      "official",
      "CLAIM_REWARD",
    )!;
    expect(a.availableAt.toISOString()).toBe(
      new Date(base.anchor).toISOString(),
    );
    expect(a.expiresAt.toISOString()).toBe("2026-10-08T20:00:00.000Z");
    expect(
      scheduledOpportunity(
        base,
        new Date("2026-10-08T19:59:59Z"),
        now,
        null,
        "official",
        "CLAIM_REWARD",
      )!.key,
    ).toBe(a.key);
    expect(
      scheduledOpportunity(
        base,
        new Date("2026-10-08T20:00:00Z"),
        now,
        null,
        "official",
        "CLAIM_REWARD",
      )!.key,
    ).not.toBe(a.key);
  });
  it("observations permit checks only, not confirmed claims", () => {
    expect(
      scheduledOpportunity(base, now, now, null, "observation", "CHECK_REWARD"),
    ).not.toBeNull();
    expect(
      scheduledOpportunity(base, now, now, null, "observation", "CLAIM_REWARD"),
    ).toBeNull();
  });
  it("expiration, stale evidence and future starts produce no opportunities", () => {
    expect(
      scheduledOpportunity(base, now, now, now, "official", "CLAIM_REWARD"),
    ).toBeNull();
    expect(
      scheduledOpportunity(
        base,
        now,
        new Date("2026-08-01"),
        null,
        "official",
        "CLAIM_REWARD",
      ),
    ).toBeNull();
    expect(
      scheduledOpportunity(
        { ...base, anchor: "2026-10-09" },
        now,
        now,
        null,
        "official",
        "CLAIM_REWARD",
      ),
    ).toBeNull();
  });
  it("hourly, weekly and custom windows work without duplicates", () => {
    expect(
      scheduledOpportunity(
        { ...base, kind: "HOURLY_INTERVAL" },
        now,
        now,
        null,
        "official",
        "CLAIM_REWARD",
      )!.expiresAt.toISOString(),
    ).toBe("2026-10-08T19:00:00.000Z");
    expect(
      scheduledOpportunity(
        { ...base, kind: "WEEKLY" },
        now,
        now,
        null,
        "official",
        "CLAIM_REWARD",
      )!.key,
    ).toContain("weekly");
    const custom = {
      ...base,
      kind: "CUSTOM" as const,
      windows: [{ start: "2026-10-08T17:00:00Z", end: "2026-10-08T19:00:00Z" }],
    };
    expect(
      scheduledOpportunity(custom, now, now, null, "official", "CLAIM_REWARD")!
        .key,
    ).toContain("custom");
    expect(() =>
      scheduledOpportunity(
        { ...base, hours: 0 },
        now,
        now,
        null,
        "official",
        "CLAIM_REWARD",
      ),
    ).toThrow();
    expect(() =>
      scheduledOpportunity(
        { ...custom, windows: [...custom.windows, ...custom.windows] },
        now,
        now,
        null,
        "official",
        "CLAIM_REWARD",
      ),
    ).toThrow("Overlapping");
  });
  it("daily boundaries respect Chicago DST rather than fixed 24h", () => {
    const date = new Date("2026-11-01T18:00:00Z"),
      start = new Date("2026-10-31T00:00:00Z");
    const p = scheduledOpportunity(
      { ...base, kind: "DAILY", anchor: start.toISOString() },
      date,
      start,
      null,
      "official",
      "CLAIM_REWARD",
    )!;
    expect((p.expiresAt.getTime() - p.availableAt.getTime()) / 3600000).toBe(
      25,
    );
  });
});
describe("Casino strategy hard controls", () => {
  const terms: GameTerms = {
    game: "Synthetic",
    eligible: true,
    contributionPercent: 100,
    minimumWager: "0.10",
    maximumWager: "1",
    rtp: 0.96,
    volatility: null,
    redemptionThreshold: "5",
    playthroughRemaining: "1",
    expectedRedeemableValue: "0.09",
    sourceUrl: "https://example.com/game",
    verifiedAt: now,
  };
  const input = {
    engine: "CASINO" as const,
    funding: freeFunding,
    controls: { ...defaultControls, minimumExpectedValue: "0" },
    terms,
    playable: 1000,
    redeemable: 0,
    requestedWager: 10,
    sessionLoss: 0,
    minutes: 0,
    now,
  };
  it("returns a plan only for evidenced free promotional actions", () =>
    expect(strategyPlan(input).status).toBe("PLAN_ONLY"));
  it("redeemable value takes priority over all further play", () =>
    expect(strategyPlan({ ...input, redeemable: 1 }).status).toBe(
      "STOP_REDEEM",
    ));
  it.each([
    { requestedWager: 11 },
    { sessionLoss: 95 },
    { minutes: 15 },
    { playable: 10 },
  ])("risk control blocks %j", (patch) =>
    expect(strategyPlan({ ...input, ...patch }).status).toBe("BLOCKED"),
  );
  it("unknown eligibility, EV or terms require manual verification", () => {
    expect(
      strategyPlan({ ...input, terms: { ...terms, eligible: null } }).status,
    ).toBe("MANUAL_VERIFICATION");
    expect(strategyPlan({ ...input, controls: defaultControls }).status).toBe(
      "MANUAL_VERIFICATION",
    );
  });
  it("no additional required wagering triggers redemption review", () =>
    expect(
      strategyPlan({ ...input, terms: { ...terms, playthroughRemaining: "0" } })
        .status,
    ).toBe("STOP_REDEEM"));
  it("cannot turn off redemption-first or add mutable cash controls", () => {
    expect(() =>
      controlsSchema.parse({ ...defaultControls, stopWhenRedeemable: false }),
    ).toThrow();
    expect(() =>
      controlsSchema.parse({
        ...defaultControls,
        NEVER_DEPOSIT_USER_FUNDS: false,
      }),
    ).toThrow();
  });
  it("never plans sportsbook betting", () =>
    expect(strategyPlan({ ...input, engine: "SPORTSBOOK" }).status).toBe(
      "BLOCKED",
    ));
});
