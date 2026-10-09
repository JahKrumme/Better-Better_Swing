import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import {
  moneyGroups,
  canAutomate,
  productCapabilities,
  quickUpdateSchema,
  runtimeStatus,
  officialLink,
  zeroIntegrity,
  platformStatus,
  executeSupportedChecks,
  stableJSON,
  type SupportedAccount,
} from "./product";
import { freeFunding, type PolicyEvidence } from "./operations";
const now = new Date("2026-10-09T12:00:00Z");
const permission = (
  stage: PolicyEvidence["stage"],
  extra: Partial<PolicyEvidence> = {},
): PolicyEvidence => ({
  stage,
  decision: "PERMITTED",
  sourceType: "official",
  sourceUrl: "https://example.test/terms",
  excerpt: "Express supported API permission for this operation",
  verifiedAt: now,
  expiresAt: null,
  ...extra,
});
const update = (extra = {}) => ({
  accountId: randomUUID(),
  submissionKey: randomUUID(),
  balance: null,
  redeemable: null,
  playable: null,
  claimed: "UNKNOWN",
  received: null,
  checked: true,
  rewardKind: "UNKNOWN",
  rewardScope: "RECURRING",
  gc: null,
  receivedGC: null,
  playthroughRemaining: null,
  redemptionMinimum: null,
  nextRewardAt: null,
  offerId: null,
  minutes: 0,
  notes: null,
  freeOnly: true,
  ...extra,
});
describe("consumer permission and truthfulness", () => {
  it.each(productCapabilities)(
    "%s requires independent current permission and implementation",
    (cap) => {
      expect(canAutomate(cap, [], true, true, now)).toBe(false);
      expect(canAutomate(cap, [permission(cap)], false, true, now)).toBe(false);
      expect(canAutomate(cap, [permission(cap)], true, false, now)).toBe(false);
      expect(canAutomate(cap, [permission(cap)], true, true, now)).toBe(true);
      for (const decision of ["UNKNOWN", "PROHIBITED"] as const)
        expect(
          canAutomate(cap, [permission(cap, { decision })], true, true, now),
        ).toBe(false);
      expect(
        canAutomate(
          cap,
          [permission(cap, { verifiedAt: new Date(+now - 31 * 86400000) })],
          true,
          true,
          now,
        ),
      ).toBe(false);
      expect(
        canAutomate(
          cap,
          [permission(cap, { verifiedAt: new Date(+now + 1) })],
          true,
          true,
          now,
        ),
      ).toBe(false);
      expect(
        canAutomate(
          cap,
          [permission(cap), permission(cap, { decision: "PROHIBITED" })],
          true,
          true,
          now,
        ),
      ).toBe(false);
    },
  );
  it("public discovery permission does not authorize private reads", () => {
    expect(
      canAutomate("BALANCE", [permission("DISCOVERY")], true, true, now),
    ).toBe(false);
    expect(
      canAutomate("AVAILABILITY", [permission("DISCOVERY")], true, true, now),
    ).toBe(false);
  });
  it("unknown amounts and one free attestation are valid; contradictory receipts are rejected", () => {
    expect(quickUpdateSchema.parse(update()).balance).toBeNull();
    expect(() =>
      quickUpdateSchema.parse(update({ claimed: "YES", received: null })),
    ).not.toThrow();
    for (const bad of [
      { freeOnly: false },
      { claimed: "NO", received: "1" },
      { balance: "1", redeemable: "2" },
      { balance: "1", playable: ".75", redeemable: ".75" },
      { rewardKind: "GC_ONLY", received: "1", claimed: "YES" },
      { minutes: -1 },
      { balance: "-1" },
    ])
      expect(() => quickUpdateSchema.parse(update(bad))).toThrow();
  });
  it("keeps runtime OFF after a stale, future or disabled heartbeat", () => {
    const s = {
      enabled: true,
      heartbeatAt: now,
      lastRunAt: now,
      nextRunAt: new Date(+now + 300000),
    };
    expect(runtimeStatus(s, now).on).toBe(true);
    expect(runtimeStatus(s, new Date(+now + 45001)).on).toBe(false);
    expect(
      runtimeStatus({ ...s, heartbeatAt: new Date(+now + 1) }, now).on,
    ).toBe(false);
    expect(runtimeStatus({ ...s, enabled: false }, now).nextRunAt).toBeNull();
  });
  it("official button rejects malformed, credential, tracking and insecure URLs", () => {
    for (const u of [
      "javascript:alert(1)",
      "http://example.test",
      "https://x:y@example.test",
      "https://example.test/?affiliate=1",
      "https://localhost",
      "https://127.0.0.1",
      "https://example.test:444",
    ])
      expect(officialLink(u)).toBeNull();
    expect(officialLink("https://example.test/redeem")).toBe(
      "https://example.test/redeem",
    );
  });
  it("detects user contribution and malformed imports", () => {
    expect(
      zeroIntegrity([
        { origin: "FREE_PROMOTIONAL", userCashContribution: "0" },
      ]),
    ).toBe(true);
    for (const e of [
      { origin: "PURCHASED", userCashContribution: "0" },
      { origin: "FREE_PROMOTIONAL", userCashContribution: "1" },
      { origin: "FREE_PROMOTIONAL", userCashContribution: "garbage" },
    ])
      expect(zeroIntegrity([e])).toBe(false);
  });
  it("redeem first overrides due rewards, expiry and failed checks", () => {
    const s = platformStatus({
      verified: true,
      redeemable: 100,
      balance: "1",
      due: true,
      pending: 0,
      expiresAt: new Date(+now + 10),
      failed: true,
      now,
    });
    expect(s.kind).toBe("REDEEM_NOW");
    expect(s.action).toBe("REDEEM NOW");
  });
  it("canonical JSON tolerates database object key ordering", () =>
    expect(stableJSON({ b: 2, a: now })).toBe(
      stableJSON({ a: now.toISOString(), b: 2 }),
    ));
});
const supported = (
  extra: Partial<SupportedAccount> = {},
): SupportedAccount => ({
  platformId: "synthetic",
  name: "Synthetic test",
  engine: "CASINO",
  eligible: true,
  excluded: false,
  policies: [permission("CLAIM")],
  supported: { CLAIM: true },
  availableAt: now,
  expiresAt: null,
  funding: freeFunding,
  claim: async () => ({
    received: true,
    receiptId: "receipt-1",
    amount: "1",
    currency: "SC",
    freeOnly: true,
  }),
  received: async () => true,
  ...extra,
});
describe("mock authorized orchestration; no real platforms", () => {
  it("collects only after actual receipt is persisted", async () => {
    const received = vi.fn(async () => true);
    const r = await executeSupportedChecks([supported({ received })], now);
    expect(received).toHaveBeenCalledOnce();
    expect(r.collected).toEqual([
      { platform: "Synthetic test", amount: "1", currency: "SC" },
    ]);
  });
  it("unknown/prohibited/unsupported/expired permissions never call executor", async () => {
    for (const a of [
      supported({ policies: [] }),
      supported({
        policies: [permission("CLAIM", { decision: "PROHIBITED" })],
      }),
      supported({ supported: {} }),
      supported({ expiresAt: now }),
      supported({ eligible: false }),
      supported({ availableAt: new Date(+now + 1) }),
    ]) {
      const claim = vi.fn(a.claim);
      const r = await executeSupportedChecks([{ ...a, claim }], now);
      expect(claim).not.toHaveBeenCalled();
      expect(r.collected).toEqual([]);
    }
  });
  it("missing receipt, failure, paid funds and failed storage cannot announce collection", async () => {
    for (const a of [
      supported({ claim: async () => ({ available: true, amount: "1" }) }),
      supported({
        claim: async () => {
          throw Error("failed");
        },
      }),
      supported({ funding: { ...freeFunding, depositRequired: true } }),
      supported({
        received: async () => {
          throw Error("storage failed");
        },
      }),
    ]) {
      const r = await executeSupportedChecks([a], now);
      expect(r.collected).toEqual([]);
      expect(r.failures).toEqual([a.name]);
    }
  });
  it("repeated receipt storage suppresses duplicate collection", async () => {
    const seen = new Set();
    const a = supported({
      received: async (r) => {
        if (seen.has(r.receiptId)) return false;
        seen.add(r.receiptId);
        return true;
      },
    });
    expect((await executeSupportedChecks([a], now)).collected).toHaveLength(1);
    expect((await executeSupportedChecks([a], now)).collected).toHaveLength(0);
  });
  it("independent permitted discovery, balance, availability capabilities execute; no wagering method exists", async () => {
    const discover = vi.fn(async () => {}),
      balance = vi.fn(async () => {}),
      availability = vi.fn(async () => false),
      claim = vi.fn(async () => ({}));
    const r = await executeSupportedChecks(
      [
        supported({
          engine: "SPORTSBOOK",
          policies: [
            permission("DISCOVERY"),
            permission("BALANCE"),
            permission("AVAILABILITY"),
          ],
          supported: {
            DISCOVERY: true,
            BALANCE: true,
            AVAILABILITY: true,
            GAMEPLAY: true,
          },
          discover,
          balance,
          availability,
          claim,
        }),
      ],
      now,
    );
    expect(discover).toHaveBeenCalledOnce();
    expect(balance).toHaveBeenCalledOnce();
    expect(availability).toHaveBeenCalledOnce();
    expect(claim).not.toHaveBeenCalled();
    expect(r.publicReads).toBe(1);
    expect(r.nothing).toHaveLength(1);
  });
});

