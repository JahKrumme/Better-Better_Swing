CREATE TABLE "action_policy_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platformId" uuid NOT NULL,
	"key" text NOT NULL,
	"stage" text NOT NULL,
	"decision" text NOT NULL,
	"sourceType" text NOT NULL,
	"sourceUrl" text,
	"excerpt" text NOT NULL,
	"verifiedAt" timestamp with time zone NOT NULL,
	"expiresAt" timestamp with time zone,
	CONSTRAINT "action_policy_evidence_key_unique" UNIQUE("key"),
	CONSTRAINT "action_policy_stage" CHECK ("action_policy_evidence"."stage" in ('DISCOVERY','CLAIM','GAMEPLAY','REDEMPTION')),
	CONSTRAINT "action_policy_decision" CHECK ("action_policy_evidence"."decision" in ('PERMITTED','PROHIBITED','UNKNOWN'))
);
--> statement-breakpoint
CREATE TABLE "bankroll_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platformId" uuid NOT NULL,
	"engine" text NOT NULL,
	"label" text NOT NULL,
	"demo" boolean DEFAULT false NOT NULL,
	"key" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bankroll_accounts_key_unique" UNIQUE("key"),
	CONSTRAINT "bankroll_engine" CHECK ("bankroll_accounts"."engine" in ('CASINO','SPORTSBOOK'))
);
--> statement-breakpoint
CREATE TABLE "casino_strategies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accountId" uuid NOT NULL,
	"controls" jsonb NOT NULL,
	"terms" jsonb NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "casino_strategies_accountId_unique" UNIQUE("accountId")
);
--> statement-breakpoint
CREATE TABLE "demo_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"casinoAccountId" uuid NOT NULL,
	"sportsbookAccountId" uuid NOT NULL,
	"step" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bankroll_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accountId" uuid NOT NULL,
	"eventType" text NOT NULL,
	"currency" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"category" text NOT NULL,
	"occurredAt" timestamp with time zone NOT NULL,
	"recordedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"offerId" uuid,
	"claimId" uuid,
	"relatedEventId" uuid,
	"sessionId" text,
	"notes" text,
	"actualCashAmount" numeric(12, 2),
	"cashCurrency" text,
	"origin" text DEFAULT 'FREE_PROMOTIONAL' NOT NULL,
	"userCashContribution" numeric(12, 2) DEFAULT '0' NOT NULL,
	"key" text NOT NULL,
	CONSTRAINT "bankroll_ledger_key_unique" UNIQUE("key"),
	CONSTRAINT "ledger_zero_cash" CHECK ("bankroll_ledger"."userCashContribution"=0),
	CONSTRAINT "ledger_free_origin" CHECK ("bankroll_ledger"."origin"='FREE_PROMOTIONAL'),
	CONSTRAINT "ledger_nonnegative" CHECK ("bankroll_ledger"."amount">=0 and ("bankroll_ledger"."actualCashAmount" is null or "bankroll_ledger"."actualCashAmount">=0)),
	CONSTRAINT "ledger_category" CHECK ("bankroll_ledger"."category" in ('PROMOTIONAL','PLAYABLE','REDEEMABLE','REDEEMED'))
);
--> statement-breakpoint
CREATE TABLE "manual_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platformId" uuid NOT NULL,
	"key" text NOT NULL,
	"reportedAt" timestamp with time zone NOT NULL,
	"observedAt" timestamp with time zone,
	"text" text NOT NULL,
	"currency" text,
	"observedBalance" numeric(12, 2),
	"notes" text NOT NULL,
	CONSTRAINT "manual_observations_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "operational_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accountId" uuid NOT NULL,
	"actionType" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"availableAt" timestamp with time zone NOT NULL,
	"expiresAt" timestamp with time zone,
	"automationPolicy" text NOT NULL,
	"executionMode" text NOT NULL,
	"reason" text NOT NULL,
	"offerId" uuid,
	"claimId" uuid,
	"scheduleId" uuid,
	"opportunityKey" text NOT NULL,
	"key" text NOT NULL,
	"result" text,
	"error" text,
	"attemptCount" integer DEFAULT 0 NOT NULL,
	"completedAt" timestamp with time zone,
	"funding" jsonb NOT NULL,
	CONSTRAINT "operational_actions_key_unique" UNIQUE("key"),
	CONSTRAINT "action_attempt_count" CHECK ("operational_actions"."attemptCount">=0),
	CONSTRAINT "action_zero_cash" CHECK ("operational_actions"."funding"->>'userCashContribution' in ('0','0.00'))
);
--> statement-breakpoint
CREATE TABLE "reward_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accountId" uuid NOT NULL,
	"offerId" uuid,
	"observationId" uuid,
	"key" text NOT NULL,
	"spec" jsonb NOT NULL,
	"purpose" text NOT NULL,
	"sourceType" text NOT NULL,
	"verifiedAt" timestamp with time zone NOT NULL,
	"expiresAt" timestamp with time zone,
	"enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "reward_schedules_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "action_policy_evidence" ADD CONSTRAINT "action_policy_evidence_platformId_platforms_id_fk" FOREIGN KEY ("platformId") REFERENCES "public"."platforms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bankroll_accounts" ADD CONSTRAINT "bankroll_accounts_platformId_platforms_id_fk" FOREIGN KEY ("platformId") REFERENCES "public"."platforms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "casino_strategies" ADD CONSTRAINT "casino_strategies_accountId_bankroll_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."bankroll_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_runs" ADD CONSTRAINT "demo_runs_casinoAccountId_bankroll_accounts_id_fk" FOREIGN KEY ("casinoAccountId") REFERENCES "public"."bankroll_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_runs" ADD CONSTRAINT "demo_runs_sportsbookAccountId_bankroll_accounts_id_fk" FOREIGN KEY ("sportsbookAccountId") REFERENCES "public"."bankroll_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bankroll_ledger" ADD CONSTRAINT "bankroll_ledger_accountId_bankroll_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."bankroll_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bankroll_ledger" ADD CONSTRAINT "bankroll_ledger_offerId_offers_id_fk" FOREIGN KEY ("offerId") REFERENCES "public"."offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bankroll_ledger" ADD CONSTRAINT "bankroll_ledger_claimId_claims_id_fk" FOREIGN KEY ("claimId") REFERENCES "public"."claims"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_observations" ADD CONSTRAINT "manual_observations_platformId_platforms_id_fk" FOREIGN KEY ("platformId") REFERENCES "public"."platforms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_actions" ADD CONSTRAINT "operational_actions_accountId_bankroll_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."bankroll_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_actions" ADD CONSTRAINT "operational_actions_offerId_offers_id_fk" FOREIGN KEY ("offerId") REFERENCES "public"."offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_actions" ADD CONSTRAINT "operational_actions_claimId_claims_id_fk" FOREIGN KEY ("claimId") REFERENCES "public"."claims"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_actions" ADD CONSTRAINT "operational_actions_scheduleId_reward_schedules_id_fk" FOREIGN KEY ("scheduleId") REFERENCES "public"."reward_schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_schedules" ADD CONSTRAINT "reward_schedules_accountId_bankroll_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."bankroll_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_schedules" ADD CONSTRAINT "reward_schedules_offerId_offers_id_fk" FOREIGN KEY ("offerId") REFERENCES "public"."offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_schedules" ADD CONSTRAINT "reward_schedules_observationId_manual_observations_id_fk" FOREIGN KEY ("observationId") REFERENCES "public"."manual_observations"("id") ON DELETE set null ON UPDATE no action;