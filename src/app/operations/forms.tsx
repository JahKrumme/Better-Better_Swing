"use client";
import { useActionState } from "react";
import {
  completeTask,
  recordEvent,
  updateStrategy,
  newDemo,
  stepDemo,
  type OperationState,
} from "./actions";
import type { RiskControls } from "@/domain/operations";
const initial: OperationState = { ok: false, message: "" };
export function ManualTaskForm({ id }: { id: string }) {
  const [s, action, pending] = useActionState(completeTask, initial);
  return (
    <form action={action} className="mt-4 space-y-2">
      <input type="hidden" name="id" value={id} />
      <label>
        What did you check or observe?
        <input required name="result" maxLength={2000} />
      </label>
      <button disabled={pending}>Record manual check</button>
      <p role="status">{s.message}</p>
    </form>
  );
}
export function LedgerForm({
  accounts,
  submissionKey,
}: {
  accounts: { id: string; label: string }[];
  submissionKey: string;
}) {
  const [s, action, pending] = useActionState(recordEvent, initial);
  return (
    <form action={action} className="panel space-y-3">
      <h2 className="text-xl font-bold">Record a manual balance event</h2>
      <p className="muted text-sm">
        Record rewards on Offers, then refresh Today. This form records
        confirmed transfers and redemption results. Wagers are available only in
        the simulation.
      </p>
      <input type="hidden" name="submissionKey" value={submissionKey} />
      <label>
        Bookkeeping account
        <select name="accountId" required>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Event
        <select name="eventType">
          {[
            "PROMOTIONAL_ACTIVATED",
            "PLAYTHROUGH_COMPLETED",
            "BECAME_REDEEMABLE",
            "REDEMPTION_REQUESTED",
            "REDEMPTION_COMPLETED",
            "EXPIRED",
            "ADJUSTMENT",
          ].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <label>
          Currency (exact ledger unit)
          <input name="currency" required maxLength={40} />
        </label>
        <label>
          Amount (0 for playthrough marker)
          <input name="amount" required inputMode="decimal" />
        </label>
      </div>
      <label>
        Balance category
        <select name="category">
          {["PROMOTIONAL", "PLAYABLE", "REDEEMABLE", "REDEEMED"].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <p className="text-sm muted">
        Activation uses PLAYABLE. Became redeemable uses the source category.
        Requests use REDEEMABLE; completions use REDEEMED. Adjustments only
        reduce balances.
      </p>
      <label>
        Related request ID (required for redemption completion)
        <input name="relatedEventId" />
      </label>
      <label>
        Actual cash/prize received, USD (completion only)
        <input name="actualCashAmount" inputMode="decimal" />
      </label>
      <label>
        Manual terms / result evidence
        <textarea name="notes" required maxLength={2000} />
      </label>
      <button disabled={pending || !accounts.length}>Record event</button>
      <p role="status">{s.message}</p>
    </form>
  );
}
export function StrategyForm({
  accountId,
  controls,
}: {
  accountId: string;
  controls: RiskControls;
}) {
  const [s, action, pending] = useActionState(updateStrategy, initial);
  return (
    <form action={action} className="panel space-y-3">
      <h2 className="font-bold text-xl">
        Promotional strategy — planning only
      </h2>
      <input type="hidden" name="accountId" value={accountId} />
      <p className="muted">
        No deposit, purchase, loss chasing or wagering redeemable funds. Blank
        terms remain unknown.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {[
          [
            "maxLoss",
            "Maximum promotional loss/session",
            controls.maxPromotionalLossPerSession,
          ],
          [
            "maxWager",
            "Maximum promotional wager",
            controls.maxPromotionalWager,
          ],
          [
            "maxMinutes",
            "Maximum session minutes",
            String(controls.maxSessionDuration),
          ],
          [
            "stopBalance",
            "Stop at remaining promotional balance",
            controls.stopAtPromotionalBalance,
          ],
          [
            "minEV",
            "Minimum expected redeemable value",
            controls.minimumExpectedValue ?? "",
          ],
        ].map(([name, label, value]) => (
          <label key={name}>
            {label}
            <input name={name} defaultValue={value} />
          </label>
        ))}
      </div>
      <label>
        Game
        <input name="game" required />
      </label>
      <label>
        Eligibility
        <select name="eligible">
          <option value="unknown">Unknown</option>
          <option value="yes">Confirmed eligible</option>
          <option value="no">Ineligible</option>
        </select>
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        {[
          ["contribution", "Wagering contribution, %"],
          ["gameMin", "Game minimum wager"],
          ["gameMax", "Game maximum wager"],
          ["rtp", "RTP (0–1, reliably sourced only)"],
          ["volatility", "Known volatility"],
          ["threshold", "Redemption threshold"],
          ["remaining", "Required promotional playthrough remaining"],
          [
            "expectedValue",
            "Expected redeemable value (same units, supported calculation)",
          ],
        ].map(([name, label]) => (
          <label key={name}>
            {label}
            <input name={name} />
          </label>
        ))}
      </div>
      <label>
        Official game/terms source
        <input name="sourceUrl" type="url" />
      </label>
      <button disabled={pending}>Save planning inputs</button>
      <p role="status">{s.message}</p>
    </form>
  );
}
export function NewDemoForm() {
  const [s, action, pending] = useActionState(newDemo, initial);
  return (
    <form action={action}>
      <button disabled={pending}>Start a new simulation</button>
      <p role="status" className="mt-2">
        {s.message}
      </p>
    </form>
  );
}
export function DemoStepForm({
  runId,
  step,
  label,
}: {
  runId: string;
  step: number;
  label: string;
}) {
  const [s, action, pending] = useActionState(stepDemo, initial);
  return (
    <form action={action}>
      <input type="hidden" name="runId" value={runId} />
      <input type="hidden" name="step" value={step} />
      <button disabled={pending}>Simulate: {label}</button>
      <p role="status" className="mt-2">
        {s.message}
      </p>
    </form>
  );
}
