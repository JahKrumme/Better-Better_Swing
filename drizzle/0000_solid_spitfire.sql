CREATE TYPE "public"."platform_category" AS ENUM('sportsbook', 'sweepstakes_casino', 'prediction', 'other');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('official', 'secondary', 'fixture');--> statement-breakpoint
CREATE TYPE "public"."offer_type" AS ENUM('signup', 'daily', 'weekly', 'limited_time');--> statement-breakpoint
CREATE TYPE "public"."automation_policy" AS ENUM('unknown', 'prohibited', 'permitted');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('needs_verification', 'verified', 'rejected');--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offerId" uuid NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"availableDate" timestamp with time zone,
	"claimedDate" timestamp with time zone,
	"promotionalValueReceived" numeric(12, 2),
	"method" text DEFAULT 'manual' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "offer_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offerId" uuid NOT NULL,
	"sourceUrl" text NOT NULL,
	"sourceType" "source_type" NOT NULL,
	"extractedText" text NOT NULL,
	"field" text NOT NULL,
	"capturedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platformId" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"offerType" "offer_type" NOT NULL,
	"promotionalAmount" numeric(12, 2),
	"promotionalCurrency" text NOT NULL,
	"estimatedCashValue" numeric(12, 2),
	"signupRequired" boolean,
	"depositRequired" boolean,
	"purchaseRequired" boolean,
	"paidWagerRequired" boolean,
	"subscriptionRequired" boolean,
	"monetaryContributionRequired" boolean,
	"identityVerificationRequired" boolean,
	"minimumAge" integer,
	"playthroughRequirement" text,
	"minimumRedemption" numeric(12, 2),
	"geographicEligibility" jsonb,
	"startDate" timestamp with time zone,
	"expirationDate" timestamp with time zone,
	"recurringCadence" text,
	"sourceUrl" text NOT NULL,
	"discoveredAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastVerifiedAt" timestamp with time zone,
	"verificationStatus" "verification_status" DEFAULT 'needs_verification' NOT NULL,
	"fixture" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platformId" uuid NOT NULL,
	"accountExists" boolean DEFAULT false NOT NULL,
	"accountVerified" boolean DEFAULT false NOT NULL,
	"identifier" text,
	"notes" text,
	CONSTRAINT "platform_accounts_platformId_unique" UNIQUE("platformId")
);
--> statement-breakpoint
CREATE TABLE "platforms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"homepageUrl" text NOT NULL,
	"category" "platform_category" NOT NULL,
	"status" text DEFAULT 'monitored' NOT NULL,
	"usAvailability" boolean,
	"geographicRestrictions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"termsUrl" text,
	"promotionsUrl" text,
	"automationPolicy" "automation_policy" DEFAULT 'unknown' NOT NULL,
	"automationPolicyEvidence" text,
	"automationPolicySource" text,
	"automationPolicyLastVerifiedAt" timestamp with time zone,
	"excluded" boolean DEFAULT false NOT NULL,
	"exclusionReason" text,
	"fixture" boolean DEFAULT false NOT NULL,
	"lastCheckedAt" timestamp with time zone,
	CONSTRAINT "platforms_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platformId" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"requestedDate" timestamp with time zone,
	"completedDate" timestamp with time zone,
	"status" text DEFAULT 'requested' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_offerId_offers_id_fk" FOREIGN KEY ("offerId") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_evidence" ADD CONSTRAINT "offer_evidence_offerId_offers_id_fk" FOREIGN KEY ("offerId") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_platformId_platforms_id_fk" FOREIGN KEY ("platformId") REFERENCES "public"."platforms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_accounts" ADD CONSTRAINT "platform_accounts_platformId_platforms_id_fk" FOREIGN KEY ("platformId") REFERENCES "public"."platforms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_platformId_platforms_id_fk" FOREIGN KEY ("platformId") REFERENCES "public"."platforms"("id") ON DELETE no action ON UPDATE no action;