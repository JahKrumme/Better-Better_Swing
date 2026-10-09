import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, notInArray } from "drizzle-orm";
import { z } from "zod";
import { db, pool } from "./index";
import * as s from "./schema";
import { loadData } from "./queries";
import {
  appendAccountObservationEvent,
  refreshOperations,
  loadOperations,
  type EventInput,
} from "./operations-service";
import {
  loadHigh5,
  recordHigh5Update,
  recordHigh5Play,
  recordHigh5Redemption,
} from "./high5-service";
import {
  bankroll,
  cents,
  decimal,
  freeFunding,
  enforceZeroMoney,
  moneyString,
} from "@/domain/operations";
import {
  quickUpdateSchema,
  stableJSON,
  zeroIntegrity,
  moneyGroups,
  platformStatus,
  runtimeStatus,
  friendlyEvent,
  executeSupportedChecks,
  type QuickUpdate,
} from "@/domain/product";
import {
  manualPlayAmounts,
  reconciliationEvents,
  reconciliationTargets,
  type High5Update,
} from "@/domain/high5";
import { opportunityFor } from "@/domain/recurrence";
import { registerRealPrizeAdapter } from "@/domain/adapters";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const hydrate = (v: QuickUpdate) => ({
  ...v,
  nextRewardAt: v.nextRewardAt ? new Date(String(v.nextRewardAt)) : null,
});
const asHigh5 = (v: QuickUpdate): High5Update => ({
  accountId: v.accountId,
  submissionKey: v.submissionKey,
  legacyOfferId: v.offerId,
  checkedReward: v.checked,
  rewardKind: v.rewardKind,
  rewardClaimed: v.claimed,
  rewardScope: v.rewardScope,
  rewardSC: v.received,
  rewardGC: v.receivedGC,
  otherReward: null,
  gc: v.gc,
  sc: v.balance,
  playableSC: v.playable,
  redeemableSC: v.redeemable,
  playthroughRequired: null,
  playthroughPlayed: null,
  playthroughRemaining: v.playthroughRemaining,
  redemptionMinimum: v.redemptionMinimum,
  nextRewardAt: v.nextRewardAt,
  minutes: v.minutes,
  freeOnly: true,
  notes: v.notes,
});
const blank = (id: string, key: string): QuickUpdate => ({
  accountId: id,
  submissionKey: key,
  balance: null,
  redeemable: null,
  playable: null,
  claimed: "UNKNOWN",
  received: null,
  checked: false,
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
});
async function account(tx: Tx, id: string) {
  const [a] = await tx
    .select()
    .from(s.bankrollAccounts)
    .where(eq(s.bankrollAccounts.id, z.uuid().parse(id)))
    .for("update");
  const [p] = a
    ? await tx
        .select()
        .from(s.platforms)
        .where(eq(s.platforms.id, a.platformId))
    : [];
  if (!a || a.demo || a.engine !== "CASINO" || !p || p.fixture || p.excluded)
    throw new Error("A real casino account is required.");
  const events = await tx
    .select()
    .from(s.ledgerEvents)
    .where(eq(s.ledgerEvents.accountId, a.id))
    .orderBy(asc(s.ledgerEvents.sequence));
  if (!zeroIntegrity(events))
    throw new Error("INTEGRITY ERROR: purchased funds or user money detected.");
  const currency =
    p.slug === "high-5-casino"
      ? "SC"
      : ((
          await tx.select().from(s.offers).where(eq(s.offers.platformId, p.id))
        ).find((o) => o.promotionalCurrency && o.purchaseRequired === false)
          ?.promotionalCurrency ?? "SC");
  return { a, p, events, currency };
}
export async function saveQuickUpdate(
  input: unknown,
  funding: unknown = freeFunding,
  now = new Date(),
) {
  enforceZeroMoney(funding);
  const v = quickUpdateSchema.parse(input);
  const original = { ...v };
  const [a] = await db
    .select()
    .from(s.bankrollAccounts)
    .where(eq(s.bankrollAccounts.id, v.accountId));
  const [p] = a
    ? await db
        .select()
        .from(s.platforms)
        .where(eq(s.platforms.id, a.platformId))
    : [];
  if (p?.slug === "high-5-casino")
    return recordHigh5Update(asHigh5(v), funding, now);
  return db.transaction(async (tx) => {
    const { a, p, currency } = await account(tx, v.accountId);
    const [duplicate] = await tx
      .select()
      .from(s.accountSnapshots)
      .where(eq(s.accountSnapshots.submissionKey, v.submissionKey));
    if (duplicate) {
      if (
        duplicate.operation !== "UPDATE" ||
        stableJSON(
          hydrate((duplicate.detail.input ?? duplicate.payload) as QuickUpdate),
        ) !== stableJSON(original)
      )
        throw new Error("Update key reused with different contents.");
      return duplicate;
    }
    const d = await loadData();
    const candidates =
      a.key === `real:${p.id}` &&
      v.claimed === "YES" &&
      ["SC_ONLY", "GC_AND_SC"].includes(v.rewardKind)
        ? d.offers.filter(
            (o) =>
              o.platformId === p.id &&
              !o.fixture &&
              o.result.eligible &&
              (v.rewardScope === "SIGNUP"
                ? o.offerType === "signup"
                : v.rewardScope === "RECURRING"
                  ? ["daily", "weekly"].includes(o.offerType)
                  : false),
          )
        : [];
    const offer = v.offerId
      ? d.offers.find((o) => o.id === v.offerId)
      : candidates.length === 1
        ? candidates[0]
        : undefined;
    if (
      v.offerId &&
      (!offer ||
        offer.platformId !== p.id ||
        offer.fixture ||
        !offer.result.eligible)
    )
      throw new Error("Choose a current free offer for this platform.");
    if (offer) {
      if (offer.offerType === "signup") v.rewardScope = "SIGNUP";
      else if (["daily", "weekly"].includes(offer.offerType))
        v.rewardScope = "RECURRING";
    }
    // A daily clock is a deduplication window, never a promise of availability.
    const day = now.toLocaleDateString("en-CA", {
      timeZone: "America/Chicago",
    });
    const instance =
      v.rewardScope === "SIGNUP"
        ? "signup"
        : offer
          ? `${offer.id}:${offer.currentOpportunity.periodKey}`
          : v.rewardScope === "RECURRING"
            ? `daily:${day}`
            : `other:${day}`;
    const prior = (
      await tx
        .select()
        .from(s.accountSnapshots)
        .where(
          and(
            eq(s.accountSnapshots.accountId, a.id),
            eq(s.accountSnapshots.instanceKey, instance),
          ),
        )
    ).filter((o) => o.operation === "UPDATE" && o.payload.claimed === "YES");
    for (const old of prior) {
      if (v.claimed !== "YES") continue;
      for (const field of ["received", "receivedGC"] as const) {
        if (
          old.payload[field] !== null &&
          v[field] !== null &&
          cents(old.payload[field]!) !== cents(v[field]!)
        )
          throw new Error("Reward already recorded with a different amount.");
        if (
          old.payload[field] === null &&
          v[field] !== null &&
          (field === "received" ? v.balance : v.gc) === null
        )
          throw new Error(
            "Update the current balance when clarifying a previously unknown receipt.",
          );
      }
    }
    const [saved] = await tx
      .insert(s.accountSnapshots)
      .values({
        accountId: a.id,
        submissionKey: v.submissionKey,
        occurredAt: now,
        payload: v,
        instanceKey: instance,
        detail: { input: original },
      })
      .returning();
    const append = (e: EventInput) =>
      appendAccountObservationEvent(tx, a, e, saved.id);
    let legacy: typeof s.claims.$inferSelect | undefined;
    if (
      offer &&
      v.claimed === "YES" &&
      ["SC_ONLY", "GC_AND_SC"].includes(v.rewardKind)
    ) {
      const opportunity = opportunityFor(offer, now);
      await tx
        .insert(s.claims)
        .values({
          ...opportunity,
          claimState: "CLAIMED",
          status: "claimed",
          method: "manual",
          claimedDate: now,
          promotionalValueReceived: v.received,
        })
        .onConflictDoNothing();
      [legacy] = await tx
        .select()
        .from(s.claims)
        .where(
          and(
            eq(s.claims.offerId, offer.id),
            eq(s.claims.periodKey, opportunity.periodKey),
          ),
        )
        .for("update");
      if (
        legacy.promotionalValueReceived !== null &&
        v.received !== null &&
        cents(legacy.promotionalValueReceived) !== cents(v.received)
      )
        throw new Error("Legacy receipt conflicts with the actual amount.");
      await tx
        .update(s.claims)
        .set({
          claimState: [
            "PLAYTHROUGH_REQUIRED",
            "REDEEMABLE",
            "REDEEMED",
          ].includes(legacy.claimState)
            ? legacy.claimState
            : "CLAIMED",
          status: "claimed",
          claimedDate: legacy.claimedDate ?? now,
          promotionalValueReceived:
            legacy.promotionalValueReceived ?? v.received,
        })
        .where(eq(s.claims.id, legacy.id));
    }
    for (const [unit, field] of [
      [currency, "received"],
      ["GC", "receivedGC"],
    ] as const) {
      const amount = v[field];
      if (
        v.claimed !== "YES" ||
        amount === null ||
        cents(amount) === 0 ||
        prior.some((o) => o.payload[field] !== null)
      )
        continue;
      // Bridge old manual claims using the same global receipt key.
      const key =
        legacy && unit === currency
          ? `claim-receipt:${legacy.id}`
          : `account:receipt:${a.id}:${instance}:${unit}`;
      const [existing] = await tx
        .select()
        .from(s.ledgerEvents)
        .where(eq(s.ledgerEvents.key, key));
      if (existing) {
        if (
          existing.accountId !== a.id ||
          existing.currency !== unit ||
          cents(existing.amount) !== cents(amount)
        )
          throw new Error("Existing receipt conflicts with this observation.");
        continue;
      }
      await append({
        eventType: "FREE_REWARD_RECEIVED",
        amount,
        currency: unit,
        category: "PROMOTIONAL",
        occurredAt: now,
        key,
        offerId: unit === currency ? (offer?.id ?? null) : null,
        claimId: unit === currency ? (legacy?.id ?? null) : null,
        notes: "Actual free reward received; user observation.",
      });
    }
    const rows = await tx
      .select()
      .from(s.ledgerEvents)
      .where(eq(s.ledgerEvents.accountId, a.id))
      .orderBy(asc(s.ledgerEvents.sequence));
    const adapted = rows.map((e) => ({
      ...e,
      currency: e.currency === currency ? "SC" : e.currency,
    }));
    const target = reconciliationTargets(adapted, asHigh5(v));
    for (const [unit, targets] of [
      [currency, target.sc],
      ["GC", target.gc === null ? {} : { PROMOTIONAL: target.gc }],
    ] as const) {
      const b = bankroll(rows.filter((e) => e.currency === unit));
      for (const e of reconciliationEvents(b.balances, targets))
        await append({
          ...e,
          currency: unit,
          occurredAt: now,
          key: `account:reconcile:${saved.id}:${unit}:${e.category}`,
          notes: "Reported balance correction; not a reward, win or income.",
        });
    }
    return saved;
  });
}
export async function recordAccountPlay(input: unknown, now = new Date()) {
  const id = z.object({ accountId: z.uuid() }).parse(input).accountId;
  const h = await loadHigh5(id);
  if (h) return recordHigh5Play(input, freeFunding, now);
  return db.transaction(async (tx) => {
    const { a, events, currency } = await account(tx, id),
      b = bankroll(events.filter((e) => e.currency === currency));
    const raw = z.object({ submissionKey: z.uuid() }).parse(input);
    const [old] = await tx
      .select()
      .from(s.accountSnapshots)
      .where(eq(s.accountSnapshots.submissionKey, raw.submissionKey));
    if (old) {
      if (
        old.accountId !== id ||
        old.operation !== "PLAY" ||
        stableJSON(old.detail) !== stableJSON(input)
      )
        throw new Error("Play key conflicts.");
      return old;
    }
    const v = manualPlayAmounts(
      input,
      b.balances.PLAYABLE,
      b.balances.REDEEMABLE,
    );
    const [last] = await tx
      .select()
      .from(s.accountSnapshots)
      .where(eq(s.accountSnapshots.accountId, id))
      .orderBy(desc(s.accountSnapshots.sequence))
      .limit(1);
    const payload = last ? hydrate(last.payload) : blank(id, v.submissionKey);
    const [saved] = await tx
      .insert(s.accountSnapshots)
      .values({
        accountId: id,
        submissionKey: v.submissionKey,
        occurredAt: now,
        payload,
        instanceKey: `play:${v.submissionKey}`,
        operation: "PLAY",
        detail: input as Record<string, unknown>,
      })
      .returning();
    const append = (e: EventInput) =>
      appendAccountObservationEvent(tx, a, e, saved.id);
    const wager = await append({
      eventType: "PROMOTIONAL_WAGER",
      currency,
      category: "PLAYABLE",
      amount: v.wager,
      occurredAt: now,
      key: `account:wager:${saved.id}`,
      sessionId: saved.id,
      notes: `Already-performed free-only play: ${v.game}`,
    });
    await append({
      eventType: cents(v.payout) > 0 ? "PROMOTIONAL_WIN" : "PROMOTIONAL_LOSS",
      currency,
      category: "PLAYABLE",
      amount: v.payout,
      occurredAt: now,
      key: `account:payout:${saved.id}`,
      relatedEventId: wager.id,
      sessionId: saved.id,
      notes: "Actual manual settlement; no gameplay executed.",
    });
    const remaining =
      payload.playthroughRemaining !== null && v.contribution !== null
        ? decimal(
            Math.max(
              0,
              cents(payload.playthroughRemaining) - cents(v.contribution),
            ),
          )
        : null;
    await tx
      .update(s.accountSnapshots)
      .set({
        payload: {
          ...payload,
          checked: false,
          claimed: "UNKNOWN",
          received: null,
          receivedGC: null,
          playable: v.end,
          balance: decimal(
            b.balances.PROMOTIONAL + cents(v.end) + b.balances.REDEEMABLE,
          ),
          playthroughRemaining: remaining,
          minutes: v.minutes,
        },
      })
      .where(eq(s.accountSnapshots.id, saved.id));
    return saved;
  });
}
export const accountRedemptionSchema = z
  .object({
    accountId: z.uuid(),
    submissionKey: z.uuid(),
    redemptionId: z.uuid().nullable(),
    requestedSC: moneyString,
    receivedUSD: moneyString.nullable(),
    requestedAt: z.date(),
    completedAt: z.date().nullable(),
    method: z.enum(["PRIZEOUT", "TRUSTLY", "UNKNOWN"]),
    status: z.enum(["REQUESTED", "COMPLETED", "CANCELLED", "FAILED"]),
    minutes: z.number().min(0).max(240),
    freeOnly: z.literal(true),
  })
  .strict();
