CREATE TABLE "high5_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accountId" uuid NOT NULL,
	"key" text NOT NULL,
	"requestedSC" numeric(12, 2) NOT NULL,
	"receivedUSD" numeric(12, 2),
	"requestedAt" timestamp with time zone NOT NULL,
	"completedAt" timestamp with time zone,
	"method" text NOT NULL,
	"status" text NOT NULL,
	"requestEventId" uuid NOT NULL,
	"completionEventId" uuid,
	"observationId" uuid NOT NULL,
	CONSTRAINT "high5_redemptions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "high5_reward_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accountId" uuid NOT NULL,
	"instanceKey" text NOT NULL,
	"occurredAt" timestamp with time zone NOT NULL,
	"scope" text NOT NULL,
	"kind" text NOT NULL,
	"claimed" boolean DEFAULT false NOT NULL,
	"sc" numeric(12, 2),
	"gc" numeric(12, 2),
	"observationId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "high5_public_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platformId" uuid NOT NULL,
	"sourceKey" text NOT NULL,
	"sourceUrl" text NOT NULL,
	"retrievedAt" timestamp with time zone NOT NULL,
	"outcome" text NOT NULL,
	"fingerprint" text,
	"excerpts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "high5_updates" (
	"sequence" bigserial NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accountId" uuid NOT NULL,
	"submissionKey" text NOT NULL,
	"occurredAt" timestamp with time zone NOT NULL,
	"checkedReward" boolean NOT NULL,
	"minutes" numeric(8, 2) NOT NULL,
	"payload" jsonb NOT NULL,
	"operation" text DEFAULT 'ACCOUNT_UPDATE' NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sourceKind" text DEFAULT 'USER_OBSERVATION' NOT NULL,
	CONSTRAINT "high5_updates_sequence_unique" UNIQUE("sequence"),
	CONSTRAINT "high5_updates_submissionKey_unique" UNIQUE("submissionKey")
);
--> statement-breakpoint
ALTER TABLE "bankroll_ledger" ADD COLUMN "direction" text DEFAULT 'DEBIT' NOT NULL;--> statement-breakpoint
ALTER TABLE "bankroll_ledger" ADD COLUMN "sourceKind" text DEFAULT 'SYSTEM' NOT NULL;--> statement-breakpoint
ALTER TABLE "bankroll_ledger" ADD COLUMN "observationId" uuid;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "high5PublicReviewRequired" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "high5_redemptions" ADD CONSTRAINT "high5_redemptions_accountId_bankroll_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."bankroll_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "high5_redemptions" ADD CONSTRAINT "high5_redemptions_observationId_high5_updates_id_fk" FOREIGN KEY ("observationId") REFERENCES "public"."high5_updates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "high5_reward_instances" ADD CONSTRAINT "high5_reward_instances_accountId_bankroll_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."bankroll_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "high5_reward_instances" ADD CONSTRAINT "high5_reward_instances_observationId_high5_updates_id_fk" FOREIGN KEY ("observationId") REFERENCES "public"."high5_updates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "high5_public_sources" ADD CONSTRAINT "high5_public_sources_platformId_platforms_id_fk" FOREIGN KEY ("platformId") REFERENCES "public"."platforms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "high5_updates" ADD CONSTRAINT "high5_updates_accountId_bankroll_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."bankroll_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "high5_reward_instance" ON "high5_reward_instances" USING btree ("accountId","instanceKey");--> statement-breakpoint
ALTER TABLE "bankroll_ledger" ADD CONSTRAINT "bankroll_ledger_observationId_high5_updates_id_fk" FOREIGN KEY ("observationId") REFERENCES "public"."high5_updates"("id") ON DELETE set null ON UPDATE no action;