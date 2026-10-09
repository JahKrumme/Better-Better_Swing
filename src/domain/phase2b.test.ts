import { describe, expect, it } from "vitest";
import {
  evaluateOfferEligibility,
  evidenceFields,
  moneyFields,
  type EligibilityOffer,
  type Evidence,
} from "./eligibility";
import { phase2EvidenceFields } from "./verification";
import { offerValue } from "./value";
const now = new Date("2026-10-08T22:00:00Z");
const profile = {
  country: "US",
  state: "KS",
  age: 21,
  excludedPlatforms: ["Fliff"],
};
function proof(field: string, normalizedValue?: string): Evidence {
  return {
    field,
    normalizedValue,
    sourceType: "official",
    sourceUrl: "https://synthetic.example/rules",
    extractedText:
      "Synthetic primary proof: free-issued promotional coins may be played and redeemed for prizes without a purchase; no real operator represented.",
    capturedAt: now,
  };
}
function offer(): EligibilityOffer {
  return {
    platform: {
      name: "Synthetic",
      slug: "synthetic",
      excluded: false,
      exclusionReason: null,
    },
    ...(Object.fromEntries(moneyFields.map((f) => [f, false])) as Record<
      (typeof moneyFields)[number],
      boolean
    >),
    entryFeeRequired: false,
    signupRequired: true,
    identityVerificationRequired: true,
    minimumAge: 21,
    geographicEligibility: {
      countries: ["US"],
      states: ["KS"],
      excludedStates: [],
    },
    playthroughRequirement: null,
    minimumRedemption: null,
    startDate: null,
    expirationDate: null,
    lastVerifiedAt: now,
    fixture: false,
    researchVersion: 2,
    evidence: [
      ...evidenceFields,
      ...phase2EvidenceFields.filter(
        (f) => !["playthroughRequirement", "minimumRedemption"].includes(f),
      ),
    ]
      .map((f) => proof(f))
      .concat([
        proof("redemptionMechanism"),
        proof("redemptionWithoutPurchase", "true"),
      ]),
  };
}
describe("existence verification versus value quantification", () => {
  it("unknown promotional/cash amounts do not prevent primary-supported existence", () => {
    const o = offer();
    expect(evaluateOfferEligibility(o, profile, now)).toMatchObject({
      verificationState: "VERIFIED_FREE",
      warnings: [],
      valueWarnings: expect.arrayContaining([
        "minimumRedemption: terms unknown.",
        "playthroughRequirement: terms unknown.",
      ]),
    });
    expect(
      offerValue({ promotionalAmount: null, evidence: o.evidence }),
    ).toEqual({
      facePromotionalValue: null,
      estimatedRedeemableValue: null,
      actualRedeemedValue: null,
    });
  });
  it("unknown redemption numbers require proof of both the mechanism and purchase-free path", () => {
    for (const field of ["redemptionMechanism", "redemptionWithoutPurchase"]) {
      const o = offer();
      o.evidence = o.evidence.filter((e) => e.field !== field);
      expect(evaluateOfferEligibility(o, profile, now).verificationState).toBe(
        "NEEDS_VERIFICATION",
      );
    }
  });
  it("a negative or undecided purchase-free proposition is not affirmative proof", () => {
    for (const value of ["false", "unknown", undefined]) {
      const o = offer();
      o.evidence.find(
        (e) => e.field === "redemptionWithoutPurchase",
      )!.normalizedValue = value;
      expect(evaluateOfferEligibility(o, profile, now).eligible).toBe(false);
    }
  });
  it("secondary or stale redemption evidence cannot relax numerical conditions", () => {
    for (const kind of ["secondary", "stale"]) {
      const o = offer();
      const e = o.evidence.find(
        (e) => e.field === "redemptionWithoutPurchase",
      )!;
      if (kind === "secondary") e.sourceType = "secondary";
      else e.capturedAt = new Date(now.getTime() - 31 * 86400000);
      expect(evaluateOfferEligibility(o, profile, now).verificationState).toBe(
        "NEEDS_VERIFICATION",
      );
    }
  });
  it("unknown acquisition money cannot pass with a proven prize path", () => {
    for (const field of moneyFields) {
      const o = offer();
      o[field] = null;
      expect(evaluateOfferEligibility(o, profile, now).eligible).toBe(false);
    }
  });
  it("Kansas evidence and age remain required", () => {
    const o = offer();
    o.evidence = o.evidence.filter((e) => e.field !== "geographicEligibility");
    expect(evaluateOfferEligibility(o, profile, now).eligible).toBe(false);
    expect(
      evaluateOfferEligibility(offer(), { ...profile, age: null }, now)
        .eligible,
    ).toBe(false);
    const excluded = offer();
    excluded.geographicEligibility!.excludedStates = ["KS"];
    expect(
      evaluateOfferEligibility(excluded, profile, now).verificationState,
    ).toBe("EXCLUDED_GEOGRAPHY");
  });
  it("conflicting redemption facts still prevent verification", () => {
    const o = offer();
    o.evidence.push(proof("redemptionWithoutPurchase", "false"));
    expect(evaluateOfferEligibility(o, profile, now).verificationState).toBe(
      "NEEDS_VERIFICATION",
    );
  });
});
