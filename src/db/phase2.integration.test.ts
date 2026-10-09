import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { importReviewedResearch } from "../../scripts/import-reviewed-research";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool } from "./index";
import {
  platforms,
  offers,
  offerEvidence,
  claims,
  redemptions,
  platformSources,
} from "./schema";
import { loadData } from "./queries";
import { recordManualClaim, changeManualClaimState } from "./claim-service";
import { evidenceFields, moneyFields } from "../domain/eligibility";
import { phase2EvidenceFields } from "../domain/verification";
import {
  nextOpportunity,
  opportunityFor,
  effectiveClaimState,
} from "../domain/recurrence";
import { earningsTotals } from "../domain/earnings";
const pid = randomUUID(),
  oid = randomUUID(),
  unknownId = randomUUID();
const ageBefore = process.env.PROFILE_AGE;
let claimedId = "";
const now = new Date();
beforeAll(async () => {
  process.env.PROFILE_AGE = "25";
  await db.insert(platforms).values({
    id: pid,
    name: "Synthetic integration platform — not real",
    slug: "test-" + pid,
    homepageUrl: "https://integration.example",
    category: "sweepstakes_casino",
  });
  const common = {
    platformId: pid,
    title: "Synthetic daily offer — not real",
    description: "Temporary integration data, deleted after tests.",
    offerType: "daily" as const,
    recurringCadence: "daily",
    researchVersion: 2,
    promotionalAmount: "10",
    facePromotionalValue: "10",
    promotionalCurrency: "synthetic coins",
    signupRequired: false,
    identityVerificationRequired: true,
    ...(Object.fromEntries(moneyFields.map((f) => [f, false])) as Record<
      (typeof moneyFields)[number],
      boolean
    >),
    entryFeeRequired: false,
    minimumAge: 21,
    playthroughRequirement: "1x",
    minimumRedemption: "20",
    geographicEligibility: {
      countries: ["US"],
      states: ["KS"],
      excludedStates: [],
    },
    sourceUrl: "https://integration.example/rules",
    lastVerifiedAt: now,
  };
  await db.insert(offers).values([
    { ...common, id: oid },
    {
      ...common,
      id: unknownId,
      title: "Synthetic incomplete offer — not real",
    },
  ]);
  await db.insert(offerEvidence).values(
    [...evidenceFields, ...phase2EvidenceFields].map((field) => ({
      offerId: oid,
      field,
      sourceUrl: "https://integration.example/rules",
      sourceType: "official" as const,
      extractedText:
        "Synthetic supporting passage; this is not real platform evidence.",
      capturedAt: now,
      normalizedValue: null,
    })),
  );
});
afterAll(async () => {
  try {
    await db.delete(redemptions).where(eq(redemptions.platformId, pid));
    for (const id of [oid, unknownId]) {
      await db.delete(claims).where(eq(claims.offerId, id));
      await db.delete(offerEvidence).where(eq(offerEvidence.offerId, id));
      await db.delete(offers).where(eq(offers.id, id));
    }
    await db.delete(platformSources).where(eq(platformSources.platformId, pid));
    await db.delete(platforms).where(eq(platforms.id, pid));
  } finally {
    if (ageBefore === undefined) delete process.env.PROFILE_AGE;
    else process.env.PROFILE_AGE = ageBefore;
    await pool.end();
  }
});
describe("PostgreSQL research and manual recurring claims", () => {
  it("Phase2B verifies unknown-value programs without inventing earnings or a Stake redemption path", async () => {
    const d = await loadData();
    const focused = d.offers.filter((o) =>
      ["high-5-casino", "stake-us", "realprize"].includes(o.platform.slug),
    );
    const verified = focused.filter((o) => o.result.eligible);
    expect(verified).toHaveLength(4);
    expect(new Set(verified.map((o) => o.platform.slug)).size).toBe(2);
    expect(verified.filter((o) => o.offerType === "daily")).toHaveLength(2);
    expect(
      verified.filter((o) => o.value.facePromotionalValue === null),
    ).toHaveLength(3);
    expect(
      verified.find((o) => o.title === "Free new-account signup reward — 55 SC")
        ?.value.facePromotionalValue,
    ).toBe("55.00");
    expect(
      verified.every((o) => o.value.estimatedRedeemableValue === null),
    ).toBe(true);
    const stake = focused.find(
      (o) => o.platform.slug === "stake-us" && o.offerType === "daily",
    )!;
    expect(stake.result.verificationState).toBe("NEEDS_VERIFICATION");
    expect(stake.result.warnings).toContain(
      "Missing current primary evidence: purchase-free redemption path.",
    );
    expect(
      focused.filter(
        (o) => o.result.verificationState === "EXCLUDED_REQUIRES_MONEY",
      ),
    ).toHaveLength(4);
  });

  it("reviewed import is idempotent and preserves manual offer edits and fixtures", async () => {
    const before = await loadData();
    const record = before.offers.find(
      (o) => !o.fixture && o.platform.slug === "stake-us",
    )!;
    const sourceCount = (await db.select().from(platformSources)).length;
    const evidenceCount = (await db.select().from(offerEvidence)).length;
    try {
      await db
        .update(offers)
        .set({ description: "Manual review must survive replay" })
        .where(eq(offers.id, record.id));
      await importReviewedResearch();
      await importReviewedResearch();
      const after = await loadData();
      expect(after.offers).toHaveLength(before.offers.length);
      expect(after.offers.find((o) => o.id === record.id)?.description).toBe(
        "Manual review must survive replay",
      );
      expect((await db.select().from(platformSources)).length).toBe(
        sourceCount,
      );
      expect((await db.select().from(offerEvidence)).length).toBe(
        evidenceCount,
      );
      expect(after.offers.filter((o) => o.fixture)).toHaveLength(5);
      expect(
        after.offers.filter(
          (o) =>
            !o.fixture &&
            o.platform.slug === "sportzino" &&
            o.offerType === "daily",
        )[0].result.verificationState,
      ).toBe("NEEDS_VERIFICATION");
      expect(
        after.platforms.find((p) => p.slug === "stake-us")
          ?.effectiveAutomationPolicy,
      ).toBe("PROHIBITED");
      for (const slug of [
        "luckyland-slots",
        "fortune-coins",
        "underdog",
        "betmgm",
      ]) {
        expect(
          after.platforms.find((p) => p.slug === slug)?.researchNotes,
        ).toContain("OFFICIAL SOURCE ACCESS BLOCKED");
        expect(
          after.offers.filter((o) => o.platform.slug === slug),
        ).toHaveLength(0);
      }
    } finally {
      await db
        .update(offers)
        .set({ description: record.description })
        .where(eq(offers.id, record.id));
    }
  });

  it("same-day platform evidence permits multiple fields and preserves conflicting facts", async () => {
    const date = new Date();
    await db.insert(platformSources).values([
      {
        platformId: pid,
        sourceUrl: "https://integration.example/rules",
        sourceType: "official",
        field: "minimumAge",
        normalizedValue: "21",
        extractedText: "Synthetic age evidence",
        retrievedAt: date,
        outcome: "reviewed",
      },
      {
        platformId: pid,
        sourceUrl: "https://integration.example/rules",
        sourceType: "official",
        field: "kansasAvailability",
        normalizedValue: "true",
        extractedText: "Synthetic Kansas evidence",
        retrievedAt: date,
        outcome: "reviewed",
      },
    ]);
    expect(
      (await loadData()).platforms.find((p) => p.id === pid)?.researchConflict,
    ).toBe(false);
  });

  it("registry contains 20 uncertain candidates plus excluded Fliff; fixtures separate", async () => {
    const d = await loadData();
    const real = d.platforms.filter((p) => !p.fixture && p.id !== pid);
    expect(
      real.filter((p) => p.status === "candidate").length,
    ).toBeGreaterThanOrEqual(20);
    expect(real.find((p) => p.slug === "fliff")?.excluded).toBe(true);
    expect(d.offers.filter((o) => o.fixture)).toHaveLength(5);
  });
  it("current primary evidence supports the synthetic test offer only", async () => {
    const d = await loadData();
    expect(d.offers.find((o) => o.id === oid)?.result.verificationState).toBe(
      "VERIFIED_FREE",
    );
    expect(
      d.offers.find((o) => o.id === unknownId)?.result.verificationState,
    ).toBe("NEEDS_VERIFICATION");
  });
  it("unverified offer cannot be recorded as claimed", async () => {
    await expect(recordManualClaim(unknownId, now)).rejects.toThrow("verified");
    expect(
      await db.select().from(claims).where(eq(claims.offerId, unknownId)),
    ).toHaveLength(0);
  });
  it("two concurrent claim submissions create exactly one claimed instance and one future instance", async () => {
    const result = await Promise.allSettled([
      recordManualClaim(oid, now, "10"),
      recordManualClaim(oid, now, "10"),
    ]);
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rows = await db.select().from(claims).where(eq(claims.offerId, oid));
    expect(rows).toHaveLength(2);
    const claimed = rows.find((c) => c.claimState === "CLAIMED")!;
    claimedId = claimed.id;
    expect(rows.filter((c) => c.claimState === "CLAIMED")).toHaveLength(1);
    expect(
      rows.find((c) => c.claimState === "UNCLAIMED")?.promotionalValueReceived,
    ).toBeNull();
  });
  it("tomorrow becomes independently ready; underlying offer remains eligible", async () => {
    const d = await loadData();
    const o = d.offers.find((o) => o.id === oid)!;
    const next = nextOpportunity(o, now)!;
    const rows = await db.select().from(claims).where(eq(claims.offerId, oid));
    const future = rows.find((c) => c.periodKey === next.periodKey)!;
    expect(effectiveClaimState(future, next.availableDate)).toBe(
      "READY_TO_CLAIM",
    );
    expect(o.result.eligible).toBe(true);
    const tomorrow = await recordManualClaim(oid, next.availableDate, "10");
    expect(tomorrow.periodKey).not.toBe(opportunityFor(o, now).periodKey);
  });
  it("claim-to-redemption transitions preserve separate promotional and actual cash", async () => {
    await changeManualClaimState(claimedId, "PLAYTHROUGH_REQUIRED");
    await changeManualClaimState(claimedId, "REDEEMABLE");
    await expect(changeManualClaimState(claimedId, "REDEEMED")).rejects.toThrow(
      "actual cash",
    );
    await changeManualClaimState(claimedId, "REDEEMED", "1.25");
    const [c] = await db.select().from(claims).where(eq(claims.id, claimedId));
    expect(c.promotionalValueReceived).toBe("10.00");
    expect(c.actualRedeemedValue).toBe("1.25");
    await expect(changeManualClaimState(claimedId, "CLAIMED")).rejects.toThrow(
      "Invalid",
    );
  });
  it("linked redemption does not double count manually recorded actual cash", async () => {
    await db.insert(redemptions).values({
      platformId: pid,
      claimId: claimedId,
      amount: "1.25",
      status: "completed",
      completedDate: now,
    });
    const d = await loadData();
    const totals = earningsTotals(
      d.claims.filter((c) => c.offerId === oid),
      d.offers,
      d.redemptions.filter((r) => r.platformId === pid),
      d.platforms,
    );
    expect(totals.actualRedeemedValue).toBe(1.25);
    expect(totals.promotionalUnits.get("synthetic coins")).toBe(20);
  });
  it("new conflicting primary evidence invalidates eligibility without losing history", async () => {
    await db.insert(offerEvidence).values({
      offerId: oid,
      field: "depositRequired",
      sourceUrl: "https://integration.example/rules",
      sourceType: "official",
      extractedText: "Synthetic conflicting assertion",
      capturedAt: new Date(),
      normalizedValue: "true",
    });
    const d = await loadData();
    expect(d.offers.find((o) => o.id === oid)?.result.verificationState).toBe(
      "NEEDS_VERIFICATION",
    );
    expect(d.offers.find((o) => o.id === oid)?.evidence.length).toBe(
      evidenceFields.length + phase2EvidenceFields.length + 1,
    );
  });
  it("conflicting platform policy never becomes permission", async () => {
    await db.insert(platformSources).values(
      ["permitted", "prohibited"].map((normalizedValue) => ({
        platformId: pid,
        sourceUrl: "https://integration.example/rules",
        sourceType: "official" as const,
        field: "automationPolicy",
        normalizedValue,
        extractedText: "Synthetic contradictory policy",
        retrievedAt: now,
        outcome: "reviewed",
      })),
    );
    const p = (await loadData()).platforms.find((p) => p.id === pid)!;
    expect(p.effectiveAutomationPolicy).toBe("UNKNOWN");
    expect(
      p.sources.filter((s) => s.field === "automationPolicy"),
    ).toHaveLength(2);
  });
});
