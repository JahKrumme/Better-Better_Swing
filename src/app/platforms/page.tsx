import Link from "next/link";
import { loadData } from "@/db/queries";
export const dynamic = "force-dynamic";
export default async function Platforms({
  searchParams,
}: {
  searchParams: Promise<{ dataset?: string }>;
}) {
  const p = await searchParams;
  const d = await loadData();
  const fixture = p.dataset === "fixtures";
  const ps = d.platforms.filter((p) => p.fixture === fixture);
  return (
    <>
      <h1 className="mb-3 text-3xl font-bold">
        {fixture ? "Fictional platform fixtures" : "Platform research registry"}
      </h1>
      <p className="mb-4 muted">
        Candidates are not endorsements. Current legitimacy, Kansas eligibility,
        and reward rules require primary-source verification. A blocked homepage
        request proves none of those facts.
      </p>
      <div className="mb-6 flex gap-4 text-sm underline">
        <Link href="/platforms">Real candidates</Link>
        <Link href="/platforms?dataset=fixtures">Fictional fixtures</Link>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {ps.map((p) => (
          <article key={p.id} className="panel">
            <p className="text-xs font-bold muted">
              {p.category} · {p.researchState} {p.fixture ? "· FICTIONAL" : ""}
            </p>
            <h2 className="my-3 text-xl font-bold">{p.name}</h2>
            <a
              href={p.homepageUrl}
              className="text-sm underline break-all"
              target="_blank"
              rel="noreferrer"
            >
              Candidate homepage: {p.homepageUrl}
            </a>
            <dl className="my-4 grid grid-cols-2 gap-3 text-sm">
              {[
                [
                  "KANSAS",
                  p.kansasAvailability === null
                    ? "Unknown"
                    : p.kansasAvailability
                      ? "Appears available"
                      : "Excluded",
                ],
                [
                  "UNITED STATES",
                  p.usAvailability === null
                    ? "Unknown"
                    : p.usAvailability
                      ? "Appears available"
                      : "Excluded",
                ],
                ["MINIMUM AGE", p.minimumAge ?? "Unknown"],
                ["SIGNUP REWARD", p.freeSignupReward ?? "Unknown"],
                ["RECURRING REWARD", p.recurringFreeReward ?? "Unknown"],
                [
                  "AMOE",
                  p.amoeAvailable === null
                    ? "Unknown"
                    : p.amoeAvailable
                      ? "Available per terms"
                      : "Not available",
                ],
                ["REDEMPTION MINIMUM", p.minimumRedemption ?? "Unknown"],
                ["PLAYTHROUGH", p.playthroughRequirement ?? "Unknown"],
                [
                  "IDENTITY VERIFICATION",
                  p.identityVerificationRequired === null
                    ? "Unknown"
                    : p.identityVerificationRequired
                      ? "Required"
                      : "Not required",
                ],
                ["AUTOMATION POLICY", p.effectiveAutomationPolicy],
                [
                  "LAST VERIFIED",
                  p.lastVerifiedAt?.toISOString().slice(0, 10) ??
                    "Not verified",
                ],
                [
                  "VERIFIED FREE OFFERS",
                  d.offers.filter(
                    (o) => o.platformId === p.id && o.result.eligible,
                  ).length,
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-bold muted">{label}</dt>
                  <dd className="mt-1">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm muted">
              {p.exclusionReason ?? p.researchNotes}
            </p>
            <div className="my-4 text-sm">
              {[
                ["Terms", p.termsUrl],
                ["Sweepstakes / promotional rules", p.rulesUrl],
                ["Rewards / promotions", p.promotionsUrl],
              ].map(([label, url]) => (
                <p key={label}>
                  {label}:{" "}
                  {url ? (
                    <a
                      className="underline break-all"
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {url}
                    </a>
                  ) : (
                    "Not retrieved"
                  )}
                </p>
              ))}
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold">
                Research sources and access observations ({p.sources.length})
              </summary>
              {p.sources.map((s) => (
                <div key={s.id} className="mt-3">
                  <strong>{s.outcome.toUpperCase()}</strong> · {s.field} ·{" "}
                  {s.retrievedAt.toISOString().slice(0, 10)}
                  <p>{s.extractedText ?? s.notes}</p>
                  <a
                    href={s.sourceUrl}
                    className="underline break-all"
                    rel="noreferrer"
                    target="_blank"
                  >
                    {s.sourceUrl}
                  </a>
                </div>
              ))}
            </details>
          </article>
        ))}
      </div>
    </>
  );
}
