import { eq } from "drizzle-orm";
import { db, pool } from "../src/db";
import { platforms, offers, offerEvidence } from "../src/db/schema";
import { evidenceFields } from "../src/domain/eligibility";
const sports = "00000000-0000-4000-8000-000000000001";
const casino = "00000000-0000-4000-8000-000000000002";
try {
  await db.transaction(async (tx) => {
    await tx
      .insert(platforms)
      .values([
        {
          id: sports,
          name: "Example Sportsbook",
          slug: "example-sportsbook",
          homepageUrl: "https://sportsbook.example",
          category: "sportsbook",
          fixture: true,
          usAvailability: true,
          lastCheckedAt: new Date(),
        },
        {
          id: casino,
          name: "Example Sweepstakes Casino",
          slug: "example-sweepstakes-casino",
          homepageUrl: "https://casino.example",
          category: "sweepstakes_casino",
          fixture: true,
          usAvailability: true,
          lastCheckedAt: new Date(),
        },
      ])
      .onConflictDoNothing();
    const samples = [
      {
        title: "$10 no-deposit signup bonus",
        amount: "10",
        type: "signup" as const,
        paid: null,
      },
      {
        title: "Deposit $10, receive $100",
        amount: "100",
        type: "signup" as const,
        paid: "depositRequired",
      },
      {
        title: "Bet $5, receive $150",
        amount: "150",
        type: "limited_time" as const,
        paid: "paidWagerRequired",
      },
      {
        title: "Free daily promotional coin",
        amount: "1",
        type: "daily" as const,
        paid: null,
      },
      {
        title: "Paid membership reward",
        amount: "5",
        type: "weekly" as const,
        paid: "subscriptionRequired",
      },
    ];
    for (const [i, s] of samples.entries()) {
      const id = `00000000-0000-4000-8000-${String(i + 10).padStart(12, "0")}`;
      await tx
        .insert(offers)
        .values({
          id,
          platformId: i >= 3 ? casino : sports,
          title: s.title,
          description:
            "Fictional fixture for rule testing. This promotion does not exist.",
          offerType: s.type,
          promotionalAmount: s.amount,
          promotionalCurrency: i >= 3 ? "promotional coins" : "bonus credit",
          estimatedCashValue: null,
          signupRequired: s.type === "signup",
          depositRequired: s.paid === "depositRequired",
          purchaseRequired: false,
          paidWagerRequired: s.paid === "paidWagerRequired",
          subscriptionRequired: s.paid === "subscriptionRequired",
          monetaryContributionRequired: false,
          identityVerificationRequired: true,
          minimumAge: 21,
          playthroughRequirement: "1× promotional balance (fictional)",
          minimumRedemption: "20",
          geographicEligibility: {
            countries: ["US"],
            states: ["KS"],
            excludedStates: [],
          },
          recurringCadence:
            s.type === "daily"
              ? "daily"
              : s.type === "weekly"
                ? "weekly"
                : null,
          sourceUrl: "https://fixtures.example/terms",
          lastVerifiedAt: new Date(),
          fixture: true,
          researchVersion: 1,
        })
        .onConflictDoNothing();
      const existing = await tx
        .select({ field: offerEvidence.field })
        .from(offerEvidence)
        .where(eq(offerEvidence.offerId, id));
      const missing = evidenceFields.filter(
        (field) => !existing.some((e) => e.field === field),
      );
      if (missing.length)
        await tx.insert(offerEvidence).values(
          missing.map((field) => ({
            offerId: id,
            field,
            sourceType: "fixture" as const,
            sourceUrl: "https://fixtures.example/terms",
            extractedText: `FICTIONAL: ${field}: ${field === s.paid ? "required" : field === "identityVerificationRequired" || (field === "signupRequired" && s.type === "signup") ? "required" : field === "minimumAge" ? "21+" : field === "geographicEligibility" ? "US, Kansas" : field === "rewardTerms" ? "Free promotional credit, 1× playthrough, $20 minimum redemption" : "not required"}`,
            notes: "Synthetic evidence; not a real platform or offer.",
          })),
        );
    }
  });
  console.log("Fictional fixtures seeded (existing records preserved).");
} finally {
  await pool.end();
}
