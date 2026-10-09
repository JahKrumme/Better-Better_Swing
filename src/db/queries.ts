import { db } from "./index";
import {
  platforms,
  offers,
  offerEvidence,
  claims,
  redemptions,
  platformSources,
} from "./schema";
import { evaluateOfferEligibility } from "@/domain/eligibility";
import { getProfile } from "@/domain/profile";
import { automationPolicy } from "@/domain/verification";
import {
  opportunityFor,
  nextOpportunity,
  effectiveClaimState,
} from "@/domain/recurrence";
import { offerValue } from "@/domain/value";
export async function loadData() {
  const [ps, os, es, cs, rs, sources] = await Promise.all([
    db.select().from(platforms),
    db.select().from(offers),
    db.select().from(offerEvidence),
    db.select().from(claims),
    db.select().from(redemptions),
    db.select().from(platformSources),
  ]);
  const profile = getProfile();
  const now = new Date();
  const preparedPlatforms = ps.map((p) => {
    const ss = sources.filter((s) => s.platformId === p.id);
    const current = ss.filter(
      (s) =>
        s.sourceType === "official" &&
        s.outcome === "reviewed" &&
        s.retrievedAt <= now &&
        now.getTime() - s.retrievedAt.getTime() <= 30 * 86400000,
    );
    const facts = new Map<string, Set<string>>();
    for (const source of current) {
      const values = facts.get(source.field) ?? new Set<string>();
      if (source.normalizedValue !== null) values.add(source.normalizedValue);
      facts.set(source.field, values);
    }
    const policyConflict = (facts.get("automationPolicy")?.size ?? 0) > 1;
    const researchConflict = [...facts].some(
      ([field, values]) => field !== "automationPolicy" && values.size > 1,
    );
    return {
      ...p,
      sources: ss,
      researchConflict,
      effectiveAutomationPolicy: policyConflict
        ? "UNKNOWN"
        : automationPolicy(p, now),
    };
  });
  const evaluated = os.map((o) => {
    const platform = preparedPlatforms.find((p) => p.id === o.platformId)!;
    const evidence = es.filter((e) => e.offerId === o.id);
    const current = opportunityFor(o, now);
    const claim = cs.find(
      (c) => c.offerId === o.id && c.periodKey === current.periodKey,
    );
    return {
      ...o,
      platform,
      evidence,
      result: evaluateOfferEligibility(
        { ...o, platform, evidence },
        profile,
        now,
      ),
      value: offerValue({ ...o, evidence }),
      currentOpportunity: {
        ...current,
        claimState: claim
          ? effectiveClaimState(claim, now)
          : effectiveClaimState({ ...current, claimState: "UNCLAIMED" }, now),
        id: claim?.id ?? null,
      },
      nextOpportunity: nextOpportunity(o, now),
    };
  });
  return {
    platforms: preparedPlatforms.map((p) => ({
      ...p,
      researchState: p.excluded
        ? "EXCLUDED_PLATFORM"
        : p.researchConflict
          ? "NEEDS_VERIFICATION"
          : p.kansasAvailability === false || p.usAvailability === false
            ? "EXCLUDED_GEOGRAPHY"
            : evaluated.some((o) => o.platformId === p.id && o.result.eligible)
              ? "VERIFIED_FREE"
              : "NEEDS_VERIFICATION",
    })),
    offers: evaluated,
    claims: cs,
    redemptions: rs,
    profile,
  };
}
export type AppOffer = Awaited<ReturnType<typeof loadData>>["offers"][number];
