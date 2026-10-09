import {
  hasEvidenceConflict,
  phase2EvidenceFields,
  type VerificationState,
} from "./verification";
import { classifyAMOE, type AMOE } from "./amoe";
export const moneyFields = [
  "depositRequired",
  "purchaseRequired",
  "paidWagerRequired",
  "subscriptionRequired",
  "monetaryContributionRequired",
] as const;
export const evidenceFields = [
  ...moneyFields,
  "minimumAge",
  "geographicEligibility",
  "signupRequired",
  "identityVerificationRequired",
  "rewardTerms",
] as const;
export type MoneyField = (typeof moneyFields)[number];
export type EvidenceField = (typeof evidenceFields)[number];
export type Evidence = {
  field: string;
  sourceUrl: string;
  sourceType: "official" | "secondary" | "fixture";
  extractedText: string;
  capturedAt: Date;
  normalizedValue?: string | null;
  conflicting?: boolean;
  supersededAt?: Date | null;
};
export type Profile = {
  country: string;
  state: string;
  age: number | null;
  excludedPlatforms: string[];
};
export type EligibilityOffer = Record<MoneyField, boolean | null> & {
  platform: {
    name: string;
    slug: string;
    excluded: boolean;
    exclusionReason: string | null;
    usAvailability?: boolean | null;
    kansasAvailability?: boolean | null;
    geographicRestrictions?: string[];
    fixture?: boolean;
    researchConflict?: boolean;
  };
  signupRequired: boolean | null;
  identityVerificationRequired: boolean | null;
  playthroughRequirement: string | null;
  minimumRedemption: string | null;
  minimumAge: number | null;
  geographicEligibility: {
    countries: string[];
    states: string[];
    excludedStates: string[];
  } | null;
  startDate: Date | null;
  expirationDate: Date | null;
  lastVerifiedAt: Date | null;
  evidence: Evidence[];
  fixture: boolean;
  researchVersion?: number;
  high5PublicReviewRequired?: boolean;
  publicReviewRequired?: boolean;
  entryFeeRequired?: boolean | null;
  offerType?: string;
} & AMOE;
export type EligibilityResult = {
  verificationState: VerificationState;
  amoeClassification: ReturnType<typeof classifyAMOE>;
  eligible: boolean;
  zeroOutOfPocket: boolean;
  reasons: string[];
  warnings: string[];
  valueWarnings: string[];
  status: "Verified Free" | "Needs Verification" | "Excluded" | "Expired";
};
const freshness = 30 * 24 * 60 * 60 * 1000;
export function evaluateOfferEligibility(
  offer: EligibilityOffer,
  profile: Profile,
  now = new Date(),
): EligibilityResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const valueWarnings: string[] = [];
  if (offer.publicReviewRequired)
    warnings.push(
      "Public offer terms changed: primary-source re-verification required.",
    );
  if (offer.high5PublicReviewRequired)
    warnings.push(
      "High 5 public terms changed: primary-source re-verification required.",
    );
  const excluded =
    offer.platform.excluded ||
    [offer.platform.slug, offer.platform.name].some((n) =>
      [
        "fliff",
        ...profile.excludedPlatforms.map((p) => p.trim().toLowerCase()),
      ].includes(n.trim().toLowerCase()),
    );
  if (excluded)
    reasons.push(
      offer.platform.exclusionReason ??
        "Platform excluded by profile or product policy.",
    );
  const structuredConflict = offer.evidence.some(
    (e) =>
      !e.supersededAt &&
      e.sourceType === "official" &&
      e.capturedAt <= now &&
      now.getTime() - e.capturedAt.getTime() <= 30 * 86400000 &&
      e.normalizedValue !== null &&
      e.normalizedValue !== undefined &&
      [
        ...moneyFields,
        "entryFeeRequired",
        "minimumAge",
        "signupRequired",
        "identityVerificationRequired",
        "postageRequired",
        "amoeOtherUserCost",
        "minimumRedemption",
      ].includes(e.field) &&
      e.field in offer &&
      (["amoeOtherUserCost", "minimumRedemption", "minimumAge"].includes(
        e.field,
      ) && offer[e.field as keyof EligibilityOffer] !== null
        ? !Number.isFinite(Number(e.normalizedValue)) ||
          Number(e.normalizedValue) !==
            Number(offer[e.field as keyof EligibilityOffer])
        : e.normalizedValue.trim().toLowerCase() !==
          String(offer[e.field as keyof EligibilityOffer])
            .trim()
            .toLowerCase()),
  );
  const conflict =
    hasEvidenceConflict(offer.evidence, now) || structuredConflict;
  const amoeClassification = classifyAMOE(offer);
  const version2 = offer.researchVersion === 2 && !offer.fixture;
  if (offer.entryFeeRequired === true)
    reasons.push("Entry fee requires user money.");
  if (offer.amoeAvailable === true) {
    if (amoeClassification === "LOW_COST_AMOE")
      reasons.push(
        "AMOE requires postage or other user costs; not literally $0.",
      );
    if (amoeClassification === "NEEDS_VERIFICATION")
      warnings.push("AMOE costs or method unknown.");
  }
  if (offer.platform.researchConflict)
    warnings.push("Conflicting platform facts require verification.");
  if (!offer.fixture && offer.platform.fixture)
    warnings.push("Real offer is associated with a fictional platform.");
  if (conflict) warnings.push("Conflicting official evidence requires review.");
  const paid = moneyFields.filter((field) => offer[field] === true);
  for (const field of paid) reasons.push(`${field}: user funds required.`);
  const expired =
    !!offer.expirationDate && offer.expirationDate.getTime() <= now.getTime();
  if (expired) reasons.push("Offer expired.");
  if (offer.startDate && offer.startDate > now)
    warnings.push("Offer has not started.");
  if (offer.platform.usAvailability === false && profile.country === "US")
    reasons.push("Platform unavailable in United States.");
  if (offer.platform.geographicRestrictions?.includes(profile.state))
    reasons.push("Platform restriction excludes your state.");
  const supported = (field: string, normalizedValue?: string) =>
    offer.evidence.some(
      (e) =>
        e.field === field &&
        (normalizedValue === undefined ||
          e.normalizedValue?.trim().toLowerCase() === normalizedValue) &&
        !e.supersededAt &&
        (e.sourceType === "official" ||
          (offer.fixture && e.sourceType === "fixture")) &&
        /^https:\/\//.test(e.sourceUrl) &&
        e.extractedText.trim().length > 0 &&
        e.capturedAt <= now &&
        now.getTime() - e.capturedAt.getTime() <= freshness,
    );
  // A proven purchase-free prize path can establish existence while its
  // numerical redemption conditions remain unknown. Legacy records retain
  // their original requirements; no acquisition/geo/age check is relaxed.
  const quantifiedFields = ["playthroughRequirement", "minimumRedemption"];
  const provenFreeRedemptionPath =
    version2 &&
    supported("redemptionMechanism") &&
    supported("redemptionWithoutPurchase", "true");
  if (
    version2 &&
    offer.evidence.some(
      (e) => e.field === "redemptionMechanism" && !e.supersededAt,
    ) &&
    !supported("redemptionWithoutPurchase", "true")
  )
    warnings.push(
      "Missing current primary evidence: purchase-free redemption path.",
    );
  for (const field of [
    "signupRequired",
    "identityVerificationRequired",
    "playthroughRequirement",
    "minimumRedemption",
  ] as const)
    if (offer[field] === null)
      (provenFreeRedemptionPath && quantifiedFields.includes(field)
        ? valueWarnings
        : warnings
      ).push(`${field}: terms unknown.`);
  if (offer.platform.kansasAvailability === false && profile.state === "KS")
    reasons.push("Platform restriction excludes Kansas.");
  if (offer.offerType === "amoe" && offer.amoeAvailable !== true)
    warnings.push("AMOE availability is unknown.");
  const geo = offer.geographicEligibility;
  if (!geo || !geo.countries.length)
    warnings.push("Geographic eligibility unknown.");
  else if (
    !geo.countries.includes(profile.country) ||
    geo.excludedStates.includes(profile.state) ||
    (geo.states.length > 0 && !geo.states.includes(profile.state))
  )
    reasons.push("Geographic restriction excludes your location.");
  if (profile.age === null || offer.minimumAge === null)
    warnings.push("Age eligibility unknown.");
  else if (profile.age < offer.minimumAge) reasons.push("Minimum age not met.");
  if (
    !offer.lastVerifiedAt ||
    now.getTime() - offer.lastVerifiedAt.getTime() > freshness ||
    offer.lastVerifiedAt > now
  )
    warnings.push("Terms verification is missing or stale.");
  if (version2) {
    if (offer.entryFeeRequired === null || offer.entryFeeRequired === undefined)
      warnings.push("entryFeeRequired: unknown.");
    for (const field of phase2EvidenceFields)
      if (
        (field !== "expirationDate" || offer.expirationDate !== null) &&
        !supported(field)
      )
        (provenFreeRedemptionPath && quantifiedFields.includes(field)
          ? valueWarnings
          : warnings
        ).push(`Missing current primary evidence: ${field}.`);
    if (offer.amoeAvailable === true)
      for (const field of [
        "amoeMethod",
        "postageRequired",
        "amoeOtherUserCost",
      ])
        if (!supported(field))
          warnings.push(`Missing current primary AMOE evidence: ${field}.`);
  }
  for (const field of evidenceFields)
    if (!supported(field))
      warnings.push(`Missing current reliable evidence: ${field}.`);
  for (const field of moneyFields)
    if (offer[field] === null) warnings.push(`${field}: unknown.`);
  const zeroOutOfPocket =
    !conflict &&
    offer.entryFeeRequired !== true &&
    amoeClassification !== "LOW_COST_AMOE" &&
    (offer.amoeAvailable !== true || amoeClassification === "ZERO_COST_AMOE") &&
    (!version2 ||
      (offer.entryFeeRequired === false &&
        supported("entryFeeRequired") &&
        supported("acquisition"))) &&
    moneyFields.every((field) => offer[field] === false && supported(field)) &&
    !!offer.lastVerifiedAt &&
    offer.lastVerifiedAt <= now &&
    now.getTime() - offer.lastVerifiedAt.getTime() <= freshness;
  const eligible =
    reasons.length === 0 && warnings.length === 0 && zeroOutOfPocket;
  const geographic = reasons.some(
    (r) =>
      r.includes("Geographic restriction") ||
      r.includes("Platform unavailable") ||
      r.includes("Platform restriction"),
  );
  const requiresMoney =
    paid.length > 0 ||
    offer.entryFeeRequired === true ||
    amoeClassification === "LOW_COST_AMOE";
  const verificationState: VerificationState = excluded
    ? "EXCLUDED_PLATFORM"
    : expired
      ? "EXPIRED"
      : conflict
        ? "NEEDS_VERIFICATION"
        : requiresMoney
          ? "EXCLUDED_REQUIRES_MONEY"
          : geographic
            ? "EXCLUDED_GEOGRAPHY"
            : reasons.length
              ? "EXCLUDED_PLATFORM"
              : eligible
                ? "VERIFIED_FREE"
                : "NEEDS_VERIFICATION";
  return {
    verificationState,
    amoeClassification,
    eligible: eligible && verificationState === "VERIFIED_FREE",
    zeroOutOfPocket,
    reasons,
    warnings,
    valueWarnings,
    status:
      conflict && !excluded && !expired
        ? "Needs Verification"
        : expired
          ? "Expired"
          : reasons.length
            ? "Excluded"
            : eligible
              ? "Verified Free"
              : "Needs Verification",
  };
}
