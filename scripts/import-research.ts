import { importReviewedResearch } from "./import-reviewed-research";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { candidateSchema, accessSchema } from "../src/domain/registry";
import { db, pool } from "../src/db";
import { platforms, platformSources } from "../src/db/schema";
const candidates = z
  .array(candidateSchema)
  .max(100)
  .parse(JSON.parse(readFileSync("research/candidates.json", "utf8")));
const attempts = z
  .array(accessSchema)
  .max(500)
  .parse(JSON.parse(readFileSync("research/access-results.json", "utf8")));
try {
  await db.transaction(async (tx) => {
    for (const p of candidates) {
      await tx
        .insert(platforms)
        .values({
          ...p,
          researchState: "NEEDS_VERIFICATION",
          status: "candidate",
          researchNotes:
            "Established brand candidate; current operator legitimacy, Kansas availability, rewards, and terms could not be checked. No live promotion asserted.",
        })
        .onConflictDoNothing();
      const [saved] = await tx
        .select()
        .from(platforms)
        .where(eq(platforms.slug, p.slug));
      if (saved.fixture || saved.homepageUrl !== p.homepageUrl)
        throw new Error(`Candidate collision: ${p.slug}`);
      for (const a of attempts.filter((a) => a.slug === p.slug)) {
        if (new URL(a.sourceUrl).hostname !== new URL(p.homepageUrl).hostname)
          throw new Error("Access observation domain mismatch");
        await tx
          .insert(platformSources)
          .values({
            platformId: saved.id,
            sourceUrl: a.sourceUrl,
            sourceType: "official",
            field: "access",
            retrievedAt: new Date(a.retrievedAt),
            outcome: a.outcome,
            notes: a.notes,
          })
          .onConflictDoNothing();
      }
    }
    await tx
      .insert(platforms)
      .values({
        name: "Fliff",
        slug: "fliff",
        homepageUrl: "https://www.getfliff.com/",
        category: "prediction",
        excluded: true,
        exclusionReason:
          "Explicit user/product exclusion; handled manually outside this app.",
        researchState: "EXCLUDED_PLATFORM",
        status: "excluded",
      })
      .onConflictDoNothing();
  });
  await importReviewedResearch();
  console.log(
    `Preserved ${candidates.length} candidate identities and historical access observations. Fliff excluded.`,
  );
} finally {
  await pool.end();
}
