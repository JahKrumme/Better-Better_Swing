import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, pool } from "./index";
import {
  platforms,
  offers,
  offerEvidence,
  claims,
  bankrollAccounts,
  ledgerEvents,
  actionPolicyEvidence,
  rewardSchedules,
  casinoStrategies,
  demoRuns,
} from "./schema";
import { loadData } from "./queries";
import { recordManualClaim } from "./claim-service";
import {
  loadOperations,
  refreshOperations,
  recordLedgerEvent,
  finishManualAction,
  startDemo,
  advanceDemo,
  demoSteps,
  saveStrategy,
  unknownTerms,
} from "./operations-service";
import { evidenceFields, moneyFields } from "../domain/eligibility";
import { phase2EvidenceFields } from "../domain/verification";
import { bankroll, freeFunding, defaultControls } from "../domain/operations";
const pid = randomUUID(),
  oid = randomUUID(),
  now = new Date(),
  ageBefore = process.env.PROFILE_AGE;
let accountId = "",
  claimId = "",
  requestId = "",
  runId = "";
beforeAll(async () => {
  process.env.PROFILE_AGE = "25";
  await db.insert(platforms).values({
    id: pid,
    slug: "ops-test-" + pid,
    name: "Synthetic operational casino — not real",
    homepageUrl: "https://ops-test.example",
    category: "sweepstakes_casino",
  });
  await db.insert(offers).values({
    id: oid,
    platformId: pid,
    title: "Synthetic operational daily reward — not real",
    description: "Temporary local integration record.",
    offerType: "daily",
    recurringCadence: "daily",
    discoveredAt: now,
    researchVersion: 2,
    promotionalCurrency: "TEST SC",
    signupRequired: false,
    identityVerificationRequired: true,
    ...Object.fromEntries(moneyFields.map((f) => [f, false])),
    entryFeeRequired: false,
    minimumAge: 21,
    playthroughRequirement: "1x",
    minimumRedemption: "5",
    geographicEligibility: {
      countries: ["US"],
      states: ["KS"],
      excludedStates: [],
    },
    sourceUrl: "https://ops-test.example/rules",
    lastVerifiedAt: now,
  });
  await db.insert(offerEvidence).values(
    [...evidenceFields, ...phase2EvidenceFields].map((field) => ({
      offerId: oid,
      field,
      sourceUrl: "https://ops-test.example/rules",
      sourceType: "official" as const,
      extractedText:
        "Synthetic integration supporting passage; not actual platform evidence.",
      capturedAt: now,
    })),
  );
});
afterAll(async () => {
  try {
    if (runId) {
      const [r] = await db
        .select()
        .from(demoRuns)
        .where(eq(demoRuns.id, runId));
      if (r) {
        await db.delete(demoRuns).where(eq(demoRuns.id, runId));
        for (const id of [r.casinoAccountId, r.sportsbookAccountId])
          await db.delete(bankrollAccounts).where(eq(bankrollAccounts.id, id));
      }
    }
    await db
      .delete(bankrollAccounts)
      .where(eq(bankrollAccounts.platformId, pid));
    await db
      .delete(actionPolicyEvidence)
      .where(eq(actionPolicyEvidence.platformId, pid));
    await db.delete(claims).where(eq(claims.offerId, oid));
    await db.delete(offerEvidence).where(eq(offerEvidence.offerId, oid));
    await db.delete(offers).where(eq(offers.id, oid));
    await db.delete(platforms).where(eq(platforms.id, pid));
  } finally {
    if (ageBefore === undefined) delete process.env.PROFILE_AGE;
    else process.env.PROFILE_AGE = ageBefore;
    await pool.end();
  }
});
const realEvent = (
  eventType:
    | "PROMOTIONAL_ACTIVATED"
    | "BECAME_REDEEMABLE"
    | "REDEMPTION_REQUESTED"
    | "REDEMPTION_COMPLETED"
    | "EXPIRED",
  amount: string,
  category: "PROMOTIONAL" | "PLAYABLE" | "REDEEMABLE" | "REDEEMED",
  extra: object = {},
) => ({
  eventType,
  amount,
  category,
  currency: "TEST SC",
  occurredAt: now,
  notes: "Synthetic manually confirmed terms/result",
  key: randomUUID(),
  ...extra,
});
describe("Phase 3 PostgreSQL operational foundation", () => {
  it("refresh is idempotent, current unknown policy creates manual tasks and observations create no bankroll", async () => {
    await refreshOperations(now);
    await refreshOperations(now);
    const d = await loadOperations();
    const account = d.accounts.find((a) => a.platformId === pid)!;
    accountId = account.id;
    const tasks = d.actions.filter((a) => a.accountId === accountId);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].executionMode).toBe("MANUAL_REQUIRED");
    expect(tasks[0].automationPolicy).toBe("UNKNOWN");
    expect(
      d.observations.find((o) => o.key === "user-high5-phase3")
        ?.observedBalance,
    ).toBe("3.00");
    const schedule = d.schedules.find(
      (s) => s.key === "high5-observed-check-4h",
    )!;
    expect(schedule.spec.hours).toBe(4);
    expect(schedule.purpose).toBe("CHECK_REWARD");
    expect(schedule.sourceType).toBe("observation");
    expect(
      d.events.filter((e) => e.accountId === schedule.accountId),
    ).toHaveLength(0);
  });
  it("paid operations are rejected by the service and database constraint", async () => {
    const e = realEvent("PROMOTIONAL_ACTIVATED", "1", "PLAYABLE");
    await expect(
      recordLedgerEvent(accountId, e, {
        ...freeFunding,
        purchaseRequired: true,
      }),
    ).rejects.toThrow("Zero-user-money");
    await expect(
      db.insert(ledgerEvents).values({
        accountId,
        eventType: "FREE_REWARD_RECEIVED",
        currency: "TEST SC",
        amount: "100",
        category: "PROMOTIONAL",
        occurredAt: now,
        key: randomUUID(),
        userCashContribution: "1",
      }),
    ).rejects.toThrow();
    expect(
      (await loadOperations()).events.filter((e) => e.accountId === accountId),
    ).toHaveLength(0);
  });
  it("concurrent manual claim submissions and repeated refresh import one actual receipt", async () => {
    const result = await Promise.allSettled([
      recordManualClaim(oid, now, "10"),
      recordManualClaim(oid, now, "10"),
    ]);
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const [c] = await db
      .select()
      .from(claims)
      .where(and(eq(claims.offerId, oid), eq(claims.claimState, "CLAIMED")));
    claimId = c.id;
    await refreshOperations(now);
    await refreshOperations(now);
    const d = await loadOperations(),
      es = d.events.filter((e) => e.claimId === claimId);
    expect(es).toHaveLength(1);
    expect(es[0].amount).toBe("10.00");
    expect(
      d.balances.find((b) => b.account.id === accountId)?.balances,
    ).toEqual({ PROMOTIONAL: 1000, PLAYABLE: 0, REDEEMABLE: 0, REDEEMED: 0 });
    expect(d.actions.find((a) => a.accountId === accountId)?.status).toBe(
      "COMPLETED",
    );
  });
  it("idempotent ledger key prevents duplicate transfers under concurrency", async () => {
    const e = realEvent("PROMOTIONAL_ACTIVATED", "10", "PLAYABLE");
    const r = await Promise.all([
      recordLedgerEvent(accountId, e),
      recordLedgerEvent(accountId, e),
    ]);
    expect(r[0].id).toBe(r[1].id);
    await expect(
      recordLedgerEvent(accountId, { ...e, amount: "9" }),
    ).rejects.toThrow("idempotency");
    await expect(
      recordLedgerEvent(accountId, {
        ...e,
        notes: "Changed result under the same submission key",
      }),
    ).rejects.toThrow("idempotency");
    const d = await loadOperations();
    expect(
      d.events.filter(
        (row) =>
          row.key === e.key &&
          row.accountId === accountId &&
          row.eventType === "PROMOTIONAL_ACTIVATED",
      ),
    ).toHaveLength(1);
    expect(
      d.balances.find((b) => b.account.id === accountId)?.balances.PLAYABLE,
    ).toBe(1000);
  });
  it("cannot forge another receipt or execute real gameplay via service", async () => {
    await expect(
      recordLedgerEvent(accountId, {
        ...realEvent("PROMOTIONAL_ACTIVATED", "1", "PLAYABLE"),
        eventType: "FREE_REWARD_RECEIVED",
      }),
    ).rejects.toThrow("manual claims");
    await expect(
      recordLedgerEvent(accountId, {
        ...realEvent("PROMOTIONAL_ACTIVATED", "1", "PLAYABLE"),
        eventType: "PROMOTIONAL_WAGER",
      }),
    ).rejects.toThrow("not supported");
  });
  it("confirmed manual redemption transfers, reserves and records actual cash separately", async () => {
    await recordLedgerEvent(
      accountId,
      realEvent("BECAME_REDEEMABLE", "5", "PLAYABLE"),
    );
    const r = await recordLedgerEvent(
      accountId,
      realEvent("REDEMPTION_REQUESTED", "5", "REDEEMABLE"),
    );
    requestId = r.id;
    await expect(
      recordLedgerEvent(
        accountId,
        realEvent("REDEMPTION_REQUESTED", "1", "REDEEMABLE"),
      ),
    ).rejects.toThrow("unreserved");
    await recordLedgerEvent(
      accountId,
      realEvent("REDEMPTION_COMPLETED", "5", "REDEEMED", {
        relatedEventId: requestId,
        actualCashAmount: "2.50",
        cashCurrency: "USD",
      }),
    );
    const b = (await loadOperations()).balances.find(
      (b) => b.account.id === accountId,
    )!;
    expect(b.balances).toEqual({
      PROMOTIONAL: 0,
      PLAYABLE: 500,
      REDEEMABLE: 0,
      REDEEMED: 500,
    });
    expect(b.cash.get("USD")).toBe(250);
    expect(b.userCashContributed).toBe(0);
    expect(b.realizedReturn).toBeNull();
    await expect(
      recordLedgerEvent(
        accountId,
        realEvent("REDEMPTION_COMPLETED", "5", "REDEEMED", {
          relatedEventId: requestId,
          actualCashAmount: "2.50",
          cashCurrency: "USD",
        }),
      ),
    ).rejects.toThrow("open request");
  });
  it("expiry cannot overdraw a category and wrong categories cannot hide funds", async () => {
    await recordLedgerEvent(accountId, realEvent("EXPIRED", "1", "PLAYABLE"));
    await expect(
      recordLedgerEvent(accountId, realEvent("EXPIRED", "5", "PLAYABLE")),
    ).rejects.toThrow();
    await expect(
      recordLedgerEvent(
        accountId,
        realEvent("PROMOTIONAL_ACTIVATED", "1", "REDEEMED"),
      ),
    ).rejects.toThrow("category");
  });
  it("current affirmative action evidence can queue automatically without enabling real executors", async () => {
    await db.insert(actionPolicyEvidence).values({
      platformId: pid,
      key: "ops-test-policy:" + pid,
      stage: "DISCOVERY",
      decision: "PERMITTED",
      sourceType: "official",
      sourceUrl: "https://ops-test.example/api-policy",
      excerpt:
        "Synthetic permission for checks only; not real platform permission.",
      verifiedAt: now,
    });
    await db.insert(rewardSchedules).values({
      accountId,
      offerId: oid,
      key: "ops-test-check:" + pid,
      spec: {
        kind: "EVERY_N_HOURS",
        hours: 4,
        anchor: now.toISOString(),
        timezone: "America/Chicago",
        windows: [],
      },
      purpose: "CHECK_REWARD",
      sourceType: "official",
      verifiedAt: now,
    });
    await refreshOperations(now);
    let tasks = (await loadOperations()).actions.filter(
      (a) => a.accountId === accountId && a.actionType === "CHECK_REWARD",
    );
    expect(tasks).toHaveLength(1);
    expect(tasks[0].executionMode).toBe("AUTOMATIC");
    await db.insert(actionPolicyEvidence).values({
      platformId: pid,
      key: "ops-test-conflict:" + pid,
      stage: "DISCOVERY",
      decision: "PROHIBITED",
      sourceType: "official",
      sourceUrl: "https://ops-test.example/terms",
      excerpt: "Synthetic conflict; fail closed.",
      verifiedAt: now,
    });
    await refreshOperations(now);
    tasks = (await loadOperations()).actions.filter(
      (a) => a.accountId === accountId && a.actionType === "CHECK_REWARD",
    );
    expect(tasks[0].executionMode).toBe("MANUAL_REQUIRED");
    expect(tasks[0].automationPolicy).toBe("UNKNOWN");
    await finishManualAction(
      tasks[0].id,
      "Synthetic manually inspected reward panel",
      now,
    );
    await expect(
      finishManualAction(tasks[0].id, "duplicate", now),
    ).rejects.toThrow("available");
  });
  it("strategy persists unknown terms, strict controls and no game executor", async () => {
    await saveStrategy(accountId, defaultControls, {
      ...unknownTerms,
      verifiedAt: null,
    });
    const [s] = await db
      .select()
      .from(casinoStrategies)
      .where(eq(casinoStrategies.accountId, accountId));
    expect(s.controls.stopWhenRedeemable).toBe(true);
    expect(s.terms.rtp).toBeNull();
    await expect(
      saveStrategy(
        accountId,
        { ...defaultControls, stopWhenRedeemable: false },
        { ...unknownTerms, verifiedAt: null },
      ),
    ).rejects.toThrow();
  });
  it("complete demo workflow is isolated, race-safe and preserves sportsbook credits", async () => {
    const before = (await loadOperations()).events.length;
    runId = await startDemo(now);
    const result = await Promise.allSettled([
      advanceDemo(runId, 0, now),
      advanceDemo(runId, 0, now),
    ]);
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (let step = 1; step < demoSteps.length; step++)
      await advanceDemo(runId, step, new Date(now.getTime() + step * 1000));
    const d = await loadOperations(true),
      run = d.runs.find((r) => r.id === runId)!;
    expect(run.step).toBe(demoSteps.length);
    const c = d.balances.find((b) => b.account.id === run.casinoAccountId)!,
      s = d.balances.find((b) => b.account.id === run.sportsbookAccountId)!;
    expect(c.balances).toEqual({
      PROMOTIONAL: 0,
      PLAYABLE: 0,
      REDEEMABLE: 0,
      REDEEMED: 995,
    });
    expect(c.cash.get("USD")).toBe(995);
    expect(c.wins).toBe(5);
    expect(c.losses).toBe(10);
    expect(c.wagered).toBe(20);
    expect(s.balances.PLAYABLE).toBe(500);
    expect(s.wagered).toBe(0);
    expect((await loadOperations()).events).toHaveLength(before);
    await expect(
      recordLedgerEvent(
        run.casinoAccountId,
        realEvent("EXPIRED", "1", "PLAYABLE"),
      ),
    ).rejects.toThrow("demo workflow");
  });
  it("ledger ordering is stable and research fixtures remain intact", async () => {
    const d = await loadData();
    expect(d.offers.filter((o) => o.fixture)).toHaveLength(5);
    expect(
      d.offers
        .filter((o) => o.fixture)
        .reduce((n, o) => n + o.evidence.length, 0),
    ).toBe(50);
    const ops = await loadOperations(),
      rows = ops.events.filter((e) => e.accountId === accountId);
    expect(bankroll(rows).balances.PLAYABLE).toBe(400);
    expect(
      rows.every(
        (e) =>
          e.userCashContribution === "0.00" && e.origin === "FREE_PROMOTIONAL",
      ),
    ).toBe(true);
  });
});
