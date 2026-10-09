import Link from "next/link";
import { loadData } from "@/db/queries";
import { filterOffers } from "@/domain/offer-filters";
import { OfferCard } from "../offer-card";
export const dynamic = "force-dynamic";
const filters = [
  ["all", "All"],
  ["signup", "Signup"],
  ["daily", "Daily"],
  ["weekly", "Weekly"],
  ["limited_time", "Limited-time"],
  ["amoe", "AMOE"],
  ["giveaway", "Giveaway"],
  ["sports", "Sports"],
  ["sweepstakes_casino", "Sweepstakes Casino"],
];
export default async function Offers({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string;
    dataset?: string;
    section?: string;
  }>;
}) {
  const p = await searchParams;
  const dataset = p.dataset === "fixtures" ? "fixtures" : "real";
  const d = await loadData();
  const os = filterOffers(
    d.offers,
    dataset,
    p.filter ?? "all",
    p.section ?? "",
  );
  return (
    <>
      <h1 className="text-3xl font-bold">
        {dataset === "fixtures"
          ? "Fictional development fixtures"
          : "Real offer research"}
      </h1>
      <p className="mt-3 muted">
        {dataset === "fixtures"
          ? "These examples do not exist and never contribute to available rewards or earnings."
          : "No real promotion is invented from a platform name. Missing primary terms remain unverified."}
      </p>
      <div className="my-4 flex gap-4 text-sm underline">
        <Link href="/offers">Real research</Link>
        <Link href="/offers?dataset=fixtures">Fictional fixtures</Link>
      </div>
      <nav aria-label="Offer filters" className="my-6 flex flex-wrap gap-2">
        {filters.map(([key, label]) => (
          <Link
            key={key}
            href={`/offers?dataset=${dataset}&filter=${key}`}
            aria-current={key === (p.filter ?? "all") ? "page" : undefined}
            className={`rounded-full border px-4 py-2 text-sm ${key === (p.filter ?? "all") ? "bg-green-900 text-white" : "bg-white"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {p.section && <p className="mb-5 font-semibold">Section: {p.section}</p>}
      <div className="grid gap-5 lg:grid-cols-2">
        {os.map((o) => (
          <OfferCard key={o.id} offer={o} />
        ))}
        {!os.length && (
          <div className="panel">
            <p>No evidence-backed offers match this section.</p>
            <Link href="/platforms" className="mt-4 block underline">
              Inspect candidate platforms and access observations
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
