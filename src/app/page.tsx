import Link from "next/link";
import { loadProduct } from "@/db/product-service";
import { GetMoney, Refresh, ProfileForm } from "./product/forms";
import { Amounts, PlatformCard, time } from "./product/display";
export const dynamic = "force-dynamic";
export default async function Home() {
  const d = await loadProduct();
  return (
    <>
      <Refresh />
      {d.profile.age === null && (
        <section className="welcome">
          <ProfileForm />
        </section>
      )}
      <div className="hero">
        <p className="eyebrow">YOUR FREE REWARDS, IN ONE PLACE</p>
        <h1>
          Make the most of
          <br />
          what’s already free.
        </h1>
        <p>
          Find rewards, keep track of free balances, and know when to redeem.
        </p>
        <GetMoney />
        <p className="small muted">
          Checks your opportunities and gives you the next step.
        </p>
      </div>
      {!d.integrity && (
        <div role="alert" className="integrity-error">
          INTEGRITY ERROR · User money or purchased funds detected. Stop and
          review Advanced before continuing.
        </div>
      )}
      <section className="summary-grid" aria-label="Your balances">
        <article>
          <h2>Free promotional balances</h2>
          <Amounts groups={d.free} empty="No recorded free balances" />
        </article>
        <article>
          <h2>Redeemable now</h2>
          <Amounts groups={d.redeemable} empty="None recorded yet" />
        </article>
        <article>
          <h2>Actually redeemed</h2>
          <Amounts groups={d.actual} empty="No actual receipts recorded" />
        </article>
        <article>
          <h2>Your money deposited</h2>
          <p className="balance-number">
            {d.integrity ? "$0" : "Integrity error"}
          </p>
          <p className="muted small">No purchases, deposits or fees. Always.</p>
        </article>
      </section>
      <div className="section-heading">
        <h2>Needs you</h2>
        <span className="small muted">
          {d.cards.filter((c) => c.status.kind !== "WAIT").length} accounts
        </span>
      </div>
      {d.cards.filter((c) => c.status.kind !== "WAIT").length ? (
        <div className="needs-list">
          {d.cards
            .filter((c) => c.status.kind !== "WAIT")
            .map((c) => (
              <Link href={`/accounts/${c.platform.slug}`} key={c.platform.id}>
                <strong>{c.platform.name}</strong>
                <span>{c.status.title} →</span>
              </Link>
            ))}
        </div>
      ) : (
        <p className="empty">
          You’re caught up. Your next checks will appear here.
        </p>
      )}
      {!d.history.length && (
        <section className="welcome">
          <h2>FREE MONEY FINDER IS READY</h2>
          <p>
            {d.opportunities} verified free opportunities. Check your first
            account, then save the balance you actually see.
          </p>
          <p className="small">
            Published promotional amounts are separate from your account
            balances.
          </p>
        </section>
      )}
      <div className="section-heading">
        <h2>Casinos</h2>
        <Link className="text-link" href="/casinos">
          View all
        </Link>
      </div>
      <div className="cards">
        {d.cards
          .filter((c) => c.account?.engine === "CASINO")
          .map((c) => (
            <PlatformCard key={c.platform.id} card={c} />
          ))}
      </div>
      <div className="section-heading">
        <h2>Sportsbooks</h2>
        <Link className="text-link" href="/sportsbook">
          View details
        </Link>
      </div>
      {d.cards.some((c) => c.account?.engine === "SPORTSBOOK") ? (
        <div className="cards">
          {d.cards
            .filter((c) => c.account?.engine === "SPORTSBOOK")
            .map((c) => (
              <PlatformCard key={c.platform.id} card={c} />
            ))}
        </div>
      ) : (
        <p className="empty">
          No verified sportsbook credits that require $0 from you right now.
        </p>
      )}
      <section className="runner">
        <div>
          <strong>Local background checks {d.runtime.on ? "ON" : "OFF"}</strong>
          <p className="small muted">
            {d.runtime.on
              ? "Checking local schedules while this app and computer are running."
              : "Start with pnpm app:start to keep local schedules up to date."}
          </p>
        </div>
        <div className="small">
          Last: {time(d.runtime.lastRunAt)}
          <br />
          Next: {d.runtime.on ? time(d.runtime.nextRunAt) : "Runner stopped"}
        </div>
      </section>
      {d.runs[0] && (
        <p className="small muted">
          Last check: {d.runs[0].result.collected.length} collected ·{" "}
          {d.runs[0].result.needsYou.length} need you ·{" "}
          {d.runs[0].result.nothing.length} waiting.{" "}
          {d.runs[0].outcome === "FAILED"
            ? "Check failed; balances preserved."
            : ""}
        </p>
      )}
      <section className="panel">
        <h2>Your progress</h2>
        <p className="small muted">Confirmed free promotional value received</p>
        <Amounts
          groups={d.receivedGroups}
          empty="No confirmed reward amounts yet"
        />
        <p>
          {d.received.length} confirmed free reward receipts ·{" "}
          {d.minutes.toFixed(1)} recorded minutes spent
        </p>
        <p>
          Actual redeemed value per recorded hour:{" "}
          {d.valuePerHour === null
            ? "Not enough recorded data"
            : `$${d.valuePerHour.toFixed(2)}`}
        </p>
        <p className="small muted">
          Uses recorded effort and actual receipts only. No projection or
          return-on-deposit calculation.
        </p>
        <Link href="/history" className="text-link">
          See history →
        </Link>
      </section>
    </>
  );
}
