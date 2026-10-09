import { readFileSync } from "node:fs";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, pool } from "../src/db";
import { offers, platforms, publicDocuments } from "../src/db/schema";
import { officialLink } from "../src/domain/product";
const rows = z
  .array(
    z.object({
      slug: z.string(),
      sourceUrl: z.string(),
      retrievedAt: z.iso.datetime({ offset: true }),
      fingerprint: z.string().nullable(),
      outcome: z.enum(["READABLE", "ACCESS_FAILED"]),
      excerpt: z.string().max(12000),
      notes: z.string().max(500),
    }),
  )
  .parse(
    JSON.parse(readFileSync("research/product-public-captures.json", "utf8")),
  );
try {
  for (const row of rows) {
    const [p] = await db
      .select()
      .from(platforms)
      .where(eq(platforms.slug, row.slug));
    if (!p || p.fixture || p.excluded || !officialLink(row.sourceUrl)) continue;
    const [prior] = await db
      .select()
      .from(publicDocuments)
      .where(
        and(
          eq(publicDocuments.platformId, p.id),
          eq(publicDocuments.sourceUrl, row.sourceUrl),
        ),
      )
      .orderBy(desc(publicDocuments.retrievedAt))
      .limit(1);
    const changed =
      prior?.fingerprint &&
      row.fingerprint &&
      prior.fingerprint !== row.fingerprint;
    await db.transaction(async (tx) => {
      await tx
        .insert(publicDocuments)
        .values({
          platformId: p.id,
          sourceUrl: row.sourceUrl,
          retrievedAt: new Date(row.retrievedAt),
          fingerprint: row.fingerprint,
          outcome: changed ? "REVIEW_REQUIRED" : row.outcome,
          excerpt: row.excerpt,
          notes: row.notes,
        })
        .onConflictDoNothing();
      if (changed)
        await tx
          .update(offers)
          .set({ publicReviewRequired: true })
          .where(eq(offers.platformId, p.id));
    });
  }
  console.log(
    `Preserved ${rows.length} public captures. No eligibility facts renewed and no account actions performed.`,
  );
} finally {
  await pool.end();
}
