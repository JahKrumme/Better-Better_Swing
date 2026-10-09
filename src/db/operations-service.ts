import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./index";
import { loadData } from "./queries";
import {
  bankrollAccounts,
  manualObservations,
  actionPolicyEvidence,
  rewardSchedules,
  operationalActions,
  ledgerEvents,
  casinoStrategies,
  demoRuns,
  claims,
  offers,
  platforms,
  high5Updates,
  accountSnapshots,
} from "./schema";
import {
  actionStage,
  bankroll,
  balanceCategories,
  cents,
  controlsSchema,
  decimal,
  defaultControls,
  effectivePolicy,
  enforceZeroMoney,
  eventTypes,
  executionPlan,
  freeFunding,
  moneyString,
  strategyPlan,
  validateLedgerEvent,
  type ActionType,
  type Engine,
  type GameTerms,
  type LedgerRecord,
  type PolicyEvidence,
} from "@/domain/operations";
import { scheduledOpportunity, type ScheduleSpec } from "@/domain/scheduler";
import { authorizeAutomatic } from "@/domain/adapters";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Account = typeof bankrollAccounts.$inferSelect;
type Data = Awaited<ReturnType<typeof loadData>>;
const engineFor = (category: string): Engine | null =>
  category === "sweepstakes_casino"
    ? "CASINO"
    : category === "sportsbook"
      ? "SPORTSBOOK"
      : null;
const eventInput = z
  .object({
    eventType: z.enum(eventTypes),
    currency: z.string().trim().min(1).max(40),
    amount: moneyString,
    category: z.enum(balanceCategories),
    occurredAt: z.date(),
    offerId: z.uuid().nullable().default(null),
    claimId: z.uuid().nullable().default(null),
    relatedEventId: z.uuid().nullable().default(null),
    sessionId: z.string().max(100).nullable().default(null),
    notes: z.string().trim().max(2000).nullable().default(null),
    actualCashAmount: moneyString.nullable().default(null),
    cashCurrency: z.enum(["USD"]).nullable().default(null),
    key: z.string().min(1).max(200),
    direction: z.enum(["CREDIT", "DEBIT"]).default("DEBIT"),
    sourceKind: z
      .enum(["SYSTEM", "USER_OBSERVATION", "SIMULATION"])
      .default("SYSTEM"),
    observationId: z.uuid().nullable().default(null),
  })
  .strict();
