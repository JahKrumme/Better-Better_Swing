"use client";
import { useActionState } from "react";
import { createOffer, createPlatform } from "./actions";
import { evidenceFields, moneyFields } from "@/domain/eligibility";
import { phase2EvidenceFields } from "@/domain/verification";
const initial = { ok: false, message: "" };
function Input({
  name,
  label,
  required = false,
  type = "text",
}: {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label>
      {label}
      <input name={name} required={required} type={type} maxLength={10000} />
    </label>
  );
}
function Decision({ name }: { name: string }) {
  return (
    <label>
      {name.replace(/([A-Z])/g, " $1")}
      <select name={name} defaultValue="unknown">
        <option value="unknown">Unknown</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </label>
  );
}
export function ResearchForms({
  platforms,
}: {
  platforms: { id: string; name: string }[];
}) {
  const [ps, pa, pp] = useActionState(createPlatform, initial);
  const [os, oa, op] = useActionState(createOffer, initial);
  return (
    <div className="space-y-6">
      <form action={pa} className="panel">
        <h2 className="mb-5 text-xl font-bold">Add a platform</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input name="name" label="Name" required />
          <Input name="slug" label="Slug (lowercase, hyphens)" required />
          <Input
            name="homepageUrl"
            label="Homepage HTTPS URL"
            type="url"
            required
          />
          <label>
            Category
            <select name="category">
              {["sportsbook", "sweepstakes_casino", "prediction", "other"].map(
                (c) => (
                  <option key={c}>{c}</option>
                ),
              )}
            </select>
          </label>
          <Input name="termsUrl" label="Terms HTTPS URL" type="url" />
          <Input name="promotionsUrl" label="Promotions HTTPS URL" type="url" />
        </div>
        <button className="mt-5" disabled={pp}>
          {pp ? "Saving…" : "Save platform"}
        </button>
        <p role="status" className="mt-3">
          {ps.message}
        </p>
      </form>
      <form action={oa} className="panel">
        <h2 className="mb-3 text-xl font-bold">Add an offer with evidence</h2>
        <p className="mb-5 text-sm muted">
          Only non-fixture platforms can receive research records. Copy exact
          supporting official text for each field. Missing or secondary evidence
          stays unverified. Source reliability is a manual research
          determination in Phase 2. Use short excerpts, not full copyrighted
          pages.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            Platform
            <select name="platformId" required defaultValue="">
              <option value="" disabled>
                Select a platform
              </option>
              {platforms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <Input name="title" label="Title" required />
          <label>
            Description
            <textarea name="description" required maxLength={10000} />
          </label>
          <label>
            Offer type
            <select name="offerType">
              {[
                "signup",
                "daily",
                "weekly",
                "limited_time",
                "amoe",
                "giveaway",
              ].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <Input
            name="promotionalAmount"
            label="Promotional amount (not cash)"
          />
          <Input
            name="promotionalCurrency"
            label="Promotional currency / unit"
            required
          />
          <Input
            name="estimatedCashValue"
            label="Legacy estimate (unused; use documented value fields below)"
          />
          <Input
            name="minimumRedemption"
            label="Minimum redemption in USD (blank if unknown)"
          />
          <Input
            name="playthroughRequirement"
            label="Playthrough terms (write none if none)"
          />
          <Input name="minimumAge" label="Minimum age (blank if unknown)" />
          {[
            ...moneyFields,
            "signupRequired",
            "identityVerificationRequired",
            "entryFeeRequired",
            "amoeAvailable",
            "postageRequired",
          ].map((name) => (
            <Decision key={name} name={name} />
          ))}
          <Input
            name="countries"
            label="Eligible country codes (US or blank if unknown)"
          />
          <Input
            name="states"
            label="Eligible state codes (KS,MO; blank means all states per terms)"
          />
          <Input
            name="excludedStates"
            label="Excluded state codes (comma-separated)"
          />
          <Input
            name="startDate"
            label="Starts (optional)"
            type="datetime-local"
          />
          <Input
            name="expirationDate"
            label="Expires (optional)"
            type="datetime-local"
          />
          <Input
            name="sourceUrl"
            label="Evidence HTTPS URL"
            type="url"
            required
          />
          <label>
            Source type
            <select name="sourceType" defaultValue="secondary">
              <option value="secondary">Secondary (unverified)</option>
              <option value="official">
                Official platform terms (manually checked)
              </option>
            </select>
          </label>
          <Input
            name="capturedAt"
            label="Evidence captured (UTC date)"
            type="date"
            required
          />
          <Input
            name="amoeMethod"
            label="AMOE method (mail / online form / other)"
          />
          <Input
            name="amoeValuePerRequest"
            label="AMOE promotional value per valid request"
          />
          <Input name="amoeRequestLimits" label="AMOE request limits" />
          <Input name="amoeFrequencyLimits" label="AMOE frequency limits" />
          <Input
            name="amoeOtherUserCost"
            label="Other AMOE cost in USD (0 only if established)"
          />
          <Input
            name="estimatedRedeemableValue"
            label="Estimated redeemable USD (leave unknown without calculation)"
          />
          <Input
            name="valueMethod"
            label="Documented conservative estimate calculation"
          />
          <Input
            name="valueEvidenceUrl"
            label="Valuation evidence HTTPS URL"
            type="url"
          />
          <label>
            Recurrence timezone
            <input name="recurrenceTimezone" defaultValue="America/Chicago" />
          </label>
          {[
            ...evidenceFields,
            ...phase2EvidenceFields,
            "amoeMethod",
            "postageRequired",
            "amoeOtherUserCost",
            "estimatedRedeemableValue",
          ].map((field) => (
            <label key={field}>
              Evidence: {field}
              <textarea name={`evidence_${field}`} maxLength={1000} />
            </label>
          ))}
        </div>
        <button className="mt-5" disabled={op || !platforms.length}>
          {op ? "Saving…" : "Save offer and evidence"}
        </button>
        <p role="status" className="mt-3">
          {os.message}
        </p>
      </form>
    </div>
  );
}
