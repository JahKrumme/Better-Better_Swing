export const claimStates = [
  "UNCLAIMED",
  "READY_TO_CLAIM",
  "CLAIMED",
  "PLAYTHROUGH_REQUIRED",
  "REDEEMABLE",
  "REDEEMED",
  "EXPIRED",
] as const;
export type ClaimState = (typeof claimStates)[number];
type RecurringOffer = {
  id: string;
  offerType: string;
  recurringCadence: string | null;
  recurrenceTimezone?: string;
  startDate: Date | null;
  expirationDate: Date | null;
  discoveredAt?: Date;
  recurrenceAnchor?: Date | null;
};
function calendarDate(date: Date, zone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
function addDays(date: string, days: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function midnight(date: string, zone: string) {
  const target = Date.parse(date + "T00:00:00Z");
  let value = target;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(value));
    const p = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    const wall = Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour),
      Number(p.minute),
      Number(p.second),
    );
    value += target - wall;
  }
  return new Date(value);
}
export function opportunityFor(offer: RecurringOffer, now = new Date()) {
  const zone = offer.recurrenceTimezone ?? "America/Chicago";
  const cadence = offer.recurringCadence ?? offer.offerType;
  let date = calendarDate(now, zone);
  if (cadence === "weekly") {
    const day = new Date(date + "T12:00:00Z").getUTCDay();
    date = addDays(date, -((day + 6) % 7));
  }
  const recurring = ["daily", "weekly"].includes(cadence);
  const periodStart = recurring
    ? midnight(date, zone)
    : (offer.startDate ?? offer.discoveredAt ?? now);
  const end = recurring
    ? midnight(addDays(date, cadence === "weekly" ? 7 : 1), zone)
    : offer.expirationDate;
  const opportunityEndsAt =
    offer.expirationDate && (!end || offer.expirationDate < end)
      ? offer.expirationDate
      : end;
  const availableDate =
    offer.startDate && offer.startDate > periodStart
      ? offer.startDate
      : periodStart;
  return {
    offerId: offer.id,
    periodKey: recurring ? `${cadence}:${zone}:${date}` : "once",
    periodStart,
    availableDate,
    opportunityEndsAt,
  };
}
export function nextOpportunity(offer: RecurringOffer, now = new Date()) {
  const current = opportunityFor(offer, now);
  if (
    offer.expirationDate &&
    current.opportunityEndsAt &&
    offer.expirationDate <= current.opportunityEndsAt
  )
    return null;
  return current.opportunityEndsAt &&
    ["daily", "weekly"].includes(offer.recurringCadence ?? offer.offerType)
    ? opportunityFor(offer, new Date(current.opportunityEndsAt.getTime() + 1))
    : null;
}
export function effectiveClaimState(
  claim: {
    claimState: string;
    availableDate: Date | null;
    opportunityEndsAt: Date | null;
  },
  now = new Date(),
): ClaimState {
  if (
    ["CLAIMED", "PLAYTHROUGH_REQUIRED", "REDEEMABLE", "REDEEMED"].includes(
      claim.claimState,
    )
  )
    return claim.claimState as ClaimState;
  if (claim.opportunityEndsAt && claim.opportunityEndsAt <= now)
    return "EXPIRED";
  if (!claim.availableDate || claim.availableDate > now) return "UNCLAIMED";
  return "READY_TO_CLAIM";
}
const transitions: Record<ClaimState, ClaimState[]> = {
  UNCLAIMED: ["READY_TO_CLAIM", "EXPIRED"],
  READY_TO_CLAIM: ["CLAIMED", "EXPIRED"],
  CLAIMED: ["PLAYTHROUGH_REQUIRED", "REDEEMABLE", "EXPIRED"],
  PLAYTHROUGH_REQUIRED: ["REDEEMABLE", "EXPIRED"],
  REDEEMABLE: ["REDEEMED", "EXPIRED"],
  REDEEMED: [],
  EXPIRED: [],
};
export function canTransitionClaim(from: ClaimState, to: ClaimState) {
  return transitions[from].includes(to);
}