export async function recordAccountRedemption(
  input: unknown,
  now = new Date(),
) {
  const v = accountRedemptionSchema.parse(input);
  if (await loadHigh5(v.accountId))
    return recordHigh5Redemption(v, freeFunding, now);
  if (
    cents(v.requestedSC) === 0 ||
    v.requestedAt > now ||
    (v.completedAt && (v.completedAt > now || v.completedAt < v.requestedAt)) ||
    (v.status === "COMPLETED" && !v.completedAt) ||
    (v.status !== "COMPLETED" && v.receivedUSD !== null)
  )
    throw new Error("Check the redemption amount, status and actual dates.");
  return db.transaction(async (tx) => {
    const { a, currency } = await account(tx, v.accountId);
    const [duplicate] = await tx
      .select()
      .from(s.accountSnapshots)
      .where(eq(s.accountSnapshots.submissionKey, v.submissionKey));
    if (duplicate) {
      const detail = {
        ...duplicate.detail,
        requestedAt: new Date(String(duplicate.detail.requestedAt)),
        completedAt: duplicate.detail.completedAt
          ? new Date(String(duplicate.detail.completedAt))
          : null,
      };
      if (
        duplicate.accountId !== a.id ||
        duplicate.operation !== "REDEMPTION" ||
        stableJSON(detail) !== stableJSON(v)
      )
        throw new Error("Redemption key conflicts.");
      return duplicate;
    }
    let prior = v.redemptionId
      ? (
          await tx
            .select()
            .from(s.accountRedemptions)
            .where(eq(s.accountRedemptions.id, v.redemptionId))
            .for("update")
        )[0]
      : undefined;
    if (v.redemptionId && (!prior || prior.accountId !== a.id))
      throw new Error("Redemption belongs to another account.");
    if (
      prior &&
      (cents(prior.requestedSC) !== cents(v.requestedSC) ||
        prior.requestedAt.getTime() !== v.requestedAt.getTime())
    )
      throw new Error("Reserved amount and request date cannot change.");
    if (
      prior &&
      prior.status !== "REQUESTED" &&
      (prior.status !== "COMPLETED" ||
        v.status !== "COMPLETED" ||
        (prior.receivedUSD !== null && prior.receivedUSD !== v.receivedUSD))
    )
      throw new Error("Finalized redemption cannot be reopened or rewritten.");
    const [last] = await tx
      .select()
      .from(s.accountSnapshots)
      .where(eq(s.accountSnapshots.accountId, a.id))
      .orderBy(desc(s.accountSnapshots.sequence))
      .limit(1);
    const payload = last ? hydrate(last.payload) : blank(a.id, v.submissionKey);
    const [saved] = await tx
      .insert(s.accountSnapshots)
      .values({
        accountId: a.id,
        submissionKey: v.submissionKey,
        occurredAt: now,
        payload,
        instanceKey: `redemption:${v.submissionKey}`,
        operation: "REDEMPTION",
        detail: v,
      })
      .returning();
    const append = (e: EventInput) =>
      appendAccountObservationEvent(tx, a, e, saved.id);
    if (!prior) {
      const request = await append({
        eventType: "REDEMPTION_REQUESTED",
        currency,
        amount: v.requestedSC,
        category: "REDEEMABLE",
        occurredAt: now,
        key: `account:request:${saved.id}`,
        notes: "User recorded an actual free-balance redemption request.",
      });
      [prior] = await tx
        .insert(s.accountRedemptions)
        .values({
          accountId: a.id,
          key: v.submissionKey,
          requestedSC: v.requestedSC,
          requestedAt: v.requestedAt,
          method: v.method,
          status: "REQUESTED",
          requestEventId: request.id,
        })
        .returning();
    }
    let completion = prior.completionEventId;
    if (v.status === "COMPLETED" && prior.status === "REQUESTED") {
      const e = await append({
        eventType: "REDEMPTION_COMPLETED",
        currency,
        amount: v.requestedSC,
        category: "REDEEMED",
        occurredAt: now,
        key: `account:complete:${prior.id}`,
        relatedEventId: prior.requestEventId,
        actualCashAmount: v.receivedUSD,
        cashCurrency: v.receivedUSD === null ? null : "USD",
        notes: "Actual manual redemption; unknown proceeds remain unknown.",
      });
      completion = e.id;
    } else if (
      v.status === "COMPLETED" &&
      prior.receivedUSD === null &&
      v.receivedUSD !== null
    )
      await append({
        eventType: "REDEMPTION_VALUE_RECORDED",
        currency,
        amount: "0",
        category: "REDEEMED",
        occurredAt: now,
        key: `account:value:${prior.id}`,
        relatedEventId: prior.completionEventId,
        actualCashAmount: v.receivedUSD,
        cashCurrency: "USD",
        notes: "Actual previously unknown cash receipt recorded once.",
      });
    else if (
      ["CANCELLED", "FAILED"].includes(v.status) &&
      prior.status === "REQUESTED"
    )
      await append({
        eventType: "REDEMPTION_CANCELLED",
        currency,
        amount: v.requestedSC,
        category: "REDEEMABLE",
        occurredAt: now,
        key: `account:cancel:${prior.id}`,
        relatedEventId: prior.requestEventId,
        notes: "Release reservation; no cash received.",
      });
    await tx
      .update(s.accountRedemptions)
      .set({
        status: v.status,
        receivedUSD: v.receivedUSD,
        completedAt: v.completedAt,
        completionEventId: completion,
      })
      .where(eq(s.accountRedemptions.id, prior.id));
    const rows = await tx
      .select()
      .from(s.ledgerEvents)
      .where(
        and(
          eq(s.ledgerEvents.accountId, a.id),
          eq(s.ledgerEvents.currency, currency),
        ),
      )
      .orderBy(asc(s.ledgerEvents.sequence));
    const b = bankroll(rows);
    await tx
      .update(s.accountSnapshots)
      .set({
        payload: {
          ...payload,
          checked: false,
          claimed: "UNKNOWN",
          received: null,
          receivedGC: null,
          balance: decimal(
            b.balances.PROMOTIONAL +
              b.balances.PLAYABLE +
              b.balances.REDEEMABLE,
          ),
          redeemable: decimal(b.balances.REDEEMABLE),
          minutes: v.minutes,
        },
      })
      .where(eq(s.accountSnapshots.id, saved.id));
    return prior.id;
  });
}
export async function loadProduct(now = new Date()) {
  const [d, ops, h, snapshots, runtime, runs, redemptions] = await Promise.all([
    loadData(),
    loadOperations(),
    loadHigh5(),
    db
      .select()
      .from(s.accountSnapshots)
      .orderBy(asc(s.accountSnapshots.sequence)),
    db.select().from(s.localRuntime),
    db
      .select()
      .from(s.productRuns)
      .orderBy(desc(s.productRuns.startedAt))
      .limit(10),
    db.select().from(s.accountRedemptions),
  ]);
  const rp = d.platforms.find((p) => p.slug === "realprize");
  if (rp) registerRealPrizeAdapter(rp.id);
  const realPlatforms = d.platforms.filter((p) => !p.fixture && !p.excluded);
  const eligible = d.offers.filter(
    (o) => !o.fixture && !o.platform.fixture && o.result.eligible,
  );
  const cards = realPlatforms
    .filter(
      (p) =>
        eligible.some((o) => o.platformId === p.id) ||
        ops.events.some(
          (e) =>
            ops.accounts.find((a) => a.id === e.accountId)?.platformId === p.id,
        ),
    )
    .map((p) => {
      const a = ops.accounts.find((a) => a.platformId === p.id && !a.demo),
        isH = p.slug === "high-5-casino";
      const snapshot = a
        ? snapshots.filter((u) => u.accountId === a.id).at(-1)
        : undefined;
      const state = isH ? h?.state : null;
      const currency = isH
        ? "SC"
        : (eligible.find((o) => o.platformId === p.id)?.promotionalCurrency ??
          ops.events.find((e) => e.accountId === a?.id)?.currency ??
          "SC");
      const es = ops.events.filter(
          (e) => e.accountId === a?.id && e.currency === currency,
        ),
        b = bankroll(es);
      const balance = isH
        ? (state?.sc ??
          (es.length
            ? decimal(
                b.balances.PROMOTIONAL +
                  b.balances.PLAYABLE +
                  b.balances.REDEEMABLE,
              )
            : null))
        : (snapshot?.payload.balance ??
          (es.length
            ? decimal(
                b.balances.PROMOTIONAL +
                  b.balances.PLAYABLE +
                  b.balances.REDEEMABLE,
              )
            : null));
      const knownRedeem = isH
        ? state?.redeemableSC
        : snapshot?.payload.redeemable;
      const redeemable =
        knownRedeem !== null && knownRedeem !== undefined
          ? b.availableRedeemable
          : es.some((e) => e.category === "REDEEMABLE")
            ? b.availableRedeemable
            : null;
      const lastCheck = isH
        ? (h?.lastCheck ?? null)
        : (snapshots
            .filter((u) => u.accountId === a?.id && u.payload.checked)
            .at(-1)?.occurredAt ?? null);
      const nextCheck = isH
        ? (h?.nextCheck ?? null)
        : snapshot?.payload.nextRewardAt
          ? new Date(String(snapshot.payload.nextRewardAt))
          : lastCheck
            ? new Date(lastCheck.getTime() + 86400000)
            : null;
      const pending = isH
        ? (h?.redemptions.filter((r) => r.status === "REQUESTED").length ?? 0)
        : redemptions.filter(
            (r) => r.accountId === a?.id && r.status === "REQUESTED",
          ).length;
      const freeOffers = eligible.filter((o) => o.platformId === p.id);
      const expiresAt =
        freeOffers
          .map((o) => o.expirationDate)
          .filter((x): x is Date => !!x)
          .sort((a, b) => +a - +b)[0] ?? null;
      const status = platformStatus({
        verified: freeOffers.length > 0,
        redeemable,
        balance,
        due: !nextCheck || nextCheck <= now,
        pending,
        expiresAt,
        failed: runs[0]?.outcome === "FAILED",
        now,
      });
      return {
        platform: p,
        account: a,
        currency,
        balance,
        redeemable,
        lastCheck,
        nextCheck,
        pending,
        expiresAt,
        status,
        mode: "MANUAL" as const,
        offers: freeOffers,
        state: isH ? state : snapshot?.payload,
        playable: isH
          ? (state?.playableSC ?? null)
          : (snapshot?.payload.playable ?? null),
        remaining: isH
          ? (state?.playthroughRemaining ?? null)
          : (snapshot?.payload.playthroughRemaining ?? null),
        redemptions: isH
          ? (h?.redemptions ?? [])
          : redemptions.filter((r) => r.accountId === a?.id),
      };
    })
    .sort(
      (a, b) =>
        a.status.priority - b.status.priority ||
        a.platform.name.localeCompare(b.platform.name),
    );
  const integrity = zeroIntegrity(ops.events) && (!h || h.integrity);
  const received = ops.events.filter(
    (e) => e.eventType === "FREE_REWARD_RECEIVED",
  );
  const minutes =
    snapshots.reduce((n, u) => n + u.payload.minutes, 0) +
    (h?.updates.reduce((n, u) => n + Number(u.minutes), 0) ?? 0);
  const actual = moneyGroups(ops.accounts, d.platforms, ops.events, "ACTUAL");
  return {
    profile: d.profile,
    cards,
    integrity,
    runtime: runtimeStatus(
      runtime.find((r) => r.key === "runner"),
      now,
    ),
    runs,
    opportunities: eligible.length,
    free: moneyGroups(ops.accounts, d.platforms, ops.events, "FREE"),
    redeemable: moneyGroups(
      ops.accounts,
      d.platforms,
      ops.events,
      "REDEEMABLE",
    ),
    actual,
    received,
    receivedGroups: received.reduce<import("@/domain/product").MoneyGroup[]>(
      (groups, e) => {
        const a = ops.accounts.find((a) => a.id === e.accountId),
          p = d.platforms.find((p) => p.id === a?.platformId);
        if (!a || a.demo || !p || p.fixture || p.excluded) return groups;
        const old = groups.find(
          (g) => g.platformId === p.id && g.currency === e.currency,
        );
        if (old) old.amount += cents(e.amount);
        else
          groups.push({
            platformId: p.id,
            platform: p.name,
            currency: e.currency,
            engine: a.engine,
            amount: cents(e.amount),
          });
        return groups;
      },
      [],
    ),
    minutes,
    valuePerHour:
      minutes > 0 && actual.length && actual.every((g) => g.currency === "USD")
        ? actual.reduce((n, g) => n + g.amount, 0) / 100 / (minutes / 60)
        : null,
    research: realPlatforms.filter(
      (p) =>
        !cards.some((c) => c.platform.id === p.id) &&
        p.researchState === "NEEDS_VERIFICATION" &&
        !(
          d.offers.some((o) => o.platformId === p.id) &&
          d.offers
            .filter((o) => o.platformId === p.id)
            .every(
              (o) => o.result.verificationState === "EXCLUDED_REQUIRES_MONEY",
            )
        ),
    ),
    history: [
      ...ops.events.map((e) => ({
        id: e.id,
        at: e.occurredAt,
        text: friendlyEvent(
          e,
          d.platforms.find(
            (p) =>
              p.id ===
              ops.accounts.find((a) => a.id === e.accountId)?.platformId,
          )?.name ?? "Account",
        ),
      })),
      ...snapshots
        .filter((u) => u.operation === "UPDATE")
        .map((u) => ({
          id: u.id,
          at: u.occurredAt,
          text: `${d.platforms.find((p) => p.id === ops.accounts.find((a) => a.id === u.accountId)?.platformId)?.name ?? "Account"} — ${u.payload.claimed === "YES" && u.payload.received === null ? "reward claimed; amount unknown" : u.payload.checked ? "account checked" : "account details updated"}`,
        })),
      ...(h?.updates
        .filter((u) => u.operation === "ACCOUNT_UPDATE")
        .map((u) => ({
          id: u.id,
          at: u.occurredAt,
          text: `High 5 Casino — ${u.payload.rewardClaimed === "YES" && u.payload.rewardSC === null ? "reward claimed; amount unknown" : u.checkedReward ? "account checked" : "account details updated"}`,
        })) ?? []),
    ].sort((a, b) => +b.at - +a.at),
  };
}
export async function runProductCheck(
  trigger: "MANUAL" | "BACKGROUND",
  now = new Date(),
) {
  const client = await pool.connect();
  let id: string | undefined;
  try {
    const lock = await client.query(
      "SELECT pg_try_advisory_lock(7439012) AS locked",
    );
    if (!lock.rows[0].locked) return { busy: true, result: null };
    const result: {
      collected: { platform: string; amount: string; currency: string }[];
      needsYou: string[];
      nothing: string[];
      publicReads: number;
      failures: string[];
    } = {
      collected: [],
      needsYou: [],
      nothing: [],
      publicReads: 0,
      failures: [],
    };
    const [run] = await db
      .insert(s.productRuns)
      .values({ startedAt: now, trigger, outcome: "RUNNING", result })
      .returning();
    id = run.id;
    await refreshOperations(now);
    // Registered real integrations provide no officially authorized automatic account methods.
    // A schedule or a published amount cannot be treated as a successful claim.
    const d = await loadProduct(now);
    if (!d.integrity)
      throw new Error("INTEGRITY ERROR: zero contribution rule failed.");
    const supported = await executeSupportedChecks(
      d.cards.map((c) => ({
        platformId: c.platform.id,
        name: c.platform.name,
        engine: c.account?.engine ?? "CASINO",
        eligible: c.offers.length > 0,
        excluded: c.platform.excluded,
        policies: [],
        supported: {},
        availableAt: c.nextCheck ?? now,
        expiresAt: c.expiresAt,
        funding: freeFunding,
      })),
      now,
    );
    result.collected = supported.collected;
    result.publicReads = supported.publicReads;
    result.failures = supported.failures;
    await db.update(s.attentionItems).set({ active: false, updatedAt: now });
    for (const c of d.cards) {
      if (c.status.kind !== "WAIT") {
        result.needsYou.push(c.platform.name);
        await db
          .insert(s.attentionItems)
          .values({
            key: `platform:${c.platform.id}`,
            platformId: c.platform.id,
            kind: c.status.kind,
            title: c.status.title,
            priority: c.status.priority,
            active: true,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: s.attentionItems.key,
            set: {
              kind: c.status.kind,
              title: c.status.title,
              priority: c.status.priority,
              active: true,
              updatedAt: now,
            },
          });
      } else result.nothing.push(c.platform.name);
    }
    await db
      .update(s.productRuns)
      .set({ finishedAt: new Date(), outcome: "COMPLETE", result })
      .where(eq(s.productRuns.id, id));
    return { busy: false, result, runId: id };
  } catch (e) {
    if (id)
      await db
        .update(s.productRuns)
        .set({
          finishedAt: new Date(),
          outcome: "FAILED",
          diagnostic: e instanceof Error ? e.message : "Unknown check failure",
        })
        .where(eq(s.productRuns.id, id));
    if (id)
      await db
        .update(s.attentionItems)
        .set({
          kind: "CHECK_FAILED",
          title: "Couldn't refresh right now",
          priority: 2,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(s.attentionItems.active, true),
            notInArray(s.attentionItems.kind, ["REDEEM_NOW", "EXPIRING_SOON"]),
          ),
        );
    throw e;
  } finally {
    await client.query("SELECT pg_advisory_unlock(7439012)");
    client.release();
  }
}
export async function initializeProduct() {
  await refreshOperations();
  await db
    .insert(s.localRuntime)
    .values({ key: "runner", enabled: false })
    .onConflictDoNothing();
}
export const newSubmissionKey = () => randomUUID();
