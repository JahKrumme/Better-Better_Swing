export function earningsTotals(
  claims: {
    id?: string;
    claimState: string;
    actualRedeemedValue: string | null;
    promotionalValueReceived: string | null;
    offerId: string;
  }[],
  offers: {
    id: string;
    fixture: boolean;
    promotionalCurrency: string;
    platform: { fixture?: boolean };
  }[],
  redemptions: {
    status: string;
    amount: string;
    completedDate: Date | null;
    claimId?: string | null;
    platformId: string;
  }[],
  platforms: { id: string; fixture: boolean }[],
) {
  const units = new Map<string, number>();
  let actual = 0;
  const recorded = new Set<string>();
  for (const c of claims) {
    const o = offers.find((o) => o.id === c.offerId);
    if (!o || o.fixture || o.platform.fixture) continue;
    if (
      ["CLAIMED", "PLAYTHROUGH_REQUIRED", "REDEEMABLE", "REDEEMED"].includes(
        c.claimState,
      ) &&
      c.promotionalValueReceived !== null
    )
      units.set(
        o.promotionalCurrency,
        (units.get(o.promotionalCurrency) ?? 0) +
          Number(c.promotionalValueReceived),
      );
    if (c.claimState === "REDEEMED" && c.actualRedeemedValue !== null)
      actual += Number(c.actualRedeemedValue);
  }
  for (const r of redemptions) {
    if (
      r.status !== "completed" ||
      !r.completedDate ||
      !platforms.some((p) => p.id === r.platformId && !p.fixture)
    )
      continue;
    if (r.claimId) {
      if (recorded.has(r.claimId)) continue;
      recorded.add(r.claimId);
      const c = claims.find((c) => c.id === r.claimId);
      if (c?.claimState === "REDEEMED" && c.actualRedeemedValue !== null)
        continue;
    }
    actual += Number(r.amount);
  }
  return { promotionalUnits: units, actualRedeemedValue: actual };
}
