import { loadProduct } from "@/db/product-service";
import { time } from "../product/display";
export const dynamic = "force-dynamic";
export default async function History() {
  const d = await loadProduct();
  return (
    <>
      <p className="eyebrow">WHAT ACTUALLY HAPPENED</p>
      <h1>History</h1>
      <p className="intro">
        Confirmed rewards, balance updates, manual play and actual redemption
        receipts.
      </p>
      {d.history.length ? (
        <ol className="history-list">
          {d.history.map((e) => (
            <li key={e.id}>
              <time>{time(e.at)}</time>
              <p>{e.text}</p>
            </li>
          ))}
        </ol>
      ) : (
        <section className="welcome">
          <h2>Your history starts with your first check</h2>
          <p>
            Open a platform and save a quick update. Unknown values stay
            unknown.
          </p>
        </section>
      )}
    </>
  );
}
