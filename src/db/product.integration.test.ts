import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, asc } from "drizzle-orm";
import { db, pool } from "./index";
import * as s from "./schema";
import {
  saveQuickUpdate,
  recordAccountPlay,
  recordAccountRedemption,
  runProductCheck,
  loadProduct,
} from "./product-service";
import { bankroll, freeFunding } from "../domain/operations";
import { type QuickUpdate } from "../domain/product";
const id = randomUUID(),
  other = randomUUID(),
  now = new Date();
let pid = "";
const runIds: string[] = [];
const u = (extra: Partial<QuickUpdate> = {}): QuickUpdate => ({
  accountId: id,
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
  minutes: 1,
  notes: "Synthetic temporary test; not real activity",
  freeOnly: true,
  ...extra,
});
const redeem = (extra: object = {}) => ({
  accountId: id,
  submissionKey: randomUUID(),
  redemptionId: null,
  requestedSC: "1",
  receivedUSD: null,
  requestedAt: now,
  completedAt: null,
  method: "UNKNOWN",
  status: "REQUESTED",
  minutes: 1,
  freeOnly: true,
  ...extra,
});
const rows = () =>
  db
    .select()
    .from(s.ledgerEvents)
    .where(eq(s.ledgerEvents.accountId, id))
    .orderBy(asc(s.ledgerEvents.sequence));