export type EventInput = z.input<typeof eventInput>;
async function accountFor(
  tx: Tx,
  platformId: string,
  engine: Engine,
  label: string,
  key: string,
  demo = false,
) {
  await tx
    .insert(bankrollAccounts)
    .values({ platformId, engine, label, key, demo })
    .onConflictDoNothing();
  const [a] = await tx
    .select()
    .from(bankrollAccounts)
    .where(eq(bankrollAccounts.key, key));
  if (
    !a ||
    a.demo !== demo ||
    a.engine !== engine ||
    a.platformId !== platformId
  )
    throw new Error("Account identity mismatch.");
  return a;
}
async function appendEvent(
  tx: Tx,
  a: Account,
  input: EventInput,
  funding: unknown = freeFunding,
  high5Observation = false,
) {
  enforceZeroMoney(funding);
  const e = eventInput.parse({
    ...input,
    sourceKind: input.sourceKind ?? (a.demo ? "SIMULATION" : "SYSTEM"),
  });
  await tx
    .select()
    .from(bankrollAccounts)
    .where(eq(bankrollAccounts.id, a.id))
    .for("update");
  const [duplicate] = await tx
    .select()
    .from(ledgerEvents)
    .where(eq(ledgerEvents.key, e.key));
  if (duplicate) {
    if (
      duplicate.accountId !== a.id ||
      duplicate.currency !== e.currency ||
      duplicate.eventType !== e.eventType ||
      cents(duplicate.amount) !== cents(e.amount) ||
      [
        "category",
        "offerId",
        "claimId",
        "relatedEventId",
        "sessionId",
        "notes",
        "cashCurrency",
        "direction",
        "sourceKind",
        "observationId",
      ].some(
        (field) =>
          duplicate[field as keyof typeof duplicate] !==
          e[field as keyof typeof e],
      ) ||
      (duplicate.actualCashAmount === null
        ? null
        : cents(duplicate.actualCashAmount)) !==
        (e.actualCashAmount === null ? null : cents(e.actualCashAmount))
    )
      throw new Error("Ledger idempotency key reused with different contents.");
    return duplicate;
  }
  const rows = await tx
    .select()
    .from(ledgerEvents)
    .where(
      and(
        eq(ledgerEvents.accountId, a.id),
        eq(ledgerEvents.currency, e.currency),
      ),
    )
    .orderBy(asc(ledgerEvents.sequence));
  const [platform] = await tx
    .select()
    .from(platforms)
    .where(eq(platforms.id, a.platformId));
  if (!a.demo && !high5Observation && e.eventType === "FREE_REWARD_RECEIVED") {
    const [c] = e.claimId
      ? await tx.select().from(claims).where(eq(claims.id, e.claimId))
      : [];
    const [o] = c
      ? await tx.select().from(offers).where(eq(offers.id, c.offerId))
      : [];
    if (
      !c ||
      !o ||
      o.platformId !== a.platformId ||
      o.fixture ||
      e.offerId !== o.id ||
      c.promotionalValueReceived === null ||
      cents(c.promotionalValueReceived) !== cents(e.amount) ||
      (o.promotionalCurrency !== e.currency &&
        !(
          platform?.slug === "high-5-casino" &&
          e.currency === "SC" &&
          o.promotionalCurrency === "SC (promotional)"
        )) ||
      !["CLAIMED", "PLAYTHROUGH_REQUIRED", "REDEEMABLE", "REDEEMED"].includes(
        c.claimState,
      )
    )
      throw new Error(
        "Free receipt must match an actual recorded real claim; balances are not inferred.",
      );
  }
  if (e.claimId) {
    const [c] = await tx.select().from(claims).where(eq(claims.id, e.claimId));
    const [o] = c
      ? await tx.select().from(offers).where(eq(offers.id, c.offerId))
      : [];
    if (
      !o ||
      o.platformId !== a.platformId ||
      (e.offerId && o.id !== e.offerId)
    )
      throw new Error("Claim belongs to another platform.");
  }
  if (e.offerId) {
    const [o] = await tx.select().from(offers).where(eq(offers.id, e.offerId));
    if (!o || o.platformId !== a.platformId || o.fixture)
      throw new Error("Offer belongs to another platform or fixture.");
  }

  if (
    !a.demo &&
    platform?.slug === "high-5-casino" &&
    e.currency === "GC" &&
    (!high5Observation ||
      e.category !== "PROMOTIONAL" ||
      !["FREE_REWARD_RECEIVED", "OBSERVATION_RECONCILIATION"].includes(
        e.eventType,
      ))
  )
    throw new Error(
      "GC is never redeemable cash or an SC wager; use the High 5 observation form.",
    );
  validateLedgerEvent(rows, e, funding, a.engine, a.demo, high5Observation);
  const [saved] = await tx
    .insert(ledgerEvents)
    .values({
      ...e,
      accountId: a.id,
      userCashContribution: "0",
      origin: "FREE_PROMOTIONAL",
    })
    .returning();
  return saved;
}
// Narrow manual bookkeeping path; this never calls a platform executor.
export async function appendHigh5ObservationEvent(
  tx: Tx,
  a: Account,
  input: EventInput,
  observationId: string,
  funding: unknown = freeFunding,
) {
  enforceZeroMoney(funding);
  const [p] = await tx
    .select()
    .from(platforms)
    .where(eq(platforms.id, a.platformId));
  const [o] = await tx
    .select()
    .from(high5Updates)
    .where(eq(high5Updates.id, observationId));
  if (
    a.demo ||
    a.engine !== "CASINO" ||
    p?.slug !== "high-5-casino" ||
    p.excluded ||
    !o ||
    o.accountId !== a.id ||
    o.payload.freeOnly !== true
  )
    throw new Error("A real High 5 free-only manual observation is required.");
  if (!["SC", "GC"].includes(input.currency))
    throw new Error("High 5 bankroll units must be SC or GC.");
  if (
    input.currency === "GC" &&
    (!["FREE_REWARD_RECEIVED", "OBSERVATION_RECONCILIATION"].includes(
      input.eventType,
    ) ||
      input.category !== "PROMOTIONAL")
  )
    throw new Error("GC is never redeemable cash or an SC wager.");
  if (
    ["PROMOTIONAL_WAGER", "PROMOTIONAL_WIN", "PROMOTIONAL_LOSS"].includes(
      input.eventType,
    ) &&
    o.operation !== "MANUAL_PLAY"
  )
    throw new Error("Already-performed manual play observation required.");
  if (
    input.eventType === "FREE_REWARD_RECEIVED" &&
    (o.payload.rewardClaimed !== "YES" ||
      (input.currency === "SC" ? o.payload.rewardSC : o.payload.rewardGC) ===
        null ||
      cents(
        (input.currency === "SC" ? o.payload.rewardSC : o.payload.rewardGC)!,
      ) !== cents(input.amount))
  )
    throw new Error(
      "Explicit claimed free receipt and actual amount required.",
    );
  return appendEvent(
    tx,
    a,
    { ...input, observationId, sourceKind: "USER_OBSERVATION" },
    funding,
    true,
  );
}
// Manual consumer observations never execute gameplay or call a platform.
export async function appendAccountObservationEvent(
  tx: Tx,
  a: Account,
  input: EventInput,
  snapshotId: string,
) {
  const [p] = await tx
    .select()
    .from(platforms)
    .where(eq(platforms.id, a.platformId));
  const [o] = await tx
    .select()
    .from(accountSnapshots)
    .where(eq(accountSnapshots.id, snapshotId));
  if (
    a.demo ||
    a.engine !== "CASINO" ||
    !p ||
    p.fixture ||
    p.excluded ||
    p.slug === "high-5-casino" ||
    !o ||
    o.accountId !== a.id ||
    !o.payload.freeOnly
  )
    throw new Error("Real free-only account observation required.");
  if (
    input.currency === "GC" &&
    (input.category !== "PROMOTIONAL" ||
      !["FREE_REWARD_RECEIVED", "OBSERVATION_RECONCILIATION"].includes(
        input.eventType,
      ))
  )
    throw new Error(
      "GC cannot be played as redeemable currency or redeemed for cash.",
    );
  if (
    ["PROMOTIONAL_WAGER", "PROMOTIONAL_WIN", "PROMOTIONAL_LOSS"].includes(
      input.eventType,
    ) &&
    o.operation !== "PLAY"
  )
    throw new Error("Already-performed manual play required.");
  if (input.eventType === "FREE_REWARD_RECEIVED") {
    const amount =
      input.currency === "GC" ? o.payload.receivedGC : o.payload.received;
    if (
      o.payload.claimed !== "YES" ||
      amount === null ||
      cents(amount) !== cents(input.amount)
    )
      throw new Error("Actual claimed receipt required.");
  }
  return appendEvent(
    tx,
    a,
    { ...input, sourceKind: "USER_OBSERVATION", observationId: null },
    freeFunding,
    true,
  );
}
export async function recordLedgerEvent(
  accountId: string,
  input: EventInput,
  funding: unknown = freeFunding,
) {
  z.uuid().parse(accountId);
  enforceZeroMoney(funding);
  const d = await loadData();
  return db.transaction(async (tx) => {
    const [a] = await tx
      .select()
      .from(bankrollAccounts)
      .where(eq(bankrollAccounts.id, accountId))
      .for("update");
    if (!a || a.demo)
      throw new Error("Use the isolated demo workflow for simulation.");
    const p = d.platforms.find((p) => p.id === a.platformId);
    if (!p || p.fixture || p.excluded)
      throw new Error("Platform is excluded or unavailable.");
    if (p.slug === "high-5-casino") {
      if (input.currency === "GC")
        throw new Error(
          "GC is never redeemable cash or an SC wager; use the High 5 observation form.",
        );
      throw new Error(
        "Use High 5 account, manual play and redemption forms so reported state and experiment records stay consistent.",
      );
    }
    if (input.occurredAt > new Date())
      throw new Error("Future actual events cannot be recorded.");
    if (
      [
        "FREE_REWARD_RECEIVED",
        "PROMOTIONAL_WAGER",
        "PROMOTIONAL_WIN",
        "PROMOTIONAL_LOSS",
      ].includes(input.eventType)
    )
      throw new Error(
        "Record free receipts via manual claims; real gameplay execution is not supported.",
      );
    if (!input.notes?.trim())
      throw new Error("Record the manual terms/result evidence.");
    return appendEvent(tx, a, input, funding);
  });
}
async function ensureAction(
  tx: Tx,
  a: Account,
  d: Data,
  type: ActionType,
  key: string,
  availableAt: Date,
  expiresAt: Date | null,
  related: {
    offerId?: string | null;
    claimId?: string | null;
    scheduleId?: string | null;
    opportunityKey: string;
  },
  now: Date,
) {
  const ps = await tx
    .select()
    .from(actionPolicyEvidence)
    .where(eq(actionPolicyEvidence.platformId, a.platformId));
  const policy = effectivePolicy(ps, actionStage(type), a.demo, now);
  const p = d.platforms.find((p) => p.id === a.platformId);
  const o = d.offers.find((o) => o.id === related.offerId);
  const eligible =
    a.demo ||
    (related.offerId && type !== "MANUAL_VERIFICATION"
      ? Boolean(o?.result.eligible)
      : Boolean(p && !p.excluded && !p.fixture));
  const plan = executionPlan({
    type,
    engine: a.engine,
    policy,
    funding: freeFunding,
    eligible,
    excluded: p?.excluded ?? true,
    demo: a.demo,
  });
  await tx
    .insert(operationalActions)
    .values({
      accountId: a.id,
      actionType: type,
      key,
      availableAt,
      expiresAt,
      automationPolicy: policy,
      executionMode: plan.mode,
      reason: plan.reason,
      ...related,
      funding: freeFunding,
    })
    .onConflictDoNothing();
  await tx
    .update(operationalActions)
    .set({
      automationPolicy: policy,
      executionMode: plan.mode,
      reason: plan.reason,
      funding: freeFunding,
    })
    .where(
      and(
        eq(operationalActions.key, key),
        eq(operationalActions.status, "PENDING"),
      ),
    );
}
async function seedPolicies(tx: Tx, d: Data) {
  const scopes: Record<string, PolicyEvidence["stage"][]> = {
    "high-5-casino": ["GAMEPLAY", "REDEMPTION"],
    "stake-us": ["CLAIM", "GAMEPLAY"],
    realprize: ["GAMEPLAY"],
  };
  for (const [slug, ss] of Object.entries(scopes)) {
    const p = d.platforms.find((p) => p.slug === slug);
    if (
      !p ||
      !p.automationPolicyEvidence ||
      !p.automationPolicySource ||
      !p.automationPolicyLastVerifiedAt
    )
      continue;
    for (const stage of ss)
      await tx
        .insert(actionPolicyEvidence)
        .values({
          platformId: p.id,
          key: `phase3:${slug}:${stage}`,
          stage,
          decision: "PROHIBITED",
          sourceType: "official",
          sourceUrl: p.automationPolicySource,
          excerpt: p.automationPolicyEvidence,
          verifiedAt: p.automationPolicyLastVerifiedAt,
        })
        .onConflictDoNothing();
  }
}
export async function refreshOperations(now = new Date()) {
  const d = await loadData();
  return db.transaction(async (tx) => {
    await seedPolicies(tx, d);
    const high = d.platforms.find(
      (p) => p.slug === "high-5-casino" && !p.fixture && !p.excluded,
    );
    if (high) {
      const [obs] = await tx
        .insert(manualObservations)
        .values({
          platformId: high.id,
          key: "user-high5-phase3",
          reportedAt: now,
          observedAt: null,
          currency: "SC",
          observedBalance: "3.00",
          text: 'User reports a new account showed 3.00 SC without purchase; UI displayed "FREE COINS Every 4 Hours! Check your Inbox."',
          notes:
            "User-reported observation, not primary-source evidence or a confirmed receipt event. Observation time, interval reward currency/amount and persistence UNKNOWN. No monthly value inferred.",
        })
        .onConflictDoNothing()
        .returning();
      const observation =
        obs ??
        (
          await tx
            .select()
            .from(manualObservations)
            .where(eq(manualObservations.key, "user-high5-phase3"))
        )[0];
      const a = await accountFor(
        tx,
        high.id,
        "CASINO",
        "High 5 — free promotional bookkeeping",
        "real:" + high.id,
      );
      await tx
        .insert(rewardSchedules)
        .values({
          accountId: a.id,
          observationId: observation.id,
          key: "high5-observed-check-4h",
          purpose: "CHECK_REWARD",
          sourceType: "observation",
          verifiedAt: observation.reportedAt,
          expiresAt: new Date(observation.reportedAt.getTime() + 7 * 86400000),
          spec: {
            kind: "EVERY_N_HOURS",
            hours: 4,
            anchor: observation.reportedAt.toISOString(),
            timezone: "America/Chicago",
            windows: [],
          },
        })
        .onConflictDoNothing();
    }
    for (const o of d.offers.filter(
      (o) => !o.fixture && !o.platform.fixture && o.result.eligible,
    )) {
      const engine = engineFor(o.platform.category);
      if (!engine) continue;
      const a = await accountFor(
        tx,
        o.platformId,
        engine,
        o.platform.name + " — free promotional bookkeeping",
        "real:" + o.platformId,
      );
      if (["daily", "weekly"].includes(o.recurringCadence ?? "")) {
        await tx
          .insert(rewardSchedules)
          .values({
            accountId: a.id,
            offerId: o.id,
            key: "verified:" + o.id,
            purpose: "CLAIM_REWARD",
            sourceType: "official",
            verifiedAt: o.lastVerifiedAt!,
            expiresAt: o.expirationDate,
            spec: {
              kind: o.recurringCadence === "weekly" ? "WEEKLY" : "DAILY",
              hours: null,
              anchor: (o.recurrenceAnchor ?? o.discoveredAt).toISOString(),
              timezone: o.recurrenceTimezone,
              windows: [],
            },
          })
          .onConflictDoNothing();
        await tx
          .update(rewardSchedules)
          .set({ verifiedAt: o.lastVerifiedAt!, expiresAt: o.expirationDate })
          .where(eq(rewardSchedules.key, "verified:" + o.id));
      } else {
        await ensureAction(
          tx,
          a,
          d,
          "CLAIM_REWARD",
          `offer:${o.id}:once`,
          o.currentOpportunity.availableDate,
          o.currentOpportunity.opportunityEndsAt,
          { offerId: o.id, opportunityKey: "once" },
          now,
        );
      }
    }
    const schedules = await tx
      .select()
      .from(rewardSchedules)
      .where(eq(rewardSchedules.enabled, true));
    for (const s of schedules) {
      const [a] = await tx
        .select()
        .from(bankrollAccounts)
        .where(eq(bankrollAccounts.id, s.accountId));
      if (!a || a.demo) continue;
      const opportunity = scheduledOpportunity(
        s.spec,
        now,
        s.verifiedAt,
        s.expiresAt,
        s.sourceType,
        s.purpose,
      );
      if (!opportunity) continue;
      await ensureAction(
        tx,
        a,
        d,
        s.purpose,
        `schedule:${s.id}:${opportunity.key}`,
        opportunity.availableAt,
        opportunity.expiresAt,
        {
          offerId: s.offerId,
          scheduleId: s.id,
          opportunityKey: opportunity.key,
        },
        now,
      );
    }
    for (const c of d.claims) {
      const o = d.offers.find((o) => o.id === c.offerId),
        engine = o ? engineFor(o.platform.category) : null;
      if (
        !o ||
        o.fixture ||
        o.platform.fixture ||
        o.platform.excluded ||
        !engine ||
        !["CLAIMED", "PLAYTHROUGH_REQUIRED", "REDEEMABLE", "REDEEMED"].includes(
          c.claimState,
        )
      )
        continue;
      const a = await accountFor(
        tx,
        o.platformId,
        engine,
        o.platform.name + " — free promotional bookkeeping",
        "real:" + o.platformId,
      );
      const receiptCurrency =
        o.platform.slug === "high-5-casino" &&
        o.promotionalCurrency === "SC (promotional)"
          ? "SC"
          : o.promotionalCurrency;
      if (
        c.promotionalValueReceived !== null &&
        ["CLAIMED", "PLAYTHROUGH_REQUIRED"].includes(c.claimState)
      ) {
        const [existing] = await tx
          .select()
          .from(ledgerEvents)
          .where(eq(ledgerEvents.key, "claim-receipt:" + c.id));
        if (existing) {
          const [owner] = await tx
            .select()
            .from(bankrollAccounts)
            .where(eq(bankrollAccounts.id, existing.accountId));
          if (
            !owner ||
            owner.demo ||
            owner.platformId !== o.platformId ||
            existing.eventType !== "FREE_REWARD_RECEIVED" ||
            existing.currency !== receiptCurrency ||
            cents(existing.amount) !== cents(c.promotionalValueReceived)
          )
            throw new Error(
              "Claim receipt conflicts with its actual recorded amount/account.",
            );
        } else {
          await appendEvent(tx, a, {
            eventType: "FREE_REWARD_RECEIVED",
            category: "PROMOTIONAL",
            amount: c.promotionalValueReceived,
            currency: receiptCurrency,
            occurredAt: c.claimedDate ?? now,
            offerId: o.id,
            claimId: c.id,
            key: "claim-receipt:" + c.id,
            notes:
              "Imported actual user-entered manual claim amount; not advertised value. Bookkeeping balance requires reconciliation of any offline play/results.",
          });
        }
      } else
        await ensureAction(
          tx,
          a,
          d,
          "MANUAL_VERIFICATION",
          `claim-amount:${c.id}`,
          now,
          null,
          {
            offerId: o.id,
            claimId: c.id,
            opportunityKey: c.periodKey ?? "once",
          },
          now,
        );
      await tx
        .update(operationalActions)
        .set({
          status: "COMPLETED",
          claimId: c.id,
          completedAt: c.claimedDate ?? now,
          result:
            "User recorded manual claim; known received amount imported once.",
        })
        .where(
          and(
            eq(operationalActions.offerId, o.id),
            eq(operationalActions.opportunityKey, c.periodKey ?? "once"),
            eq(operationalActions.actionType, "CLAIM_REWARD"),
          ),
        );
    }
    const accounts = await tx
      .select()
      .from(bankrollAccounts)
      .where(eq(bankrollAccounts.demo, false));
    const events = await tx
      .select()
      .from(ledgerEvents)
      .orderBy(asc(ledgerEvents.sequence));
    for (const a of accounts) {
      for (const currency of new Set(
        events.filter((e) => e.accountId === a.id).map((e) => e.currency),
      )) {
        const rows = events.filter(
            (e) => e.accountId === a.id && e.currency === currency,
          ),
          b = bankroll(rows);
        const type: ActionType | null =
          b.availableRedeemable > 0
            ? "REQUEST_REDEMPTION"
            : b.reserved > 0
              ? "CHECK_REDEMPTION"
              : b.balances.PROMOTIONAL + b.balances.PLAYABLE > 0
                ? "CHECK_PLAYTHROUGH"
                : null;
        const key = type
          ? `bankroll:${a.id}:${currency}:${type}:${rows.at(-1)!.id}`
          : null;
        for (const old of await tx
          .select()
          .from(operationalActions)
          .where(
            and(
              eq(operationalActions.accountId, a.id),
              eq(operationalActions.opportunityKey, "bankroll:" + currency),
              eq(operationalActions.status, "PENDING"),
            ),
          )) {
          if (old.actionType !== type)
            await tx
              .update(operationalActions)
              .set({
                status: "COMPLETED",
                completedAt: now,
                result:
                  "Recorded ledger state progressed; no external action executed.",
              })
              .where(eq(operationalActions.id, old.id));
          else if (old.key !== key)
            await tx
              .update(operationalActions)
              .set({
                status: "EXPIRED",
                result:
                  "Superseded by a newer ledger state; no task execution assumed.",
              })
              .where(eq(operationalActions.id, old.id));
        }
        if (type)
          await ensureAction(
            tx,
            a,
            d,
            type,
            key!,
            now,
            null,
            { opportunityKey: "bankroll:" + currency },
            now,
          );
      }
    }
    const pending = await tx
      .select()
      .from(operationalActions)
      .where(eq(operationalActions.status, "PENDING"));
    for (const task of pending) {
      if (task.expiresAt && task.expiresAt <= now)
        await tx
          .update(operationalActions)
          .set({ status: "EXPIRED" })
          .where(eq(operationalActions.id, task.id));
      else {
        const [a] = await tx
          .select()
          .from(bankrollAccounts)
          .where(eq(bankrollAccounts.id, task.accountId));
        if (a && !a.demo)
          await ensureAction(
            tx,
            a,
            d,
            task.actionType,
            task.key,
            task.availableAt,
            task.expiresAt,
            {
              offerId: task.offerId,
              claimId: task.claimId,
              scheduleId: task.scheduleId,
              opportunityKey: task.opportunityKey,
            },
            now,
          );
      }
    }
  });
}
export async function loadOperations(demo = false) {
  const [
    accounts,
    events,
    actions,
    schedules,
    observations,
    strategies,
    runs,
    policies,
  ] = await Promise.all([
    db.select().from(bankrollAccounts).where(eq(bankrollAccounts.demo, demo)),
    db.select().from(ledgerEvents).orderBy(asc(ledgerEvents.sequence)),
    db
      .select()
      .from(operationalActions)
      .orderBy(
        asc(operationalActions.availableAt),
        asc(
          sql`CASE WHEN ${operationalActions.actionType} = 'CLAIM_REWARD' THEN 0 ELSE 1 END`,
        ),
        asc(operationalActions.key),
      ),
    db.select().from(rewardSchedules),
    db.select().from(manualObservations),
    db.select().from(casinoStrategies),
    db.select().from(demoRuns),
    db.select().from(actionPolicyEvidence),
  ]);
  const ids = new Set(accounts.map((a) => a.id));
  const es = events.filter((e) => ids.has(e.accountId));
  const balances = accounts.flatMap((a) =>
    [
      ...new Set(es.filter((e) => e.accountId === a.id).map((e) => e.currency)),
    ].map((currency) => ({
      account: a,
      currency,
      ...bankroll(
        es.filter((e) => e.accountId === a.id && e.currency === currency),
      ),
    })),
  );
  return {
    accounts,
    events: es,
    balances,
    actions: actions.filter((a) => ids.has(a.accountId)),
    schedules: schedules.filter((s) => ids.has(s.accountId)),
    observations: demo ? [] : observations,
    strategies: strategies.filter((s) => ids.has(s.accountId)),
    runs: demo ? runs : [],
    policies,
  };
}
export async function finishManualAction(
  id: string,
  result: string,
  now = new Date(),
) {
  z.uuid().parse(id);
  z.string().trim().min(1).max(2000).parse(result);
  const d = await loadData();
  return db.transaction(async (tx) => {
    const [a] = await tx
      .select()
      .from(operationalActions)
      .where(eq(operationalActions.id, id))
      .for("update");
    const [account] = a
      ? await tx
          .select()
          .from(bankrollAccounts)
          .where(eq(bankrollAccounts.id, a.accountId))
      : [];
    if (
      !a ||
      !account ||
      account.demo ||
      a.status !== "PENDING" ||
      a.availableAt > now ||
      (a.expiresAt && a.expiresAt <= now)
    )
      throw new Error("Manual task is not currently available.");
    enforceZeroMoney(a.funding);
    const platform = d.platforms.find((p) => p.id === account.platformId);
    if (!platform || platform.excluded) throw new Error("Excluded platform.");
    if (
      a.offerId &&
      a.actionType !== "MANUAL_VERIFICATION" &&
      !d.offers.find((o) => o.id === a.offerId)?.result.eligible
    )
      throw new Error("Offer no longer verified; review evidence.");
    if (["CLAIM_REWARD", "MANUAL_CLAIM"].includes(a.actionType))
      throw new Error(
        "Record the actual manual claim on Offers, then refresh Today.",
      );
    await tx
      .update(operationalActions)
      .set({
        status: "COMPLETED",
        result,
        completedAt: now,
        attemptCount: a.attemptCount + 1,
      })
      .where(eq(operationalActions.id, id));
  });
}
export const gameTermsSchema = z
  .object({
    game: z.string().trim().min(1).max(200),
    eligible: z.boolean().nullable(),
    contributionPercent: z.number().min(0).max(100).nullable(),
    minimumWager: moneyString.nullable(),
    maximumWager: moneyString.nullable(),
    rtp: z.number().min(0).max(1).nullable(),
    volatility: z.string().max(200).nullable(),
    redemptionThreshold: moneyString.nullable(),
    playthroughRemaining: moneyString.nullable(),
    expectedRedeemableValue: moneyString.nullable(),
    sourceUrl: z.url().nullable(),
    verifiedAt: z.iso.datetime().nullable(),
  })
  .strict();
