"use client";
import { useActionState } from "react";
import { saveHigh5, savePlay, saveRedemption, syncPublic } from "./actions";
import type { High5Update } from "@/domain/high5";
const initial = { ok: false, message: "" };
function FreeOnly() {
  return (
    <label className="flex items-start gap-2">
      <input
        className="!w-auto"
        type="checkbox"
        name="freeOnly"
        value="yes"
        required
      />
      <span>
        All recorded funds came from free promotions. I contributed $0 and
        purchased nothing.
      </span>
    </label>
  );
}
export function High5UpdateForm({
  accountId,
  submissionKey,
  current,
  offers,
}: {
  accountId: string;
  submissionKey: string;
  current: High5Update | null;
  offers: { id: string; title: string }[];
}) {
  const [s, submit, pending] = useActionState(saveHigh5, initial);
  return (
    <form action={submit} className="panel space-y-4">
      <h2 className="text-xl font-bold">CHECK REWARD / QUICK ACCOUNT UPDATE</h2>
      <p className="muted text-sm">
        Check High 5 yourself. Confirm current values; clear any field that is
        unknown. No passwords, cookies, ID documents or banking details.
      </p>
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="submissionKey" value={submissionKey} />
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["sc", "Current total free SC", current?.sc],
          ["playableSC", "Playable free SC", current?.playableSC],
          [
            "redeemableSC",
            "Operator-confirmed redeemable SC",
            current?.redeemableSC,
          ],
        ].map(([name, label, value]) => (
          <label key={name}>
            {label}
            <input
              name={name!}
              defaultValue={value ?? ""}
              inputMode="decimal"
              placeholder="UNKNOWN"
            />
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="checkedReward"
          value="yes"
          className="!w-auto"
        />
        I checked the free reward / inbox
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          Reward outcome
          <select name="rewardKind">
            <option>UNKNOWN</option>
            <option>NO_REWARD</option>
            <option>GC_ONLY</option>
            <option>SC_ONLY</option>
            <option>GC_AND_SC</option>
            <option>OTHER</option>
          </select>
        </label>
        <label>
          Reward actually claimed?
          <select name="rewardClaimed">
            <option>UNKNOWN</option>
            <option>NO</option>
            <option>YES</option>
          </select>
        </label>
        <label>
          Free SC received
          <input name="rewardSC" inputMode="decimal" placeholder="UNKNOWN" />
        </label>
        <label>
          Free GC received
          <input name="rewardGC" inputMode="decimal" placeholder="UNKNOWN" />
        </label>
      </div>
      <details>
        <summary className="cursor-pointer font-semibold underline">
          GC, schedule and playthrough details
        </summary>
        <div className="grid gap-3 sm:grid-cols-2 mt-3">
          <label>
            Current free GC (never cash)
            <input
              name="gc"
              inputMode="decimal"
              placeholder="UNKNOWN"
              defaultValue={current?.gc ?? ""}
            />
          </label>
          <label>
            Reward category
            <select name="rewardScope">
              <option value="RECURRING">Recurring/inbox</option>
              <option value="SIGNUP">Signup</option>
              <option value="OTHER">Other free reward</option>
            </select>
          </label>
          <label>
            Published offer source, if known
            <select name="legacyOfferId">
              <option value="">UNKNOWN / four-hour inbox reward</option>
              {offers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Other reward description
            <input name="otherReward" maxLength={100} />
          </label>
          <label>
            Next reward time shown (Central)
            <input name="nextRewardAt" type="datetime-local" />
          </label>
          {[
            [
              "playthroughRemaining",
              "Playthrough remaining shown",
              current?.playthroughRemaining,
            ],
            [
              "playthroughRequired",
              "Total required playthrough shown",
              current?.playthroughRequired,
            ],
            [
              "playthroughPlayed",
              "Playthrough progress shown",
              current?.playthroughPlayed,
            ],
            [
              "redemptionMinimum",
              "Redemption minimum shown",
              current?.redemptionMinimum,
            ],
          ].map(([name, label, value]) => (
            <label key={name}>
              {label}
              <input
                name={name!}
                inputMode="decimal"
                placeholder="UNKNOWN"
                defaultValue={value ?? ""}
              />
            </label>
          ))}
          <label>
            Manual effort, minutes
            <input name="minutes" inputMode="decimal" defaultValue="0" />
          </label>
          <label>
            Optional observation note
            <input name="notes" maxLength={500} />
          </label>
        </div>
      </details>
      <FreeOnly />
      <button disabled={pending}>
        {pending ? "Saving…" : "Save High 5 update"}
      </button>
      <p role="status">{s.message}</p>
    </form>
  );
}
export function High5PlayForm({
  accountId,
  submissionKey,
  start,
}: {
  accountId: string;
  submissionKey: string;
  start: string | null;
}) {
  const [s, submit, pending] = useActionState(savePlay, initial);
  return (
    <form action={submit} className="panel space-y-3">
      <h2 className="text-xl font-bold">RECORD PLAY</h2>
      <p className="text-sm muted">
        Record play you already performed yourself. This app recommends no game
        without verified critical data and never executes gameplay.
      </p>
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="submissionKey" value={submissionKey} />
      <label>
        Game
        <input name="game" required maxLength={100} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          Starting playable free SC
          <input
            name="start"
            defaultValue={start ?? ""}
            required
            inputMode="decimal"
          />
        </label>
        <label>
          Wager in free SC
          <input name="wager" required inputMode="decimal" />
        </label>
        <label>
          Result
          <select name="result">
            <option>WIN</option>
            <option>LOSS</option>
            <option>PUSH</option>
          </select>
        </label>
        <label>
          Ending playable free SC
          <input name="end" required inputMode="decimal" />
        </label>
        <label>
          Operator-confirmed playthrough contribution
          <input
            name="contribution"
            placeholder="UNKNOWN"
            inputMode="decimal"
          />
        </label>
        <label>
          Manual effort, minutes
          <input name="minutes" defaultValue="0" inputMode="decimal" />
        </label>
      </div>
      <FreeOnly />
      <button disabled={pending}>Record manual play</button>
      <p role="status">{s.message}</p>
    </form>
  );
}
export function High5RedemptionForm({
  accountId,
  submissionKey,
  today,
  requests,
}: {
  accountId: string;
  submissionKey: string;
  today: string;
  requests: {
    id: string;
    requestedSC: string;
    method: string;
    status: string;
  }[];
}) {
  const [s, submit, pending] = useActionState(saveRedemption, initial);
  return (
    <form action={submit} className="panel space-y-3">
      <h2 className="text-xl font-bold">RECORD REDEMPTION</h2>
      <p className="muted text-sm">
        Record a request/result you handled yourself. Prizeout explicitly
        requires no prior purchase. Trustly help is inconsistent; verify your
        method. Skrill is excluded because it requires purchase.
      </p>
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="submissionKey" value={submissionKey} />
      <label>
        Request
        <select name="redemptionId">
          <option value="">New manual request</option>
          {requests.map((r) => (
            <option key={r.id} value={r.id}>
              {r.requestedSC} SC · {r.method} · {r.status}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          Requested SC
          <input name="requestedSC" required inputMode="decimal" />
        </label>
        <label>
          Actual received USD/prize value
          <input name="receivedUSD" placeholder="UNKNOWN" inputMode="decimal" />
        </label>
        <label>
          Request date (Central)
          <input name="requestedAt" type="date" required defaultValue={today} />
        </label>
        <label>
          Completion date (Central)
          <input name="completedAt" type="date" />
        </label>
        <label>
          Method
          <select name="method">
            <option>PRIZEOUT</option>
            <option>TRUSTLY</option>
            <option>UNKNOWN</option>
          </select>
        </label>
        <label>
          Status
          <select name="status">
            <option>REQUESTED</option>
            <option>COMPLETED</option>
            <option>CANCELLED</option>
            <option>FAILED</option>
          </select>
        </label>
        <label>
          Manual effort, minutes
          <input name="minutes" defaultValue="0" inputMode="decimal" />
        </label>
      </div>
      <FreeOnly />
      <button disabled={pending}>Record redemption</button>
      <p role="status">{s.message}</p>
    </form>
  );
}
export function High5SyncForm() {
  const [s, submit, pending] = useActionState(syncPublic, initial);
  return (
    <form action={submit}>
      <button disabled={pending}>
        {pending
          ? "Reading public documents…"
          : "Sync official public information"}
      </button>
      <p role="status" className="mt-2 text-sm">
        {s.message}
      </p>
    </form>
  );
}
