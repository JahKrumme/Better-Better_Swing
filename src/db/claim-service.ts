import { and, eq } from "drizzle-orm";
import { db } from "./index";
import { claims } from "./schema";
import {
  opportunityFor,
  nextOpportunity,
  effectiveClaimState,
  canTransitionClaim,
  type ClaimState,
} from "@/domain/recurrence";
import { loadData } from "./queries";
export async function recordManualClaim(
  offerId: string,
  now = new Date(),
  received: string | null = null,
) {
  if (received !== null && !/^\d{1,10}(\.\d{1,2})?$/.test(received))
    throw new Error("Invalid promotional amount received.");
  const data = await loadData();
  const o = data.offers.find((o) => o.id === offerId);
  if (!o || o.fixture || o.platform.fixture || !o.result.eligible)
    throw new Error(
      "Only currently verified, eligible real offers can be recorded as claimed.",
    );
  const opportunity = opportunityFor(o, now);
  if (
    effectiveClaimState({ ...opportunity, claimState: "UNCLAIMED" }, now) !==
    "READY_TO_CLAIM"
  )
    throw new Error("Reward is not currently available.");
  return db.transaction(async (tx) => {
    await tx
      .insert(claims)
      .values({
        ...opportunity,
        claimState: "READY_TO_CLAIM",
        method: "manual",
      })
      .onConflictDoNothing();
    const [c] = await tx
      .select()
      .from(claims)
      .where(
        and(
          eq(claims.offerId, offerId),
          eq(claims.periodKey, opportunity.periodKey),
        ),
      )
      .for("update");
    if (!c || !canTransitionClaim(effectiveClaimState(c, now), "CLAIMED"))
      throw new Error("This reward instance has already been claimed.");
    const [saved] = await tx
      .update(claims)
      .set({
        claimState: "CLAIMED",
        status: "claimed",
        claimedDate: now,
        promotionalValueReceived: received,
      })
      .where(eq(claims.id, c.id))
      .returning();
    const next = nextOpportunity(o, now);
    if (next)
      await tx
        .insert(claims)
        .values({ ...next, claimState: "UNCLAIMED", method: "manual" })
        .onConflictDoNothing();
    return saved;
  });
}
export async function changeManualClaimState(
  id: string,
  target: ClaimState,
  actual: string | null = null,
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    const [c] = await tx
      .select()
      .from(claims)
      .where(eq(claims.id, id))
      .for("update");
    if (!c || !canTransitionClaim(effectiveClaimState(c, now), target))
      throw new Error("Invalid manual claim transition.");
    if (
      target === "REDEEMED" &&
      (actual === null ||
        !Number.isFinite(Number(actual)) ||
        Number(actual) < 0)
    )
      throw new Error("Record the actual cash redeemed separately.");
    await tx
      .update(claims)
      .set({
        claimState: target,
        actualRedeemedValue:
          target === "REDEEMED" ? actual : c.actualRedeemedValue,
      })
      .where(eq(claims.id, id));
    // Claim cash is the manual instance ledger; redemptions remain separate historical records.
  });
}
