import type { VerificationState } from "./verification";
type Filterable = {
  fixture: boolean;
  platform: { fixture?: boolean; category: string };
  offerType: string;
  amoeAvailable?: boolean | null;
  result: { eligible: boolean; verificationState: VerificationState };
  currentOpportunity: { claimState: string };
};
export function filterOffers<T extends Filterable>(
  offers: T[],
  dataset = "real",
  filter = "all",
  section = "",
) {
  return offers
    .filter((o) =>
      dataset === "fixtures"
        ? o.fixture || o.platform.fixture
        : !o.fixture && !o.platform.fixture,
    )
    .filter(
      (o) =>
        filter === "all" ||
        o.offerType === filter ||
        o.platform.category === filter ||
        (filter === "sports" &&
          ["sportsbook", "prediction"].includes(o.platform.category)),
    )
    .filter((o) => {
      switch (section) {
        case "AVAILABLE NOW":
          return (
            o.result.eligible &&
            o.currentOpportunity.claimState === "READY_TO_CLAIM"
          );
        case "DAILY / RECURRING":
          return o.result.eligible && ["daily", "weekly"].includes(o.offerType);
        case "SIGNUP":
          return o.result.eligible && o.offerType === "signup";
        case "NEEDS VERIFICATION":
          return o.result.verificationState === "NEEDS_VERIFICATION";
        case "EXCLUDED":
          return (
            o.result.verificationState.startsWith("EXCLUDED") ||
            o.result.verificationState === "EXPIRED"
          );
        case "AMOE":
          return o.offerType === "amoe" || o.amoeAvailable === true;
        default:
          return true;
      }
    });
}
