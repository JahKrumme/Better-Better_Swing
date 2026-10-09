"use client";
import { useActionState } from "react";
import { markClaimed, updateClaim } from "./actions";
const initial = { ok: false, message: "" };
export function ClaimButton({
  offerId,
  enabled,
}: {
  offerId: string;
  enabled: boolean;
}) {
  const [state, action, pending] = useActionState(markClaimed, initial);
  return (
    <form action={action} className="mt-5">
      <input type="hidden" name="offerId" value={offerId} />
      <label className="mb-3 text-sm">
        Promotional amount actually received (blank if unknown)
        <input name="received" inputMode="decimal" disabled={!enabled} />
      </label>
      <button disabled={!enabled || pending}>
        {pending ? "Recording…" : "I manually claimed this reward"}
      </button>
      <p role="status" className="mt-2 text-sm">
        {state.message}
      </p>
    </form>
  );
}
export function ClaimUpdate({ id }: { id: string }) {
  const [state, action, pending] = useActionState(updateClaim, initial);
  return (
    <form action={action} className="mt-4 space-y-3">
      <input name="id" type="hidden" value={id} />
      <label>
        Manual next state
        <select name="state">
          <option>PLAYTHROUGH_REQUIRED</option>
          <option>REDEEMABLE</option>
          <option>REDEEMED</option>
          <option>EXPIRED</option>
        </select>
      </label>
      <label>
        Actual cash redeemed in USD (only when redeemed)
        <input name="actual" inputMode="decimal" />
      </label>
      <button disabled={pending}>Update record</button>
      <p role="status">{state.message}</p>
    </form>
  );
}
