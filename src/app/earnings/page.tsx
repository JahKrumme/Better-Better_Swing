import { loadData } from "@/db/queries";
import { earningsTotals } from "@/domain/earnings";
export const dynamic = "force-dynamic";
export default async function Earnings() {
  const d = await loadData();
  const totals = earningsTotals(d.claims, d.offers, d.redemptions, d.platforms);
  return (
    <>
      <h1 className="mb-6 text-3xl font-bold">Earnings</h1>
      <div className="grid gap-5 md:grid-cols-3">
        <section className="panel">
          <h2 className="font-bold">Face promotional value received</h2>
          {totals.promotionalUnits.size ? (
            [...totals.promotionalUnits].map(([unit, value]) => (
              <p key={unit} className="mt-3">
                {value} {unit}
              </p>
            ))
          ) : (
            <p className="mt-3 muted">No recorded promotional rewards</p>
          )}
        </section>
        <section className="panel">
          <h2 className="font-bold">Estimated redeemable value</h2>
          <p className="mt-3 muted">
            Unknown for recorded balances unless a documented conservative
            calculation supports an estimate. Promotional coins are not
            automatically dollars.
          </p>
        </section>
        <section className="panel">
          <h2 className="font-bold">Actual redeemed value</h2>
          <p className="mt-3 text-2xl font-bold">
            ${totals.actualRedeemedValue.toFixed(2)}
          </p>
        </section>
      </div>
      <p className="mt-6 muted">
        Only actual cash recorded as redeemed is counted as cash. Fictional
        fixtures and linked duplicate redemption records are excluded.
      </p>
    </>
  );
}
