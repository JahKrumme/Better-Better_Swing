import Link from "next/link";
import type { loadHigh5 } from "@/db/high5-service";
import { decimal } from "@/domain/operations";
type Data = NonNullable<Awaited<ReturnType<typeof loadHigh5>>>;
const when = (date: Date | null) =>
  date
    ? date.toLocaleString("en-US", { timeZone: "America/Chicago" }) + " Central"
    : "UNKNOWN";
export function High5Today({ data: d }: { data: Data | null }) {
  if (!d)
    return (
      <section className="panel">
        <h2 className="font-bold">HIGH 5</h2>
        <p>Initialize the existing High 5 integration with pnpm high5:init.</p>
      </section>
    );
  const due = !d.nextCheck || d.nextCheck <= new Date();
  return (
    <section className="panel my-6 border-green-700">
      <h2 className="text-2xl font-bold">HIGH 5</h2>
      {!d.integrity ? (
        <p role="alert" className="text-red-800 font-bold">
          CRITICAL INTEGRITY ERROR: user money/purchased bankroll. STOP.
          Experiment invalid.
        </p>
      ) : (
        <>
          <p className="mt-3 font-semibold">
            {d.balance.balances.REDEEMABLE > 0
              ? "REDEEM AVAILABLE VALUE — STOP PLAYING"
              : due
                ? "Free reward may be available"
                : "Wait for the next expected reward check"}
          </p>
          <p className="text-sm muted mt-2">
            High 5 displayed a free-coins-every-4-hours promotion. Reward
            currency and amount may vary.
          </p>
          <p className="mt-3">
            Last checked: {when(d.lastCheck)}
            <br />
            Next expected check: {when(d.nextCheck)}
          </p>
          <div className="grid gap-3 sm:grid-cols-3 my-4">
            <p>
              Promotional SC: <strong>{d.state?.sc ?? "UNKNOWN"}</strong>
            </p>
            <p>
              Playthrough remaining:{" "}
              <strong>{d.state?.playthroughRemaining ?? "UNKNOWN"}</strong>
            </p>
            <p>
              Redeemable SC:{" "}
              <strong>{d.state?.redeemableSC ?? "UNKNOWN"}</strong>
            </p>
          </div>
          <p className="font-bold">
            Recommended action:{" "}
            {d.balance.balances.REDEEMABLE > 0
              ? "REDEEM"
              : !d.termsCurrent || due
                ? "CHECK"
                : "WAIT"}
          </p>
          <p className="text-sm mt-2">{d.recommendation.status}</p>
          <div className="flex flex-wrap gap-3 mt-4">
            <Link className="button" href="/high5#check">
              CHECK REWARD
            </Link>
            <a
              className="button"
              href="https://high5casino.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Check High 5
            </a>
            <Link className="underline self-center" href="/high5#redemption">
              Record redemption
            </Link>
            <Link className="underline self-center" href="/high5/experiment">
              Experiment / performance
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
export function High5Performance({ data: d }: { data: Data }) {
  const m = d.metrics;
  const rate = (n: number | null, unit: string) =>
    n === null
      ? "UNKNOWN — projection criteria not met"
      : `${(n / 100).toFixed(2)} ${unit} (projection / observed rate)`;
  if (!d.integrity)
    return (
      <p role="alert">
        CRITICAL INTEGRITY ERROR — experiment metrics withheld.
      </p>
    );
  return (
    <>
      <h2 className="text-2xl font-bold my-5">HIGH 5 PERFORMANCE · REAL</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="panel">
          <h3 className="font-bold">FREE VALUE RECEIVED</h3>
          <p>Signup SC: {decimal(m.signupSC)}</p>
          <p>Recurring SC: {decimal(m.recurringSC)}</p>
          <p>Other promotional SC: {decimal(m.otherSC)}</p>
          <p className="mt-2">
            {m.unknownSC} claimed rewards have unknown SC amounts. Known
            subtotal: {decimal(m.freeSC)} SC.
          </p>
          <p className="mt-2 muted text-sm">
            Balance corrections do not count as received rewards. GC is never
            cash.
          </p>
        </section>
        <section className="panel">
          <h3 className="font-bold">PLAY</h3>
          <p>SC wagered: {decimal(m.wagered)}</p>
          <p>Net wins: {decimal(m.wins)}</p>
          <p>Losses: {decimal(m.losses)}</p>
          <p>
            Net promotional result: {((m.wins - m.losses) / 100).toFixed(2)} SC
          </p>
          <p>SC played: {decimal(m.wagered)}</p>
          <p>
            Required playthrough: {d.state?.playthroughRequired ?? "UNKNOWN"}
          </p>
          <p>Progress shown: {d.state?.playthroughPlayed ?? "UNKNOWN"}</p>
          <p>Remaining: {d.state?.playthroughRemaining ?? "UNKNOWN"}</p>
          <p>
            Playthrough completed:{" "}
            {
              d.events.filter((e) => e.eventType === "PLAYTHROUGH_COMPLETED")
                .length
            }{" "}
            recorded confirmations
          </p>
        </section>
        <section className="panel">
          <h3 className="font-bold">REDEMPTION</h3>
          <p>
            Potentially redeemable SC: UNKNOWN until operator requirements are
            confirmed
          </p>
          <p>
            Actually redeemable:{" "}
            {d.state?.redeemableSC ?? "REDEMPTION STATUS UNKNOWN"}
          </p>
          <p>
            Observed increases in confirmed redeemable SC:{" "}
            {decimal(m.redeemableGenerated)} (known-to-known observations)
          </p>
          <p>Pending: {decimal(m.pending)} SC</p>
          <p>Redeemed units: {decimal(m.redeemedSC)} SC</p>
          <p>Actual cash/prizes recorded: {decimal(m.actualUSD)} USD</p>
          <p>{m.unknownCash} completed redemptions have unknown proceeds.</p>
          <p className="mt-3 font-bold">USER MONEY CONTRIBUTED: $0</p>
        </section>
      </div>
      <section className="panel my-5">
        <h3 className="font-bold">EXPERIMENT</h3>
        <p>Start: {when(m.start)}</p>
        <p>
          {m.daysObserved} distinct days observed / {m.elapsedDays} elapsed days
        </p>
        <p>
          {m.rewardChecks} reward checks · {m.rewardsReceived} rewards received
          · {m.minutes.toFixed(2)} manual minutes
        </p>
        <p>Average free SC/day: {rate(m.scPerDay, "SC/day")}</p>
        <p>Average free SC/week: {rate(m.scPerWeek, "SC/week")}</p>
        <p>
          Projected monthly recurring SC:{" "}
          {rate(m.projectedMonthlySC, "SC/30 days")}
        </p>
        <p>Redeemed value/day: {rate(m.redeemedPerDay, "USD/day")}</p>
        <p>
          Projected redeemed value/month:{" "}
          {rate(m.projectedMonthlyUSD, "USD/30 days")}
        </p>
        <p>Value/manual minute: {rate(m.valuePerMinute, "USD/minute")}</p>
        <p className="text-sm muted mt-3">
          At least 7 elapsed and 7 observed days, known relevant reward amounts,
          and completed known-value redemptions are required for the
          corresponding projections. Signup rewards are excluded from monthly
          recurring SC. Monthly USD/prize projections remain UNKNOWN when signup
          SC is present because proceeds are not attributed to recurring
          rewards. These projections are conditional, not guaranteed profit.
        </p>
      </section>
    </>
  );
}
