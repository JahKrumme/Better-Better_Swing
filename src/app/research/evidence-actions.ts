"use server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { offers, platforms, offerEvidence, platformSources } from "@/db/schema";
import { evidenceFields } from "@/domain/eligibility";
import { phase2EvidenceFields } from "@/domain/verification";
import { officialSource } from "@/domain/registry";
import { offerFactPatch } from "@/domain/offer-fact";
import type { FormState } from "./actions";
const input = z.object({
  applyToTerms: z.enum(["yes", "no"]).default("no"),
  offerId: z.uuid(),
  sourceUrl: z.url().refine((v) => v.startsWith("https://")),
  sourceType: z.enum(["official", "secondary"]),
  field: z.enum([
    ...evidenceFields,
    ...phase2EvidenceFields,
    "amoeMethod",
    "postageRequired",
    "amoeOtherUserCost",
    "estimatedRedeemableValue",
  ]),
  extractedText: z.string().trim().min(1).max(1000),
  normalizedValue: z.string().trim().min(1).max(1000),
  capturedAt: z
    .string()
    .transform((v) => new Date(v))
    .refine((d) => Number.isFinite(d.getTime()) && d <= new Date()),
  conflicting: z.enum(["yes", "no"]).transform((v) => v === "yes"),
});
export async function appendEvidence(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const v = input.safeParse(Object.fromEntries(form));
  if (!v.success)
    return {
      ok: false,
      message: v.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    };
  try {
    await db.transaction(async (tx) => {
      const [o] = await tx
        .select()
        .from(offers)
        .where(eq(offers.id, v.data.offerId));
      if (!o || o.fixture) throw new Error("Not a real offer");
      const [p] = await tx
        .select()
        .from(platforms)
        .where(eq(platforms.id, o.platformId));
      if (
        v.data.sourceType === "official" &&
        !officialSource(p, v.data.sourceUrl)
      )
        throw new Error("Source mismatch");
      if (v.data.applyToTerms === "yes" && v.data.sourceType !== "official")
        throw new Error("Only official sources may update terms.");
      const patch =
        v.data.applyToTerms === "yes"
          ? offerFactPatch(v.data.field, v.data.normalizedValue)
          : {};
      await tx.insert(offerEvidence).values({
        offerId: v.data.offerId,
        field: v.data.field,
        sourceUrl: v.data.sourceUrl,
        sourceType: v.data.sourceType,
        extractedText: v.data.extractedText,
        normalizedValue: v.data.normalizedValue,
        capturedAt: v.data.capturedAt,
        conflicting: v.data.conflicting,
      });
      await tx
        .update(offers)
        .set({
          ...patch,
          lastVerifiedAt: new Date(),
          researchState: "NEEDS_VERIFICATION",
        })
        .where(eq(offers.id, o.id));
    });
    revalidatePath("/", "layout");
    return {
      ok: true,
      message:
        "Evidence appended. Historical evidence retained; conflicting facts prevent verification.",
    };
  } catch {
    return {
      ok: false,
      message:
        "Could not append evidence. Select a real offer and registered official source. Term edits need official evidence and correctly typed normalized values (true/false/unknown, amount, age, or geography JSON).",
    };
  }
}
const supersede = z.object({
  evidenceId: z.uuid(),
  reason: z.string().trim().min(10).max(500),
});
export async function supersedeEvidence(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const v = supersede.safeParse(Object.fromEntries(form));
  if (!v.success)
    return {
      ok: false,
      message:
        "Choose evidence and document a review reason (10–500 characters).",
    };
  try {
    await db.transaction(async (tx) => {
      const [e] = await tx
        .select()
        .from(offerEvidence)
        .where(and(eq(offerEvidence.id, v.data.evidenceId)));
      if (!e || e.supersededAt) throw new Error("No active evidence");
      const [o] = await tx
        .select()
        .from(offers)
        .where(eq(offers.id, e.offerId));
      if (o.fixture) throw new Error("Fixture evidence immutable");
      await tx
        .update(offerEvidence)
        .set({
          supersededAt: new Date(),
          notes: [e.notes, `Review: ${v.data.reason}`]
            .filter(Boolean)
            .join("\n"),
        })
        .where(eq(offerEvidence.id, e.id));
    });
    revalidatePath("/", "layout");
    return {
      ok: true,
      message:
        "Evidence superseded with a review reason; historical passage retained.",
    };
  } catch {
    return { ok: false, message: "Unable to supersede this evidence." };
  }
}
const platformReview = z.object({
  platformId: z.uuid(),
  termsUrl: z.union([z.url(), z.literal("")]),
  rulesUrl: z.union([z.url(), z.literal("")]),
  promotionsUrl: z.union([z.url(), z.literal("")]),
  automationPolicy: z.enum(["unknown", "prohibited", "permitted"]),
  sourceUrl: z.url().refine((v) => v.startsWith("https://")),
  extractedText: z.string().trim().min(1).max(1000),
  capturedAt: z
    .string()
    .transform((v) => new Date(v))
    .refine((d) => Number.isFinite(d.getTime()) && d <= new Date()),
});
export async function reviewPlatform(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const v = platformReview.safeParse(Object.fromEntries(form));
  if (!v.success)
    return {
      ok: false,
      message:
        "Provide valid platform URLs, a short official passage, and a past capture date.",
    };
  try {
    await db.transaction(async (tx) => {
      const [p] = await tx
        .select()
        .from(platforms)
        .where(eq(platforms.id, v.data.platformId));
      if (!p || p.fixture || p.excluded || !officialSource(p, v.data.sourceUrl))
        throw new Error("Invalid official source");
      await tx
        .insert(platformSources)
        .values({
          platformId: p.id,
          sourceUrl: v.data.sourceUrl,
          sourceType: "official",
          field: "automationPolicy",
          extractedText: v.data.extractedText,
          normalizedValue: v.data.automationPolicy,
          retrievedAt: v.data.capturedAt,
          outcome: "reviewed",
        })
        .onConflictDoNothing();
      await tx
        .update(platforms)
        .set({
          termsUrl: v.data.termsUrl || null,
          rulesUrl: v.data.rulesUrl || null,
          promotionsUrl: v.data.promotionsUrl || null,
          automationPolicy: v.data.automationPolicy,
          automationPolicyEvidence: v.data.extractedText,
          automationPolicySource: v.data.sourceUrl,
          automationPolicyLastVerifiedAt: v.data.capturedAt,
          lastCheckedAt: new Date(),
        })
        .where(eq(platforms.id, p.id));
    });
    revalidatePath("/", "layout");
    return {
      ok: true,
      message:
        "Platform policy research saved. No automatic claiming is enabled.",
    };
  } catch {
    return {
      ok: false,
      message:
        "Unable to save policy. Evidence must originate at an already registered official platform domain.",
    };
  }
}

