import { randomUUID } from "node:crypto";
import { loadOperations } from "@/db/operations-service";
import { BalancePanels, Performance } from "../operations/display";
import { LedgerForm } from "../operations/forms";
export const dynamic = "force-dynamic";
export default async function Bankroll() {
  const d = await loadOperations();
  return (
    <>
      <h1 className="text-3xl font-bold">PROMOTIONAL BANKROLL LEDGER</h1>
      <p className="my-4 muted">
        Append-only free-value bookkeeping. Each currency, account and engine
        stays separate. No account passwords or sessions are stored.
      </p>
      <BalancePanels data={d} />
      <div className="my-8">
        <LedgerForm accounts={d.accounts} submissionKey={randomUUID()} />
      </div>
      <Performance data={d} />
      <h2 className="my-4 text-xl font-bold">Event history</h2>
      <div className="overflow-x-auto panel">
        <table className="w-full text-sm text-left">
          <thead>
            <tr>
              {[
                "Time (Central)",
                "Account",
                "Event",
                "Amount / unit",
                "Category",
                "Source / claim / linked event",
                "Evidence",
              ].map((h) => (
                <th className="p-2" key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.events.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="p-2">
                  {e.occurredAt.toLocaleString("en-US", {
                    timeZone: "America/Chicago",
                  })}
                </td>
                <td className="p-2">
                  {d.accounts.find((a) => a.id === e.accountId)?.label}
                </td>
                <td className="p-2">
                  {e.eventType}
                  <p className="muted">ID: {e.id}</p>
                </td>
                <td className="p-2">
                  {e.amount} {e.currency}
                  {e.actualCashAmount !== null ? (
                    <p>Actual: {e.actualCashAmount} USD</p>
                  ) : null}
                </td>
                <td className="p-2">{e.category}</td>
                <td className="p-2 break-all">
                  Offer: {e.offerId ?? "None"}
                  <br />
                  Claim: {e.claimId ?? "None"}
                  <br />
                  Related: {e.relatedEventId ?? "None"}
                </td>
                <td className="p-2">{e.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!d.events.length && <p>No real ledger events recorded.</p>}
      </div>
      <h2 className="my-4 text-xl font-bold">
        Manual observations · separate from primary evidence
      </h2>
      {d.observations.map((o) => (
        <section key={o.id} className="panel">
          <p>{o.text}</p>
          <p className="mt-2 muted">{o.notes}</p>
          <p className="text-sm mt-2">
            Reported{" "}
            {o.reportedAt.toLocaleString("en-US", {
              timeZone: "America/Chicago",
            })}{" "}
            Central · Actual observation time{" "}
            {o.observedAt
              ? o.observedAt.toLocaleString("en-US", {
                  timeZone: "America/Chicago",
                })
              : "UNKNOWN"}
          </p>
        </section>
      ))}
    </>
  );
}
