import type { AppOffer } from "@/db/queries";
import { ClaimButton } from "./claims/forms";
export function OfferCard({ offer: o }: { offer: AppOffer }) {
  return (
    <article className="panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase muted">
            {o.platform.name}
            {o.fixture ? " · FICTIONAL FIXTURE" : ""}
          </p>
          <h2 className="mt-2 text-xl font-bold">{o.title}</h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${o.result.eligible ? "bg-green-100" : "bg-amber-100"}`}
        >
          {o.result.verificationState}
          {o.fixture ? " (fixture)" : ""}
        </span>
      </div>
      <p className="mt-3 text-sm muted">{o.description}</p>
      <dl className="my-5 grid grid-cols-2 gap-4 text-sm">
        {[
          [
            "PROMOTIONAL VALUE",
            `${o.value.facePromotionalValue ?? "Unknown"} ${o.promotionalCurrency} · not cash`,
          ],
          [
            "ESTIMATED REDEEMABLE VALUE",
            o.value.estimatedRedeemableValue === null
              ? "Unknown"
              : `$${o.value.estimatedRedeemableValue} documented estimate`,
          ],
          ["HOW OFTEN", o.recurringCadence ?? o.offerType],
          [
            "KANSAS ELIGIBILITY",
            o.result.verificationState === "EXCLUDED_GEOGRAPHY"
              ? "Excluded"
              : o.result.eligible
                ? "Appears eligible"
                : "Not established for this profile",
          ],
          ["PLAYTHROUGH", o.playthroughRequirement ?? "Unknown"],
          [
            "MINIMUM REDEMPTION",
            o.minimumRedemption === null
              ? "Unknown"
              : `${o.minimumRedemption} USD (terms apply)`,
          ],
          ["CLAIM METHOD", "Manual only · no automated claim execution"],
          [
            "LAST VERIFIED",
            o.lastVerifiedAt?.toISOString().slice(0, 10) ?? "Not verified",
          ],
          [
            "EXPIRATION",
            o.expirationDate?.toISOString().slice(0, 10) ??
              "Not established / see terms",
          ],
          ["THIS INSTANCE", o.currentOpportunity.claimState],
          [
            "NEXT TRACKING PERIOD",
            o.nextOpportunity?.availableDate.toLocaleDateString("en-US", {
              timeZone: o.recurrenceTimezone,
            }) ?? "One-time or expired",
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-bold muted">{label}</dt>
            <dd className="mt-1">{value}</dd>
          </div>
        ))}
      </dl>
      {o.amoeAvailable && (
        <p className="mb-4 text-sm">
          <strong>{o.result.amoeClassification}</strong> ·{" "}
          {o.amoeMethod ?? "Unknown method"} · promotional value per valid
          request: {o.amoeValuePerRequest ?? "unknown"} {o.promotionalCurrency}{" "}
          · postage:{" "}
          {o.postageRequired === null
            ? "unknown"
            : o.postageRequired
              ? "required"
              : "not required"}{" "}
          · other cost: {o.amoeOtherUserCost ?? "unknown"} USD · request limit:{" "}
          {o.amoeRequestLimits ?? "unknown"} · frequency:{" "}
          {o.amoeFrequencyLimits ?? "unknown"}
        </p>
      )}
      {[...o.result.reasons, ...o.result.warnings, ...o.result.valueWarnings]
        .length > 0 && (
        <ul className="space-y-1 border-t border-green-900/10 pt-4 text-sm muted">
          {[
            ...o.result.reasons,
            ...o.result.warnings,
            ...o.result.valueWarnings,
          ].map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-semibold">
          Why is this considered free? / Evidence ({o.evidence.length})
        </summary>
        <p className="my-3 muted">
          {o.result.eligible
            ? "All required qualifying facts have current primary support."
            : "Free eligibility has not been established. Review missing or conflicting evidence."}
        </p>
        <ul className="space-y-3">
          {o.evidence.map((e) => (
            <li key={e.id}>
              <strong>{e.field}</strong> · {e.sourceType} ·{" "}
              {e.capturedAt.toISOString().slice(0, 10)}
              {e.supersededAt ? " · SUPERSEDED" : ""}
              {e.conflicting ? " · CONFLICT" : ""}
              <p className="mt-1">{e.extractedText}</p>
              {e.normalizedValue && (
                <p className="muted">Normalized fact: {e.normalizedValue}</p>
              )}
              <a
                className="underline break-all"
                href={e.sourceUrl}
                rel="noreferrer"
                target="_blank"
              >
                Source: {e.sourceUrl}
              </a>
            </li>
          ))}
        </ul>
      </details>
      {!o.fixture && (
        <ClaimButton
          offerId={o.id}
          enabled={
            o.result.eligible &&
            o.currentOpportunity.claimState === "READY_TO_CLAIM"
          }
        />
      )}
    </article>
  );
}
