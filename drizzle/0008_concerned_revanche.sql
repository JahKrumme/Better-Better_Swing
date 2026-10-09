CREATE TABLE "account_redemptions" (
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
	CONSTRAINT "account_redemptions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "account_snapshots" (
	"sequence" bigserial NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accountId" uuid NOT NULL,
	"submissionKey" text NOT NULL,
	"occurredAt" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	"instanceKey" text NOT NULL,
	"operation" text DEFAULT 'UPDATE' NOT NULL,
	"sourceKind" text DEFAULT 'USER_OBSERVATION' NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "account_snapshots_sequence_unique" UNIQUE("sequence"),
	CONSTRAINT "account_snapshots_submissionKey_unique" UNIQUE("submissionKey")
);
--> statement-breakpoint
CREATE TABLE "attention_items" (
	"key" text PRIMARY KEY NOT NULL,
	"platformId" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"priority" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "local_runtime" (
	"key" text PRIMARY KEY NOT NULL,
	"owner" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"heartbeatAt" timestamp with time zone,
	"lastRunAt" timestamp with time zone,
	"nextRunAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"startedAt" timestamp with time zone NOT NULL,
	"finishedAt" timestamp with time zone,
	"trigger" text NOT NULL,
	"outcome" text NOT NULL,
	"result" jsonb NOT NULL,
	"diagnostic" text
);
--> statement-breakpoint
CREATE TABLE "public_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platformId" uuid NOT NULL,
	"sourceUrl" text NOT NULL,
	"retrievedAt" timestamp with time zone NOT NULL,
	"fingerprint" text,
	"outcome" text NOT NULL,
	"excerpt" text NOT NULL,
	"notes" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "publicReviewRequired" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "account_redemptions" ADD CONSTRAINT "account_redemptions_accountId_bankroll_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."bankroll_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_snapshots" ADD CONSTRAINT "account_snapshots_accountId_bankroll_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."bankroll_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attention_items" ADD CONSTRAINT "attention_items_platformId_platforms_id_fk" FOREIGN KEY ("platformId") REFERENCES "public"."platforms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_documents" ADD CONSTRAINT "public_documents_platformId_platforms_id_fk" FOREIGN KEY ("platformId") REFERENCES "public"."platforms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "public_document_capture" ON "public_documents" USING btree ("platformId","sourceUrl","retrievedAt");