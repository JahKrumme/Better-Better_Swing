export type AMOE = {
  amoeAvailable?: boolean | null;
  amoeMethod?: string | null;
  postageRequired?: boolean | null;
  amoeOtherUserCost?: string | null;
};
export function classifyAMOE(
  offer: AMOE,
): "NOT_AMOE" | "ZERO_COST_AMOE" | "LOW_COST_AMOE" | "NEEDS_VERIFICATION" {
  if (offer.amoeAvailable !== true)
    return offer.amoeAvailable === false ? "NOT_AMOE" : "NEEDS_VERIFICATION";
  if (
    offer.postageRequired === true ||
    (offer.amoeOtherUserCost !== null &&
      offer.amoeOtherUserCost !== undefined &&
      Number(offer.amoeOtherUserCost) > 0)
  )
    return "LOW_COST_AMOE";
  if (
    !offer.amoeMethod ||
    offer.postageRequired !== false ||
    offer.amoeOtherUserCost === null ||
    offer.amoeOtherUserCost === undefined ||
    !Number.isFinite(Number(offer.amoeOtherUserCost))
  )
    return "NEEDS_VERIFICATION";
  return Number(offer.amoeOtherUserCost) === 0
    ? "ZERO_COST_AMOE"
    : "NEEDS_VERIFICATION";
}
