"use client";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  submitCheck,
  saveProfile,
  saveUpdate,
  saveManualPlay,
  saveManualRedemption,
  type FormState,
} from "./actions";
const initial: FormState = { ok: false, message: "" };
export function Refresh() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 30000);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
export function GetMoney() {
  const [state, action, pending] = useActionState(submitCheck, initial);
  return (
    <form action={action}>
      <button className="primary hero-button" disabled={pending}>
        {pending ? "CHECKING…" : "GET MY FREE MONEY"}
      </button>
      <p className="form-result" role="status">
        {state.message}
      </p>
    </form>
  );
}

function Money({
  name,
  label,
  value = null,
}: {
  name: string;
  label: string;
  value?: string | null;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type="number"
        step="0.01"
        min="0"
        defaultValue={value ?? ""}
        placeholder="Unknown"
      />
    </label>
  );
}
function Attestation() {
  return (
    <label className="attestation">
      <input type="checkbox" name="freeOnly" value="yes" required />
      These balances and rewards are entirely free. I deposited or spent $0.
    </label>
  );
}
function Result({ state }: { state: FormState }) {
  return (
    <p
      role="status"
      className={`form-result ${state.message && !state.ok ? "error-text" : ""}`}
    >
      {state.message}
    </p>
  );
}
export function QuickForm({
  accountId,
  currency,
  submissionKey,
}: {
  accountId: string;
  currency: string;
  submissionKey: string;
}) {
  const [state, action, pending] = useActionState(saveUpdate, initial);
  const [claimed, setClaimed] = useState("UNKNOWN");
  return (
    <form action={action} className="consumer-form">
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="submissionKey" value={submissionKey} />
      <div className="form-grid">
        <Money
          name="balance"
          label={`Current promotional balance (${currency})`}
        />
        <Money
          name="redeemable"
          label={`Redeemable now (${currency}, optional)`}
        />
        <label>
          Did you claim a free reward?
          <select
            name="claimed"
            value={claimed}
            onChange={(e) => setClaimed(e.target.value)}
          >
            <option value="UNKNOWN">Unknown / didn’t check</option>
            <option value="YES">Yes, actually claimed</option>
            <option value="NO">No</option>
          </select>
        </label>
        {claimed === "YES" && (
          <Money
            name="received"
            label={`Amount actually received (${currency})`}
          />
        )}
      </div>
      <p className="muted small">
        Leave an amount blank if unknown. An increased balance alone is not a
        received reward.
      </p>
      <details>
        <summary>More details</summary>
        <div className="form-grid">
          <Money name="playable" label="Playable promotional balance" />
          <Money name="gc" label="GC balance (no cash value)" />
          <Money name="receivedGC" label="GC actually received" />
          <Money name="playthroughRemaining" label="Playthrough remaining" />
          <Money name="redemptionMinimum" label="Redemption minimum" />
          <label>
            Reward type
            <select name="rewardKind" defaultValue="UNKNOWN">
              <option value="SC_ONLY">Promotional / SC reward</option>
              <option value="GC_ONLY">GC only</option>
              <option value="GC_AND_SC">GC and SC</option>
              <option value="UNKNOWN">Unknown</option>
              <option value="OTHER">Other</option>
              <option value="NO_REWARD">No reward</option>
            </select>
          </label>
          <label>
            Reward occasion
            <select name="rewardScope">
              <option value="RECURRING">Recurring reward</option>
              <option value="SIGNUP">One-time welcome reward</option>
              <option value="OTHER">Other reward</option>
            </select>
          </label>
          <label>
            Did you check the reward?
            <select name="checked">
              <option value="yes">Yes</option>
              <option value="no">No, balance update only</option>
            </select>
          </label>
          <label>
            Next check (Central time)
            <input type="datetime-local" name="nextRewardAt" />
          </label>
          <label>
            Minutes spent
            <input
              type="number"
              name="minutes"
              min="0"
              max="240"
              step="0.01"
              defaultValue="0"
            />
          </label>
          <label>
            Notes
            <textarea name="notes" maxLength={500} />
          </label>
        </div>
      </details>
      <Attestation />
      <button disabled={pending}>{pending ? "Saving…" : "SAVE UPDATE"}</button>
      <Result state={state} />
    </form>
  );
}
export function PlayForm({
  accountId,
  submissionKey,
}: {
  accountId: string;
  submissionKey: string;
}) {
  const [state, action, pending] = useActionState(saveManualPlay, initial);
  return (
    <form action={action} className="consumer-form">
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="submissionKey" value={submissionKey} />
      <p className="muted">
        Record play you already performed yourself, using free promotional
        currency only.
      </p>
      <div className="form-grid">
        <label>
          Game
          <input name="game" required maxLength={100} />
        </label>
        <Money name="start" label="Playable balance before" />
        <Money name="wager" label="Amount played" />
        <Money name="end" label="Playable balance after" />
        <label>
          Result
          <select name="result">
            <option value="WIN">Win</option>
            <option value="LOSS">Loss</option>
            <option value="PUSH">No change</option>
          </select>
        </label>
        <Money
          name="contribution"
          label="Confirmed playthrough contribution (optional)"
        />
        <label>
          Minutes spent
          <input
            name="minutes"
            type="number"
            min="0"
            max="240"
            defaultValue="0"
          />
        </label>
      </div>
      <Attestation />
      <button disabled={pending}>SAVE MANUAL PLAY</button>
      <Result state={state} />
    </form>
  );
}
export function RedemptionForm({
  accountId,
  submissionKey,
  currency,
  requests,
}: {
  accountId: string;
  submissionKey: string;
  currency: string;
  requests: {
    id: string;
    amount: string;
    requestedAt: string;
    status: string;
    received: string | null;
  }[];
}) {
  const [state, action, pending] = useActionState(
    saveManualRedemption,
    initial,
  );
  const [selected, setSelected] = useState("");
  const request = requests.find((r) => r.id === selected);
  return (
    <form action={action} className="consumer-form">
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="submissionKey" value={submissionKey} />
      <p className="muted">
        Request or redeem on the official platform first, then record what
        actually happened here.
      </p>
      <div className="form-grid">
        <label>
          Redemption request
          <select
            name="redemptionId"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">New request</option>
            {requests
              .filter(
                (r) =>
                  r.status === "REQUESTED" ||
                  (r.status === "COMPLETED" && r.received === null),
              )
              .map((r, i) => (
                <option key={r.id} value={r.id}>
                  {r.amount} {currency} · {r.requestedAt.replace("T", " ")} ·{" "}
                  {r.status === "REQUESTED"
                    ? "pending"
                    : "received, value unknown"}{" "}
                  · request {i + 1}
                </option>
              ))}
          </select>
        </label>
        <Money
          key={`amount:${selected}`}
          value={request?.amount}
          name="requestedSC"
          label={`Requested promotional amount (${currency})`}
        />
        <label>
          Request time (Central)
          <input
            key={`date:${selected}`}
            defaultValue={request?.requestedAt}
            name="requestedAt"
            type="datetime-local"
            required
          />
        </label>
        <label>
          Status
          <select name="status">
            <option value="REQUESTED">Requested / pending</option>
            <option value="COMPLETED">Actually received</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="FAILED">Failed</option>
          </select>
        </label>
        <Money
          name="receivedUSD"
          label="Actual USD prize received (optional)"
        />
        <label>
          Received time (Central)
          <input name="completedAt" type="datetime-local" />
        </label>
        <label>
          Method
          <select name="method">
            <option value="UNKNOWN">Unknown / other free method</option>
            <option value="PRIZEOUT">Prizeout</option>
            <option value="TRUSTLY">Trustly</option>
          </select>
        </label>
        <label>
          Minutes spent
          <input
            name="minutes"
            type="number"
            min="0"
            max="240"
            defaultValue="0"
          />
        </label>
      </div>
      <Attestation />
      <button disabled={pending}>SAVE REDEMPTION</button>
      <Result state={state} />
    </form>
  );
}

export function ProfileForm() {
  const [state, action, pending] = useActionState(saveProfile, initial);
  return (
    <form action={action} className="consumer-form">
      <h2>Check your eligibility</h2>
      <p className="small muted">
        Confirm once so we can show rewards available where you live.
      </p>
      <div className="form-grid">
        <label>
          Age eligibility
          <select name="age">
            <option value="21">I am at least 21</option>
            <option value="18">I am 18–20</option>
          </select>
        </label>
        <input name="country" type="hidden" value="US" />
        <label>
          State (two letters)
          <input
            name="state"
            defaultValue="KS"
            pattern="[A-Z]{2}"
            maxLength={2}
            required
          />
        </label>
      </div>
      <button disabled={pending}>CONFIRM ELIGIBILITY</button>
      <Result state={state} />
    </form>
  );
}
