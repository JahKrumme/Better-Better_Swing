import { z } from "zod";
export const candidateSchema = z
  .object({
    name: z.string().trim().min(1),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    homepageUrl: z.url().refine((v) => v.startsWith("https://")),
    category: z.enum([
      "sportsbook",
      "sweepstakes_casino",
      "prediction",
      "other",
    ]),
  })
  .strict();
export const accessSchema = z
  .object({
    slug: z.string(),
    sourceUrl: z.url(),
    retrievedAt: z.iso.datetime({ offset: true }),
    outcome: z.enum(["blocked", "unavailable", "retrieved"]),
    httpStatus: z.number().nullable(),
    notes: z.string().max(1000),
  })
  .strict();
export function officialSource(
  platform: {
    homepageUrl: string;
    termsUrl?: string | null;
    promotionsUrl?: string | null;
    rulesUrl?: string | null;
  },
  url: string,
) {
  try {
    const host = new URL(url).hostname;
    return (
      new URL(url).protocol === "https:" &&
      [
        platform.homepageUrl,
        platform.termsUrl,
        platform.promotionsUrl,
        platform.rulesUrl,
      ]
        .filter((s): s is string => !!s)
        .some((s) => {
          const h = new URL(s).hostname.replace(/^www\./, "");
          return host === h || host.endsWith("." + h);
        })
    );
  } catch {
    return false;
  }
}
