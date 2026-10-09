import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  numeric,
  integer,
  jsonb,
  uniqueIndex,
  check,
  bigserial,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type {
  Engine,
  ActionType,
  Policy,
  ExecutionMode,
  EventType,
  Category,
  RiskControls,
  GameTerms,
  PolicyEvidence,
} from "@/domain/operations";
import type { ScheduleSpec } from "@/domain/scheduler";
export const category = pgEnum("platform_category", [
  "sportsbook",
  "sweepstakes_casino",
  "prediction",
  "other",
]);
export const policy = pgEnum("automation_policy", [
  "unknown",
  "prohibited",
  "permitted",
]);
export const offerType = pgEnum("offer_type", [
  "signup",
  "daily",
  "weekly",
  "limited_time",
  "amoe",
  "giveaway",
]);
export const verification = pgEnum("verification_status", [
  "needs_verification",
  "verified",
  "rejected",
]);
export const evidenceType = pgEnum("source_type", [
  "official",
  "secondary",
  "fixture",
]);
export const researchState = pgEnum("research_state", [
  "VERIFIED_FREE",
  "NEEDS_VERIFICATION",
  "EXCLUDED_REQUIRES_MONEY",
  "EXCLUDED_GEOGRAPHY",
  "EXCLUDED_PLATFORM",
  "EXPIRED",
]);
export const claimState = pgEnum("claim_state", [
  "UNCLAIMED",
  "READY_TO_CLAIM",
  "CLAIMED",
  "PLAYTHROUGH_REQUIRED",
  "REDEEMABLE",
  "REDEEMED",
  "EXPIRED",
]);
export const platformSources = pgTable(
  "platform_sources",
  {
    id: uuid().primaryKey().defaultRandom(),
    platformId: uuid()
      .notNull()
      .references(() => platforms.id),
    sourceUrl: text().notNull(),
    sourceType: evidenceType().notNull(),
    field: text().notNull(),
    extractedText: text(),
    normalizedValue: text(),
    retrievedAt: timestamp({ withTimezone: true }).notNull(),
    outcome: text().notNull(),
    notes: text(),
  },
  (t) => [
    uniqueIndex("platform_source_attempt").on(
      t.platformId,
      t.sourceUrl,
      t.retrievedAt,
      t.field,
      sql`coalesce(${t.normalizedValue}, '')`,
    ),
  ],
);
export const platforms = pgTable("platforms", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  homepageUrl: text().notNull(),
  category: category().notNull(),
  status: text().notNull().default("monitored"),
  usAvailability: boolean(),
  geographicRestrictions: jsonb().$type<string[]>().notNull().default([]),
  termsUrl: text(),
  promotionsUrl: text(),
  automationPolicy: policy().notNull().default("unknown"),
  automationPolicyEvidence: text(),
  automationPolicySource: text(),
  automationPolicyLastVerifiedAt: timestamp({ withTimezone: true }),
  excluded: boolean().notNull().default(false),
  exclusionReason: text(),
  fixture: boolean().notNull().default(false),
  lastCheckedAt: timestamp({ withTimezone: true }),
  rulesUrl: text(),
  kansasAvailability: boolean(),
  minimumAge: integer(),
  freeSignupReward: text(),
  recurringFreeReward: text(),
  amoeAvailable: boolean(),
  minimumRedemption: numeric({ precision: 12, scale: 2 }),
  playthroughRequirement: text(),
  identityVerificationRequired: boolean(),
  researchNotes: text(),
  lastVerifiedAt: timestamp({ withTimezone: true }),
  researchState: researchState().notNull().default("NEEDS_VERIFICATION"),
});
export const offers = pgTable("offers", {
  id: uuid().primaryKey().defaultRandom(),
  platformId: uuid()
    .notNull()
    .references(() => platforms.id),
  title: text().notNull(),
  description: text().notNull(),
  offerType: offerType().notNull(),
  promotionalAmount: numeric({ precision: 12, scale: 2 }),
  promotionalCurrency: text().notNull(),
  estimatedCashValue: numeric({ precision: 12, scale: 2 }),
  signupRequired: boolean(),
  depositRequired: boolean(),
  purchaseRequired: boolean(),
  paidWagerRequired: boolean(),
  subscriptionRequired: boolean(),
  monetaryContributionRequired: boolean(),
  identityVerificationRequired: boolean(),
  minimumAge: integer(),
  playthroughRequirement: text(),
  minimumRedemption: numeric({ precision: 12, scale: 2 }),
  geographicEligibility: jsonb().$type<{
    countries: string[];
    states: string[];
    excludedStates: string[];
  }>(),
  startDate: timestamp({ withTimezone: true }),
  expirationDate: timestamp({ withTimezone: true }),
  recurringCadence: text(),
  sourceUrl: text().notNull(),
  discoveredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  lastVerifiedAt: timestamp({ withTimezone: true }),
  verificationStatus: verification().notNull().default("needs_verification"),
  fixture: boolean().notNull().default(false),
  researchVersion: integer().notNull().default(2),
  researchState: researchState().notNull().default("NEEDS_VERIFICATION"),
  amoeAvailable: boolean(),
  amoeMethod: text(),
  amoeValuePerRequest: numeric({ precision: 12, scale: 2 }),
  amoeRequestLimits: text(),
  amoeFrequencyLimits: text(),
  postageRequired: boolean(),
  amoeOtherUserCost: numeric({ precision: 12, scale: 2 }),
  entryFeeRequired: boolean(),
  facePromotionalValue: numeric({ precision: 12, scale: 2 }),
  estimatedRedeemableValue: numeric({ precision: 12, scale: 2 }),
  valueMethod: text(),
  valueEvidenceUrl: text(),
  recurrenceTimezone: text().notNull().default("America/Chicago"),
  recurrenceAnchor: timestamp({ withTimezone: true }),
  publicReviewRequired: boolean().notNull().default(false),
  high5PublicReviewRequired: boolean().notNull().default(false),
});
export const offerEvidence = pgTable("offer_evidence", {
  id: uuid().primaryKey().defaultRandom(),
  offerId: uuid()
    .notNull()
    .references(() => offers.id, { onDelete: "cascade" }),
  sourceUrl: text().notNull(),
  sourceType: evidenceType().notNull(),
  extractedText: text().notNull(),
  field: text().notNull(),
  capturedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  notes: text(),
  normalizedValue: text(),
  conflicting: boolean().notNull().default(false),
  supersededAt: timestamp({ withTimezone: true }),
});
export const claims = pgTable(
  "claims",
  {
    id: uuid().primaryKey().defaultRandom(),
    offerId: uuid()
      .notNull()
      .references(() => offers.id),
    status: text().notNull().default("available"),
    availableDate: timestamp({ withTimezone: true }),
    claimedDate: timestamp({ withTimezone: true }),
    promotionalValueReceived: numeric({ precision: 12, scale: 2 }),
    method: text().notNull().default("manual"),
    notes: text(),
    periodKey: text(),
    periodStart: timestamp({ withTimezone: true }),
    opportunityEndsAt: timestamp({ withTimezone: true }),
    claimState: claimState().notNull().default("UNCLAIMED"),
    estimatedRedeemableValue: numeric({ precision: 12, scale: 2 }),
    actualRedeemedValue: numeric({ precision: 12, scale: 2 }),
  },
  (t) => [
    uniqueIndex("claim_offer_period").on(t.offerId, t.periodKey),
    check(
      "claim_actual_nonnegative",
      sql`${t.actualRedeemedValue} is null or ${t.actualRedeemedValue} >= 0`,
    ),
  ],
);
export const redemptions = pgTable("redemptions", {
  id: uuid().primaryKey().defaultRandom(),
  platformId: uuid()
    .notNull()
    .references(() => platforms.id),
  amount: numeric({ precision: 12, scale: 2 }).notNull(),
  requestedDate: timestamp({ withTimezone: true }),
  completedDate: timestamp({ withTimezone: true }),
  status: text().notNull().default("requested"),
  claimId: uuid().references(() => claims.id),
});
export const platformAccounts = pgTable("platform_accounts", {
  id: uuid().primaryKey().defaultRandom(),
  platformId: uuid()
    .notNull()
    .unique()
    .references(() => platforms.id),
  accountExists: boolean().notNull().default(false),
  accountVerified: boolean().notNull().default(false),
  identifier: text(),
  notes: text(),
});

