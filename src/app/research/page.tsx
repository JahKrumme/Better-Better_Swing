import { loadData } from "@/db/queries";
import { EvidenceForms } from "./evidence-forms";
import { ResearchForms } from "./forms";
export const dynamic = "force-dynamic";
export default async function Research() {
  const d = await loadData();
  return (
    <>
      <h1 className="mb-3 text-3xl font-bold">Admin / Research</h1>
      <p className="mb-6 muted">
        Local manual entry. No automated discovery, logins, claims, or wagers.
        Do not enter passwords, cookies, or identity documents.
      </p>
      <EvidenceForms
        offers={d.offers.filter((o) => !o.fixture)}
        evidence={d.offers
          .filter((o) => !o.fixture)
          .flatMap((o) => o.evidence.filter((e) => !e.supersededAt))}
        platforms={d.platforms.filter((p) => !p.fixture && !p.excluded)}
      />
      <ResearchForms
        platforms={d.platforms.filter((p) => !p.fixture && !p.excluded)}
      />
    </>
  );
}
