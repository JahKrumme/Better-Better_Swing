import { z } from "zod";
const booleanFields = [
  "depositRequired",
  "purchaseRequired",
  "paidWagerRequired",
  "subscriptionRequired",
  "monetaryContributionRequired",
  "entryFeeRequired",
  "signupRequired",
  "identityVerificationRequired",
  "postageRequired",
];
export function offerFactPatch(
  field: string,
  value: string,
): Record<string, unknown> {
  if (booleanFields.includes(field))
    return {
      [field]:
        value === "unknown"
          ? null
          : z.enum(["true", "false"]).parse(value) === "true",
    };
  if (field === "expirationDate")
    return {
      [field]:
        value === "unknown"
          ? null
          : z.iso
              .datetime({ offset: true })
              .transform((v) => new Date(v))
              .parse(value),
    };
  if (field === "minimumAge")
    return {
      [field]:
        value === "unknown"
          ? null
          : z.coerce.number().int().min(18).max(120).parse(value),
    };
  if (
    [
      "minimumRedemption",
      "amoeOtherUserCost",
      "estimatedRedeemableValue",
    ].includes(field)
  )
    return {
      [field]:
        value === "unknown"
          ? null
          : z
              .string()
              .regex(/^\d{1,10}(\.\d{1,2})?$/)
              .parse(value),
    };
  if (field === "geographicEligibility") {
    const geo = z
      .object({
        countries: z.array(z.string().regex(/^[A-Z]{2}$/)).min(1),
        states: z.array(z.string().regex(/^[A-Z]{2}$/)),
        excludedStates: z.array(z.string().regex(/^[A-Z]{2}$/)),
      })
      .strict()
      .parse(JSON.parse(value));
    return { geographicEligibility: geo };
  }
  if (["playthroughRequirement", "amoeMethod"].includes(field))
    return {
      [field]:
        value === "unknown"
          ? null
          : z.string().trim().min(1).max(1000).parse(value),
    };
  throw new Error(
    "This evidence field does not directly edit structured terms.",
  );
}