export async function saveStrategy(
  accountId: string,
  controls: unknown,
  terms: unknown,
) {
  z.uuid().parse(accountId);
  const c = controlsSchema.parse(controls),
    t = gameTermsSchema.parse(terms);
  const [a] = await db
    .select()
    .from(bankrollAccounts)
    .where(eq(bankrollAccounts.id, accountId));
  if (!a || a.engine !== "CASINO" || a.demo)
    throw new Error("Real casino planning account required.");
  if (t.sourceUrl) {
    const d = await loadData();
    const p = d.platforms.find((p) => p.id === a.platformId);
    const url = new URL(t.sourceUrl);
    const host = p ? new URL(p.homepageUrl).hostname : "";
    if (
      url.protocol !== "https:" ||
      !(url.hostname === host || url.hostname.endsWith("." + host))
    )
      throw new Error("Official platform game-terms source required.");
  }
  if (t.verifiedAt && new Date(t.verifiedAt) > new Date())
    throw new Error("Future verification date rejected.");
  await db
    .insert(casinoStrategies)
    .values({ accountId, controls: c, terms: t })
    .onConflictDoUpdate({
      target: casinoStrategies.accountId,
      set: { controls: c, terms: t, updatedAt: new Date() },
    });
}
export const demoSteps = [
  "Recurring reward appeared",
  "Free rewards claimed",
  "Promotional balance activated",
  "Promotional wager placed",
  "Promotional win settled",
  "Second promotional wager placed",
  "Promotional loss settled",
  "Playthrough completed",
  "Balance became redeemable — STOP PLAYING",
  "Redemption requested",
  "Redemption completed",
] as const;
export async function startDemo(now = new Date()) {
  const d = await loadData();
  const p = d.platforms.find((p) => p.slug === "high-5-casino"),
    s = d.platforms.find(
      (p) => p.category === "sportsbook" && !p.fixture && !p.excluded,
    );
  if (!p || !s) throw new Error("Existing platform registry required.");
  return db.transaction(async (tx) => {
    const id = randomUUID();
    const casino = await accountFor(
      tx,
      p.id,
      "CASINO",
      "SIMULATED casino — fictional rewards",
      `demo:${id}:casino`,
      true,
    );
    const sports = await accountFor(
      tx,
      s.id,
      "SPORTSBOOK",
      "SIMULATED sportsbook — fictional free bet",
      `demo:${id}:sports`,
      true,
    );
    const spec: ScheduleSpec = {
      kind: "EVERY_N_HOURS",
      hours: 4,
      anchor: now.toISOString(),
      timezone: "America/Chicago",
      windows: [],
    };
    await tx.insert(rewardSchedules).values({
      accountId: casino.id,
      key: `demo:${id}:schedule`,
      spec,
      purpose: "CLAIM_REWARD",
      sourceType: "simulation",
      verifiedAt: now,
      expiresAt: new Date(now.getTime() + 86400000),
    });
    await tx.insert(demoRuns).values({
      id,
      casinoAccountId: casino.id,
      sportsbookAccountId: sports.id,
      createdAt: now,
    });
    for (const account of [casino, sports])
      await tx.insert(operationalActions).values({
        accountId: account.id,
        actionType: "CLAIM_REWARD",
        key: `demo:${id}:claim:${account.engine}`,
        availableAt: now,
        expiresAt: new Date(now.getTime() + 86400000),
        automationPolicy: "PERMITTED",
        executionMode: "AUTOMATIC",
        reason:
          "SIMULATION ONLY: fictional local executor authorization, not platform permission.",
        opportunityKey: "demo-once",
        funding: freeFunding,
      });
    return id;
  });
}
const unknownTerms: GameTerms = {
  game: "Unverified",
  eligible: null,
  contributionPercent: null,
  minimumWager: null,
  maximumWager: null,
  rtp: null,
  volatility: null,
  redemptionThreshold: null,
  playthroughRemaining: null,
  expectedRedeemableValue: null,
  sourceUrl: null,
  verifiedAt: null,
};
export { unknownTerms };
export async function advanceDemo(
  id: string,
  expectedStep: number,
  now = new Date(),
) {
  z.uuid().parse(id);
  z.number()
    .int()
    .min(0)
    .max(demoSteps.length - 1)
    .parse(expectedStep);
  return db.transaction(async (tx) => {
    const [run] = await tx
      .select()
      .from(demoRuns)
      .where(eq(demoRuns.id, id))
      .for("update");
    if (!run || run.step !== expectedStep)
      throw new Error("Demo step already advanced or complete.");
    const [a] = await tx
      .select()
      .from(bankrollAccounts)
      .where(eq(bankrollAccounts.id, run.casinoAccountId))
      .for("update");
    const [s] = await tx
      .select()
      .from(bankrollAccounts)
      .where(eq(bankrollAccounts.id, run.sportsbookAccountId));
    if (
      !a?.demo ||
      !s?.demo ||
      a.engine !== "CASINO" ||
      s.engine !== "SPORTSBOOK"
    )
      throw new Error("Simulation accounts required.");
    const add = async (
      eventType: LedgerRecord["eventType"],
      amount: string,
      category: LedgerRecord["category"],
      extra: Partial<EventInput> = {},
    ) =>
      appendEvent(tx, a, {
        eventType,
        amount,
        category,
        currency: "DEMO SC",
        occurredAt: now,
        key: `demo:${id}:step:${run.step}`,
        sessionId: id,
        notes: "SIMULATED result; no real platform action or cash.",
        ...extra,
      });
    const rows = await tx
      .select()
      .from(ledgerEvents)
      .where(eq(ledgerEvents.accountId, a.id))
      .orderBy(asc(ledgerEvents.sequence));
    const b = bankroll(rows);
    switch (run.step) {
      case 0:
        break;
      case 1: {
        const [action] = await tx
          .select()
          .from(operationalActions)
          .where(eq(operationalActions.key, `demo:${id}:claim:CASINO`))
          .for("update");
        const simulation: PolicyEvidence = {
          stage: "CLAIM",
          decision: "PERMITTED",
          sourceType: "simulation",
          sourceUrl: null,
          excerpt: "Local demo executor only.",
          verifiedAt: run.createdAt,
          expiresAt: new Date(run.createdAt.getTime() + 86400000),
        };
        authorizeAutomatic({
          type: "CLAIM_REWARD",
          engine: "CASINO",
          funding: action.funding,
          eligible: true,
          excluded: false,
          demo: true,
          policies: [simulation],
          adapterEnabled: true,
          availableAt: action.availableAt,
          expiresAt: action.expiresAt,
          now,
        });
        await add("FREE_REWARD_RECEIVED", "10", "PROMOTIONAL");
        await appendEvent(tx, s, {
          eventType: "FREE_REWARD_RECEIVED",
          amount: "5",
          category: "PROMOTIONAL",
          currency: "DEMO FREE BET USD",
          occurredAt: now,
          key: `demo:${id}:sports-receipt`,
          notes:
            "SIMULATED $0 free-bet receipt; user decides betting; no wager execution.",
        });
        await appendEvent(tx, s, {
          eventType: "PROMOTIONAL_ACTIVATED",
          amount: "5",
          category: "PLAYABLE",
          currency: "DEMO FREE BET USD",
          occurredAt: now,
          key: `demo:${id}:sports-playable`,
          notes: "SIMULATED credit available to user; no sportsbook wager.",
        });
        for (const account of [a, s])
          await tx
            .update(operationalActions)
            .set({
              status: "COMPLETED",
              completedAt: now,
              result: "SIMULATED free reward receipt",
              attemptCount: 1,
            })
            .where(
              eq(operationalActions.key, `demo:${id}:claim:${account.engine}`),
            );
        break;
      }
      case 2:
        await add("PROMOTIONAL_ACTIVATED", "10", "PLAYABLE");
        break;
      case 3:
      case 5: {
        const terms = {
          ...unknownTerms,
          game: "SIMULATED eligible game",
          eligible: true,
          contributionPercent: 100,
          minimumWager: "0.10",
          maximumWager: "0.10",
          rtp: 0.96,
          volatility: "Fictional",
          redemptionThreshold: "5",
          playthroughRemaining: "0.20",
          expectedRedeemableValue: "0.09",
          sourceUrl: "https://simulation.invalid/game",
          verifiedAt: now,
        };
        const plan = strategyPlan({
          engine: "CASINO",
          funding: freeFunding,
          controls: { ...defaultControls, minimumExpectedValue: "0" },
          terms,
          playable: b.balances.PLAYABLE,
          redeemable: b.balances.REDEEMABLE,
          requestedWager: 10,
          sessionLoss: b.losses,
          minutes: (now.getTime() - run.createdAt.getTime()) / 60000,
          now,
        });
        if (plan.status !== "PLAN_ONLY") throw new Error(plan.reason);
        await add("PROMOTIONAL_WAGER", "0.10", "PLAYABLE");
        break;
      }
      case 4:
        await add("PROMOTIONAL_WIN", "0.15", "PLAYABLE", {
          relatedEventId: rows.find((e) => e.key === `demo:${id}:step:3`)!.id,
        });
        break;
      case 6:
        await add("PROMOTIONAL_LOSS", "0", "PLAYABLE", {
          relatedEventId: rows.find((e) => e.key === `demo:${id}:step:5`)!.id,
        });
        break;
      case 7:
        await add("PLAYTHROUGH_COMPLETED", "0", "PLAYABLE");
        break;
      case 8:
        await add(
          "BECAME_REDEEMABLE",
          decimal(b.balances.PLAYABLE),
          "PLAYABLE",
          {
            notes:
              "SIMULATED: fictional 0.20 required playthrough completed and fictional 5 SC minimum met; no purchase.",
          },
        );
        break;
      case 9:
        await add(
          "REDEMPTION_REQUESTED",
          decimal(b.availableRedeemable),
          "REDEEMABLE",
        );
        break;
      case 10:
        await add(
          "REDEMPTION_COMPLETED",
          decimal(b.balances.REDEEMABLE),
          "REDEEMED",
          {
            relatedEventId: rows.find((e) => e.key === `demo:${id}:step:9`)!.id,
            actualCashAmount: decimal(b.balances.REDEEMABLE),
            cashCurrency: "USD",
          },
        );
        break;
    }
    await tx
      .update(demoRuns)
      .set({ step: run.step + 1 })
      .where(eq(demoRuns.id, id));
  });
}
