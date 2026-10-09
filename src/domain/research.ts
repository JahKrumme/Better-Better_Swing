import { z } from "zod";
import { evidenceFields, moneyFields } from "./eligibility";
import { phase2EvidenceFields } from "./verification";
const https = z
  .url()
  .refine((v) => v.startsWith("https://"), "Use an HTTPS source URL.");
const text = z.string().trim().min(1).max(10000);
const optionalText = z
  .string()
  .trim()
  .max(10000)
  .transform((v) => v || null);
const evidenceText = z
  .string()
  .trim()
  .max(1000)
  .transform((v) => v || null);
const decision = z
  .enum(["unknown", "yes", "no"])
  .transform((v) => (v === "unknown" ? null : v === "yes"));
const amount = z
  .string()
  .regex(
    /^(\d{1,10}(\.\d{1,2})?)?$/,
    "Use a nonnegative amount with at most two decimal places.",
  )
  .transform((v) => v || null);
const age = z
  .string()
  .regex(/^(\d{1,3})?$/)
  .transform((v) => (v ? Number(v) : null))
  .refine(
    (v) => v === null || (v >= 18 && v <= 120),
    "Age must be between 18 and 120.",
  );
const date = z.string().transform((v, ctx) => {
  if (!v) return null;
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) {
    ctx.addIssue({ code: "custom", message: "Invalid date" });
    return z.NEVER;
  }
  return d;
});
export const platformInput = z
  .object({
    name: text,
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    homepageUrl: https,
    category: z.enum([
      "sportsbook",
      "sweepstakes_casino",
      "prediction",
      "other",
    ]),
    termsUrl: z.union([https, z.literal("")]).transform((v) => v || null),
    promotionsUrl: z.union([https, z.literal("")]).transform((v) => v || null),
  })
  .refine(
    (p) => p.name.trim().toLowerCase() !== "fliff" && p.slug !== "fliff",
    "Fliff is excluded from this application.",
  );
export const offerInput = z
  .object({
    platformId: z.uuid(),
    title: text,
    description: text,
    offerType: z.enum([
      "signup",
      "daily",
      "weekly",
      "limited_time",
      "amoe",
      "giveaway",
    ]),
    entryFeeRequired: decision.prefault("unknown"),
    amoeAvailable: decision.prefault("unknown"),
    postageRequired: decision.prefault("unknown"),
    amoeMethod: optionalText.prefault(""),
    amoeValuePerRequest: amount.prefault(""),
    amoeRequestLimits: optionalText.prefault(""),
    amoeFrequencyLimits: optionalText.prefault(""),
    amoeOtherUserCost: amount.prefault(""),
    estimatedRedeemableValue: amount.prefault(""),
    valueMethod: optionalText.prefault(""),
    valueEvidenceUrl: z
      .union([https, z.literal("")])
      .prefault("")
      .transform((v) => v || null),
    recurrenceTimezone: z
      .string()
      .default("America/Chicago")
      .refine((v) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: v });
          return true;
        } catch {
          return false;
        }
      }, "Invalid timezone"),
    promotionalAmount: amount,
    promotionalCurrency: text,
    estimatedCashValue: amount,
    minimumRedemption: amount,
    playthroughRequirement: optionalText,
    sourceUrl: https,
    minimumAge: age,
    signupRequired: decision,
    identityVerificationRequired: decision,
    ...(Object.fromEntries(moneyFields.map((f) => [f, decision])) as Record<
      (typeof moneyFields)[number],
      typeof decision
    >),
    countries: z
      .string()
      .trim()
      .regex(/^([A-Z]{2}(,[A-Z]{2})*)?$/),
    states: z
      .string()
      .trim()
      .regex(/^([A-Z]{2}(,[A-Z]{2})*)?$/),
    excludedStates: z
      .string()
      .trim()
      .regex(/^([A-Z]{2}(,[A-Z]{2})*)?$/),
    startDate: date,
    expirationDate: date,
    sourceType: z.enum(["official", "secondary"]),
    capturedAt: date.refine(
      (v) => !!v && v <= new Date(),
      "Capture date must be today or earlier.",
    ),
    ...(Object.fromEntries(
      [
        ...phase2EvidenceFields,
        "amoeMethod",
        "postageRequired",
        "amoeOtherUserCost",
        "estimatedRedeemableValue",
      ].map((f) => [`evidence_${f}`, evidenceText.prefault("")]),
    ) as Record<
      `evidence_${(typeof phase2EvidenceFields)[number] | "amoeMethod" | "postageRequired" | "amoeOtherUserCost" | "estimatedRedeemableValue"}`,
      ReturnType<typeof optionalText.prefault>
    >),
    ...(Object.fromEntries(
      evidenceFields.map((f) => [`evidence_${f}`, evidenceText]),
    ) as Record<
      `evidence_${(typeof evidenceFields)[number]}`,
      typeof optionalText
    >),
  })
  .refine(
    (o) => !o.startDate || !o.expirationDate || o.expirationDate > o.startDate,
    "Expiration must be after the start date.",
  );
