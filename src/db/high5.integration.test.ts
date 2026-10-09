import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db, pool } from "./index";
import {
  bankrollAccounts,
  high5Sources,
  offerEvidence,
  claims,
  ledgerEvents,
  operationalActions,
  platforms,
  offers,
  platformSources,
  actionPolicyEvidence,
  high5Redemptions,
} from "./schema";
import {
  recordHigh5Update,
  recordHigh5Play,
  recordHigh5Redemption,
  loadHigh5,
  persistHigh5PublicSources,
  importHigh5PublicReview,
  reviewHigh5PublicSources,
} from "./high5-service";
import { refreshOperations, recordLedgerEvent } from "./operations-service";
import { loadData } from "./queries";
import { freeFunding } from "../domain/operations";
import type { High5Update } from "../domain/high5";
import baseline from "../../research/high5-public-review.json";
const aid = randomUUID(),
  demo = randomUUID(),
  oid = randomUUID(),
  now = new Date();
let pid = "";
let flags: { id: string; value: boolean }[] = [];
let capture: Date;
const captures: Date[] = [];
const u = (extra: Partial<High5Update> = {}) => ({
  accountId: aid,
  submissionKey: randomUUID(),
  legacyOfferId: null,
  checkedReward: true,
  rewardKind: "UNKNOWN" as const,
  rewardClaimed: "UNKNOWN" as const,
  rewardScope: "RECURRING" as const,
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
  minutes: 1,
  freeOnly: true as const,
  notes: "Synthetic temporary test observation, not real activity",
  ...extra,
});
const play = (extra: object = {}) => ({
  accountId: aid,
  submissionKey: randomUUID(),
  game: "Synthetic test game",
  start: "10",
  wager: "0.10",
  end: "9.90",
  result: "LOSS",
  contribution: "0.10",
  minutes: 1,
  freeOnly: true,
  ...extra,
});
const redemption = (extra: object = {}) => ({
  accountId: aid,
  submissionKey: randomUUID(),
  redemptionId: null,
  requestedSC: "5",
  receivedUSD: null,
  requestedAt: now,
  completedAt: null,
  method: "PRIZEOUT",
  status: "REQUESTED",
  minutes: 1,
  freeOnly: true,
  ...extra,
});
beforeAll(async () => {
  const [p] = await db
    .select()
    .from(platforms)
    .where(eq(platforms.slug, "high-5-casino"));
  pid = p.id;
  flags = (
    await db.select().from(offers).where(eq(offers.platformId, pid))
  ).map((o) => ({ id: o.id, value: o.high5PublicReviewRequired }));
  await db.insert(bankrollAccounts).values([
    {
      id: aid,
      key: "high5-test:" + aid,
      platformId: pid,
      engine: "CASINO",
      label: "Synthetic temporary Phase4 bookkeeping test",
      demo: false,
    },
    {
      id: demo,
      key: "high5-test:" + demo,
      platformId: pid,
      engine: "CASINO",
      label: "Synthetic temporary demo",
      demo: true,
    },
  ]);
});
afterAll(async () => {
  try {
    await db
      .delete(operationalActions)
      .where(eq(operationalActions.offerId, oid));
    await db.delete(claims).where(eq(claims.offerId, oid));
    await db.delete(offerEvidence).where(eq(offerEvidence.offerId, oid));
    await db.delete(offers).where(eq(offers.id, oid));
    await db
      .delete(high5Redemptions)
      .where(eq(high5Redemptions.accountId, aid));
    for (const id of [aid, demo])
      await db.delete(bankrollAccounts).where(eq(bankrollAccounts.id, id));
    for (const capture of captures) {
      await db
        .delete(high5Sources)
        .where(eq(high5Sources.retrievedAt, capture));
      await db
        .delete(platformSources)
        .where(
          and(
            eq(platformSources.platformId, pid),
            eq(platformSources.retrievedAt, capture),
          ),
        );
      await db
        .delete(actionPolicyEvidence)
        .where(
          and(
            eq(actionPolicyEvidence.platformId, pid),
            eq(actionPolicyEvidence.verifiedAt, capture),
          ),
        );
    }
    for (const f of flags)
      await db
        .update(offers)
        .set({ high5PublicReviewRequired: f.value })
        .where(eq(offers.id, f.id));
  } finally {
    await pool.end();
  }
});
describe("High 5 real manual PostgreSQL workflow", () => {
  it("rejects demo accounts and purchased bankroll without observations", async () => {
    await expect(recordHigh5Update(u({ accountId: demo }))).rejects.toThrow(
      "Real High 5",
    );
    expect(await loadHigh5(demo)).toBeNull();
    await expect(
      recordHigh5Update({ ...u(), freeOnly: false }),
    ).rejects.toThrow();
    await expect(
      recordHigh5Update(u(), { ...freeFunding, purchaseRequired: true }),
    ).rejects.toThrow("Zero-user-money");
    expect((await loadHigh5(aid))?.updates).toHaveLength(0);
  });
  it("unknown claimed reward creates no inferred SC receipt and is idempotent", async () => {
    const v = u({ rewardClaimed: "YES", rewardKind: "SC_ONLY" });
    const [a, b] = await Promise.all([
      recordHigh5Update(v, freeFunding, now),
      recordHigh5Update(v, freeFunding, now),
    ]);
    expect(a.id).toBe(b.id);
    const d = (await loadHigh5(aid))!;
    expect(d.rewards).toHaveLength(1);
    expect(d.metrics.unknownSC).toBe(1);
    expect(d.events).toHaveLength(0);
    await expect(
      recordHigh5Update({ ...v, sc: "1" }, freeFunding, now),
    ).rejects.toThrow("different contents");
  });
  it("clarifies unknown grant with current balance, emits exactly one free SC receipt", async () => {
    const v = u({
      rewardClaimed: "YES",
      rewardKind: "SC_ONLY",
      rewardSC: "10",
      sc: "10",
      playableSC: "10",
      redeemableSC: "0",
      playthroughRequired: "1",
      playthroughPlayed: "0",
      playthroughRemaining: "1",
    });
    await recordHigh5Update(v, freeFunding, now);
    await recordHigh5Update(
      { ...v, submissionKey: randomUUID() },
      freeFunding,
      now,
    );
    const d = (await loadHigh5(aid))!;
    expect(
      d.events.filter((e) => e.eventType === "FREE_REWARD_RECEIVED"),
    ).toHaveLength(1);
    expect(d.balance.balances.PLAYABLE).toBe(1000);
    expect(d.metrics.freeSC).toBe(1000);
    expect(d.state?.playthroughRemaining).toBe("1");
    expect(
      d.events.every(
        (e) =>
          e.sourceKind === "USER_OBSERVATION" &&
          e.userCashContribution === "0.00",
      ),
    ).toBe(true);
  });
  it("GC-only and no-reward checks stay distinct without cash or added SC", async () => {
    const later = new Date(now.getTime() + 4 * 3600000);
    await recordHigh5Update(
      u({
        rewardKind: "GC_ONLY",
        rewardClaimed: "YES",
        rewardGC: "1000",
        gc: "1000",
      }),
      freeFunding,
      later,
    );
    await recordHigh5Update(
      u({ rewardKind: "NO_REWARD", rewardClaimed: "NO" }),
      freeFunding,
      new Date(later.getTime() + 4 * 3600000),
    );
    const d = (await loadHigh5(aid))!;
    expect(d.metrics.freeSC).toBe(1000);
    expect(d.metrics.actualUSD).toBe(0);
    expect(
      d.events
        .filter((e) => e.currency === "GC")
        .every(
          (e) => e.category === "PROMOTIONAL" && e.actualCashAmount === null,
        ),
    ).toBe(true);
    expect(d.rewards.map((r) => r.kind)).toEqual(
      expect.arrayContaining(["SC_ONLY", "GC_ONLY", "NO_REWARD"]),
    );
    expect(d.state?.playthroughRemaining).toBeNull();
  });
  it("manual play rejects impossible arithmetic and reconciles actual result/contribution", async () => {
    await recordHigh5Update(
      u({
        sc: "10",
        playableSC: "10",
        redeemableSC: "0",
        playthroughRequired: "1",
        playthroughPlayed: "0",
        playthroughRemaining: "1",
      }),
      freeFunding,
      now,
    );
    await expect(recordHigh5Play(play({ end: "9.80" }))).rejects.toThrow(
      "Impossible",
    );
    const v = play();
    await recordHigh5Play(v, freeFunding, now);
    await recordHigh5Play(v, freeFunding, now);
    const d = (await loadHigh5(aid))!;
    expect(d.balance.balances.PLAYABLE).toBe(990);
    expect(d.metrics.losses).toBe(10);
    expect(d.metrics.wagered).toBe(10);
    expect(d.state?.playthroughRemaining).toBe("0.90");
    expect(d.updates.filter((o) => o.operation === "MANUAL_PLAY")).toHaveLength(
      1,
    );
  });
  it("push and win record gross settlements without inventing contribution", async () => {
    await recordHigh5Play(
      play({ start: "9.90", end: "9.90", result: "PUSH", contribution: null }),
      freeFunding,
      now,
    );
    await recordHigh5Play(
      play({ start: "9.90", end: "10.00", result: "WIN", contribution: null }),
      freeFunding,
      now,
    );
    const d = (await loadHigh5(aid))!;
    expect(d.metrics.wins).toBe(10);
    expect(d.metrics.losses).toBe(10);
    expect(d.state?.playthroughRemaining).toBeNull();
  });
  it("redeemable report creates highest-priority manual action and STOP PLAYING", async () => {
    await recordHigh5Update(
      u({
        sc: "10",
        playableSC: "5",
        redeemableSC: "5",
        playthroughRemaining: "0",
      }),
      freeFunding,
      now,
    );
    const d = (await loadHigh5(aid))!;
    expect(d.recommendation.status).toBe("STOP PLAYING");
    const tasks = await db
      .select()
      .from(operationalActions)
      .where(
        and(
          eq(operationalActions.accountId, aid),
          eq(operationalActions.status, "PENDING"),
        ),
      );
    expect(
      tasks.some(
        (t) =>
          t.actionType === "REQUEST_REDEMPTION" &&
          t.executionMode === "MANUAL_REQUIRED",
      ),
    ).toBe(true);
    await expect(
      recordHigh5Play(play({ start: "5", end: "4.90" })),
    ).rejects.toThrow("STOP PLAYING");
  });
  it("reservation prevents double redemption and balance removal", async () => {
    await recordHigh5Redemption(redemption(), freeFunding, now);
    await expect(
      recordHigh5Redemption(redemption(), freeFunding, now),
    ).rejects.toThrow("unreserved");
    await expect(
      recordHigh5Update(u({ sc: "5", redeemableSC: "0" }), freeFunding, now),
    ).rejects.toThrow("reserved");
    expect((await loadHigh5(aid))?.metrics.pending).toBe(500);
  });
  it("completion with unknown actual proceeds does not infer USD; one fill allowed", async () => {
    const d = (await loadHigh5(aid))!,
      id = d.redemptions[0].id;
    await recordHigh5Redemption(
      redemption({ redemptionId: id, status: "COMPLETED", completedAt: now }),
      freeFunding,
      now,
    );
    expect((await loadHigh5(aid))?.metrics.unknownCash).toBe(1);
    expect((await loadHigh5(aid))?.metrics.actualUSD).toBe(0);
    const v = redemption({
      redemptionId: id,
      status: "COMPLETED",
      completedAt: now,
      receivedUSD: "4.50",
    });
    await recordHigh5Redemption(v, freeFunding, now);
    await recordHigh5Redemption(v, freeFunding, now);
    const result = (await loadHigh5(aid))!;
    expect(result.metrics.actualUSD).toBe(450);
    expect(result.metrics.redeemedSC).toBe(500);
    expect(result.metrics.pending).toBe(0);
    expect(result.balance.userCashContributed).toBe(0);
    await expect(
      recordHigh5Redemption(
        { ...v, submissionKey: randomUUID() },
        freeFunding,
        now,
      ),
    ).rejects.toThrow("already completed");
  });
  it("cancellation releases reserved SC without cash", async () => {
    await recordHigh5Update(
      u({ sc: "5", redeemableSC: "5", playableSC: "0" }),
      freeFunding,
      now,
    );
    const id = await recordHigh5Redemption(redemption(), freeFunding, now);
    await recordHigh5Redemption(
      redemption({ redemptionId: id, status: "CANCELLED" }),
      freeFunding,
      now,
    );
    const d = (await loadHigh5(aid))!;
    expect(d.metrics.pending).toBe(0);
    expect(d.balance.availableRedeemable).toBe(500);
    expect(d.metrics.actualUSD).toBe(450);
  });
  it("database enforces zero-user-money invariant", async () => {
    await expect(
      db.insert(ledgerEvents).values({
        accountId: aid,
        eventType: "FREE_REWARD_RECEIVED",
        currency: "SC",
        amount: "1",
        category: "PROMOTIONAL",
        occurredAt: now,
        key: randomUUID(),
        userCashContribution: "1",
      }),
    ).rejects.toThrow();
  });
  it("baseline import is repeatable and public sources never count as account observations", async () => {
    const count = (await db.select().from(high5Sources)).length;
    await importHigh5PublicReview();
    await importHigh5PublicReview();
    expect((await db.select().from(high5Sources)).length).toBe(count);
    const d = (await loadHigh5(aid))!;
    expect(
      d.sources.every((s) =>
        s.sourceUrl.startsWith("https://high5casino.com/"),
      ),
    ).toBe(true);
    expect(d.metrics.projectedMonthlySC).toBeNull();
    expect(
      (await loadHigh5(aid, new Date(now.getTime() + 31 * 86400000)))
        ?.termsCurrent,
    ).toBe(false);
  });
  it("a selected published offer updates the legacy claim, and refresh never reimports its receipt", async () => {
    const data = await loadData(),
      source = data.offers.find(
        (o) => o.platformId === pid && o.result.eligible,
      )!;
    const [raw] = await db
      .select()
      .from(offers)
      .where(eq(offers.id, source.id));
    await db.insert(offers).values({
      ...raw,
      id: oid,
      title: "Synthetic temporary High5 legacy-bridge test — not a real offer",
      recurringCadence: "once",
      offerType: "signup",
      promotionalAmount: null,
      facePromotionalValue: null,
    });
    await db.insert(offerEvidence).values(
      source.evidence.map((e) => ({
        ...e,
        id: randomUUID(),
        offerId: oid,
        extractedText:
          "Synthetic local verification test, not actual official evidence.",
      })),
    );
    await recordHigh5Update(
      u({
        legacyOfferId: oid,
        rewardScope: "RECURRING",
        rewardKind: "SC_ONLY",
        rewardClaimed: "YES",
        rewardSC: "1",
        sc: "6",
        redeemableSC: "5",
        playableSC: "0",
      }),
      freeFunding,
      now,
    );
    const [c] = await db
      .select()
      .from(claims)
      .where(and(eq(claims.offerId, oid), eq(claims.claimState, "CLAIMED")));
    expect(c.promotionalValueReceived).toBe("1.00");
    expect((await loadHigh5(aid))?.metrics.signupSC).toBe(100);
    await refreshOperations(now);
    await refreshOperations(now);
    const receipts = await db
      .select()
      .from(ledgerEvents)
      .where(eq(ledgerEvents.claimId, c.id));
    expect(receipts).toHaveLength(1);
    expect(receipts[0].accountId).toBe(aid);
    expect(receipts[0].sourceKind).toBe("USER_OBSERVATION");
  });
  it("generic ledger APIs cannot convert High5 GC to redeemable value", async () => {
    await expect(
      recordLedgerEvent(aid, {
        eventType: "PROMOTIONAL_ACTIVATED",
        currency: "GC",
        category: "PLAYABLE",
        amount: "1",
        occurredAt: now,
        key: randomUUID(),
        notes: "Synthetic attempt",
      }),
    ).rejects.toThrow("GC is never redeemable");
  });
  it("changed critical public evidence flags offers and needs re-verification", async () => {
    capture = new Date(now.getTime() + 60000);
    captures.push(capture);
    const rows = baseline.documents.map((d) => ({
      ...d,
      retrievedAt: capture,
      outcome: "READABLE",
      notes: "Synthetic local source-change test; deleted after test",
      excerpts: Object.fromEntries(Object.entries(d.excerpts)) as Record<
        string,
        string
      >,
    }));
    const rules = rows[0];
    rules.excerpts = {
      ...rules.excerpts,
      minimum: "Synthetic changed minimum; not actual official terms.",
    };
    rules.fingerprint = createHash("sha256")
      .update(
        JSON.stringify(
          Object.fromEntries(
            Object.entries(rules.excerpts).sort(([a], [b]) =>
              a.localeCompare(b),
            ),
          ),
        ),
      )
      .digest("hex");
    expect((await persistHigh5PublicSources(rows, capture)).changed).toBe(true);
    expect(
      (await db.select().from(offers).where(eq(offers.platformId, pid))).every(
        (o) => o.high5PublicReviewRequired,
      ),
    ).toBe(true);
    const d = (await loadHigh5(aid, capture))!;
    expect(d.termsCurrent).toBe(false);
    expect(d.adapterSupport.claimReward).toBe("SUPPORTED_MANUAL");
  });
  it("manual review clears only independently eligible offers after matching core evidence, while games remain unavailable", async () => {
    const date = new Date(now.getTime() + 180000);
    captures.push(date);
    const rows = baseline.documents.map((d) => ({
      ...d,
      retrievedAt: date,
      outcome: d.sourceKey === "games" ? "ACCESS_FAILED" : "READABLE",
      fingerprint: d.sourceKey === "games" ? null : d.fingerprint,
      excerpts: d.sourceKey === "games" ? {} : d.excerpts,
      notes: "Synthetic review-flow test; removed after test",
    }));
    await persistHigh5PublicSources(rows, date);
    const reviewed = await reviewHigh5PublicSources(date);
    expect(reviewed.reviewedOffers).toBeGreaterThanOrEqual(2);
    const state = (await loadHigh5(aid, date))!;
    expect(state.termsCurrent).toBe(true);
    expect(
      state.sourceStatus.find((s) => s?.sourceKey === "games")?.outcome,
    ).toBe("ACCESS_FAILED");
    expect(state.adapterSupport.executePromotionalPlay).toBe("UNAVAILABLE");
  });
  it("public origin and future timestamps are validated", async () => {
    const rows = baseline.documents.map((d) => ({
      ...d,
      outcome: "READABLE",
      notes: "test",
    }));
    await expect(
      persistHigh5PublicSources(
        rows.map((r, i) =>
          i ? r : { ...r, sourceUrl: "https://other.example" },
        ),
      ),
    ).rejects.toThrow("Unexpected source");
    await expect(
      persistHigh5PublicSources(
        rows.map((r) => ({
          ...r,
          retrievedAt: new Date(Date.now() + 86400000),
        })),
      ),
    ).rejects.toThrow("future evidence");
  });
});
