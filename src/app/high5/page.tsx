import { randomUUID } from "node:crypto";
import { loadHigh5 } from "@/db/high5-service";
import { decimal } from "@/domain/operations";
import { High5Today, High5Performance } from "./display";
import {
  High5UpdateForm,
  High5PlayForm,
  High5RedemptionForm,
  High5SyncForm,
} from "./forms";
export const dynamic = "force-dynamic";
export default async function High5() {
  const d = await loadHigh5();
  if (!d) return <High5Today data={null} />;
  return (
    <>
      <h1 className="text-3xl font-bold">
        HIGH 5 · Real free-value experiment
      </h1>
      <High5Today data={d} />
      <section id="check" className="scroll-mt-5">
        <High5UpdateForm
          accountId={d.account.id}
          submissionKey={randomUUID()}
          current={d.state}
          offers={d.offers.map((o) => ({ id: o.id, title: o.title }))}
        />
      </section>
      <section className="panel my-5">
        <h2 className="font-bold">GC / SC / REDEEMABLE VALUE</h2>
        <p>
          Current GC: {d.state?.gc ?? "UNKNOWN"} · Free SC:{" "}
          {d.state?.sc ?? "UNKNOWN"} · Playable SC:{" "}
          {d.state?.playableSC ?? "UNKNOWN"}
        </p>
        <p>
          Redeemable SC: {d.state?.redeemableSC ?? "REDEMPTION STATUS UNKNOWN"}{" "}
          · Reserved: {decimal(d.balance.reserved)} SC
        </p>
        <p className="text-sm muted mt-2">
          GC is never cash-equivalent. SC is not redeemable until you confirm
          operator requirements. The earlier reported 3.00 SC is an observation,
          not a fresh balance or inferred claim.
        </p>
      </section>
      <section className="panel my-5">
        <h2 className="font-bold">GAMEPLAY PLANNER</h2>
        <p className="mt-2 font-semibold">{d.recommendation.status}</p>
        <p className="mt-2 muted">
          Public High 5 game pages did not establish a complete verified tuple
          of SC eligibility, contribution and wager limits. No game is
          recommended. RTP/volatility and expected redeemable value remain
          unknown. No gameplay executor exists.
        </p>
      </section>
      <section id="play" className="my-5">
        <High5PlayForm
          accountId={d.account.id}
          submissionKey={randomUUID()}
          start={d.state?.playableSC ?? null}
        />
      </section>
      <section id="redemption" className="my-5">
        <High5RedemptionForm
          accountId={d.account.id}
          submissionKey={randomUUID()}
          today={new Date().toLocaleDateString("en-CA", {
            timeZone: "America/Chicago",
          })}
          requests={d.redemptions.filter(
            (r) =>
              r.status === "REQUESTED" ||
              (r.status === "COMPLETED" && r.receivedUSD === null),
          )}
        />
      </section>
      <High5Performance data={d} />
      <section className="panel my-5">
        <h2 className="font-bold mb-3">PUBLIC INFORMATION · PRIMARY SOURCES</h2>
        <High5SyncForm />
        <p className="text-sm mt-3 muted">
          Explicit bounded public read only. No authenticated pages. Material
          changes block affected offers pending re-verification. No permission
          to automate claiming/gameplay is inferred.
        </p>
        {d.sourceStatus.map((s, i) => (
          <p className="mt-2 text-sm" key={s?.id ?? i}>
            {s ? (
              <>
                <a
                  className="underline"
                  href={s.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {s.sourceKey}
                </a>{" "}
                · {s.outcome} ·{" "}
                {s.retrievedAt.toLocaleString("en-US", {
                  timeZone: "America/Chicago",
                })}{" "}
                Central
              </>
            ) : (
              "Public source not synchronized"
            )}
          </p>
        ))}
        <p className="mt-3 text-sm">
          Official rules: at least 1x play, sponsor may require more; 50 SC
          non-cash / 100 SC cash minimum. A help article&apos;s 3x example is
          not a universal multiplier. Operator-shown minimum:{" "}
          {d.state?.redemptionMinimum ?? "UNKNOWN"}.
        </p>
        <details className="mt-3">
          <summary className="underline cursor-pointer">
            Adapter capabilities
          </summary>
          {Object.entries(d.adapterSupport).map(([capability, status]) => (
            <p key={capability}>
              {capability}: {status}
            </p>
          ))}
        </details>
      </section>
    </>
  );
}
