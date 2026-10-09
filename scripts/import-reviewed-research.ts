import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import {
  platforms,
  platformSources,
  offers,
  offerEvidence,
} from "../src/db/schema";
import { officialSource } from "../src/domain/registry";
const url = z.url().refine((v) => v.startsWith("https://"));
const date = z.iso.datetime({ offset: true });
const amount = z.string().regex(/^\d+(\.\d{1,2})?$/);
const platformPatch = z
  .object({
    researchNotes: z.string(),
    termsUrl: url,
    rulesUrl: url,
    promotionsUrl: url,
    usAvailability: z.boolean(),
    kansasAvailability: z.boolean(),
    minimumAge: z.number().int().min(18),
    amoeAvailable: z.boolean(),
    identityVerificationRequired: z.boolean(),
    minimumRedemption: amount,
    playthroughRequirement: z.string(),
    freeSignupReward: z.string(),
    recurringFreeReward: z.string(),
    automationPolicy: z.enum(["unknown", "prohibited", "permitted"]),
    automationPolicyEvidence: z.string().max(1000),
    automationPolicySource: url,
    automationPolicyLastVerifiedAt: date,
    lastVerifiedAt: date,
    lastCheckedAt: date,
  })
  .partial()
  .strict();
const offerPatch = z
  .object({
    title: z.string().min(1),
    description: z.string(),
    sourceUrl: url,
    offerType: z.enum([
      "signup",
      "daily",
      "weekly",
      "limited_time",
      "amoe",
      "giveaway",
    ]),
    promotionalCurrency: z.string().min(1),
    facePromotionalValue: amount.optional(),
    signupRequired: z.boolean().optional(),
    depositRequired: z.boolean().optional(),
    purchaseRequired: z.boolean().optional(),
    paidWagerRequired: z.boolean().optional(),
    subscriptionRequired: z.boolean().optional(),
    monetaryContributionRequired: z.boolean().optional(),
    entryFeeRequired: z.boolean().optional(),
    identityVerificationRequired: z.boolean().optional(),
    minimumAge: z.number().int().min(18).optional(),
    minimumRedemption: amount.optional(),
    playthroughRequirement: z.string().nullable().optional(),
    recurringCadence: z.enum(["daily", "weekly"]).optional(),
    geographicEligibility: z
      .object({
        countries: z.array(z.string()),
        states: z.array(z.string()),
        excludedStates: z.array(z.string()),
      })
      .strict()
      .optional(),
    expirationDate: date.optional(),
    amoeAvailable: z.boolean().optional(),
    amoeMethod: z.string().optional(),
    postageRequired: z.boolean().optional(),
  })
  .strict();
const source = z
  .object({
    field: z.string(),
    sourceUrl: url,
    extractedText: z.string().max(1000).nullable(),
    normalizedValue: z.string().nullable(),
    retrievedAt: date,
    outcome: z.enum(["blocked", "unavailable", "retrieved"]).optional(),
    notes: z.string().max(1000).optional(),
    conflicting: z.boolean().optional(),
  })
  .strict();
const findingsSchema = z
  .object({
    reviewedAt: date,
    platforms: z
      .array(
        z
          .object({
            slug: z.string(),
            patch: platformPatch,
            sources: z.array(source),
            offers: z.array(
              z
                .object({
                  key: z.string(),
                  patch: offerPatch,
                  evidence: z.array(source),
                })
                .strict(),
            ),
          })
          .strict(),
      )
      .length(20),
  })
  .strict();
function stableId(identity: string) {
  const hex = createHash("sha256")
    .update("phase2-primary-research:" + identity)
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
/** Import manually reviewed, static primary evidence. No network calls or claims. */
export async function importReviewedResearch() {
  const path = "research/reviewed-findings.json";
  if (!existsSync(path)) return;
  const findings = findingsSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  const reviewedAt = new Date(findings.reviewedAt);
  await db.transaction(async (tx) => {
    for (const row of findings.platforms) {
      const [saved] = await tx
        .select()
        .from(platforms)
        .where(eq(platforms.slug, row.slug));
      if (!saved || saved.fixture || saved.excluded)
        throw new Error(`Research candidate mismatch: ${row.slug}`);
      const {
        lastVerifiedAt,
        lastCheckedAt,
        automationPolicyLastVerifiedAt,
        ...patch
      } = row.patch;
      // Never overwrite later manual research when this historical snapshot is replayed.
      if (!saved.lastVerifiedAt || saved.lastVerifiedAt <= reviewedAt) {
        await tx
          .update(platforms)
          .set({
            ...patch,
            ...(lastVerifiedAt
              ? { lastVerifiedAt: new Date(lastVerifiedAt) }
              : {}),
            ...(lastCheckedAt
              ? { lastCheckedAt: new Date(lastCheckedAt) }
              : {}),
            ...(automationPolicyLastVerifiedAt
              ? {
                  automationPolicyLastVerifiedAt: new Date(
                    automationPolicyLastVerifiedAt,
                  ),
                }
              : {}),
          })
          .where(eq(platforms.id, saved.id));
      }
      const registered = { ...saved, ...patch };
      for (const s of row.sources) {
        if (
          s.outcome === undefined &&
          (!s.extractedText || !officialSource(registered, s.sourceUrl))
        )
          throw new Error(`Invalid primary fact: ${row.slug}/${s.field}`);
        await tx
          .insert(platformSources)
          .values({
            id: stableId(row.slug + JSON.stringify(s)),
            platformId: saved.id,
            sourceUrl: s.sourceUrl,
            sourceType: "official",
            field: s.field,
            extractedText: s.extractedText,
            normalizedValue: s.normalizedValue,
            retrievedAt: new Date(s.retrievedAt),
            outcome: s.outcome ?? "reviewed",
            notes: s.notes,
          })
          .onConflictDoNothing();
      }
      for (const o of row.offers) {
        if (!officialSource(registered, o.patch.sourceUrl))
          throw new Error(`Invalid offer origin: ${row.slug}`);
        const id = stableId(row.slug + ":offer:" + o.key);
        const { expirationDate, ...terms } = o.patch;
        await tx
          .insert(offers)
          .values({
            ...terms,
            id,
            platformId: saved.id,
            expirationDate: expirationDate ? new Date(expirationDate) : null,
            fixture: false,
            researchVersion: 2,
            lastVerifiedAt: reviewedAt,
            // Missing facts stay null. The existing evaluator determines live qualification.
          })
          .onConflictDoNothing();
        const [existing] = await tx
          .select()
          .from(offers)
          .where(eq(offers.id, id));
        if (existing.fixture || existing.platformId !== saved.id)
          throw new Error("Offer identity collision");
        for (const s of o.evidence) {
          if (!s.extractedText || !officialSource(registered, s.sourceUrl))
            throw new Error(`Invalid offer evidence: ${row.slug}/${s.field}`);
          await tx
            .insert(offerEvidence)
            .values({
              id: stableId(id + JSON.stringify(s)),
              offerId: id,
              field: s.field,
              sourceUrl: s.sourceUrl,
              sourceType: "official",
              extractedText: s.extractedText,
              normalizedValue: s.normalizedValue,
              capturedAt: new Date(s.retrievedAt),
              conflicting: s.conflicting ?? false,
              notes: s.notes,
            })
            .onConflictDoNothing();
        }
      }
    }
  });
  console.log(
    `Imported reviewed primary facts for 20 candidates and ${findings.platforms.reduce((n, p) => n + p.offers.length, 0)} real offer records; no external actions.`,
  );
}
