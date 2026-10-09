"use server";
import { revalidatePath } from "next/cache";
import {
  recordHigh5Update,
  recordHigh5Play,
  recordHigh5Redemption,
  syncHigh5PublicSources,
} from "@/db/high5-service";
import { chicagoTime } from "@/domain/high5";
export type High5FormState = { ok: boolean; message: string };
async function action(
  work: () => Promise<unknown>,
  message: string,
): Promise<High5FormState> {
  try {
    await work();
    revalidatePath("/", "layout");
    return { ok: true, message };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error ? e.message : "Unable to record High 5 observation.",
    };
  }
}
const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;
export async function saveHigh5(_: High5FormState, f: FormData) {
  return action(
    () =>
      recordHigh5Update({
        submissionKey: text(f, "submissionKey"),
        accountId: text(f, "accountId"),
        legacyOfferId: text(f, "legacyOfferId"),
        checkedReward: f.get("checkedReward") === "yes",
        rewardKind: text(f, "rewardKind") ?? "UNKNOWN",
        rewardClaimed: text(f, "rewardClaimed") ?? "UNKNOWN",
        rewardScope: text(f, "rewardScope") ?? "RECURRING",
        rewardSC: text(f, "rewardSC"),
        rewardGC: text(f, "rewardGC"),
        otherReward: text(f, "otherReward"),
        gc: text(f, "gc"),
        sc: text(f, "sc"),
        playableSC: text(f, "playableSC"),
        redeemableSC: text(f, "redeemableSC"),
        playthroughRequired: text(f, "playthroughRequired"),
        playthroughPlayed: text(f, "playthroughPlayed"),
        playthroughRemaining: text(f, "playthroughRemaining"),
        redemptionMinimum: text(f, "redemptionMinimum"),
        nextRewardAt: text(f, "nextRewardAt")
          ? chicagoTime(text(f, "nextRewardAt")!)
          : null,
        minutes: Number(text(f, "minutes") ?? 0),
        freeOnly: f.get("freeOnly") === "yes",
        notes: text(f, "notes"),
      }),
    "High 5 observation saved. Known free receipts and balances reconciled; no platform action executed.",
  );
}
export async function savePlay(_: High5FormState, f: FormData) {
  return action(
    () =>
      recordHigh5Play({
        submissionKey: text(f, "submissionKey"),
        accountId: text(f, "accountId"),
        game: text(f, "game"),
        start: text(f, "start"),
        wager: text(f, "wager"),
        result: text(f, "result"),
        end: text(f, "end"),
        contribution: text(f, "contribution"),
        minutes: Number(text(f, "minutes") ?? 0),
        freeOnly: f.get("freeOnly") === "yes",
      }),
    "Already-performed manual play recorded. Unknown contribution stays unknown; no gameplay executed.",
  );
}
export async function saveRedemption(_: High5FormState, f: FormData) {
  return action(
    () =>
      recordHigh5Redemption({
        submissionKey: text(f, "submissionKey"),
        accountId: text(f, "accountId"),
        redemptionId: text(f, "redemptionId"),
        requestedSC: text(f, "requestedSC"),
        receivedUSD: text(f, "receivedUSD"),
        requestedAt: chicagoTime(text(f, "requestedAt") ?? ""),
        completedAt: text(f, "completedAt")
          ? chicagoTime(text(f, "completedAt")!)
          : null,
        method: text(f, "method") ?? "UNKNOWN",
        status: text(f, "status") ?? "REQUESTED",
        minutes: Number(text(f, "minutes") ?? 0),
        freeOnly: f.get("freeOnly") === "yes",
      }),
    "Manual redemption recorded. Actual prize/USD value stays separate from SC.",
  );
}
export async function syncPublic() {
  return action(
    () => syncHigh5PublicSources(),
    "Official public sources synchronized. Changes require primary-source re-verification; no account access occurred.",
  );
}
