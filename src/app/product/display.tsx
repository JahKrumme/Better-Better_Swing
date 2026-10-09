import Link from "next/link";
import { loadProduct } from "@/db/product-service";
import { decimal } from "@/domain/operations";
import { officialLink, displayUnit, type MoneyGroup } from "@/domain/product";
export const time = (d: Date | null) =>
  d
    ? d.toLocaleString("en-US", {
        timeZone: "America/Chicago",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Not checked yet";
export function Amounts({
  groups,
  empty,
}: {
  groups: MoneyGroup[];
  empty: string;
}) {
  return (
    <>
      {groups.length ? (
        groups.map((g, i) => (
          <div
            className="amount-row"
            key={`${g.platformId}:${displayUnit(g.currency)}:${i}`}
          >
            <strong>
              {decimal(g.amount)} {displayUnit(g.currency)}
            </strong>
            <span>{g.platform}</span>
          </div>
        ))
      ) : (
        <p className="muted">{empty}</p>
      )}
    </>
  );
}
export function PlatformCard({
  card: c,
}: {
  card: Awaited<ReturnType<typeof loadProduct>>["cards"][number];
}) {
  const url = officialLink(c.platform.homepageUrl ?? "");
  return (
    <article
      className={`platform-card ${c.status.kind === "REDEEM_NOW" ? "ready-card" : ""}`}
    >
      <div className="card-heading">
        <h3>{c.platform.name}</h3>
        <span className="badge">{c.mode}</span>
      </div>
      <p className="balance-number">
        {c.balance === null
          ? "Unknown"
          : `${c.balance} ${displayUnit(c.currency)}`}
      </p>
      <p className="muted small">Recorded promotional balance · not cash</p>
      <p className="reward-status">{c.status.title}</p>
      {c.redeemable !== null && (
        <p>
          Redeemable now:{" "}
          <strong>
            {decimal(c.redeemable)} {displayUnit(c.currency)}
          </strong>
        </p>
      )}
      {c.status.kind === "REDEEM_NOW" && (
        <p className="stop">
          STOP PLAYING · protect the amount you can redeem.
        </p>
      )}
      <p className="small muted">
        {c.nextCheck
          ? `Next check: ${time(c.nextCheck)}${c.nextCheck <= new Date() ? " · due now" : ""}`
          : "Check your first reward on the platform"}
      </p>
      {c.expiresAt && (
        <p className="small">Offer expires: {time(c.expiresAt)}</p>
      )}
      <div className="card-actions">
        {url ? (
          <a
            className="button primary"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {c.status.action}
            <span aria-hidden="true"> ↗</span>
          </a>
        ) : (
          <span>Official link needs verification</span>
        )}
        {c.account && (
          <Link href={`/accounts/${c.platform.slug}`} className="text-link">
            Quick update
          </Link>
        )}
      </div>
      <details>
        <summary>Details</summary>
        <p className="small">
          Last reward check: {time(c.lastCheck)}. Next-check times are
          reminders, not confirmed rewards.
        </p>
        {c.offers.map((o) => (
          <p className="small" key={o.id}>
            {o.title} · published amount {o.facePromotionalValue ?? "unknown"}{" "}
            {o.promotionalCurrency ?? ""}. Credit appears only after an actual
            receipt.
          </p>
        ))}
        <p className="small">
          Manual account access, claiming, play and redemption. Game advice:
          insufficient verified game data.
        </p>
      </details>
    </article>
  );
}
