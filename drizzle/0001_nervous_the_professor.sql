CREATE TYPE "public"."claim_state" AS ENUM('UNCLAIMED', 'READY_TO_CLAIM', 'CLAIMED', 'PLAYTHROUGH_REQUIRED', 'REDEEMABLE', 'REDEEMED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."research_state" AS ENUM('VERIFIED_FREE', 'NEEDS_VERIFICATION', 'EXCLUDED_REQUIRES_MONEY', 'EXCLUDED_GEOGRAPHY', 'EXCLUDED_PLATFORM', 'EXPIRED');--> statement-breakpoint
ALTER TYPE "public"."offer_type" ADD VALUE 'amoe';--> statement-breakpoint
ALTER TYPE "public"."offer_type" ADD VALUE 'giveaway';--> statement-breakpoint
CREATE TABLE "platform_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platformId" uuid NOT NULL,
	"sourceUrl" text NOT NULL,
	"sourceType" "source_type" NOT NULL,
	"field" text NOT NULL,
	"extractedText" text,
	"normalizedValue" text,
	"retrievedAt" timestamp with time zone NOT NULL,
	"outcome" text NOT NULL,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "periodKey" text;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "periodStart" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "opportunityEndsAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "claimState" "claim_state" DEFAULT 'UNCLAIMED' NOT NULL;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "estimatedRedeemableValue" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "actualRedeemedValue" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "offer_evidence" ADD COLUMN "normalizedValue" text;--> statement-breakpoint
ALTER TABLE "offer_evidence" ADD COLUMN "conflicting" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "offer_evidence" ADD COLUMN "supersededAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "researchVersion" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "researchState" "research_state" DEFAULT 'NEEDS_VERIFICATION' NOT NULL;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "amoeAvailable" boolean;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "amoeMethod" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "amoeValuePerRequest" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "amoeRequestLimits" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "amoeFrequencyLimits" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "postageRequired" boolean;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "amoeOtherUserCost" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "entryFeeRequired" boolean;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "facePromotionalValue" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "estimatedRedeemableValue" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "valueMethod" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "valueEvidenceUrl" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "recurrenceTimezone" text DEFAULT 'America/Chicago' NOT NULL;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "recurrenceAnchor" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "rulesUrl" text;--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "kansasAvailability" boolean;--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "minimumAge" integer;--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "freeSignupReward" text;--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "recurringFreeReward" text;--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "amoeAvailable" boolean;--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "minimumRedemption" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "playthroughRequirement" text;--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "identityVerificationRequired" boolean;--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "researchNotes" text;--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "lastVerifiedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "researchState" "research_state" DEFAULT 'NEEDS_VERIFICATION' NOT NULL;--> statement-breakpoint
ALTER TABLE "redemptions" ADD COLUMN "claimId" uuid;--> statement-breakpoint
ALTER TABLE "platform_sources" ADD CONSTRAINT "platform_sources_platformId_platforms_id_fk" FOREIGN KEY ("platformId") REFERENCES "public"."platforms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "platform_source_attempt" ON "platform_sources" USING btree ("platformId","sourceUrl","retrievedAt");--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_claimId_claims_id_fk" FOREIGN KEY ("claimId") REFERENCES "public"."claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "claim_offer_period" ON "claims" USING btree ("offerId","periodKey");--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claim_actual_nonnegative" CHECK ("claims"."actualRedeemedValue" is null or "claims"."actualRedeemedValue" >= 0);--> statement-breakpoint
UPDATE offers SET "researchVersion" = 1 WHERE fixture = true;
--> statement-breakpoint
UPDATE offers SET "facePromotionalValue" = "promotionalAmount";
--> statement-breakpoint
UPDATE claims SET "periodKey" = 'legacy:' || id::text,
 "claimState" = CASE WHEN status = 'claimed' THEN 'CLAIMED'::claim_state ELSE 'UNCLAIMED'::claim_state END
 WHERE "periodKey" IS NULL;
