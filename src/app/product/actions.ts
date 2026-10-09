"use server";
import { revalidatePath } from "next/cache";
import {
  initializeProduct,
  saveQuickUpdate,
  recordAccountPlay,
  recordAccountRedemption,
  runProductCheck,
} from "@/db/product-service";
import { chicagoTime } from "@/domain/high5";
import { db } from "@/db";
import { userSettings } from "@/db/schema";
import { z } from "zod";
export type FormState = { ok: boolean; message: string };
const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;
async function action(
  work: () => Promise<unknown>,
  message: string,
): Promise<FormState> {
  try {
    await work();
    revalidatePath("/", "layout");
    return { ok: true, message };
  } catch (e) {
    if (e instanceof z.ZodError)
      return {
        ok: false,
        message: e.issues[0]?.message ?? "Check the values and try again.",
      };
    const message = e instanceof Error ? e.message : "";
    return {
      ok: false,
      message:
        /balance|amount|reward|receipt|currency|redemption|request|date|already|free-only|STOP PLAYING|INTEGRITY|key|account|current/i.test(
          message,
        ) &&
        !/(sql|database|postgres|connect|relation|password|select |insert )/i.test(
          message,
        )
          ? message
          : "Couldn't save right now. Try again; technical details are available in Advanced.",
    };
  }
}
export async function checkMoney(): Promise<FormState> {
  try {
    const r = await runProductCheck("MANUAL");
    revalidatePath("/", "layout");
    if (r.busy)
      return {
        ok: false,
        message: "A check is already running. Try again shortly.",
      };
    return {
      ok: true,
      message: `Free money check complete · ${r.result?.collected.length ?? 0} collected · ${r.result?.needsYou.length ?? 0} need you · ${r.result?.nothing.length ?? 0} waiting. Open the accounts in Needs you to collect any available reward.`,
    };
  } catch {
    return {
      ok: false,
      message:
        "Couldn't finish this check. Your saved balances are preserved. Try again or see Advanced.",
    };
  }
}
export async function submitCheck() {
  return checkMoney();
}

export async function saveUpdate(_: FormState, f: FormData) {
  return action(
    () =>
      saveQuickUpdate({
        accountId: text(f, "accountId"),
        submissionKey: text(f, "submissionKey"),
        balance: text(f, "balance"),
        redeemable: text(f, "redeemable"),
        playable: text(f, "playable"),
        claimed: text(f, "claimed") ?? "UNKNOWN",
        received: text(f, "received"),
        checked: f.get("checked") !== "no",
        rewardKind:
          text(f, "received") &&
          (!text(f, "rewardKind") || text(f, "rewardKind") === "UNKNOWN")
            ? "SC_ONLY"
            : (text(f, "rewardKind") ?? "UNKNOWN"),
        rewardScope: text(f, "rewardScope") ?? "RECURRING",
        gc: text(f, "gc"),
        receivedGC: text(f, "receivedGC"),
        playthroughRemaining: text(f, "playthroughRemaining"),
        redemptionMinimum: text(f, "redemptionMinimum"),
        nextRewardAt: text(f, "nextRewardAt")
          ? chicagoTime(text(f, "nextRewardAt")!)
          : null,
        offerId: text(f, "offerId"),
        minutes: Number(text(f, "minutes") ?? 0),
        notes: text(f, "notes"),
        freeOnly: f.get("freeOnly") === "yes",
      }),
    "Account updated. Only confirmed receipts count as received rewards.",
  );
}
export async function saveManualPlay(_: FormState, f: FormData) {
  return action(
    () =>
      recordAccountPlay({
        accountId: text(f, "accountId"),
        submissionKey: text(f, "submissionKey"),
        game: text(f, "game"),
        start: text(f, "start"),
        wager: text(f, "wager"),
        end: text(f, "end"),
        result: text(f, "result"),
        contribution: text(f, "contribution"),
        minutes: Number(text(f, "minutes") ?? 0),
        freeOnly: f.get("freeOnly") === "yes",
      }),
    "Manual play recorded. Check the platform for redemption availability.",
  );
}
export async function saveManualRedemption(_: FormState, f: FormData) {
  return action(
    () =>
      recordAccountRedemption({
        accountId: text(f, "accountId"),
        submissionKey: text(f, "submissionKey"),
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
    "Redemption recorded. Actual money received stays separate from promotional currency.",
  );
}

export async function saveProfile(_: FormState, f: FormData) {
  return action(async () => {
    const profile = z
      .object({
        age: z.number().int().min(18).max(120),
        country: z.literal("US"),
        state: z.enum(
          "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(
            " ",
          ),
        ),
      })
      .parse({
        age: Number(text(f, "age")),
        country: text(f, "country"),
        state: text(f, "state"),
      });
    await db
      .insert(userSettings)
      .values({ key: "profile", profile })
      .onConflictDoUpdate({
        target: userSettings.key,
        set: { profile, updatedAt: new Date() },
      });
    await initializeProduct();
  }, "Eligibility settings saved. Your opportunities are now up to date.");
}
