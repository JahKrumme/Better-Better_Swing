"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { platforms, offers, offerEvidence } from "@/db/schema";
import { platformInput, offerInput } from "@/domain/research";
import { evidenceFields } from "@/domain/eligibility";
import { eq } from "drizzle-orm";
import { phase2EvidenceFields } from "@/domain/verification";
import { officialSource } from "@/domain/registry";
export type FormState = { ok: boolean; message: string };
export async function createPlatform(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = platformInput.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    };
  try {
    await db.insert(platforms).values(parsed.data);
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: "Platform saved. Automation policy remains unknown.",
    };
  } catch {
    return {
      ok: false,
      message:
        "Could not save platform. Check for a duplicate slug and database availability.",
    };
  }
}
export async function createOffer(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = offerInput.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    };
  const v = parsed.data;
  try {
    await db.transaction(async (tx) => {
      const [p] = await tx
        .select()
        .from(platforms)
        .where(eq(platforms.id, v.platformId));
      if (!p || p.fixture || p.excluded || p.slug === "fliff")
        throw new Error("Unsupported platform");
      if (v.sourceType === "official" && !officialSource(p, v.sourceUrl))
        throw new Error("Official source domain mismatch");
      const fields = [
        ...evidenceFields,
        ...phase2EvidenceFields,
        "amoeMethod",
        "postageRequired",
        "amoeOtherUserCost",
        "estimatedRedeemableValue",
      ] as const;
      if (!fields.some((field) => v[`evidence_${field}`]))
        throw new Error("Real records require at least one evidence passage.");
      const [o] = await tx
        .insert(offers)
        .values({
          platformId: v.platformId,
          title: v.title,
          description: v.description,
          offerType: v.offerType,
          promotionalAmount: v.promotionalAmount,
          promotionalCurrency: v.promotionalCurrency,
          estimatedCashValue: null,
          facePromotionalValue: v.promotionalAmount,
          entryFeeRequired: v.entryFeeRequired,
          amoeAvailable: v.amoeAvailable,
          amoeMethod: v.amoeMethod,
          amoeValuePerRequest: v.amoeValuePerRequest,
          amoeRequestLimits: v.amoeRequestLimits,
          amoeFrequencyLimits: v.amoeFrequencyLimits,
          postageRequired: v.postageRequired,
          amoeOtherUserCost: v.amoeOtherUserCost,
          estimatedRedeemableValue: v.estimatedRedeemableValue,
          valueMethod: v.valueMethod,
          valueEvidenceUrl: v.valueEvidenceUrl,
          recurrenceTimezone: v.recurrenceTimezone,
          researchVersion: 2,
          minimumRedemption: v.minimumRedemption,
          playthroughRequirement: v.playthroughRequirement,
          sourceUrl: v.sourceUrl,
          minimumAge: v.minimumAge,
          signupRequired: v.signupRequired,
          identityVerificationRequired: v.identityVerificationRequired,
          depositRequired: v.depositRequired,
          purchaseRequired: v.purchaseRequired,
          paidWagerRequired: v.paidWagerRequired,
          subscriptionRequired: v.subscriptionRequired,
          monetaryContributionRequired: v.monetaryContributionRequired,
          geographicEligibility: v.countries
            ? {
                countries: v.countries.split(","),
                states: v.states ? v.states.split(",") : [],
                excludedStates: v.excludedStates
                  ? v.excludedStates.split(",")
                  : [],
              }
            : null,
          startDate: v.startDate,
          expirationDate: v.expirationDate,
          recurringCadence: ["daily", "weekly"].includes(v.offerType)
            ? v.offerType
            : null,
          lastVerifiedAt: new Date(),
          verificationStatus: "needs_verification",
        })
        .returning({ id: offers.id });
      const es = fields.flatMap((field) =>
        v[`evidence_${field}`]
          ? [
              {
                offerId: o.id,
                field,
                normalizedValue:
                  field === "geographicEligibility"
                    ? JSON.stringify({
                        countries: v.countries.split(","),
                        states: v.states ? v.states.split(",") : [],
                        excludedStates: v.excludedStates
                          ? v.excludedStates.split(",")
                          : [],
                      })
                    : field === "rewardTerms" || field === "acquisition"
                      ? v[`evidence_${field}`]
                      : field === "recurrence"
                        ? `${v.offerType}:${v.recurrenceTimezone}`
                        : String(v[field as keyof typeof v] ?? "unknown"),
                extractedText: v[`evidence_${field}`]!,
                sourceUrl: v.sourceUrl,
                sourceType: v.sourceType,
                capturedAt: v.capturedAt!,
              },
            ]
          : [],
      );
      if (es.length) await tx.insert(offerEvidence).values(es);
    });
    revalidatePath("/", "layout");
    return {
      ok: true,
      message:
        "Offer and evidence saved. Eligibility is computed from current terms and your profile.",
    };
  } catch {
    return {
      ok: false,
      message:
        "Could not save offer. Choose a non-fixture, non-excluded platform. Official evidence must match a registered platform URL domain. At least one evidence passage is required. Check database availability.",
    };
  }
}