describe("consumer balances never mix issuers or cash and promotional units", () => {
  const ps = [
    { id: "a", name: "A", fixture: false, excluded: false },
    { id: "b", name: "B", fixture: false, excluded: false },
    { id: "fixture", name: "Fixture", fixture: true, excluded: false },
    { id: "excluded", name: "Fliff", fixture: false, excluded: true },
  ];
  const accounts = ps.map((p) => ({
    id: p.id,
    platformId: p.id,
    demo: false,
    engine: p.id === "b" ? "SPORTSBOOK" : "CASINO",
    label: p.name,
  }));
  const event = (accountId: string, currency: string, amount: string) => ({
    accountId,
    currency,
    amount,
    eventType: "FREE_REWARD_RECEIVED" as const,
    category: "PROMOTIONAL" as const,
    relatedEventId: null,
    actualCashAmount: null,
    cashCurrency: null,
    notes: null,
    sessionId: null,
    occurredAt: now,
  });
  it("same-named SC issuers and GC stay separate and exclude fixtures, Fliff and demo", () => {
    const es = [
      event("a", "SC", "2"),
      event("a", "GC", "10"),
      event("b", "SC", "3"),
      event("fixture", "SC", "100"),
      event("excluded", "SC", "100"),
    ];
    const g = moneyGroups(accounts, ps, es, "FREE");
    expect(g.map((g) => [g.platform, g.currency, g.amount])).toEqual([
      ["A", "SC", 200],
      ["A", "GC", 1000],
      ["B", "SC", 300],
    ]);
    expect(moneyGroups(accounts, ps, es, "ACTUAL")).toEqual([]);
    expect(
      moneyGroups(
        accounts.map((a) => ({ ...a, demo: true })),
        ps,
        es,
        "FREE",
      ),
    ).toEqual([]);
  });
  it("GC cannot be imported as redeemable or cash even with zero contribution", () => {
    expect(
      zeroIntegrity([
        {
          origin: "FREE_PROMOTIONAL",
          userCashContribution: "0",
          currency: "GC",
          category: "REDEEMABLE",
          actualCashAmount: null,
        },
      ]),
    ).toBe(false);
    expect(
      zeroIntegrity([
        {
          origin: "FREE_PROMOTIONAL",
          userCashContribution: "0",
          currency: "GC",
          category: "PROMOTIONAL",
          actualCashAmount: "1",
        },
      ]),
    ).toBe(false);
  });
});
