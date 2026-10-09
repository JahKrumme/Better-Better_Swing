import Link from "next/link";
import type { loadOperations } from "@/db/operations-service";
import { decimal, comparableConversion } from "@/domain/operations";
import { ManualTaskForm } from "./forms";
type Data = Awaited<ReturnType<typeof loadOperations>>;
export function BalancePanels({ data }: { data: Data }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {data.balances.map((b) => (
        <section key={b.account.id + b.currency} className="panel">
          <h3 className="font-bold">
            {b.account.label} · {b.currency}
          </h3>
          <dl className="mt-3 grid grid-cols-2 gap-2">
            {Object.entries(b.balances).map(([category, amount]) => (
              <div key={category}>
                <dt className="text-sm muted">{category}</dt>
                <dd className="font-bold">
                  {decimal(amount)} {b.currency}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm muted">
            Pending redemption: {decimal(b.reserved)} {b.currency}
          </p>
          {b.balances.REDEEMABLE > 0 && (
            <p className="mt-3 font-bold text-green-900">
              STOP PLAYING · Prioritize redemption
            </p>
          )}
        </section>
      ))}
      {!data.balances.length && (
        <div className="panel muted">
          No free promotional receipts recorded. Observed balances and
          advertised offers are not ledger receipts.
        </div>
      )}
    </div>
  );
}
export function TaskList({
  data,
  manualOnly = false,
}: {
  data: Data;
  manualOnly?: boolean;
}) {
  const now = new Date();
  const tasks = data.actions.filter(
    (a) =>
      a.status === "PENDING" &&
      a.availableAt <= now &&
      (!a.expiresAt || a.expiresAt > now) &&
      (!manualOnly || a.executionMode === "MANUAL_REQUIRED"),
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {tasks
        .sort(
          (a, b) =>
            Number(b.actionType === "REQUEST_REDEMPTION") -
            Number(a.actionType === "REQUEST_REDEMPTION"),
        )
        .map((a) => (
          <section className="panel" key={a.id}>
            <h3 className="font-bold">
              {data.accounts.find((x) => x.id === a.accountId)?.label}
            </h3>
            <p className="mt-2 font-semibold">
              {a.actionType.replaceAll("_", " ")}
            </p>
            <p className="text-sm">
              {a.executionMode} · {a.automationPolicy}
            </p>
            <p className="mt-2 muted text-sm">{a.reason}</p>
            <p className="mt-2 text-sm">
              Available{" "}
              {a.availableAt.toLocaleString("en-US", {
                timeZone: "America/Chicago",
              })}{" "}
              Central
              {a.expiresAt
                ? ` · Ends ${a.expiresAt.toLocaleString("en-US", { timeZone: "America/Chicago" })} Central`
                : ""}
            </p>
            {a.offerId ? (
              <Link href="/offers" className="mt-3 inline-block underline">
                Review terms and record the manual claim
              </Link>
            ) : null}
            {!data.accounts.find((x) => x.id === a.accountId)?.demo &&
              a.executionMode === "MANUAL_REQUIRED" &&
              !["CLAIM_REWARD", "MANUAL_CLAIM"].includes(a.actionType) && (
                <ManualTaskForm id={a.id} />
              )}
          </section>
        ))}
      {!tasks.length && (
        <div className="panel muted">
          No actions currently waiting. Refresh the local queue to evaluate
          schedules and import recorded claims.
        </div>
      )}
    </div>
  );
}
export function Performance({ data }: { data: Data }) {
  return (
    <section className="my-8">
      <h2 className="mb-3 text-xl font-bold">
        Performance — recorded ledger events
      </h2>
      <p className="mb-4 font-bold">
        TOTAL USER MONEY CONTRIBUTED: $0 · ROI: not applicable (zero
        denominator)
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {data.balances.map((b) => {
          const ratio = comparableConversion(
            b.balances.REDEEMED,
            b.freeReceived,
            true,
          );
          return (
            <div className="panel" key={b.account.id + b.currency}>
              <h3 className="font-bold">
                {b.account.label} · {b.currency}
              </h3>
              <p>Free promotional value received: {decimal(b.freeReceived)}</p>
              <p>Amount wagered: {decimal(b.wagered)}</p>
              <p>
                Promotional wins (net): {decimal(b.wins)} · Losses:{" "}
                {decimal(b.losses)}
              </p>
              <p>Became redeemable: {decimal(b.becameRedeemable)}</p>
              <p>
                Promotional units redeemed / received:{" "}
                {ratio === null ? "Unknown" : `${(ratio * 100).toFixed(2)}%`}
              </p>
              <p className="font-bold mt-3">
                {data.accounts[0]?.demo
                  ? "SIMULATED CASH/PRIZES"
                  : "TOTAL CASH/PRIZES REDEEMED"}
                :{" "}
                {b.cash.size
                  ? [...b.cash]
                      .map(([unit, n]) => `${decimal(n)} ${unit}`)
                      .join(", ")
                  : "0.00 USD recorded"}
              </p>
              <p className="text-sm muted mt-2">
                Promo conversion compares the same account currency. No
                cash-to-coin conversion or expected return is assumed.
              </p>
            </div>
          );
        })}
        {!data.balances.length && (
          <p className="panel muted">
            No ledger performance yet. Total cash/prizes redeemed: $0 recorded.
          </p>
        )}
      </div>
    </section>
  );
}
