import { z } from "zod";
export const platformFactFields = [
  "usAvailability",
  "kansasAvailability",
  "minimumAge",
  "freeSignupReward",
  "recurringFreeReward",
  "amoeAvailable",
  "minimumRedemption",
  "playthroughRequirement",
  "identityVerificationRequired",
] as const;
export function parsePlatformFact(
  field: (typeof platformFactFields)[number],
  value: string,
): string | number | boolean | null {
  if (value === "unknown") return null;
  if (
    [
      "usAvailability",
      "kansasAvailability",
      "amoeAvailable",
      "identityVerificationRequired",
    ].includes(field)
  )
    return z.enum(["true", "false"]).parse(value) === "true";
  if (field === "minimumAge")
    return z.coerce.number().int().min(18).max(120).parse(value);
  if (field === "minimumRedemption")
    return z
      .string()
      .regex(/^\d{1,10}(\.\d{1,2})?$/)
      .parse(value);
  return z.string().trim().min(1).max(1000).parse(value);
}
