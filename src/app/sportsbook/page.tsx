import { loadProduct } from "@/db/product-service";
import { PlatformCard } from "../product/display";
export const dynamic = "force-dynamic";
export default async function Sportsbooks() {
  const d = await loadProduct();
  const cards = d.cards.filter((c) => c.account?.engine === "SPORTSBOOK");
  return (
    <>
      <p className="eyebrow">FREE BETTING CREDITS</p>
      <h1>Sportsbooks</h1>
      <p className="intro">
        Only credits requiring $0 from you belong here. You always decide
        whether and how to use them.
      </p>
      {cards.length ? (
        <div className="cards">
          {cards.map((c) => (
            <PlatformCard key={c.platform.id} card={c} />
          ))}
        </div>
      ) : (
        <section className="welcome">
          <h2>No verified free credits right now</h2>
          <p>
            Current offers require money or have unresolved terms. Research is
            available in Advanced.
          </p>
        </section>
      )}
      <p className="muted">
        Sportsbook wagers are never automatic. Fliff is excluded.
      </p>
    </>
  );
}
