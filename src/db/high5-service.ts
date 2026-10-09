import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "./index";
import {
  bankrollAccounts,
  casinoStrategies,
  ledgerEvents,
  high5Updates,
  high5RewardInstances,
  high5Redemptions,
  high5Sources,
  operationalActions,
  rewardSchedules,
  platforms,
  offers,
  platformSources,
  actionPolicyEvidence,
  claims,
} from "./schema";
import { loadData } from "./queries";
import { opportunityFor } from "@/domain/recurrence";
import {
  appendHigh5ObservationEvent,
  refreshOperations,
} from "./operations-service";
import {
  bankroll,
  cents,
  decimal,
  enforceZeroMoney,
  freeFunding,
  effectivePolicy,
  actionStage,
} from "@/domain/operations";
import {
  experimentMetrics,
  high5Integrity,
  high5Recommendation,
  high5UpdateSchema,
  manualPlayAmounts,
  reconciliationEvents,
  reconciliationTargets,
  nullableMoney,
  type High5Update,
} from "@/domain/high5";
import { scheduledOpportunity } from "@/domain/scheduler";
import { registerHigh5Adapter } from "@/domain/adapters";
import baseline from "../../research/high5-public-review.json";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Account = typeof bankrollAccounts.$inferSelect;
const hydrate = (payload: High5Update): High5Update => ({
  ...payload,
  nextRewardAt: payload.nextRewardAt
    ? new Date(String(payload.nextRewardAt))
    : null,
});
function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
const hash = (value: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");

function emptyUpdate(accountId: string, key: string): High5Update {
  return {
    accountId,
    submissionKey: key,
    legacyOfferId: null,
    checkedReward: false,
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
  };
}
async function account(tx: Tx, id: string) {
  const [a] = await tx
    .select()
    .from(bankrollAccounts)
    .where(eq(bankrollAccounts.id, z.uuid().parse(id)))
    .for("update");
  const [p] = a
    ? await tx.select().from(platforms).where(eq(platforms.id, a.platformId))
    : [];
  if (
    !a ||
    a.demo ||
    a.engine !== "CASINO" ||
    p?.slug !== "high-5-casino" ||
    p.excluded
  )
    throw new Error(
      "Real High 5 account required; demo/other platforms are separate.",
    );
  const events = await tx
    .select()
    .from(ledgerEvents)
    .where(eq(ledgerEvents.accountId, a.id))
    .orderBy(asc(ledgerEvents.sequence));
  if (!high5Integrity(events))
    throw new Error(
      "CRITICAL INTEGRITY ERROR: user money or purchased bankroll detected.",
    );
  return { a, p, events };
}
async function queue(
  tx: Tx,
  a: Account,
  type:
    | "CHECK_REWARD"
    | "CHECK_PLAYTHROUGH"
    | "REQUEST_REDEMPTION"
    | "CHECK_REDEMPTION"
    | "MANUAL_VERIFICATION",
  key: string,
  reason: string,
  now: Date,
) {
  const evidence = await tx
    .select()
    .from(actionPolicyEvidence)
    .where(eq(actionPolicyEvidence.platformId, a.platformId));
  await tx
    .insert(operationalActions)
    .values({
      accountId: a.id,
      actionType: type,
      key,
      availableAt: now,
      automationPolicy: effectivePolicy(
        evidence,
        actionStage(type),
        false,
        now,
      ),
      executionMode: "MANUAL_REQUIRED",
      reason,
      opportunityKey: "high5:manual",
      funding: freeFunding,
    })
    .onConflictDoNothing();
}
async function priorityTasks(
  tx: Tx,
  a: Account,
  observationId: string,
  now: Date,
) {
  const rows = await tx
    .select()
    .from(ledgerEvents)
    .where(
      and(eq(ledgerEvents.accountId, a.id), eq(ledgerEvents.currency, "SC")),
    )
    .orderBy(asc(ledgerEvents.sequence));
  const b = bankroll(rows);
  for (const t of await tx
    .select()
    .from(operationalActions)
    .where(
      and(
        eq(operationalActions.accountId, a.id),
        eq(operationalActions.opportunityKey, "high5:manual"),
        eq(operationalActions.status, "PENDING"),
      ),
    ))
    await tx
      .update(operationalActions)
      .set({ status: "EXPIRED", result: "Superseded by newer reported state." })
      .where(eq(operationalActions.id, t.id));
  if (b.availableRedeemable > 0)
    await queue(
      tx,
      a,
      "REQUEST_REDEMPTION",
      `high5:redeem:${observationId}`,
      "REDEEM AVAILABLE VALUE — highest priority. STOP PLAYING. Manually confirm method/minimum/KYC; no purchase. Prizeout has an explicit no-purchase path; Trustly help is inconsistent.",
      now,
    );
  else if (b.reserved > 0)
    await queue(
      tx,
      a,
      "CHECK_REDEMPTION",
      `high5:pending:${observationId}`,
      "Manually check pending redemption; reserved funds cannot be played.",
      now,
    );
  else
    await queue(
      tx,
      a,
      "CHECK_PLAYTHROUGH",
      `high5:requirements:${observationId}`,
      "Check bonus-specific playthrough and redeemability. Unknown requirements remain UNKNOWN; no automatic gameplay.",
      now,
    );
}
export async function recordHigh5Update(
  input: unknown,
  funding: unknown = freeFunding,
  now = new Date(),
) {
  enforceZeroMoney(funding);
  const u = high5UpdateSchema.parse(input);
  const legacy = u.legacyOfferId
    ? (await loadData()).offers.find((o) => o.id === u.legacyOfferId)
    : null;
  if (
    u.legacyOfferId &&
    (!legacy ||
      !legacy.result.eligible ||
      legacy.platform.slug !== "high-5-casino" ||
      legacy.fixture ||
      !["SC", "SC (promotional)"].includes(legacy.promotionalCurrency))
  )
    throw new Error(
      "Choose a currently verified High 5 SC offer or leave the source UNKNOWN.",
    );
  if (legacy) {
    if (
      ["GC_ONLY", "OTHER"].includes(u.rewardKind) &&
      u.rewardClaimed === "YES"
    )
      throw new Error(
        "The selected published offer describes SC; leave its source UNKNOWN for GC-only/other rewards.",
      );
    u.rewardScope =
      legacy.offerType === "signup"
        ? "SIGNUP"
        : ["daily", "weekly"].includes(
              legacy.recurringCadence ?? legacy.offerType,
            )
          ? "RECURRING"
          : "OTHER";
  }
  if (u.nextRewardAt && u.nextRewardAt < now)
    throw new Error("Next reward time must be in the future or UNKNOWN.");
  return db.transaction(async (tx) => {
    const { a } = await account(tx, u.accountId);
    const [old] = await tx
      .select()
      .from(high5Updates)
      .where(eq(high5Updates.submissionKey, u.submissionKey));
    if (old) {
      if (old.accountId !== a.id || hash(hydrate(old.payload)) !== hash(u))
        throw new Error("Observation key reused with different contents.");
      return old;
    }
    const [saved] = await tx
      .insert(high5Updates)
      .values({
        accountId: a.id,
        submissionKey: u.submissionKey,
        occurredAt: now,
        checkedReward: u.checkedReward,
        minutes: String(u.minutes),
        payload: u,
      })
      .returning();
    const [schedule] = await tx
      .select()
      .from(rewardSchedules)
      .where(
        and(
          eq(rewardSchedules.accountId, a.id),
          eq(rewardSchedules.purpose, "CHECK_REWARD"),
        ),
      );
    const slot = schedule
      ? scheduledOpportunity(
          schedule.spec,
          now,
          schedule.verifiedAt,
          schedule.expiresAt,
          schedule.sourceType,
          schedule.purpose,
        )
      : null;
    const fallback = Math.floor(now.getTime() / (4 * 3600000));
    const legacyPeriod = legacy ? opportunityFor(legacy, now) : null;
    const instanceKey = legacyPeriod
      ? `legacy:${legacyPeriod.offerId}:${legacyPeriod.periodKey}`
      : u.rewardScope === "SIGNUP"
        ? "signup"
        : `${u.rewardScope.toLowerCase()}:${slot?.key ?? fallback}`;
    if (u.checkedReward || u.rewardClaimed === "YES") {
      const [existing] = await tx
        .select()
        .from(high5RewardInstances)
        .where(
          and(
            eq(high5RewardInstances.accountId, a.id),
            eq(high5RewardInstances.instanceKey, instanceKey),
          ),
        )
        .for("update");
      if (existing?.claimed && u.rewardClaimed === "YES") {
        if (
          (existing.kind !== "UNKNOWN" && existing.kind !== u.rewardKind) ||
          (existing.sc !== null &&
            u.rewardSC !== null &&
            cents(existing.sc) !== cents(u.rewardSC)) ||
          (existing.gc !== null &&
            u.rewardGC !== null &&
            cents(existing.gc) !== cents(u.rewardGC))
        )
          throw new Error(
            "This reward instance is already recorded with different amounts/outcome. Do not claim or count it twice.",
          );
        if (
          (existing.sc === null && u.rewardSC !== null && u.sc === null) ||
          (existing.gc === null && u.rewardGC !== null && u.gc === null)
        )
          throw new Error(
            "Enter the current currency balance when clarifying a previously unknown reward amount; it must not be added twice.",
          );
      }
      const newlyClaimed = u.rewardClaimed === "YES" && !existing?.claimed;
      let legacyClaim: typeof claims.$inferSelect | undefined;
      if (legacyPeriod && u.rewardClaimed === "YES") {
        await tx
          .insert(claims)
          .values({
            ...legacyPeriod,
            claimState: "CLAIMED",
            status: "claimed",
            method: "manual",
            claimedDate: now,
            promotionalValueReceived: u.rewardSC,
            notes:
              "USER_OBSERVATION: High 5 manual update; actual amount, not advertised amount.",
          })
          .onConflictDoNothing();
        [legacyClaim] = await tx
          .select()
          .from(claims)
          .where(
            and(
              eq(claims.offerId, legacyPeriod.offerId),
              eq(claims.periodKey, legacyPeriod.periodKey),
            ),
          )
          .for("update");
        if (
          legacyClaim.promotionalValueReceived !== null &&
          u.rewardSC !== null &&
          cents(legacyClaim.promotionalValueReceived) !== cents(u.rewardSC)
        )
          throw new Error(
            "Legacy claim already has a different actual amount; do not double-count it.",
          );
        if (
          ![
            "CLAIMED",
            "PLAYTHROUGH_REQUIRED",
            "REDEEMABLE",
            "REDEEMED",
          ].includes(legacyClaim.claimState)
        )
          await tx
            .update(claims)
            .set({
              claimState: "CLAIMED",
              status: "claimed",
              claimedDate: now,
              promotionalValueReceived: u.rewardSC,
            })
            .where(eq(claims.id, legacyClaim.id));
        else if (
          legacyClaim.promotionalValueReceived === null &&
          u.rewardSC !== null
        )
          await tx
            .update(claims)
            .set({ promotionalValueReceived: u.rewardSC })
            .where(eq(claims.id, legacyClaim.id));
        await tx
          .update(operationalActions)
          .set({
            status: "COMPLETED",
            claimId: legacyClaim.id,
            completedAt: now,
            result: "Actual manual High 5 claim recorded.",
          })
          .where(
            and(
              eq(operationalActions.accountId, a.id),
              eq(operationalActions.offerId, legacyPeriod.offerId),
              eq(operationalActions.opportunityKey, legacyPeriod.periodKey),
              eq(operationalActions.actionType, "CLAIM_REWARD"),
            ),
          );
      }
      if (!existing)
        await tx.insert(high5RewardInstances).values({
          accountId: a.id,
          instanceKey,
          occurredAt: now,
          scope: u.rewardScope,
          kind: u.rewardKind,
          claimed: u.rewardClaimed === "YES",
          sc: u.rewardClaimed === "YES" ? u.rewardSC : null,
          gc: u.rewardClaimed === "YES" ? u.rewardGC : null,
          observationId: saved.id,
        });
      else if (u.rewardClaimed === "YES")
        await tx
          .update(high5RewardInstances)
          .set({
            claimed: true,
            kind: u.rewardKind,
            sc: u.rewardSC ?? existing.sc,
            gc: u.rewardGC ?? existing.gc,
            observationId: saved.id,
          })
          .where(eq(high5RewardInstances.id, existing.id));
      for (const [currency, amount, prior] of [
        ["SC", u.rewardSC, existing?.sc],
        ["GC", u.rewardGC, existing?.gc],
      ] as const) {
        const key =
          currency === "SC" && legacyClaim
            ? `claim-receipt:${legacyClaim.id}`
            : `high5:receipt:${a.id}:${instanceKey}:${currency}`;
        const recorded = (
          await tx.select().from(ledgerEvents).where(eq(ledgerEvents.key, key))
        )[0];
        if (
          recorded &&
          (recorded.accountId !== a.id ||
            (amount !== null && cents(recorded.amount) !== cents(amount)))
        )
          throw new Error(
            "Receipt already belongs to another bookkeeping account or amount.",
          );
        if (
          !recorded &&
          u.rewardClaimed === "YES" &&
          amount !== null &&
          (newlyClaimed || prior === null || prior === undefined)
        )
          await appendHigh5ObservationEvent(
            tx,
            a,
            {
              eventType: "FREE_REWARD_RECEIVED",
              category: "PROMOTIONAL",
              currency,
              amount,
              occurredAt: now,
              key,
              claimId: currency === "SC" ? legacyClaim?.id : null,
              offerId: currency === "SC" ? legacy?.id : null,
              notes: `USER_OBSERVATION: actually claimed free ${u.rewardScope.toLowerCase()} reward; amount entered explicitly.`,
            },
            saved.id,
            funding,
          );
      }
      if (u.rewardClaimed === "YES")
        await tx
          .insert(operationalActions)
          .values({
            accountId: a.id,
            actionType: "MANUAL_CLAIM",
            status: "COMPLETED",
            availableAt: now,
            automationPolicy: "UNKNOWN",
            executionMode: "MANUAL_REQUIRED",
            reason:
              "Actual user-reported free reward claim; not an external automatic claim or primary evidence.",
            opportunityKey: instanceKey,
            key: `high5:claim:${a.id}:${instanceKey}`,
            completedAt: now,
            result: u.rewardKind,
            attemptCount: 1,
            funding: freeFunding,
          })
          .onConflictDoNothing();
    }
    const current = await tx
      .select()
      .from(ledgerEvents)
      .where(eq(ledgerEvents.accountId, a.id))
      .orderBy(asc(ledgerEvents.sequence));
    const targets = reconciliationTargets(current, u);
    for (const [currency, target] of [
      ["SC", targets.sc],
      ["GC", targets.gc === null ? {} : { PROMOTIONAL: targets.gc }],
    ] as const) {
      const b = bankroll(current.filter((e) => e.currency === currency));
      for (const [i, e] of reconciliationEvents(b.balances, target).entries())
        await appendHigh5ObservationEvent(
          tx,
          a,
          {
            ...e,
            currency,
            occurredAt: now,
            key: `high5:reconcile:${saved.id}:${currency}:${i}`,
            notes:
              "USER_OBSERVATION: free-only balance reconciliation, cause unknown. This is not a reward, win, loss or cash conversion.",
          },
          saved.id,
          funding,
        );
    }
    if (u.checkedReward) {
      const tasks = await tx
        .select()
        .from(operationalActions)
        .where(
          and(
            eq(operationalActions.accountId, a.id),
            eq(operationalActions.actionType, "CHECK_REWARD"),
            eq(operationalActions.status, "PENDING"),
          ),
        );
      for (const t of tasks)
        if (t.availableAt <= now && (!t.expiresAt || t.expiresAt > now))
          await tx
            .update(operationalActions)
            .set({
              status: "COMPLETED",
              completedAt: now,
              result: `USER_OBSERVATION: ${u.rewardKind}; claimed ${u.rewardClaimed}`,
              attemptCount: t.attemptCount + 1,
            })
            .where(eq(operationalActions.id, t.id));
    }
    await priorityTasks(tx, a, saved.id, now);
    return saved;
  });
}
export async function recordHigh5Play(
  input: unknown,
  funding: unknown = freeFunding,
  now = new Date(),
) {
  enforceZeroMoney(funding);
  const parsed = z
    .object({ accountId: z.uuid(), submissionKey: z.uuid() })
    .parse(input);
  return db.transaction(async (tx) => {
    const { a, events } = await account(tx, parsed.accountId);
    const [duplicate] = await tx
      .select()
      .from(high5Updates)
      .where(eq(high5Updates.submissionKey, parsed.submissionKey));
    if (duplicate) {
      if (
        duplicate.operation !== "MANUAL_PLAY" ||
        hash(duplicate.detail) !== hash(input)
      )
        throw new Error("Play key reused with different contents.");
      return duplicate;
    }
    const b = bankroll(events.filter((e) => e.currency === "SC")),
      v = manualPlayAmounts(input, b.balances.PLAYABLE, b.balances.REDEEMABLE);
    const [last] = await tx
      .select()
      .from(high5Updates)
      .where(eq(high5Updates.accountId, a.id))
      .orderBy(desc(high5Updates.sequence))
      .limit(1);
    const u = last ? hydrate(last.payload) : emptyUpdate(a.id, v.submissionKey);
    const remaining =
      u.playthroughRemaining === null || v.contribution === null
        ? null
        : decimal(
            Math.max(0, cents(u.playthroughRemaining) - cents(v.contribution)),
          );
    const payload = {
      ...u,
      submissionKey: v.submissionKey,
      checkedReward: false,
      rewardKind: "UNKNOWN" as const,
      rewardClaimed: "UNKNOWN" as const,
      rewardSC: null,
      rewardGC: null,
      minutes: v.minutes,
      sc:
        u.sc === null
          ? null
          : decimal(cents(u.sc) + cents(v.end) - cents(v.start)),
      playableSC: v.end,
      playthroughRemaining: remaining,
      playthroughPlayed:
        u.playthroughPlayed === null || v.contribution === null
          ? null
          : decimal(cents(u.playthroughPlayed) + cents(v.contribution)),
    };
    const [saved] = await tx
      .insert(high5Updates)
      .values({
        accountId: a.id,
        submissionKey: v.submissionKey,
        occurredAt: now,
        checkedReward: false,
        minutes: String(v.minutes),
        operation: "MANUAL_PLAY",
        payload,
        detail: input as Record<string, unknown>,
      })
      .returning();
    const wager = await appendHigh5ObservationEvent(
      tx,
      a,
      {
        eventType: "PROMOTIONAL_WAGER",
        currency: "SC",
        category: "PLAYABLE",
        amount: v.wager,
        occurredAt: now,
        sessionId: saved.id,
        key: `high5:play:${saved.id}:wager`,
        notes: `USER_OBSERVATION: already-performed free SC play on ${v.game}. No gameplay executed by the application.`,
      },
      saved.id,
      funding,
    );
    await appendHigh5ObservationEvent(
      tx,
      a,
      {
        eventType:
          cents(v.payout) === 0 ? "PROMOTIONAL_LOSS" : "PROMOTIONAL_WIN",
        currency: "SC",
        category: "PLAYABLE",
        amount: v.payout,
        occurredAt: now,
        sessionId: saved.id,
        relatedEventId: wager.id,
        key: `high5:play:${saved.id}:settlement`,
        notes: `USER_OBSERVATION: ${v.result}; contribution ${v.contribution ?? "UNKNOWN"}. Net result is ending minus starting balance.`,
      },
      saved.id,
      funding,
    );
    if (
      remaining !== null &&
      cents(remaining) === 0 &&
      u.playthroughRemaining !== null &&
      cents(u.playthroughRemaining) > 0
    )
      await appendHigh5ObservationEvent(
        tx,
        a,
        {
          eventType: "PLAYTHROUGH_COMPLETED",
          currency: "SC",
          category: "PLAYABLE",
          amount: "0",
          occurredAt: now,
          key: `high5:playthrough:${saved.id}`,
          notes:
            "USER_OBSERVATION: reported contribution satisfied reported remaining requirement. Actual redeemability still requires operator confirmation.",
        },
        saved.id,
        funding,
      );
    await priorityTasks(tx, a, saved.id, now);
    return saved;
  });
}
const redemptionSchema = z
  .object({
    accountId: z.uuid(),
    submissionKey: z.uuid(),
    redemptionId: z.uuid().nullable(),
    requestedSC: nullableMoney,
    receivedUSD: nullableMoney,
    requestedAt: z.date(),
    completedAt: z.date().nullable(),
    method: z.enum(["PRIZEOUT", "TRUSTLY", "UNKNOWN"]),
    status: z.enum(["REQUESTED", "COMPLETED", "CANCELLED", "FAILED"]),
    freeOnly: z.literal(true),
    minutes: z.number().min(0).max(240),
  })
  .strict();
export async function recordHigh5Redemption(
  input: unknown,
  funding: unknown = freeFunding,
  now = new Date(),
) {
  enforceZeroMoney(funding);
  const v = redemptionSchema.parse(input);
  if (
    v.requestedAt > now ||
    (v.completedAt && (v.completedAt > now || v.completedAt < v.requestedAt))
  )
    throw new Error("Invalid request/completion dates.");
  if (v.status === "COMPLETED" && !v.completedAt)
    throw new Error(
      "Completion date required; received value may remain UNKNOWN.",
    );
  if (v.status !== "COMPLETED" && v.receivedUSD !== null)
    throw new Error("Actual proceeds belong only to a completed redemption.");
  return db.transaction(async (tx) => {
    const { a } = await account(tx, v.accountId);
    const [duplicate] = await tx
      .select()
      .from(high5Updates)
      .where(eq(high5Updates.submissionKey, v.submissionKey));
    if (duplicate) {
      if (
        duplicate.accountId !== a.id ||
        duplicate.operation !== "REDEMPTION" ||
        hash({
          ...duplicate.detail,
          requestedAt: new Date(String(duplicate.detail.requestedAt)),
          completedAt: duplicate.detail.completedAt
            ? new Date(String(duplicate.detail.completedAt))
            : null,
        }) !== hash(v)
      )
        throw new Error("Redemption key reused with different contents.");
      if (v.redemptionId) return v.redemptionId;
      const [recorded] = await tx
        .select()
        .from(high5Redemptions)
        .where(eq(high5Redemptions.key, v.submissionKey));
      if (!recorded) throw new Error("Recorded redemption missing.");
      return recorded.id;
    }
    let prior = v.redemptionId
      ? (
          await tx
            .select()
            .from(high5Redemptions)
            .where(eq(high5Redemptions.id, v.redemptionId))
            .for("update")
        )[0]
      : undefined;
    if (v.redemptionId && (!prior || prior.accountId !== a.id))
      throw new Error(
        "Redemption belongs to another account or is unavailable.",
      );
    if (v.requestedSC === null || cents(v.requestedSC) === 0)
      throw new Error("Record an actual positive requested SC amount.");
    if (prior && cents(prior.requestedSC) !== cents(v.requestedSC))
      throw new Error("Requested SC cannot change after reservation.");
    const [last] = await tx
      .select()
      .from(high5Updates)
      .where(eq(high5Updates.accountId, a.id))
      .orderBy(desc(high5Updates.sequence))
      .limit(1);
    const u = last ? hydrate(last.payload) : emptyUpdate(a.id, v.submissionKey);
    const [saved] = await tx
      .insert(high5Updates)
      .values({
        accountId: a.id,
        submissionKey: v.submissionKey,
        occurredAt: now,
        checkedReward: false,
        minutes: String(v.minutes),
        operation: "REDEMPTION",
        payload: {
          ...u,
          submissionKey: v.submissionKey,
          checkedReward: false,
          rewardClaimed: "UNKNOWN",
          rewardSC: null,
          rewardGC: null,
          minutes: v.minutes,
        },
        detail: v,
      })
      .returning();
    if (!prior) {
      const request = await appendHigh5ObservationEvent(
        tx,
        a,
        {
          eventType: "REDEMPTION_REQUESTED",
          currency: "SC",
          category: "REDEEMABLE",
          amount: v.requestedSC,
          occurredAt: v.requestedAt,
          key: `high5:request:${saved.id}`,
          notes: `USER_OBSERVATION: manually requested via ${v.method}; no credentials stored or platform request executed.`,
        },
        saved.id,
        funding,
      );
      [prior] = await tx
        .insert(high5Redemptions)
        .values({
          accountId: a.id,
          key: v.submissionKey,
          requestedSC: v.requestedSC,
          requestedAt: v.requestedAt,
          method: v.method,
          status: "REQUESTED",
          requestEventId: request.id,
          observationId: saved.id,
        })
        .returning();
    }
    if (prior.status === "COMPLETED") {
      if (
        v.status !== "COMPLETED" ||
        prior.receivedUSD !== null ||
        v.receivedUSD === null
      )
        throw new Error(
          "Redemption already completed; only previously unknown proceeds can be filled once.",
        );
      await appendHigh5ObservationEvent(
        tx,
        a,
        {
          eventType: "REDEMPTION_VALUE_RECORDED",
          currency: "SC",
          category: "REDEEMED",
          amount: "0",
          occurredAt: now,
          relatedEventId: prior.completionEventId,
          actualCashAmount: v.receivedUSD,
          cashCurrency: "USD",
          key: `high5:proceeds:${prior.id}`,
          notes:
            "USER_OBSERVATION: actual USD/prize value for previously unknown completed redemption.",
        },
        saved.id,
        funding,
      );
    } else if (prior.status !== "REQUESTED")
      throw new Error("Closed redemption cannot be reopened.");
    else if (v.status === "COMPLETED") {
      const complete = await appendHigh5ObservationEvent(
        tx,
        a,
        {
          eventType: "REDEMPTION_COMPLETED",
          currency: "SC",
          category: "REDEEMED",
          amount: v.requestedSC,
          occurredAt: v.completedAt!,
          relatedEventId: prior.requestEventId,
          actualCashAmount: v.receivedUSD,
          cashCurrency: v.receivedUSD === null ? null : "USD",
          key: `high5:complete:${prior.id}`,
          notes:
            "USER_OBSERVATION: manual redemption completed; actual USD/prize value is separate and may remain UNKNOWN.",
        },
        saved.id,
        funding,
      );
      prior = { ...prior, completionEventId: complete.id };
    } else if (["CANCELLED", "FAILED"].includes(v.status))
      await appendHigh5ObservationEvent(
        tx,
        a,
        {
          eventType: "REDEMPTION_CANCELLED",
          currency: "SC",
          category: "REDEEMABLE",
          amount: v.requestedSC,
          occurredAt: now,
          relatedEventId: prior.requestEventId,
          key: `high5:cancel:${prior.id}`,
          notes: `USER_OBSERVATION: ${v.status}; release the reservation, not a cash payment.`,
        },
        saved.id,
        funding,
      );
    await tx
      .update(high5Redemptions)
      .set({
        status: v.status,
        receivedUSD: v.receivedUSD,
        completedAt: v.completedAt,
        completionEventId: prior.completionEventId,
        observationId: saved.id,
      })
      .where(eq(high5Redemptions.id, prior.id));
    const rows = await tx
      .select()
      .from(ledgerEvents)
      .where(
        and(eq(ledgerEvents.accountId, a.id), eq(ledgerEvents.currency, "SC")),
      )
      .orderBy(asc(ledgerEvents.sequence));
    const b = bankroll(rows);
    await tx
      .update(high5Updates)
      .set({
        payload: {
          ...u,
          submissionKey: v.submissionKey,
          checkedReward: false,
          rewardClaimed: "UNKNOWN",
          rewardSC: null,
          rewardGC: null,
          minutes: v.minutes,
          redeemableSC: decimal(b.balances.REDEEMABLE),
          sc: decimal(
            b.balances.PROMOTIONAL +
              b.balances.PLAYABLE +
              b.balances.REDEEMABLE,
          ),
        },
      })
      .where(eq(high5Updates.id, saved.id));
    await priorityTasks(tx, a, saved.id, now);
    return prior.id;
  });
}
const publicRow = z.object({
  sourceKey: z.string(),
  sourceUrl: z.url(),
  retrievedAt: z.coerce.date(),
  outcome: z.enum(["READABLE", "ACCESS_FAILED"]),
  fingerprint: z.string().nullable(),
  excerpts: z.record(z.string(), z.string().max(1000)),
  notes: z.string().max(1000),
});
export async function persistHigh5PublicSources(
  input: unknown,
  now = new Date(),
) {
  const rows = z.array(publicRow).length(6).parse(input),
    p = (
      await db
        .select()
        .from(platforms)
        .where(eq(platforms.slug, "high-5-casino"))
    )[0];
  if (!p) throw new Error("High 5 registry missing.");
  if (new Set(rows.map((r) => r.sourceKey)).size !== 6)
    throw new Error("Duplicate/missing public source.");
  return db.transaction(async (tx) => {
    let changed = false;
    for (const r of rows) {
      const reviewed = baseline.documents.find(
        (d) => d.sourceKey === r.sourceKey,
      );
      if (
        !reviewed ||
        r.sourceUrl !== reviewed.sourceUrl ||
        r.retrievedAt > now
      )
        throw new Error("Unexpected source origin or future evidence.");
      const calculated = createHash("sha256")
        .update(
          JSON.stringify(
            Object.fromEntries(
              Object.entries(r.excerpts).sort(([a], [b]) => a.localeCompare(b)),
            ),
          ),
        )
        .digest("hex");
      if (r.outcome === "READABLE" && r.fingerprint !== calculated)
        throw new Error("Public excerpt fingerprint mismatch.");
      const match =
        r.outcome === "READABLE" && r.fingerprint === reviewed.fingerprint;
      const outcome =
        r.outcome === "ACCESS_FAILED"
          ? "ACCESS_FAILED"
          : match
            ? "REVIEWED_MATCH"
            : "REVIEW_REQUIRED";
      await tx
        .insert(high5Sources)
        .values({
          ...r,
          platformId: p.id,
          outcome,
          notes: match ? baseline.notes : r.notes,
        })
        .onConflictDoNothing();
      if (outcome === "REVIEW_REQUIRED" && !["games"].includes(r.sourceKey))
        changed = true;
      if (match && r.sourceKey === "rules")
        for (const stage of ["GAMEPLAY", "REDEMPTION"] as const)
          await tx
            .insert(actionPolicyEvidence)
            .values({
              platformId: p.id,
              key: `high5:public-policy:${r.fingerprint}:${r.retrievedAt.toISOString()}:${stage}`,
              stage,
              decision: "PROHIBITED",
              sourceType: "official",
              sourceUrl: r.sourceUrl,
              excerpt: r.excerpts.automation,
              verifiedAt: r.retrievedAt,
            })
            .onConflictDoNothing();
      for (const [field, excerpt] of Object.entries(r.excerpts))
        if (excerpt && field !== "documentDigest")
          await tx
            .insert(platformSources)
            .values({
              platformId: p.id,
              sourceUrl: r.sourceUrl,
              sourceType: "official",
              field: `high5Public:${r.sourceKey}:${field}`,
              extractedText: excerpt,
              normalizedValue: null,
              retrievedAt: r.retrievedAt,
              outcome: match ? "reviewed" : "needs_review",
              notes:
                "Public-source snapshot; never USER_OBSERVATION or automatic account permission.",
            })
            .onConflictDoNothing();
    }
    if (changed)
      await tx
        .update(offers)
        .set({ high5PublicReviewRequired: true })
        .where(eq(offers.platformId, p.id));
    return { changed, sources: rows.length };
  });
}
export async function importHigh5PublicReview() {
  return persistHigh5PublicSources(
    baseline.documents.map((d) => ({
      ...d,
      outcome: "READABLE",
      notes: baseline.notes,
    })),
  );
}
export async function syncHigh5PublicSources() {
  const latest = (
    await db
      .select()
      .from(high5Sources)
      .orderBy(desc(high5Sources.retrievedAt))
      .limit(1)
  )[0];
  if (latest && Date.now() - latest.retrievedAt.getTime() < 15 * 60000)
    throw new Error(
      "Public sync was just reviewed. Wait 15 minutes before another bounded read.",
    );
  const { stdout } = await promisify(execFile)(
    "python3",
    ["scripts/high5-public-fetch.py"],
    { timeout: 90000, maxBuffer: 100000 },
  );
  return persistHigh5PublicSources(JSON.parse(stdout));
}
export async function loadHigh5(accountId?: string, now = new Date()) {
  const p = (
    await db.select().from(platforms).where(eq(platforms.slug, "high-5-casino"))
  )[0];
  if (!p) return null;
  const adapter = registerHigh5Adapter(p.id);
  const a = (
    await db
      .select()
      .from(bankrollAccounts)
      .where(
        accountId
          ? eq(bankrollAccounts.id, accountId)
          : eq(bankrollAccounts.key, "real:" + p.id),
      )
  )[0];
  if (!a || a.demo || a.platformId !== p.id) return null;
  const [updates, rewards, events, redemptions, sources, os] =
    await Promise.all([
      db
        .select()
        .from(high5Updates)
        .where(eq(high5Updates.accountId, a.id))
        .orderBy(asc(high5Updates.sequence)),
      db
        .select()
        .from(high5RewardInstances)
        .where(eq(high5RewardInstances.accountId, a.id)),
      db
        .select()
        .from(ledgerEvents)
        .where(eq(ledgerEvents.accountId, a.id))
        .orderBy(asc(ledgerEvents.sequence)),
      db
        .select()
        .from(high5Redemptions)
        .where(eq(high5Redemptions.accountId, a.id)),
      db
        .select()
        .from(high5Sources)
        .where(eq(high5Sources.platformId, p.id))
        .orderBy(desc(high5Sources.retrievedAt)),
      db.select().from(offers).where(eq(offers.platformId, p.id)),
    ]);
  const latest = updates.at(-1),
    state = latest ? hydrate(latest.payload) : null,
    b = bankroll(events.filter((e) => e.currency === "SC"));
  const sourceStatus = baseline.documents.map((d) =>
    sources.find((s) => s.sourceKey === d.sourceKey),
  );
  const termsCurrent =
    sourceStatus
      .filter((s, index) => baseline.documents[index].sourceKey !== "games")
      .every(
        (s) =>
          s &&
          s.outcome === "REVIEWED_MATCH" &&
          s.retrievedAt <= now &&
          now.getTime() - s.retrievedAt.getTime() <= 30 * 86400000,
      ) &&
    !os.some(
      (o) =>
        o.high5PublicReviewRequired &&
        o.purchaseRequired === false &&
        o.depositRequired === false,
    );
  const [strategy] = await db
    .select()
    .from(casinoStrategies)
    .where(eq(casinoStrategies.accountId, a.id));
  const recommendation = high5Recommendation({
    redeemable:
      b.balances.REDEEMABLE > 0
        ? b.balances.REDEEMABLE
        : state?.redeemableSC === null || state === null
          ? null
          : 0,
    remaining: state?.playthroughRemaining ?? null,
    playable: state?.playableSC ?? null,
    termsCurrent,
    verifiedGames: [],
    controls: strategy?.controls,
    redemptionMinimum: state?.redemptionMinimum ?? null,
    now,
  });
  const legacyClaims = os.length
    ? await db
        .select()
        .from(claims)
        .where(
          inArray(
            claims.offerId,
            os.map((o) => o.id),
          ),
        )
    : [];
  const legacyRewards = legacyClaims
    .filter(
      (c) =>
        ["CLAIMED", "PLAYTHROUGH_REQUIRED", "REDEEMABLE", "REDEEMED"].includes(
          c.claimState,
        ) &&
        !rewards.some(
          (r) => r.instanceKey === `legacy:${c.offerId}:${c.periodKey}`,
        ) &&
        (events.some(
          (e) => e.claimId === c.id && e.eventType === "FREE_REWARD_RECEIVED",
        ) ||
          (a.key === `real:${p.id}` && c.promotionalValueReceived === null)),
    )
    .map((c) => {
      const offer = os.find((o) => o.id === c.offerId)!;
      return {
        claimed: true,
        kind: "SC_ONLY",
        sc: c.promotionalValueReceived,
        scope:
          offer.offerType === "signup"
            ? "SIGNUP"
            : offer.recurringCadence === "daily" ||
                offer.recurringCadence === "weekly"
              ? "RECURRING"
              : "OTHER",
        occurredAt: c.claimedDate ?? c.periodStart,
      };
    });
  const metrics = experimentMetrics({
    start:
      [updates[0]?.occurredAt, ...legacyRewards.map((r) => r.occurredAt)]
        .filter((d): d is Date => d !== null && d !== undefined)
        .sort((a, b) => a.getTime() - b.getTime())[0] ?? null,
    now,
    updates: updates.map((u) => ({
      occurredAt: u.occurredAt,
      checkedReward: u.checkedReward,
      minutes: Number(u.minutes),
      payload: hydrate(u.payload),
    })),
    rewards: [...rewards, ...legacyRewards],
    events,
    redemptions,
  });
  const lastCheck =
    [...updates].reverse().find((u) => u.checkedReward)?.occurredAt ?? null;
  const nextCheck =
    state?.nextRewardAt ??
    (lastCheck ? new Date(lastCheck.getTime() + 4 * 3600000) : null);
  return {
    platform: p,
    account: a,
    adapterSupport: adapter.support,
    updates,
    rewards,
    events,
    redemptions,
    sources,
    sourceStatus,
    state,
    balance: b,
    termsCurrent,
    recommendation,
    metrics,
    lastCheck,
    nextCheck,
    integrity: high5Integrity(events),
    offers: os.filter(
      (o) =>
        o.purchaseRequired === false &&
        o.depositRequired === false &&
        o.offerType !== "amoe",
    ),
  };
}
export async function initializeHigh5() {
  await refreshOperations();
  await importHigh5PublicReview();
}

// Explicit curator action after primary-source/typed-term review, never part of sync.
export async function reviewHigh5PublicSources(now = new Date()) {
  const d = await loadHigh5(undefined, now);
  if (
    !d ||
    !d.sourceStatus
      .filter((s, index) => baseline.documents[index].sourceKey !== "games")
      .every(
        (s) =>
          s &&
          s.outcome === "REVIEWED_MATCH" &&
          s.retrievedAt <= now &&
          now.getTime() - s.retrievedAt.getTime() <= 30 * 86400000,
      )
  )
    throw new Error(
      "Review current primary documents, update the curated baseline and typed terms, then sync matching sources before clearing flags.",
    );
  const data = await loadData();
  const { evaluateOfferEligibility } = await import("@/domain/eligibility");
  const candidates = data.offers.filter(
    (o) =>
      o.platformId === d.platform.id &&
      o.high5PublicReviewRequired &&
      evaluateOfferEligibility(
        { ...o, high5PublicReviewRequired: false },
        data.profile,
        now,
      ).eligible,
  );
  await db.transaction(async (tx) => {
    for (const o of candidates)
      await tx
        .update(offers)
        .set({ high5PublicReviewRequired: false })
        .where(eq(offers.id, o.id));
    await tx.insert(platformSources).values({
      platformId: d.platform.id,
      field: "high5Public:manualReverification",
      sourceUrl: "https://high5casino.com/sweepstakes-rules/",
      sourceType: "official",
      retrievedAt: now,
      outcome: "reviewed",
      extractedText:
        "Explicit curator re-verification against matching current primary documents and independently eligible typed offer evidence.",
      notes:
        "Manual local review command, not account automation or inferred source permission.",
    });
  });
  await refreshOperations(now);
  return { reviewedOffers: candidates.length };
}
