import Link from "next/link";
import { ProfileForm } from "../product/forms";
import { db } from "@/db";
import { attentionItems, productRuns, publicDocuments } from "@/db/schema";
import { desc } from "drizzle-orm";
export const dynamic = "force-dynamic";
export default async function Advanced() {
  const [runs, attention, docs] = await Promise.all([
    db
      .select()
      .from(productRuns)
      .orderBy(desc(productRuns.startedAt))
      .limit(20),
    db.select().from(attentionItems),
    db
      .select()
      .from(publicDocuments)
      .orderBy(desc(publicDocuments.retrievedAt))
      .limit(40),
  ]);
  return (
    <>
      <h1>Advanced</h1>
      <p className="intro">
        Research, accounting details, controls, experiments and technical
        diagnostics.
      </p>
      <details>
        <summary>Eligibility settings</summary>
        <ProfileForm />
      </details>
      <div className="advanced-links">
        {[
          ["/advanced/today", "Detailed operations"],
          ["/advanced/casinos", "Casino strategy controls"],
          ["/advanced/sportsbook", "Sportsbook research"],
          ["/high5", "High 5 experiment"],
          ["/research", "Research administration"],
          ["/platforms", "Candidate registry"],
          ["/offers", "Offer evidence"],
          ["/bankroll", "Detailed accounting"],
          ["/overview", "Detailed overview"],
          ["/earnings", "Detailed analytics"],
          ["/claims", "Legacy claim records"],
          ["/demo", "Isolated fictional simulation"],
        ].map(([href, label]) => (
          <Link className="panel" key={href} href={href}>
            {label} →
          </Link>
        ))}
      </div>
      <details>
        <summary>Local runner diagnostics</summary>
        <pre>{JSON.stringify(runs, null, 2)}</pre>
      </details>
      <details>
        <summary>Attention queue (local, no external notifications)</summary>
        <pre>{JSON.stringify(attention, null, 2)}</pre>
      </details>
      <details>
        <summary>Public research captures</summary>
        <pre>{JSON.stringify(docs, null, 2)}</pre>
      </details>
    </>
  );
}
