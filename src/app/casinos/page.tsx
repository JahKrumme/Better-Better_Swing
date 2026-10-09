import { loadProduct } from "@/db/product-service";
import { PlatformCard } from "../product/display";
export const dynamic = "force-dynamic";
export default async function Casinos() {
  const d = await loadProduct();
  return (
    <>
      <p className="eyebrow">FREE CASINO REWARDS</p>
      <h1>Casinos</h1>
      <p className="intro">
        Collect free promotional currency, track requirements, and stop playing
        when you can redeem.
      </p>
      <div className="cards">
        {d.cards
          .filter((c) => c.account?.engine === "CASINO")
          .map((c) => (
            <PlatformCard key={c.platform.id} card={c} />
          ))}
      </div>
      <details className="research-disclosure">
        <summary>Still being researched</summary>
        <p className="muted">
          These are not verified free opportunities. Availability or terms still
          need confirmation.
        </p>
        {d.research
          .filter((p) => p.category === "sweepstakes_casino")
          .map((p) => (
            <p key={p.id}>{p.name} · Needs verification</p>
          ))}
      </details>
    </>
  );
}