// Separate bookkeeping accounts; never platform credentials or sessions.
export const bankrollAccounts = pgTable(
  "bankroll_accounts",
  {
    id: uuid().primaryKey().defaultRandom(),
    platformId: uuid()
      .notNull()
      .references(() => platforms.id, { onDelete: "cascade" }),
    engine: text().$type<Engine>().notNull(),
    label: text().notNull(),
    demo: boolean().notNull().default(false),
    key: text().notNull().unique(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("bankroll_engine", sql`${t.engine} in ('CASINO','SPORTSBOOK')`),
  ],
);
export const manualObservations = pgTable("manual_observations", {
  id: uuid().primaryKey().defaultRandom(),
  platformId: uuid()
    .notNull()
    .references(() => platforms.id, { onDelete: "cascade" }),
  key: text().notNull().unique(),
  reportedAt: timestamp({ withTimezone: true }).notNull(),
  observedAt: timestamp({ withTimezone: true }),
  text: text().notNull(),
  currency: text(),
  observedBalance: numeric({ precision: 12, scale: 2 }),
  notes: text().notNull(),
});
export const actionPolicyEvidence = pgTable(
  "action_policy_evidence",
  {
    id: uuid().primaryKey().defaultRandom(),
    platformId: uuid()
      .notNull()
      .references(() => platforms.id, { onDelete: "cascade" }),
    key: text().notNull().unique(),
    stage: text().$type<PolicyEvidence["stage"]>().notNull(),
    decision: text().$type<Policy>().notNull(),
    sourceType: text().$type<PolicyEvidence["sourceType"]>().notNull(),
    sourceUrl: text(),
    excerpt: text().notNull(),
    verifiedAt: timestamp({ withTimezone: true }).notNull(),
    expiresAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    check(
      "action_policy_stage",
      sql`${t.stage} in ('DISCOVERY','AVAILABILITY','BALANCE','CLAIM','GAMEPLAY','REDEMPTION')`,
    ),
    check(
      "action_policy_decision",
      sql`${t.decision} in ('PERMITTED','PROHIBITED','UNKNOWN')`,
    ),
  ],
);
export const rewardSchedules = pgTable("reward_schedules", {
  id: uuid().primaryKey().defaultRandom(),
  accountId: uuid()
    .notNull()
    .references(() => bankrollAccounts.id, { onDelete: "cascade" }),
  offerId: uuid().references(() => offers.id, { onDelete: "set null" }),
  observationId: uuid().references(() => manualObservations.id, {
    onDelete: "set null",
  }),
  key: text().notNull().unique(),
  spec: jsonb().$type<ScheduleSpec>().notNull(),
  purpose: text().$type<"CLAIM_REWARD" | "CHECK_REWARD">().notNull(),
  sourceType: text().$type<PolicyEvidence["sourceType"]>().notNull(),
  verifiedAt: timestamp({ withTimezone: true }).notNull(),
  expiresAt: timestamp({ withTimezone: true }),
  enabled: boolean().notNull().default(true),
});
export const operationalActions = pgTable(
  "operational_actions",
  {
    id: uuid().primaryKey().defaultRandom(),
    accountId: uuid()
      .notNull()
      .references(() => bankrollAccounts.id, { onDelete: "cascade" }),
    actionType: text().$type<ActionType>().notNull(),
    status: text()
      .$type<"PENDING" | "COMPLETED" | "FAILED" | "EXPIRED">()
      .notNull()
      .default("PENDING"),
    availableAt: timestamp({ withTimezone: true }).notNull(),
    expiresAt: timestamp({ withTimezone: true }),
    automationPolicy: text().$type<Policy>().notNull(),
    executionMode: text().$type<ExecutionMode>().notNull(),
    reason: text().notNull(),
    offerId: uuid().references(() => offers.id, { onDelete: "set null" }),
    claimId: uuid().references(() => claims.id, { onDelete: "set null" }),
    scheduleId: uuid().references(() => rewardSchedules.id, {
      onDelete: "set null",
    }),
    opportunityKey: text().notNull(),
    key: text().notNull().unique(),
    result: text(),
    error: text(),
    attemptCount: integer().notNull().default(0),
    completedAt: timestamp({ withTimezone: true }),
    funding: jsonb().$type<import("@/domain/operations").Funding>().notNull(),
  },
  (t) => [
    check("action_attempt_count", sql`${t.attemptCount}>=0`),
    check(
      "action_zero_cash",
      sql`${t.funding}->>'userCashContribution' in ('0','0.00')`,
    ),
    check(
      "action_free_funding",
      sql`${t.funding} @> '{"depositRequired":false,"purchaseRequired":false,"paidWagerRequired":false,"subscriptionRequired":false,"entryFeeRequired":false,"bankrollOrigin":"FREE_PROMOTIONAL"}'::jsonb`,
    ),
  ],
);
export const ledgerEvents = pgTable(
  "bankroll_ledger",
  {
    id: uuid().primaryKey().defaultRandom(),
    sequence: bigserial({ mode: "number" }).notNull().unique(),
    accountId: uuid()
      .notNull()
      .references(() => bankrollAccounts.id, { onDelete: "cascade" }),
    eventType: text().$type<EventType>().notNull(),
    currency: text().notNull(),
    amount: numeric({ precision: 12, scale: 2 }).notNull(),
    category: text().$type<Category>().notNull(),
    occurredAt: timestamp({ withTimezone: true }).notNull(),
    recordedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    offerId: uuid().references(() => offers.id, { onDelete: "set null" }),
    claimId: uuid().references(() => claims.id, { onDelete: "set null" }),
    relatedEventId: uuid(),
    sessionId: text(),
    notes: text(),
    actualCashAmount: numeric({ precision: 12, scale: 2 }),
    cashCurrency: text(),
    origin: text().notNull().default("FREE_PROMOTIONAL"),
    direction: text().$type<"CREDIT" | "DEBIT">().notNull().default("DEBIT"),
    sourceKind: text()
      .$type<"SYSTEM" | "USER_OBSERVATION" | "SIMULATION">()
      .notNull()
      .default("SYSTEM"),
    observationId: uuid().references(() => high5Updates.id, {
      onDelete: "set null",
    }),
    userCashContribution: numeric({ precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    key: text().notNull().unique(),
  },
  (t) => [
    check("ledger_zero_cash", sql`${t.userCashContribution}=0`),
    check("ledger_free_origin", sql`${t.origin}='FREE_PROMOTIONAL'`),
    check(
      "ledger_nonnegative",
      sql`${t.amount}>=0 and (${t.actualCashAmount} is null or ${t.actualCashAmount}>=0)`,
    ),
    check(
      "ledger_category",
      sql`${t.category} in ('PROMOTIONAL','PLAYABLE','REDEEMABLE','REDEEMED')`,
    ),
  ],
);
export const casinoStrategies = pgTable("casino_strategies", {
  id: uuid().primaryKey().defaultRandom(),
  accountId: uuid()
    .notNull()
    .unique()
    .references(() => bankrollAccounts.id, { onDelete: "cascade" }),
  controls: jsonb().$type<RiskControls>().notNull(),
  terms: jsonb()
    .$type<Omit<GameTerms, "verifiedAt"> & { verifiedAt: string | null }>()
    .notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
export const demoRuns = pgTable("demo_runs", {
  id: uuid().primaryKey().defaultRandom(),
  casinoAccountId: uuid()
    .notNull()
    .references(() => bankrollAccounts.id, { onDelete: "cascade" }),
  sportsbookAccountId: uuid()
    .notNull()
    .references(() => bankrollAccounts.id, { onDelete: "cascade" }),
  step: integer().notNull().default(0),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
export const high5Updates = pgTable("high5_updates", {
  sequence: bigserial({ mode: "number" }).notNull().unique(),
  id: uuid().primaryKey().defaultRandom(),
  accountId: uuid()
    .notNull()
    .references(() => bankrollAccounts.id, { onDelete: "cascade" }),
  submissionKey: text().notNull().unique(),
  occurredAt: timestamp({ withTimezone: true }).notNull(),
  checkedReward: boolean().notNull(),
  minutes: numeric({ precision: 8, scale: 2 }).notNull(),
  payload: jsonb().$type<import("@/domain/high5").High5Update>().notNull(),
  operation: text()
    .$type<"ACCOUNT_UPDATE" | "MANUAL_PLAY" | "REDEMPTION">()
    .notNull()
    .default("ACCOUNT_UPDATE"),
  detail: jsonb().$type<Record<string, unknown>>().notNull().default({}),
  sourceKind: text().notNull().default("USER_OBSERVATION"),
});
export const high5RewardInstances = pgTable(
  "high5_reward_instances",
  {
    id: uuid().primaryKey().defaultRandom(),
    accountId: uuid()
      .notNull()
      .references(() => bankrollAccounts.id, { onDelete: "cascade" }),
    instanceKey: text().notNull(),
    occurredAt: timestamp({ withTimezone: true }).notNull(),
    scope: text().$type<"SIGNUP" | "RECURRING" | "OTHER">().notNull(),
    kind: text().notNull(),
    claimed: boolean().notNull().default(false),
    sc: numeric({ precision: 12, scale: 2 }),
    gc: numeric({ precision: 12, scale: 2 }),
    observationId: uuid()
      .notNull()
      .references(() => high5Updates.id),
  },
  (t) => [uniqueIndex("high5_reward_instance").on(t.accountId, t.instanceKey)],
);
export const high5Sources = pgTable(
  "high5_public_sources",
  {
    id: uuid().primaryKey().defaultRandom(),
    platformId: uuid()
      .notNull()
      .references(() => platforms.id, { onDelete: "cascade" }),
    sourceKey: text().notNull(),
    sourceUrl: text().notNull(),
    retrievedAt: timestamp({ withTimezone: true }).notNull(),
    outcome: text()
      .$type<"REVIEWED_MATCH" | "REVIEW_REQUIRED" | "ACCESS_FAILED">()
      .notNull(),
    fingerprint: text(),
    excerpts: jsonb().$type<Record<string, string>>().notNull().default({}),
    notes: text().notNull(),
  },
  (t) => [
    uniqueIndex("high5_source_capture").on(
      t.platformId,
      t.sourceKey,
      t.retrievedAt,
    ),
  ],
);
export const high5Redemptions = pgTable("high5_redemptions", {
  id: uuid().primaryKey().defaultRandom(),
  accountId: uuid()
    .notNull()
    .references(() => bankrollAccounts.id, { onDelete: "cascade" }),
  key: text().notNull().unique(),
  requestedSC: numeric({ precision: 12, scale: 2 }).notNull(),
  receivedUSD: numeric({ precision: 12, scale: 2 }),
  requestedAt: timestamp({ withTimezone: true }).notNull(),
  completedAt: timestamp({ withTimezone: true }),
  method: text().$type<"PRIZEOUT" | "TRUSTLY" | "UNKNOWN">().notNull(),
  status: text()
    .$type<"REQUESTED" | "COMPLETED" | "CANCELLED" | "FAILED">()
    .notNull(),
  requestEventId: uuid().notNull(),
  completionEventId: uuid(),
  observationId: uuid()
    .notNull()
    .references(() => high5Updates.id),
});

// Consumer snapshots and runtime state reuse the existing ledger and policies.
export const accountSnapshots = pgTable("account_snapshots", {
  sequence: bigserial({ mode: "number" }).notNull().unique(),
  id: uuid().primaryKey().defaultRandom(),
  accountId: uuid()
    .notNull()
    .references(() => bankrollAccounts.id, { onDelete: "cascade" }),
  submissionKey: text().notNull().unique(),
  occurredAt: timestamp({ withTimezone: true }).notNull(),
  payload: jsonb().$type<import("@/domain/product").QuickUpdate>().notNull(),
  instanceKey: text().notNull(),
  operation: text()
    .$type<"UPDATE" | "PLAY" | "REDEMPTION">()
    .notNull()
    .default("UPDATE"),
  sourceKind: text().notNull().default("USER_OBSERVATION"),
  detail: jsonb().$type<Record<string, unknown>>().notNull().default({}),
});
export const accountRedemptions = pgTable("account_redemptions", {
  id: uuid().primaryKey().defaultRandom(),
  accountId: uuid()
    .notNull()
    .references(() => bankrollAccounts.id, { onDelete: "cascade" }),
  key: text().notNull().unique(),
  requestedSC: numeric({ precision: 12, scale: 2 }).notNull(),
  receivedUSD: numeric({ precision: 12, scale: 2 }),
  requestedAt: timestamp({ withTimezone: true }).notNull(),
  completedAt: timestamp({ withTimezone: true }),
  method: text().notNull(),
  status: text()
    .$type<"REQUESTED" | "COMPLETED" | "CANCELLED" | "FAILED">()
    .notNull(),
  requestEventId: uuid().notNull(),
  completionEventId: uuid(),
});
export const productRuns = pgTable("product_runs", {
  id: uuid().primaryKey().defaultRandom(),
  startedAt: timestamp({ withTimezone: true }).notNull(),
  finishedAt: timestamp({ withTimezone: true }),
  trigger: text().$type<"MANUAL" | "BACKGROUND">().notNull(),
  outcome: text().$type<"RUNNING" | "COMPLETE" | "FAILED">().notNull(),
  result: jsonb()
    .$type<{
      collected: { platform: string; amount: string; currency: string }[];
      needsYou: string[];
      nothing: string[];
      publicReads: number;
      failures: string[];
    }>()
    .notNull(),
  diagnostic: text(),
});
export const localRuntime = pgTable("local_runtime", {
  key: text().primaryKey(),
  owner: text(),
  enabled: boolean().notNull().default(false),
  heartbeatAt: timestamp({ withTimezone: true }),
  lastRunAt: timestamp({ withTimezone: true }),
  nextRunAt: timestamp({ withTimezone: true }),
});
export const attentionItems = pgTable("attention_items", {
  key: text().primaryKey(),
  platformId: uuid()
    .notNull()
    .references(() => platforms.id, { onDelete: "cascade" }),
  kind: text().notNull(),
  title: text().notNull(),
  priority: integer().notNull(),
  active: boolean().notNull().default(true),
  updatedAt: timestamp({ withTimezone: true }).notNull(),
});
export const publicDocuments = pgTable(
  "public_documents",
  {
    id: uuid().primaryKey().defaultRandom(),
    platformId: uuid()
      .notNull()
      .references(() => platforms.id, { onDelete: "cascade" }),
    sourceUrl: text().notNull(),
    retrievedAt: timestamp({ withTimezone: true }).notNull(),
    fingerprint: text(),
    outcome: text()
      .$type<"READABLE" | "ACCESS_FAILED" | "REVIEW_REQUIRED">()
      .notNull(),
    excerpt: text().notNull(),
    notes: text().notNull(),
  },
  (t) => [
    uniqueIndex("public_document_capture").on(
      t.platformId,
      t.sourceUrl,
      t.retrievedAt,
    ),
  ],
);
export const userSettings = pgTable("user_settings", {
  key: text().primaryKey(),
  profile: jsonb()
    .$type<{ age: number | null; country: string; state: string }>()
    .notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
