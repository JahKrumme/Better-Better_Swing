import Link from "next/link";
import { loadData } from "@/db/queries";
import { OfferCard } from "../offer-card";
export const dynamic = "force-dynamic";
export default async function Overview() {
  const d = await loadData();
  const real = d.offers.filter((o) => !o.fixture && !o.platform.fixture);
  const eligible = real.filter((o) => o.result.eligible);
  const available = eligible.filter(
    (o) => o.currentOpportunity.claimState === "READY_TO_CLAIM",
  );
  const groups = [
    ["AVAILABLE NOW", available],
    [
      "DAILY / RECURRING",
      eligible.filter((o) => ["daily", "weekly"].includes(o.offerType)),
    ],
    ["SIGNUP", eligible.filter((o) => o.offerType === "signup")],
    [
      "NEEDS VERIFICATION",
      real.filter((o) => o.result.verificationState === "NEEDS_VERIFICATION"),
    ],
    [
      "EXCLUDED",
      real.filter(
        (o) =>
          o.result.verificationState.startsWith("EXCLUDED") ||
          o.result.verificationState === "EXPIRED",
      ),
    ],
    ["AMOE", real.filter((o) => o.offerType === "amoe" || o.amoeAvailable)],
  ] as const;
  const unquantified = available.filter(
    (o) => o.value.facePromotionalValue === null,
  ).length;
  const units = new Map<string, number>();
  for (const o of available)
    if (o.value.facePromotionalValue !== null)
      units.set(
        o.promotionalCurrency,
        (units.get(o.promotionalCurrency) ?? 0) +
          Number(o.value.facePromotionalValue),
      );
  return (
    <>
      <p className="text-sm font-semibold muted">
        KANSAS · PRIMARY-SOURCE RESEARCH
      </p>
      <h1 className="mt-2 text-3xl font-bold">
        What can you collect without spending?
      </h1>
      <p className="my-4 muted">
        Profile: {d.profile.state}, {d.profile.country} · Age{" "}
        {d.profile.age ?? "not configured"} · Fliff excluded
      </p>
      <div className="my-8 grid gap-4 md:grid-cols-3">
        <div className="panel">
          <p className="muted">Verified real offers</p>
          <p className="mt-3 text-3xl font-bold">{eligible.length}</p>
        </div>
        <div className="panel">
          <p className="muted">Known promotional subtotal (separate units)</p>
          <p className="mt-3 font-bold">
            {units.size
              ? [...units].map(([unit, amount]) => (
                  <span className="block" key={unit}>
                    {amount} {unit}
                  </span>
                ))
              : unquantified
                ? "Verified opportunities exist; promotional amounts unknown"
                : "No verified promotional value"}
          </p>
          {unquantified > 0 && (
            <p className="mt-2 text-sm muted">
              {unquantified} verified opportunities have unknown promotional
              amounts; this subtotal is incomplete.
            </p>
          )}
        </div>
        <div className="panel">
          <p className="muted">Research candidates needing evidence</p>
          <p className="mt-3 text-3xl font-bold">
            {
              d.platforms.filter(
                (p) =>
                  !p.fixture &&
                  !p.excluded &&
                  p.researchState === "NEEDS_VERIFICATION",
              ).length
            }
          </p>
        </div>
      </div>
      <p className="mb-8 text-sm muted">
        No reward value is assumed from a platform name. Public-site access
        failures are recorded in the platform registry. Fictional fixtures never
        enter these totals. All claiming is manual.
      </p>
      <div className="space-y-8">
        {groups.map(([title, os]) => (
          <section key={title}>
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold">{title}</h2>
              <Link
                className="text-sm underline"
                href={`/offers?section=${encodeURIComponent(title)}`}
              >
                Review offers
              </Link>
            </div>
            {os.length ? (
              <div className="grid gap-5 lg:grid-cols-2">
                {os.map((o) => (
                  <OfferCard key={o.id} offer={o} />
                ))}
              </div>
            ) : (
              <div className="panel muted">
                {title === "NEEDS VERIFICATION" ? (
                  <>
                    No evidence-backed offer records yet.{" "}
                    <Link className="underline" href="/platforms">
                      Review candidate platforms and blocked sources.
                    </Link>
                  </>
                ) : title === "AMOE" ? (
                  "No AMOE terms have been verified. Postage or other costs will be classified separately as LOW_COST_AMOE."
                ) : (
                  "No established real opportunities in this section."
                )}
              </div>
            )}
          </section>
        ))}
      </div>
      <Link
        href="/offers?dataset=fixtures"
        className="mt-8 inline-block text-sm underline"
      >
        Development fixtures (separate from real research)
      </Link>
    </>
  );
}
