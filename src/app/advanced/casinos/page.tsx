import { loadOperations, unknownTerms } from "@/db/operations-service";
import { loadData } from "@/db/queries";
import {
  defaultControls,
  cents,
  strategyPlan,
  freeFunding,
} from "@/domain/operations";
import { BalancePanels, TaskList, Performance } from "@/app/operations/display";
import { StrategyForm } from "@/app/operations/forms";
import { OfferCard } from "@/app/offer-card";
export const dynamic = "force-dynamic";
export default async function Casinos() {
  const [all, d] = await Promise.all([loadOperations(), loadData()]);
  const accounts = all.accounts.filter((a) => a.engine === "CASINO"),
    ids = new Set(accounts.map((a) => a.id));
  const ops = {
    ...all,
    accounts,
    balances: all.balances.filter((b) => ids.has(b.account.id)),
    actions: all.actions.filter((a) => ids.has(a.accountId)),
  };
  return (
    <>
      <h1 className="text-3xl font-bold">CASINOS · Free-value engine</h1>
      <p className="my-4 muted">
        Use free promotional funds only. Strategy plans never execute gameplay.
        When value becomes redeemable, stop playing and prioritize redemption.
      </p>
      <BalancePanels data={ops} />
      <h2 className="mt-8 mb-4 text-xl font-bold">Verified free programs</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {d.offers
          .filter(
            (o) =>
              !o.fixture &&
              o.platform.category === "sweepstakes_casino" &&
              o.result.eligible,
          )
          .map((o) => (
            <OfferCard key={o.id} offer={o} />
          ))}
      </div>
      <h2 className="my-4 text-xl font-bold">Actions required</h2>
      <TaskList data={ops} />
      <div className="mt-8 space-y-5">
        {accounts.map((a) => {
          const saved = all.strategies.find((s) => s.accountId === a.id),
            controls = saved?.controls ?? defaultControls,
            terms = saved
              ? {
                  ...saved.terms,
                  verifiedAt: saved.terms.verifiedAt
                    ? new Date(saved.terms.verifiedAt)
                    : null,
                }
              : unknownTerms;
          return (
            <section key={a.id}>
              <h2 className="mb-3 font-bold">{a.label}</h2>
              {ops.balances
                .filter((b) => b.account.id === a.id)
                .map((b) => {
                  const plan = strategyPlan({
                    engine: "CASINO",
                    funding: freeFunding,
                    controls,
                    terms,
                    playable: b.balances.PLAYABLE,
                    redeemable: b.balances.REDEEMABLE,
                    requestedWager: cents(controls.maxPromotionalWager),
                    sessionLoss: 0,
                    minutes: 0,
                  });
                  return (
                    <p key={b.currency} className="panel mb-3">
                      {b.currency}: {plan.status} · {plan.reason}
                    </p>
                  );
                })}
              <StrategyForm accountId={a.id} controls={controls} />
              {saved && (
                <p className="mt-3 muted">
                  Saved game: {saved.terms.game} · Eligibility:{" "}
                  {String(saved.terms.eligible ?? "Unknown")} · Contribution:{" "}
                  {saved.terms.contributionPercent ?? "Unknown"}% · Playthrough
                  remaining: {saved.terms.playthroughRemaining ?? "Unknown"} ·
                  RTP: {saved.terms.rtp ?? "Unknown"} · Volatility:{" "}
                  {saved.terms.volatility ?? "Unknown"}
                </p>
              )}
            </section>
          );
        })}
      </div>
      <Performance data={ops} />
    </>
  );
}
