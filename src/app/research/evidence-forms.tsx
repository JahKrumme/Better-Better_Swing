"use client";
import { useActionState } from "react";
import {
  appendEvidence,
  supersedeEvidence,
  reviewPlatform,
  reviewPlatformFact,
} from "./evidence-actions";
import { evidenceFields } from "@/domain/eligibility";
import { phase2EvidenceFields } from "@/domain/verification";
import { platformFactFields } from "@/domain/platform-fact";
const initial = { ok: false, message: "" };
export function EvidenceForms({
  offers,
  evidence,
  platforms,
}: {
  offers: { id: string; title: string }[];
  evidence: { id: string; field: string; offerId: string }[];
  platforms: { id: string; name: string }[];
}) {
  const [es, ea, ep] = useActionState(appendEvidence, initial);
  const [ss, sa, sp] = useActionState(supersedeEvidence, initial);
  const [fs, fa, fp] = useActionState(reviewPlatformFact, initial);
  const [ps, pa, pp] = useActionState(reviewPlatform, initial);
  return (
    <div className="my-6 space-y-6">
      <form action={fa} className="panel">
        <h2 className="mb-4 text-xl font-bold">
          Review a platform qualification fact
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            Platform
            <select name="platformId">
              {platforms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Field
            <select name="field">
              {platformFactFields.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <label>
            Normalized value (true / false / unknown, number, or short text)
            <input name="value" required maxLength={1000} />
          </label>
          <label>
            Official source HTTPS URL
            <input name="sourceUrl" type="url" required />
          </label>
          <label>
            Short supporting passage
            <textarea name="extractedText" maxLength={1000} required />
          </label>
          <label>
            Captured (UTC date)
            <input name="capturedAt" type="date" required />
          </label>
        </div>
        <button disabled={fp || !platforms.length} className="mt-4">
          Save qualification research
        </button>
        <p role="status" className="mt-3">
          {fs.message}
        </p>
      </form>
      <form action={ea} className="panel">
        <h2 className="mb-5 text-xl font-bold">Append source evidence</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            Offer
            <select name="offerId" required>
              {offers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Supported field
            <select name="field">
              {[
                ...evidenceFields,
                ...phase2EvidenceFields,
                "amoeMethod",
                "postageRequired",
                "amoeOtherUserCost",
                "estimatedRedeemableValue",
              ].map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <label>
            Source HTTPS URL
            <input name="sourceUrl" type="url" required />
          </label>
          <label>
            Source type
            <select name="sourceType">
              <option value="secondary">Secondary (discovery only)</option>
              <option value="official">Official</option>
            </select>
          </label>
          <label>
            Short supporting passage
            <textarea name="extractedText" maxLength={1000} required />
          </label>
          <label>
            Normalized fact (same format as stored terms)
            <input name="normalizedValue" required maxLength={1000} />
          </label>
          <label>
            Captured (UTC date)
            <input type="date" name="capturedAt" required />
          </label>
          <label>
            Apply this normalized fact to structured offer terms?
            <select name="applyToTerms">
              <option value="no">No — append evidence only</option>
              <option value="yes">
                Yes — official evidence and typed value required
              </option>
            </select>
          </label>
          <label>
            Known conflicting terms
            <select name="conflicting">
              <option value="no">No</option>
              <option value="yes">Yes — retain both sources</option>
            </select>
          </label>
        </div>
        <button disabled={ep || !offers.length} className="mt-4">
          Append evidence
        </button>
        <p role="status" className="mt-3">
          {es.message}
        </p>
      </form>
      <form action={sa} className="panel">
        <h2 className="mb-4 text-xl font-bold">Review obsolete evidence</h2>
        <p className="mb-4 text-sm muted">
          Superseding requires a documented review reason. Old passages remain
          stored.
        </p>
        <label>
          Active evidence
          <select name="evidenceId">
            {evidence.map((e) => (
              <option key={e.id} value={e.id}>
                {offers.find((o) => o.id === e.offerId)?.title} · {e.field}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-4">
          Review reason
          <textarea name="reason" minLength={10} maxLength={500} required />
        </label>
        <button className="mt-4" disabled={sp || !evidence.length}>
          Supersede with reason
        </button>
        <p role="status" className="mt-3">
          {ss.message}
        </p>
      </form>
      <form action={pa} className="panel">
        <h2 className="mb-4 text-xl font-bold">
          Platform sources and automation policy
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            Platform
            <select name="platformId">
              {platforms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Policy
            <select name="automationPolicy">
              <option value="unknown">UNKNOWN</option>
              <option value="prohibited">PROHIBITED</option>
              <option value="permitted">
                PERMITTED — affirmative evidence required
              </option>
            </select>
          </label>
          {["termsUrl", "rulesUrl", "promotionsUrl"].map((name) => (
            <label key={name}>
              {name}
              <input name={name} type="url" />
            </label>
          ))}
          <label>
            Official policy source
            <input name="sourceUrl" type="url" required />
          </label>
          <label>
            Exact short policy passage
            <textarea name="extractedText" required maxLength={1000} />
          </label>
          <label>
            Captured (UTC date)
            <input name="capturedAt" type="date" required />
          </label>
        </div>
        <button className="mt-4" disabled={pp || !platforms.length}>
          Save policy research
        </button>
        <p role="status" className="mt-3">
          {ps.message}
        </p>
      </form>
    </div>
  );
}
