import { loadData } from "@/db/queries";
import { effectiveClaimState } from "@/domain/recurrence";
import { ClaimUpdate } from "./forms";
export const dynamic = "force-dynamic";
export default async function Claims() {
  const d = await loadData();
  const rows = d.claims.filter((c) => {
    const o = d.offers.find((o) => o.id === c.offerId);
    return o && !o.fixture && !o.platform.fixture;
  });
  return (
    <>
      <h1 className="mb-3 text-3xl font-bold">Manual claim instances</h1>
      <p className="mb-6 muted">
        This is a personal record, not a platform action. Recording a claim
        contacts no gaming platform. Each daily or weekly period has its own
        instance; claiming today leaves tomorrow&apos;s reward intact.
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        {rows.map((c) => (
          <article className="panel" key={c.id}>
            <h2 className="text-xl font-bold">
              {d.offers.find((o) => o.id === c.offerId)?.title}
            </h2>
            <p className="my-3">
              {effectiveClaimState(c)} · {c.periodKey ?? "Legacy instance"}
            </p>
            <p className="text-sm muted">
              Available{" "}
              {c.availableDate?.toLocaleString("en-US", {
                timeZone: "America/Chicago",
              }) ?? "unknown"}{" "}
              (America/Chicago)
            </p>
            <p className="mt-3 text-sm">
              Promotional value received:{" "}
              {c.promotionalValueReceived ?? "not recorded"} · Actual cash
              redeemed:{" "}
              {c.actualRedeemedValue === null
                ? "not recorded"
                : `$${c.actualRedeemedValue}`}
            </p>
            {["CLAIMED", "PLAYTHROUGH_REQUIRED", "REDEEMABLE"].includes(
              c.claimState,
            ) && <ClaimUpdate id={c.id} />}
          </article>
        ))}
      </div>
      {!rows.length && (
        <div className="panel muted">
          No manual claims recorded. Claim buttons appear on verified, eligible
          real offer records.
        </div>
      )}
    </>
  );
}
