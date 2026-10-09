import { describe, it, expect } from "vitest";
import { offerInput, platformInput } from "./research";
import { evidenceFields, moneyFields } from "./eligibility";
function input() {
  return {
    platformId: "00000000-0000-4000-8000-000000000001",
    title: "Manual example",
    description: "A manually recorded test",
    offerType: "signup",
    promotionalAmount: "10",
    promotionalCurrency: "bonus credits",
    estimatedCashValue: "",
    minimumRedemption: "20",
    playthroughRequirement: "1x",
    sourceUrl: "https://test.example/terms",
    minimumAge: "21",
    signupRequired: "yes",
    identityVerificationRequired: "yes",
    ...Object.fromEntries(moneyFields.map((f) => [f, "no"])),
    countries: "US",
    states: "KS",
    excludedStates: "",
    startDate: "",
    expirationDate: "",
    sourceType: "official",
    capturedAt: "2026-10-08",
    ...Object.fromEntries(
      evidenceFields.map((f) => [`evidence_${f}`, "Exact excerpt"]),
    ),
  };
}
describe("manual research validation", () => {
  it("accepts a platform with optional blank URLs", () =>
    expect(
      platformInput.safeParse({
        name: "Example manual platform",
        slug: "manual",
        homepageUrl: "https://manual.example",
        category: "sportsbook",
        termsUrl: "",
        promotionsUrl: "",
      }).success,
    ).toBe(true));
  it("invalid URLs return errors without throwing", () =>
    expect(
      offerInput.safeParse({ ...input(), sourceUrl: "nonsense" }).success,
    ).toBe(false));
  it("normalizes explicit free terms and unknown cash estimate", () => {
    const result = offerInput.parse(input());
    expect(result.depositRequired).toBe(false);
    expect(result.estimatedCashValue).toBeNull();
    expect(result.minimumAge).toBe(21);
  });
  it("unknown monetary terms stay null", () =>
    expect(
      offerInput.parse({ ...input(), depositRequired: "unknown" })
        .depositRequired,
    ).toBeNull());
  it("rejects a malformed boolean instead of assuming no", () =>
    expect(
      offerInput.safeParse({ ...input(), purchaseRequired: "false" }).success,
    ).toBe(false));
  it("rejects negative estimated values", () =>
    expect(
      offerInput.safeParse({ ...input(), estimatedCashValue: "-10" }).success,
    ).toBe(false));
  it("rejects non-HTTPS sources", () =>
    expect(
      offerInput.safeParse({ ...input(), sourceUrl: "http://test.example" })
        .success,
    ).toBe(false));
  it("rejects invalid capture dates", () =>
    expect(
      offerInput.safeParse({ ...input(), capturedAt: "nonsense" }).success,
    ).toBe(false));
  it("rejects future evidence", () =>
    expect(
      offerInput.safeParse({ ...input(), capturedAt: "2999-01-01" }).success,
    ).toBe(false));
  it("rejects reversed offer dates", () =>
    expect(
      offerInput.safeParse({
        ...input(),
        startDate: "2026-10-10",
        expirationDate: "2026-10-09",
      }).success,
    ).toBe(false));
  it("rejects fixture classification for research evidence", () =>
    expect(
      offerInput.safeParse({ ...input(), sourceType: "fixture" }).success,
    ).toBe(false));
  it("rejects Fliff from manual registry", () =>
    expect(
      platformInput.safeParse({
        name: "Fliff",
        slug: "fliff",
        homepageUrl: "https://fliff.example",
        category: "sportsbook",
        termsUrl: "",
        promotionsUrl: "",
      }).success,
    ).toBe(false));
});
