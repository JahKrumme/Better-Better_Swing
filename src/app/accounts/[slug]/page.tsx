import Link from "next/link";
import { displayUnit } from "@/domain/product";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { loadProduct } from "@/db/product-service";
import { PlatformCard, time } from "../../product/display";
import { QuickForm, PlayForm, RedemptionForm } from "../../product/forms";
export const dynamic = "force-dynamic";
export default async function Account({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params,
    d = await loadProduct(),
    c = d.cards.find((c) => c.platform.slug === slug);
  if (!c?.account) notFound();
  return (
    <>
      <Link className="text-link" href="/">
        ← Home
      </Link>
      <h1>{c.platform.name}</h1>
      <div className="account-layout">
        <PlatformCard card={c} />
        <section className="panel">
          <h2>Quick update</h2>
          <p className="muted">Enter what you actually saw on the platform.</p>
          <QuickForm
            accountId={c.account.id}
            currency={displayUnit(c.currency)}
            submissionKey={randomUUID()}
          />
        </section>
      </div>
      <section className="panel">
        <h2>Playthrough and redemption</h2>
        {(c.redeemable !== null && c.redeemable > 0) || c.pending > 0 ? (
          <p className="stop">STOP PLAYING · redeem the available balance.</p>
        ) : (
          <p>
            Game recommendation: insufficient verified game data. No automated
            play is available.
          </p>
        )}
        <p className="muted">
          Playable: {c.playable ?? "Unknown"} · Playthrough remaining:{" "}
          {c.remaining ?? "Unknown"}
        </p>
        <details>
          <summary>Record already-performed manual play</summary>
          <PlayForm accountId={c.account.id} submissionKey={randomUUID()} />
        </details>
        <details open={c.status.kind === "REDEEM_NOW"}>
          <summary>Record a redemption request or result</summary>
          {c.redemptions.map((r) => (
            <p className="small" key={r.id}>
              {r.requestedSC} {displayUnit(c.currency)} ·{" "}
              {r.status.toLowerCase()} · requested {time(r.requestedAt)} ·
              actual USD {r.receivedUSD ?? "unknown"}
            </p>
          ))}
          <RedemptionForm
            accountId={c.account.id}
            submissionKey={randomUUID()}
            currency={displayUnit(c.currency)}
            requests={c.redemptions.map((r) => ({
              id: r.id,
              amount: r.requestedSC,
              status: r.status,
              received: r.receivedUSD,
              requestedAt: r.requestedAt
                .toLocaleString("sv-SE", { timeZone: "America/Chicago" })
                .replace(" ", "T")
                .slice(0, 16),
            }))}
          />
        </details>
      </section>
    </>
  );
}
