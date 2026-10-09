import { describe, it, expect } from "vitest";
import {
  evaluateOfferEligibility,
  evidenceFields,
  moneyFields,
  type EligibilityOffer,
} from "./eligibility";
const now = new Date("2026-10-08T12:00:00Z");
const profile = {
  country: "US",
  state: "KS",
  age: 25,
  excludedPlatforms: ["Fliff"],
};
function free(): EligibilityOffer {
  return {
    platform: {
      name: "Test",
      slug: "test",
      excluded: false,
      exclusionReason: null,
    },
    depositRequired: false,
    purchaseRequired: false,
    paidWagerRequired: false,
    subscriptionRequired: false,
    monetaryContributionRequired: false,
    signupRequired: true,
    identityVerificationRequired: true,
    playthroughRequirement: "1x free promotional credit",
    minimumRedemption: "20",
    minimumAge: 21,
    geographicEligibility: {
      countries: ["US"],
      states: ["KS"],
      excludedStates: [],
    },
    startDate: null,
    expirationDate: null,
    lastVerifiedAt: now,
    fixture: false,
    evidence: evidenceFields.map((field) => ({
      field,
      sourceUrl: "https://official.example/terms",
      sourceType: "official",
      extractedText: "Explicit manually verified terms",
      capturedAt: now,
    })),
  };
}
describe("evidence-first zero-out-of-pocket eligibility", () => {
  for (const field of moneyFields)
    it(`${field} rejects even with reliable evidence`, () => {
      const o = free();
      o[field] = true;
      expect(evaluateOfferEligibility(o, profile, now)).toMatchObject({
        eligible: false,
        zeroOutOfPocket: false,
        status: "Excluded",
      });
    });
  it("free signup passes", () =>
    expect(evaluateOfferEligibility(free(), profile, now)).toMatchObject({
      eligible: true,
      zeroOutOfPocket: true,
      status: "Verified Free",
    }));
  it("free recurring promotional credit with playthrough passes", () => {
    const o = free();
    o.signupRequired = false;
    expect(evaluateOfferEligibility(o, profile, now).eligible).toBe(true);
  });
  it("unknown playthrough stays unverified", () => {
    const o = free();
    o.playthroughRequirement = null;
    expect(evaluateOfferEligibility(o, profile, now).status).toBe(
      "Needs Verification",
    );
  });
  it("platform-level US restriction rejects", () => {
    const o = free();
    o.platform.usAvailability = false;
    expect(evaluateOfferEligibility(o, profile, now).status).toBe("Excluded");
  });
  it("Fliff is excluded regardless of free terms or capitalization", () => {
    const o = free();
    o.platform.name = " FLIFF ";
    expect(evaluateOfferEligibility(o, profile, now).status).toBe("Excluded");
  });
  it("Kansas geographic restriction rejects", () => {
    const o = free();
    o.geographicEligibility!.excludedStates = ["KS"];
    expect(evaluateOfferEligibility(o, profile, now).eligible).toBe(false);
  });
  it("country restriction rejects", () => {
    const o = free();
    o.geographicEligibility!.countries = ["CA"];
    expect(evaluateOfferEligibility(o, profile, now).status).toBe("Excluded");
  });
  it("expired offers reject", () => {
    const o = free();
    o.expirationDate = now;
    expect(evaluateOfferEligibility(o, profile, now).status).toBe("Expired");
  });
  it("unknown monetary requirement cannot be free", () => {
    const o = free();
    o.purchaseRequired = null;
    expect(evaluateOfferEligibility(o, profile, now)).toMatchObject({
      zeroOutOfPocket: false,
      status: "Needs Verification",
    });
  });
  it("missing evidence stays unverified", () => {
    const o = free();
    o.evidence = [];
    expect(evaluateOfferEligibility(o, profile, now).status).toBe(
      "Needs Verification",
    );
  });
  it("secondary sources cannot verify", () => {
    const o = free();
    o.evidence.forEach((e) => (e.sourceType = "secondary"));
    expect(evaluateOfferEligibility(o, profile, now).eligible).toBe(false);
  });
  it("fixture evidence cannot verify live offers", () => {
    const o = free();
    o.evidence.forEach((e) => (e.sourceType = "fixture"));
    expect(evaluateOfferEligibility(o, profile, now).eligible).toBe(false);
  });
  it("stale evidence invalidates determination", () => {
    const o = free();
    o.evidence[0].capturedAt = new Date("2025-01-01");
    expect(evaluateOfferEligibility(o, profile, now).status).toBe(
      "Needs Verification",
    );
  });
  it("unknown age stays unverified", () =>
    expect(
      evaluateOfferEligibility(free(), { ...profile, age: null }, now).status,
    ).toBe("Needs Verification"));
  it("underage rejects", () =>
    expect(
      evaluateOfferEligibility(free(), { ...profile, age: 18 }, now).status,
    ).toBe("Excluded"));
  it("future source cannot prove terms", () => {
    const o = free();
    o.evidence[0].capturedAt = new Date("2030-01-01");
    expect(evaluateOfferEligibility(o, profile, now).eligible).toBe(false);
  });
  it("future promotion is not yet eligible", () => {
    const o = free();
    o.startDate = new Date("2030-01-01");
    expect(evaluateOfferEligibility(o, profile, now).eligible).toBe(false);
  });
  it("refundable deposit remains disallowed", () => {
    const o = free();
    o.depositRequired = true;
    o.evidence[0].extractedText = "Refundable deposit required";
    expect(evaluateOfferEligibility(o, profile, now).zeroOutOfPocket).toBe(
      false,
    );
  });
});
