import Link from "next/link";
import { loadOperations } from "@/db/operations-service";
import { loadData } from "@/db/queries";
import { BalancePanels, TaskList, Performance } from "../operations/display";
import { OfferCard } from "../offer-card";
export const dynamic = "force-dynamic";
export default async function Sportsbook() {
  const [all, d] = await Promise.all([loadOperations(), loadData()]);
  const accounts = all.accounts.filter((a) => a.engine === "SPORTSBOOK"),
    ids = new Set(accounts.map((a) => a.id));
  const ops = {
    ...all,
    accounts,
    balances: all.balances.filter((b) => ids.has(b.account.id)),
    actions: all.actions.filter((a) => ids.has(a.accountId)),
  };
  const available = d.offers.filter(
    (o) =>
      !o.fixture &&
      o.platform.category === "sportsbook" &&
      o.result.eligible &&
      o.currentOpportunity.claimState === "READY_TO_CLAIM",
  );
  const received = all.events.filter(
    (e) => ids.has(e.accountId) && e.eventType === "FREE_REWARD_RECEIVED",
  );
  return (
    <>
      <h1 className="text-3xl font-bold">SPORTS BETTING</h1>
      <p className="my-4 muted">
        Genuinely $0 promotional credits only. You decide how to bet them. No
        sportsbook wager execution is implemented.
      </p>
      <h2 className="mb-4 text-xl font-bold">
        AVAILABLE FREE OFFERS · {available.length}
      </h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {available.map((o) => (
          <OfferCard key={o.id} offer={o} />
        ))}
        {!available.length && (
          <p className="panel muted">
            No currently verified $0 sportsbook offers. Deposit matches and paid
            qualifying bets stay excluded.
          </p>
        )}
      </div>
      <h2 className="my-4 text-xl font-bold">AVAILABLE FREE-BET BALANCE</h2>
      <BalancePanels data={ops} />
      <h2 className="my-4 text-xl font-bold">CLAIMED FREE BETS</h2>
      {received.length ? (
        received.map((e) => (
          <p key={e.id} className="panel">
            {e.amount} {e.currency} · Actual manual receipt
          </p>
        ))
      ) : (
        <p className="panel muted">No real free bets recorded.</p>
      )}
      <h2 className="my-4 text-xl font-bold">MANUAL ACTION REQUIRED</h2>
      <TaskList data={ops} manualOnly />
      <h2 className="my-4 text-xl font-bold">EXPIRED</h2>
      {ops.events
        .filter((e) => e.eventType === "EXPIRED")
        .map((e) => (
          <p key={e.id}>
            {e.amount} {e.currency} expired
          </p>
        ))}
      {ops.actions
        .filter((a) => a.status === "EXPIRED")
        .map((a) => (
          <p key={a.id}>{a.actionType} expired</p>
        ))}
      {!ops.events.some((e) => e.eventType === "EXPIRED") &&
        !ops.actions.some((a) => a.status === "EXPIRED") && (
          <p className="panel muted">No recorded expired credits or tasks.</p>
        )}
      <Performance data={ops} />
      <Link className="underline" href="/offers?filter=sports">
        Review sportsbook research and exclusions
      </Link>
    </>
  );
}