beforeAll(async () => {
  pid = (
    await db.select().from(s.platforms).where(eq(s.platforms.slug, "realprize"))
  )[0].id;
  await db.insert(s.bankrollAccounts).values([
    {
      id,
      platformId: pid,
      engine: "CASINO",
      demo: false,
      label: "Synthetic product integration",
      key: `product-test:${id}`,
    },
    {
      id: other,
      platformId: pid,
      engine: "CASINO",
      demo: false,
      label: "Synthetic second account",
      key: `product-test:${other}`,
    },
  ]);
});
afterAll(async () => {
  await db.delete(s.bankrollAccounts).where(eq(s.bankrollAccounts.id, id));
  await db.delete(s.bankrollAccounts).where(eq(s.bankrollAccounts.id, other));
  for (const rid of runIds)
    await db.delete(s.productRuns).where(eq(s.productRuns.id, rid));
  await pool.end();
});
describe("RealPrize consumer bookkeeping", () => {
  it("starts unknown, with no invented credit", async () => {
    const d = await loadProduct();
    expect(
      d.cards.find((c) => c.platform.slug === "realprize")?.balance,
    ).toBeNull();
    expect((await rows()).length).toBe(0);
  });
  it("balance increase alone is a correction, not received income", async () => {
    await saveQuickUpdate(u({ balance: "10", playable: "10" }));
    expect(
      (await rows()).some((e) => e.eventType === "FREE_REWARD_RECEIVED"),
    ).toBe(false);
  });
  it("actual claim recorded once across replay and separate repeated check", async () => {
    const input = u({
      balance: "11",
      playable: "11",
      claimed: "YES",
      rewardKind: "SC_ONLY",
      received: "1",
    });
    await saveQuickUpdate(input);
    await saveQuickUpdate(input);
    await saveQuickUpdate({ ...input, submissionKey: randomUUID() });
    expect(
      (await rows()).filter((e) => e.eventType === "FREE_REWARD_RECEIVED"),
    ).toHaveLength(1);
    await expect(
      saveQuickUpdate({ ...input, received: "2", submissionKey: randomUUID() }),
    ).rejects.toThrow(/different/);
  });
  it("same key with changed data is rejected", async () => {
    const input = u({ balance: "11" });
    await saveQuickUpdate(input);
    await expect(saveQuickUpdate({ ...input, balance: "12" })).rejects.toThrow(
      /key/,
    );
  });
  it("rejects paid funding, free-only omission, impossible allocations and sportsbook account", async () => {
    await expect(
      saveQuickUpdate(u(), { ...freeFunding, depositRequired: true }),
    ).rejects.toThrow();
    await expect(
      saveQuickUpdate({ ...u(), freeOnly: false }),
    ).rejects.toThrow();
    await expect(
      saveQuickUpdate(u({ balance: "1", redeemable: "2" })),
    ).rejects.toThrow();
    const sid = randomUUID();
    await db.insert(s.bankrollAccounts).values({
      id: sid,
      platformId: pid,
      engine: "SPORTSBOOK",
      demo: false,
      label: "Synthetic",
      key: sid,
    });
    try {
      await expect(saveQuickUpdate(u({ accountId: sid }))).rejects.toThrow(
        /casino/,
      );
    } finally {
      await db.delete(s.bankrollAccounts).where(eq(s.bankrollAccounts.id, sid));
    }
  });
  it("records manual play with exact arithmetic, preserves unknown progress", async () => {
    await saveQuickUpdate(
      u({ balance: "11", playable: "11", playthroughRemaining: "2" }),
    );
    const p = {
      accountId: id,
      submissionKey: randomUUID(),
      game: "Synthetic",
      start: "11",
      wager: "1",
      end: "10",
      result: "LOSS",
      contribution: null,
      minutes: 1,
      freeOnly: true,
    };
    await recordAccountPlay(p);
    await recordAccountPlay(p);
    const last = (
      await db
        .select()
        .from(s.accountSnapshots)
        .where(eq(s.accountSnapshots.accountId, id))
        .orderBy(asc(s.accountSnapshots.sequence))
    ).at(-1);
    expect(last?.payload.playthroughRemaining).toBeNull();
    expect(
      (await rows()).filter((e) => e.eventType === "PROMOTIONAL_WAGER"),
    ).toHaveLength(1);
  });
  it("redeemable balance blocks manual play and reserves each request", async () => {
    await saveQuickUpdate(u({ balance: "10", playable: "8", redeemable: "2" }));
    await expect(
      recordAccountPlay({
        accountId: id,
        submissionKey: randomUUID(),
        game: "Synthetic",
        start: "8",
        wager: "1",
        end: "7",
        result: "LOSS",
        contribution: "1",
        minutes: 0,
        freeOnly: true,
      }),
    ).rejects.toThrow(/STOP PLAYING/);
    const r = redeem();
    await recordAccountRedemption(r);
    await recordAccountRedemption(r);
    const unit = (await rows())[0].currency;
    expect(
      bankroll((await rows()).filter((e) => e.currency === unit)).reserved,
    ).toBe(100);
    await expect(
      recordAccountRedemption(redeem({ requestedSC: "2" })),
    ).rejects.toThrow();
  });
  it("unknown cash stays unknown; one later actual value can be recorded", async () => {
    const prior = (
      await db
        .select()
        .from(s.accountRedemptions)
        .where(eq(s.accountRedemptions.accountId, id))
    )[0];
    await recordAccountRedemption(
      redeem({ redemptionId: prior.id, status: "COMPLETED", completedAt: now }),
    );
    expect(
      (await rows()).filter((e) => e.eventType === "REDEMPTION_COMPLETED")[0]
        .actualCashAmount,
    ).toBeNull();
    await recordAccountRedemption(
      redeem({
        redemptionId: prior.id,
        status: "COMPLETED",
        completedAt: now,
        receivedUSD: "0.90",
      }),
    );
    await expect(
      recordAccountRedemption(
        redeem({
          redemptionId: prior.id,
          status: "COMPLETED",
          completedAt: now,
          receivedUSD: "1",
        }),
      ),
    ).rejects.toThrow(/rewritten/);
    expect(
      (await rows()).filter((e) => e.eventType === "REDEMPTION_VALUE_RECORDED"),
    ).toHaveLength(1);
  });
  it("another account cannot complete a request", async () => {
    const prior = (
      await db
        .select()
        .from(s.accountRedemptions)
        .where(eq(s.accountRedemptions.accountId, id))
    )[0];
    await expect(
      recordAccountRedemption(
        redeem({
          accountId: other,
          redemptionId: prior.id,
          status: "COMPLETED",
          completedAt: now,
        }),
      ),
    ).rejects.toThrow(/another/);
  });
  it("cancelled request releases balance without cash and cannot reopen", async () => {
    const r = redeem();
    await recordAccountRedemption(r);
    const prior = (
      await db
        .select()
        .from(s.accountRedemptions)
        .where(eq(s.accountRedemptions.key, r.submissionKey))
    )[0];
    await recordAccountRedemption({
      ...r,
      submissionKey: randomUUID(),
      redemptionId: prior.id,
      status: "CANCELLED",
    });
    const events = await rows();
    expect(
      bankroll(events.filter((e) => e.currency === events[0].currency))
        .reserved,
    ).toBe(0);
    await expect(
      recordAccountRedemption({
        ...r,
        submissionKey: randomUUID(),
        redemptionId: prior.id,
      }),
    ).rejects.toThrow(/reopened/);
  });
  it("GC stays noncash and unknown receipt stays unminted", async () => {
    await saveQuickUpdate(
      u({
        claimed: "YES",
        rewardScope: "OTHER",
        rewardKind: "GC_ONLY",
        receivedGC: "20",
        gc: "20",
      }),
    );
    expect(
      (await rows())
        .filter((e) => e.currency === "GC")
        .every(
          (e) => e.category === "PROMOTIONAL" && e.actualCashAmount === null,
        ),
    ).toBe(true);
    await saveQuickUpdate(
      u({
        claimed: "YES",
        rewardScope: "OTHER",
        rewardKind: "GC_ONLY",
        receivedGC: "20",
        gc: "20",
      }),
    );
    expect(
      (await rows()).filter(
        (e) => e.currency === "GC" && e.eventType === "FREE_REWARD_RECEIVED",
      ),
    ).toHaveLength(1);
    const count = (await rows()).filter(
      (e) => e.eventType === "FREE_REWARD_RECEIVED",
    ).length;
    await saveQuickUpdate(
      u({ claimed: "YES", rewardScope: "OTHER", balance: "9" }),
    );
    expect(
      (await rows()).filter((e) => e.eventType === "FREE_REWARD_RECEIVED"),
    ).toHaveLength(count);
  });
  it("failed integrity check is persisted, leaves balances intact and marks attention", async () => {
    const before = await rows(),
      stamp = new Date();
    const attentionKey = `synthetic:${id}`;
    await db.insert(s.attentionItems).values({
      key: attentionKey,
      platformId: pid,
      kind: "FREE_MONEY_READY",
      title: "Synthetic failure check",
      priority: 4,
      active: true,
      updatedAt: stamp,
    });
    const [bad] = await db
      .insert(s.ledgerEvents)
      .values({
        accountId: id,
        currency: "GC",
        eventType: "REDEMPTION_COMPLETED",
        category: "REDEEMED",
        amount: "1",
        actualCashAmount: "1",
        cashCurrency: "USD",
        occurredAt: stamp,
        key: `synthetic-integrity:${randomUUID()}`,
        sourceKind: "USER_OBSERVATION",
        origin: "FREE_PROMOTIONAL",
        userCashContribution: "0",
        notes: "Synthetic corrupt import for isolated test",
      })
      .returning();
    try {
      await expect(runProductCheck("MANUAL", stamp)).rejects.toThrow(
        /INTEGRITY/,
      );
      const [r] = await db
        .select()
        .from(s.productRuns)
        .where(eq(s.productRuns.startedAt, stamp));
      runIds.push(r.id);
      expect(r.outcome).toBe("FAILED");
      const [attention] = await db
        .select()
        .from(s.attentionItems)
        .where(eq(s.attentionItems.key, attentionKey));
      expect(attention.kind).toBe("CHECK_FAILED");
      expect((await rows()).filter((e) => e.id !== bad.id).length).toBe(
        before.length,
      );
    } finally {
      await db.delete(s.ledgerEvents).where(eq(s.ledgerEvents.id, bad.id));
      await db
        .delete(s.attentionItems)
        .where(eq(s.attentionItems.key, attentionKey));
    }
  });
  it("check lock prevents overlap and runs persist with manual fallback", async () => {
    const client = await pool.connect();
    try {
      await client.query("SELECT pg_advisory_lock(7439012)");
      expect((await runProductCheck("MANUAL")).busy).toBe(true);
    } finally {
      await client.query("SELECT pg_advisory_unlock(7439012)");
      client.release();
    }
    const r = await runProductCheck("MANUAL");
    expect(r.result?.collected).toEqual([]);
    expect(r.result?.needsYou).toContain("RealPrize");
    const all = await db.select().from(s.productRuns);
    if (r.runId) runIds.push(r.runId);
    expect(all.some((r) => r.outcome === "COMPLETE")).toBe(true);
  });
});
