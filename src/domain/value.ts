import { currentEvidence } from "./verification";
import type { Evidence } from "./eligibility";
export function offerValue(
  offer: {
    facePromotionalValue?: string | null;
    promotionalAmount: string | null;
    estimatedRedeemableValue?: string | null;
    valueMethod?: string | null;
    valueEvidenceUrl?: string | null;
    researchVersion?: number;
    evidence?: Evidence[];
  },
  actualRedeemedValue: string | null = null,
) {
  return {
    facePromotionalValue: offer.facePromotionalValue ?? offer.promotionalAmount,
    estimatedRedeemableValue:
      offer.estimatedRedeemableValue &&
      offer.valueMethod?.trim() &&
      offer.valueEvidenceUrl?.startsWith("https://") &&
      currentEvidence(offer.evidence ?? [], new Date()).some(
        (e) =>
          e.sourceType === "official" &&
          e.field === "estimatedRedeemableValue" &&
          e.sourceUrl === offer.valueEvidenceUrl &&
          e.normalizedValue !== null &&
          e.normalizedValue !== undefined &&
          Number.isFinite(Number(e.normalizedValue)) &&
          Number(e.normalizedValue) ===
            Number(offer.estimatedRedeemableValue) &&
          !e.conflicting,
      )
        ? offer.estimatedRedeemableValue
        : null,
    actualRedeemedValue,
  };
}