export async function reviewPlatformFact(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const { platformFactFields, parsePlatformFact } =
    await import("@/domain/platform-fact");
  const v = z
    .object({
      platformId: z.uuid(),
      field: z.enum(platformFactFields),
      value: z.string().trim().min(1).max(1000),
      sourceUrl: z.url().refine((v) => v.startsWith("https://")),
      extractedText: z.string().trim().min(1).max(1000),
      capturedAt: z
        .string()
        .transform((v) => new Date(v))
        .refine((d) => Number.isFinite(d.getTime()) && d <= new Date()),
    })
    .safeParse(Object.fromEntries(form));
  if (!v.success)
    return {
      ok: false,
      message:
        "Enter a valid field, normalized fact, short official passage, source, and capture date.",
    };
  try {
    const fact = parsePlatformFact(v.data.field, v.data.value);
    await db.transaction(async (tx) => {
      const [p] = await tx
        .select()
        .from(platforms)
        .where(eq(platforms.id, v.data.platformId));
      if (!p || p.fixture || p.excluded || !officialSource(p, v.data.sourceUrl))
        throw new Error("Invalid platform/source");
      await tx
        .insert(platformSources)
        .values({
          platformId: p.id,
          field: v.data.field,
          sourceUrl: v.data.sourceUrl,
          sourceType: "official",
          extractedText: v.data.extractedText,
          normalizedValue: v.data.value,
          retrievedAt: v.data.capturedAt,
          outcome: "reviewed",
        })
        .onConflictDoNothing();
      await tx
        .update(platforms)
        .set({
          [v.data.field]: fact,
          lastCheckedAt: new Date(),
          lastVerifiedAt: v.data.capturedAt,
          researchState: "NEEDS_VERIFICATION",
        })
        .where(eq(platforms.id, p.id));
    });
    revalidatePath("/", "layout");
    return {
      ok: true,
      message:
        "Platform fact and primary evidence saved; individual offers still require verification.",
    };
  } catch {
    return {
      ok: false,
      message:
        "Unable to save fact. Boolean values use true/false/unknown; amounts and ages must be valid, and sources must be official registered domains.",
    };
  }
}
