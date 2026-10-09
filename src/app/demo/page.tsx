import { loadOperations, demoSteps } from "@/db/operations-service";
import { BalancePanels, Performance } from "../operations/display";
import { NewDemoForm, DemoStepForm } from "../operations/forms";
export const dynamic = "force-dynamic";
export default async function Demo() {
  const d = await loadOperations(true);
  return (
    <>
      <p className="font-bold text-amber-900">
        SIMULATION ONLY · FICTIONAL BALANCES AND CASH
      </p>
      <h1 className="mt-2 text-3xl font-bold">
        Complete free-value workflow demo
      </h1>
      <p className="my-4 muted">
        A deterministic local scenario, not an expected outcome. Demonstrates
        free receipts, playthrough, promotional wins/losses, stop-playing and
        redemption. No real accounts or platform calls.
      </p>
      <NewDemoForm />
      <div className="space-y-6 mt-6">
        {d.runs.map((run) => {
          const ids = new Set([run.casinoAccountId, run.sportsbookAccountId]);
          const data = {
            ...d,
            accounts: d.accounts.filter((a) => ids.has(a.id)),
            balances: d.balances.filter((b) => ids.has(b.account.id)),
          };
          return (
            <section key={run.id} className="panel">
              <h2 className="font-bold">SIMULATED run · {run.id}</h2>
              <ol className="my-4 list-decimal pl-6">
                {demoSteps.map((label, i) => (
                  <li
                    key={label}
                    className={i < run.step ? "text-green-900" : "muted"}
                  >
                    {label} {i < run.step ? "✓" : ""}
                  </li>
                ))}
              </ol>
              {run.step < demoSteps.length ? (
                <DemoStepForm
                  runId={run.id}
                  step={run.step}
                  label={demoSteps[run.step]}
                />
              ) : (
                <p className="font-bold">
                  Simulation complete · No actual cash earned
                </p>
              )}
              <div className="my-4">
                <BalancePanels data={data} />
              </div>
              <Performance data={data} />
              <details>
                <summary className="cursor-pointer underline">
                  Simulated ledger events
                </summary>
                {d.events
                  .filter((e) => ids.has(e.accountId))
                  .map((e) => (
                    <p className="text-sm" key={e.id}>
                      {e.eventType}: {e.amount} {e.currency}
                      {e.actualCashAmount !== null
                        ? ` · SIMULATED ${e.actualCashAmount} USD`
                        : ""}
                    </p>
                  ))}
              </details>
            </section>
          );
        })}
      </div>
    </>
  );
}
