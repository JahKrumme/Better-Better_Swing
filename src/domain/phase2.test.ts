import { offerFactPatch } from "./offer-fact";
import { describe, it, expect } from "vitest";
import {
  evaluateOfferEligibility,
  evidenceFields,
  moneyFields,
  type EligibilityOffer,
  type Evidence,
} from "./eligibility";
import {
  phase2EvidenceFields,
  automationPolicy,
  isRealRecord,
} from "./verification";
import { classifyAMOE } from "./amoe";
import {
  opportunityFor,
  nextOpportunity,
  effectiveClaimState,
  canTransitionClaim,
} from "./recurrence";
import { offerValue } from "./value";
import { filterOffers } from "./offer-filters";
import { officialSource } from "./registry";
import { earningsTotals } from "./earnings";
const now = new Date("2026-10-08T17:00:00Z");
const profile = {
  country: "US",
  state: "KS",
  age: 25,
  excludedPlatforms: ["Fliff"],
};
function real(): EligibilityOffer {
  return {
    platform: {
      name: "Test real structure (not a live platform)",
      slug: "synthetic",
      excluded: false,
      exclusionReason: null,
    },
    ...(Object.fromEntries(moneyFields.map((f) => [f, false])) as Record<
      (typeof moneyFields)[number],
      false
    >),
    entryFeeRequired: false,
    signupRequired: true,
    identityVerificationRequired: true,
    minimumAge: 21,
    playthroughRequirement: "1x",
    minimumRedemption: "20",
    geographicEligibility: {
      countries: ["US"],
      states: ["KS"],
      excludedStates: [],
    },
    startDate: null,
    expirationDate: null,
    lastVerifiedAt: now,
    fixture: false,
    researchVersion: 2,
    evidence: [...evidenceFields, ...phase2EvidenceFields].map((field) => ({
      field,
      sourceUrl: "https://official.example/terms",
      sourceType: "official",
      extractedText: "Synthetic primary excerpt for tests only",
      capturedAt: now,
    })),
  };
}
function freeAMOE() {
  const o = real();
  o.offerType = "amoe";
  o.amoeAvailable = true;
  o.amoeMethod = "online form";
  o.postageRequired = false;
  o.amoeOtherUserCost = "0";
  o.evidence.push(
    ...["amoeMethod", "postageRequired", "amoeOtherUserCost"].map((field) => ({
      field,
      sourceUrl: "https://official.example/rules",
      sourceType: "official" as const,
      extractedText: "Synthetic AMOE support",
      capturedAt: now,
    })),
  );
  return o;
}
describe("Phase 2 verification", () => {
  it("a future expiration needs its own primary support", () => {
    const o = real();
    o.expirationDate = new Date("2026-10-09T17:00:00Z");
    o.evidence = o.evidence.filter((e) => e.field !== "expirationDate");
    expect(evaluateOfferEligibility(o, profile, now).verificationState).toBe(
      "NEEDS_VERIFICATION",
    );
  });

  it("complete primary-supported terms verify", () =>
    expect(
      evaluateOfferEligibility(real(), profile, now).verificationState,
    ).toBe("VERIFIED_FREE"));
  it("missing primary acquisition evidence stays uncertain", () => {
    const o = real();
    o.evidence = o.evidence.filter((e) => e.field !== "acquisition");
    expect(evaluateOfferEligibility(o, profile, now).verificationState).toBe(
      "NEEDS_VERIFICATION",
    );
  });
  it("missing entry-fee decision stays uncertain", () => {
    const o = real();
    o.entryFeeRequired = null;
    expect(evaluateOfferEligibility(o, profile, now).verificationState).toBe(
      "NEEDS_VERIFICATION",
    );
  });
  it("an entry fee excludes", () => {
    const o = real();
    o.entryFeeRequired = true;
    expect(evaluateOfferEligibility(o, profile, now)).toMatchObject({
      verificationState: "EXCLUDED_REQUIRES_MONEY",
      zeroOutOfPocket: false,
    });
  });
  it("deposit and paid wager map to monetary exclusion", () => {
    for (const field of ["depositRequired", "paidWagerRequired"] as const) {
      const o = real();
      o[field] = true;
      expect(evaluateOfferEligibility(o, profile, now).verificationState).toBe(
        "EXCLUDED_REQUIRES_MONEY",
      );
    }
  });
  it("Kansas restriction maps to geographic exclusion", () => {
    const o = real();
    o.geographicEligibility!.excludedStates = ["KS"];
    expect(evaluateOfferEligibility(o, profile, now).verificationState).toBe(
      "EXCLUDED_GEOGRAPHY",
    );
  });
  it("Fliff exclusion maps to platform exclusion", () => {
    const o = real();
    o.platform.slug = "fliff";
    expect(evaluateOfferEligibility(o, profile, now).verificationState).toBe(
      "EXCLUDED_PLATFORM",
    );
  });
  it("expired offers cannot verify", () => {
    const o = real();
    o.expirationDate = now;
    expect(evaluateOfferEligibility(o, profile, now).verificationState).toBe(
      "EXPIRED",
    );
  });
  it("secondary acquisition evidence cannot verify", () => {
    const o = real();
    o.evidence.find((e) => e.field === "acquisition")!.sourceType = "secondary";
    expect(evaluateOfferEligibility(o, profile, now).verificationState).toBe(
      "NEEDS_VERIFICATION",
    );
  });
  it("explicit conflicting evidence blocks free verification", () => {
    const o = real();
    o.evidence[0].conflicting = true;
    expect(evaluateOfferEligibility(o, profile, now)).toMatchObject({
      verificationState: "NEEDS_VERIFICATION",
      eligible: false,
      zeroOutOfPocket: false,
    });
  });
  it("different current normalized primary facts conflict", () => {
    const o = real();
    o.evidence[0].normalizedValue = "false";
    o.evidence.push({ ...o.evidence[0], normalizedValue: "true" });
    expect(evaluateOfferEligibility(o, profile, now).verificationState).toBe(
      "NEEDS_VERIFICATION",
    );
  });
  it("source fact contradicting stored terms conflicts", () => {
    const o = real();
    o.evidence[0].normalizedValue = "true";
    expect(evaluateOfferEligibility(o, profile, now).verificationState).toBe(
      "NEEDS_VERIFICATION",
    );
  });
  it("superseded evidence retained but does not block current facts", () => {
    const o = real();
    o.evidence.push({
      ...o.evidence[0],
      normalizedValue: "true",
      supersededAt: now,
    });
    expect(evaluateOfferEligibility(o, profile, now).verificationState).toBe(
      "VERIFIED_FREE",
    );
  });
  it("fixture sources cannot verify a real record", () => {
    const o = real();
    o.evidence.forEach((e) => (e.sourceType = "fixture"));
    expect(evaluateOfferEligibility(o, profile, now).eligible).toBe(false);
  });
  it("removing evidence transitions verified to uncertain", () => {
    const o = real();
    expect(evaluateOfferEligibility(o, profile, now).verificationState).toBe(
      "VERIFIED_FREE",
    );
    o.evidence = [];
    expect(evaluateOfferEligibility(o, profile, now).verificationState).toBe(
      "NEEDS_VERIFICATION",
    );
  });
});
describe("AMOE costs", () => {
  it("postal postage is low-cost, not literally free", () => {
    const o = freeAMOE();
    o.amoeMethod = "mail";
    o.postageRequired = true;
    expect(classifyAMOE(o)).toBe("LOW_COST_AMOE");
    expect(evaluateOfferEligibility(o, profile, now)).toMatchObject({
      verificationState: "EXCLUDED_REQUIRES_MONEY",
      zeroOutOfPocket: false,
    });
  });
  it("online payment-free AMOE can qualify", () =>
    expect(evaluateOfferEligibility(freeAMOE(), profile, now)).toMatchObject({
      verificationState: "VERIFIED_FREE",
      amoeClassification: "ZERO_COST_AMOE",
    }));
  it("online entry with other user cost is excluded", () => {
    const o = freeAMOE();
    o.amoeOtherUserCost = "1";
    expect(evaluateOfferEligibility(o, profile, now).eligible).toBe(false);
  });
  it("unknown postage cannot be assumed zero", () => {
    const o = freeAMOE();
    o.postageRequired = null;
    expect(evaluateOfferEligibility(o, profile, now).verificationState).toBe(
      "NEEDS_VERIFICATION",
    );
  });
  it("missing primary AMOE cost evidence remains uncertain", () => {
    const o = freeAMOE();
    o.evidence = o.evidence.filter((e) => e.field !== "amoeOtherUserCost");
    expect(evaluateOfferEligibility(o, profile, now).eligible).toBe(false);
  });
});
describe("automation and dataset isolation", () => {
  const policy = {
    automationPolicy: "unknown",
    automationPolicyEvidence: null,
    automationPolicySource: null,
    automationPolicyLastVerifiedAt: null,
  };
  it("UNKNOWN is never permission", () =>
    expect(automationPolicy(policy, now)).toBe("UNKNOWN"));
  it("a bare permitted flag without affirmative evidence is unknown", () =>
    expect(
      automationPolicy({ ...policy, automationPolicy: "permitted" }, now),
    ).toBe("UNKNOWN"));
  it("current affirmative evidence can describe permitted policy without enabling execution", () =>
    expect(
      automationPolicy(
        {
          automationPolicy: "permitted",
          automationPolicyEvidence: "Synthetic permission excerpt",
          automationPolicySource: "https://official.example/rules",
          automationPolicyLastVerifiedAt: now,
        },
        now,
      ),
    ).toBe("PERMITTED"));
  it("explicit bot prohibition is reported", () =>
    expect(
      automationPolicy(
        {
          automationPolicy: "prohibited",
          automationPolicyEvidence: "Synthetic no-bots excerpt",
          automationPolicySource: "https://official.example/rules",
          automationPolicyLastVerifiedAt: now,
        },
        now,
      ),
    ).toBe("PROHIBITED"));
  it("stale permission is unknown", () =>
    expect(
      automationPolicy(
        {
          automationPolicy: "permitted",
          automationPolicyEvidence: "old permission",
          automationPolicySource: "https://official.example/rules",
          automationPolicyLastVerifiedAt: new Date("2025-01-01"),
        },
        now,
      ),
    ).toBe("UNKNOWN"));
  it("fixtures or fixture platforms never count as real", () => {
    expect(isRealRecord({ fixture: true })).toBe(false);
    expect(isRealRecord({ fixture: false, platform: { fixture: true } })).toBe(
      false,
    );
    expect(isRealRecord({ fixture: false })).toBe(true);
  });
  it("real offer filters exclude development fixtures", () => {
    const base = {
      platform: { category: "sportsbook", fixture: false },
      offerType: "signup",
      result: { eligible: true, verificationState: "VERIFIED_FREE" as const },
      currentOpportunity: { claimState: "READY_TO_CLAIM" },
    };
    const all = [
      { ...base, fixture: false },
      { ...base, fixture: true },
    ];
    expect(filterOffers(all)).toEqual([all[0]]);
    expect(filterOffers(all, "fixtures")).toEqual([all[1]]);
  });
  it("lookalike domains are not official sources", () => {
    expect(
      officialSource(
        { homepageUrl: "https://www.platform.example" },
        "https://platform.example.attacker.test/rules",
      ),
    ).toBe(false);
    expect(
      officialSource(
        { homepageUrl: "https://www.platform.example" },
        "https://help.platform.example/rules",
      ),
    ).toBe(true);
  });
});
describe("recurring claim periods", () => {
  const daily = {
    id: "daily",
    offerType: "daily",
    recurringCadence: "daily",
    recurrenceTimezone: "America/Chicago",
    startDate: null,
    expirationDate: null,
  };
  it("today and tomorrow have different instance keys", () => {
    const today = opportunityFor(daily, now);
    const tomorrow = nextOpportunity(daily, now)!;
    expect(today.periodKey).not.toBe(tomorrow.periodKey);
    expect(tomorrow.availableDate).toEqual(new Date("2026-10-09T05:00:00Z"));
  });
  it("claimed today does not disable tomorrow", () => {
    const today = opportunityFor(daily, now);
    const next = nextOpportunity(daily, now)!;
    expect(effectiveClaimState({ ...today, claimState: "CLAIMED" }, now)).toBe(
      "CLAIMED",
    );
    expect(
      effectiveClaimState(
        { ...next, claimState: "UNCLAIMED" },
        next.availableDate,
      ),
    ).toBe("READY_TO_CLAIM");
  });
  it("weekly instances stay stable within a week", () => {
    const weekly = {
      ...daily,
      offerType: "weekly",
      recurringCadence: "weekly",
    };
    expect(opportunityFor(weekly, now).periodKey).toBe(
      opportunityFor(weekly, new Date("2026-10-09T17:00:00Z")).periodKey,
    );
  });
  it("daylight-saving end creates a 25-hour calendar day", () => {
    const period = opportunityFor(daily, new Date("2026-11-01T18:00:00Z"));
    expect(
      period.opportunityEndsAt!.getTime() - period.periodStart.getTime(),
    ).toBe(25 * 3600000);
  });
  it("expired unclaimed instances expire", () => {
    const period = opportunityFor(daily, now);
    expect(
      effectiveClaimState(
        { ...period, claimState: "UNCLAIMED" },
        period.opportunityEndsAt!,
      ),
    ).toBe("EXPIRED");
  });
  it("one-time offers have one stable key and no future instance", () => {
    const once = { ...daily, offerType: "signup", recurringCadence: null };
    expect(opportunityFor(once, now).periodKey).toBe("once");
    expect(nextOpportunity(once, now)).toBeNull();
  });
  it("no future recurrence generated after promotion expiry", () =>
    expect(
      nextOpportunity(
        { ...daily, expirationDate: new Date("2026-10-09T05:00:00Z") },
        now,
      ),
    ).toBeNull());
  it("redeemed is terminal and claiming twice is invalid", () => {
    expect(canTransitionClaim("CLAIMED", "CLAIMED")).toBe(false);
    expect(canTransitionClaim("REDEEMED", "CLAIMED")).toBe(false);
    expect(canTransitionClaim("READY_TO_CLAIM", "CLAIMED")).toBe(true);
  });
});
describe("value separation", () => {
  it("a face coin is not inferred to be a dollar", () =>
    expect(
      offerValue({
        promotionalAmount: "1",
        facePromotionalValue: "1",
        estimatedRedeemableValue: null,
      }),
    ).toEqual({
      facePromotionalValue: "1",
      estimatedRedeemableValue: null,
      actualRedeemedValue: null,
    }));
  it("unsupported estimate remains unknown", () =>
    expect(
      offerValue({
        promotionalAmount: "10",
        estimatedRedeemableValue: "10",
        valueMethod: "guess",
        valueEvidenceUrl: "https://official.example/rules",
      }).estimatedRedeemableValue,
    ).toBeNull());
  it("documented estimate and actual cash remain different fields", () => {
    const capturedAt = new Date();
    const evidence: Evidence[] = [
      {
        field: "estimatedRedeemableValue",
        sourceType: "official",
        sourceUrl: "https://official.example/rules",
        normalizedValue: "2",
        extractedText: "Synthetic value calculation evidence",
        capturedAt,
      },
    ];
    expect(
      offerValue(
        {
          promotionalAmount: "10",
          estimatedRedeemableValue: "2",
          valueMethod: "Conservative documented calculation",
          valueEvidenceUrl: "https://official.example/rules",
          evidence,
        },
        "1.25",
      ),
    ).toEqual({
      facePromotionalValue: "10",
      estimatedRedeemableValue: "2",
      actualRedeemedValue: "1.25",
    });
  });
  it("earnings do not convert promotional units to cash", () => {
    const result = earningsTotals(
      [
        {
          claimState: "CLAIMED",
          offerId: "o",
          actualRedeemedValue: null,
          promotionalValueReceived: "10",
        },
      ],
      [
        {
          id: "o",
          fixture: false,
          promotionalCurrency: "coins",
          platform: { fixture: false },
        },
      ],
      [],
      [],
    );
    expect(result.promotionalUnits.get("coins")).toBe(10);
    expect(result.actualRedeemedValue).toBe(0);
  });
  it("review patches preserve unknown rather than treating it as false", () => {
    expect(offerFactPatch("depositRequired", "unknown")).toEqual({
      depositRequired: null,
    });
    expect(offerFactPatch("depositRequired", "false")).toEqual({
      depositRequired: false,
    });
  });
  it("review patches validate structured Kansas geography", () => {
    expect(
      offerFactPatch(
        "geographicEligibility",
        JSON.stringify({
          countries: ["US"],
          states: ["KS"],
          excludedStates: [],
        }),
      ),
    ).toEqual({
      geographicEligibility: {
        countries: ["US"],
        states: ["KS"],
        excludedStates: [],
      },
    });
    expect(() => offerFactPatch("depositRequired", "0")).toThrow();
  });
});
