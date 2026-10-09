import Link from "next/link";
import { loadData } from "@/db/queries";
import { loadOperations } from "@/db/operations-service";
import { decimal } from "@/domain/operations";
import { refreshQueue } from "./operations/actions";
import { BalancePanels, TaskList } from "./operations/display";
import { loadHigh5 } from "@/db/high5-service";
import { High5Today } from "./high5/display";
export const dynamic = "force-dynamic";
export default async function Today() {
  const [d, ops] = await Promise.all([loadData(), loadOperations()]);
  const high5 = await loadHigh5();
  const now = new Date(),
    day = (date: Date) =>
      date.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const eligible = d.offers.filter(
    (o) =>
      !o.fixture &&
      !o.platform.fixture &&
      o.result.eligible &&
      o.currentOpportunity.claimState === "READY_TO_CLAIM",
  );
  const completed = ops.actions.filter(
    (a) =>
      a.status === "COMPLETED" &&
      a.completedAt &&
      day(a.completedAt) === day(now),
  );
  const todayEvents = ops.events.filter((e) => day(e.occurredAt) === day(now));
  return (
    <>
      <p className="muted text-sm">
        {now.toLocaleDateString("en-US", {
          timeZone: "America/Chicago",
          dateStyle: "full",
        })}{" "}
        · Central time
      </p>
      <h1 className="mt-2 text-3xl font-bold">TODAY</h1>
      <High5Today data={high5} />
      <h2 className="mt-5 text-xl font-bold">FREE MONEY AVAILABLE TODAY</h2>
      <p className="mt-2 muted">
        Promotional rewards may require playthrough and identity checks.
        Published amounts are not cash or confirmed account credits.
      </p>
      <form action={refreshQueue} className="my-5">
        <button>Refresh local queue</button>
        <span className="ml-3 text-sm muted">
          Evaluates local evidence and schedules; makes no platform requests.
        </span>
      </form>
      <div className="grid gap-5 md:grid-cols-2">
        {(["CASINO", "SPORTSBOOK"] as const).map((engine) => {
          const category =
              engine === "CASINO" ? "sweepstakes_casino" : "sportsbook",
            ready = eligible.filter((o) => o.platform.category === category),
            ids = new Set(
              ops.accounts.filter((a) => a.engine === engine).map((a) => a.id),
            ),
            balances = ops.balances.filter((b) => ids.has(b.account.id)),
            tasks = ops.actions.filter(
              (a) =>
                ids.has(a.accountId) &&
                a.status === "PENDING" &&
                a.availableAt <= now &&
                (!a.expiresAt || a.expiresAt > now),
            );
          return (
            <section key={engine} className="panel">
              <h2 className="font-bold text-xl">
                {engine === "CASINO" ? "CASINOS" : "SPORTSBOOKS"}
              </h2>
              <p className="mt-3">
                {ready.length} verified rewards/offers ready · {tasks.length}{" "}
                actions required
              </p>
              <p>
                {ready.filter((o) => o.facePromotionalValue === null).length}{" "}
                available offers have unknown promotional amounts
              </p>
              <p className="mt-2">
                {engine === "CASINO"
                  ? "Promotional balance"
                  : "Free betting balance available"}
                :{" "}
                {balances.length
                  ? balances
                      .map((b) =>
                        engine === "CASINO"
                          ? `${decimal(b.balances.PROMOTIONAL)} ${b.currency} (${b.account.label})`
                          : `${decimal(b.balances.PLAYABLE)} ${b.currency} (${b.account.label})`,
                      )
                      .join("; ")
                  : "No recorded credits"}
              </p>
              <p>
                {engine === "CASINO"
                  ? "Playable free balance"
                  : "Received credits awaiting activation"}
                :{" "}
                {balances.length
                  ? balances
                      .map(
                        (b) =>
                          `${decimal(engine === "CASINO" ? b.balances.PLAYABLE : b.balances.PROMOTIONAL)} ${b.currency} (${b.account.label})`,
                      )
                      .join("; ")
                  : "No recorded credits"}
              </p>
              <p>
                Redeemable balance:{" "}
                {balances.length
                  ? balances
                      .map(
                        (b) =>
                          `${decimal(b.balances.REDEEMABLE)} ${b.currency}`,
                      )
                      .join("; ")
                  : "No recorded redeemable value"}
              </p>
              <p>
                Playthrough remaining:{" "}
                {engine === "CASINO"
                  ? ops.strategies.length
                    ? ops.strategies
                        .map(
                          (s) =>
                            `${ops.accounts.find((a) => a.id === s.accountId)?.label}: ${s.terms.playthroughRemaining ?? "Unknown"} promotional units`,
                        )
                        .join("; ")
                    : "Unknown until bonus-specific requirements are recorded"
                  : "User decides how to bet free credits"}
              </p>
              <Link
                className="mt-4 inline-block underline"
                href={engine === "CASINO" ? "/casinos" : "/sportsbook"}
              >
                Open{" "}
                {engine === "CASINO" ? "casino engine" : "sportsbook engine"}
              </Link>
            </section>
          );
        })}
      </div>
      <section className="my-8">
        <h2 className="mb-4 text-xl font-bold">MANUAL ACTIONS</h2>
        <TaskList data={ops} manualOnly />
      </section>
      <section className="my-8">
        <h2 className="mb-4 text-xl font-bold">
          Recorded promotional bankroll
        </h2>
        <BalancePanels data={ops} />
      </section>
      <section className="panel">
        <h2 className="font-bold text-xl">COMPLETED TODAY</h2>
        <p className="mt-3">
          {completed.length} completed tasks ·{" "}
          {
            todayEvents.filter((e) => e.eventType === "FREE_REWARD_RECEIVED")
              .length
          }{" "}
          recorded rewards collected
        </p>
        {todayEvents
          .filter((e) =>
            [
              "FREE_REWARD_RECEIVED",
              "BECAME_REDEEMABLE",
              "REDEMPTION_COMPLETED",
            ].includes(e.eventType),
          )
          .map((e) => (
            <p key={e.id}>
              {e.eventType.replaceAll("_", " ")}: {e.amount} {e.currency}
              {e.actualCashAmount !== null
                ? ` · actual ${e.actualCashAmount} ${e.cashCurrency}`
                : ""}
            </p>
          ))}
        {completed.map((a) => (
          <p key={a.id} className="text-sm mt-2">
            {a.actionType}: {a.result}
          </p>
        ))}
      </section>
      <div className="mt-6 flex gap-5 underline">
        <Link href="/overview">Complete research overview</Link>
        <Link href="/demo">Try the isolated simulation</Link>
        <Link href="/bankroll">Open ledger</Link>
      </div>
    </>
  );
}
