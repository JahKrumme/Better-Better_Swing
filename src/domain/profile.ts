import { z } from "zod";
export function getProfile() {
  const age = z.coerce
    .number()
    .int()
    .min(18)
    .max(120)
    .safeParse(process.env.PROFILE_AGE || undefined);
  return {
    country: process.env.PROFILE_COUNTRY || "US",
    state: process.env.PROFILE_STATE || "KS",
    age: age.success ? age.data : null,
    excludedPlatforms: ["Fliff"],
  };
}
