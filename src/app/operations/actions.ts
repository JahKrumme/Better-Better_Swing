"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  refreshOperations,
  finishManualAction,
  recordLedgerEvent,
  saveStrategy,
  startDemo,
  advanceDemo,
} from "@/db/operations-service";
import { defaultControls } from "@/domain/operations";
export type OperationState = { ok: boolean; message: string };
async function result(
  fn: () => Promise<unknown>,
  message: string,
): Promise<OperationState> {
  try {
    await fn();
    revalidatePath("/", "layout");
    return { ok: true, message };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Operation failed.",
    };
  }
}
export async function refreshQueue(): Promise<void> {
  await refreshOperations();
  revalidatePath("/", "layout");
}
export async function completeTask(_: OperationState, f: FormData) {
  return result(
    () =>
      finishManualAction(
        z.uuid().parse(f.get("id")),
        z.string().parse(f.get("result")),
      ),
    "Manual check recorded. No external action was executed.",
  );
}
export async function recordEvent(_: OperationState, f: FormData) {
  return result(async () => {
    const nullable = (key: string) => String(f.get(key) ?? "").trim() || null;
    await recordLedgerEvent(z.uuid().parse(f.get("accountId")), {
      eventType: z
        .enum([
          "PROMOTIONAL_ACTIVATED",
          "PLAYTHROUGH_COMPLETED",
          "BECAME_REDEEMABLE",
          "REDEMPTION_REQUESTED",
          "REDEMPTION_COMPLETED",
          "EXPIRED",
          "ADJUSTMENT",
        ])
        .parse(f.get("eventType")),
      category: z
        .enum(["PROMOTIONAL", "PLAYABLE", "REDEEMABLE", "REDEEMED"])
        .parse(f.get("category")),
      currency: String(f.get("currency") ?? ""),
      amount: String(f.get("amount") ?? ""),
      occurredAt: new Date(),
      notes: nullable("notes"),
      relatedEventId: nullable("relatedEventId"),
      actualCashAmount: nullable("actualCashAmount"),
      cashCurrency: nullable("actualCashAmount") !== null ? "USD" : null,
      key: z.uuid().parse(f.get("submissionKey")),
    });
  }, "Manual ledger event recorded. Promotional units and actual USD remain separate.");
}
export async function updateStrategy(_: OperationState, f: FormData) {
  return result(async () => {
    const text = (k: string) => String(f.get(k) ?? "").trim() || null;
    const number = (k: string) => (text(k) === null ? null : Number(text(k)));
    await saveStrategy(
      z.uuid().parse(f.get("accountId")),
      {
        ...defaultControls,
        maxPromotionalLossPerSession: text("maxLoss") ?? "1",
        maxPromotionalWager: text("maxWager") ?? "0.10",
        maxSessionDuration: number("maxMinutes") ?? 15,
        stopAtPromotionalBalance: text("stopBalance") ?? "0.10",
        minimumExpectedValue: text("minEV"),
      },
      {
        game: text("game") ?? "Unverified",
        eligible:
          text("eligible") === "yes"
            ? true
            : text("eligible") === "no"
              ? false
              : null,
        contributionPercent: number("contribution"),
        minimumWager: text("gameMin"),
        maximumWager: text("gameMax"),
        rtp: number("rtp"),
        volatility: text("volatility"),
        redemptionThreshold: text("threshold"),
        playthroughRemaining: text("remaining"),
        expectedRedeemableValue: text("expectedValue"),
        sourceUrl: text("sourceUrl"),
        verifiedAt: text("sourceUrl") ? new Date().toISOString() : null,
      },
    );
  }, "Strategy saved for planning only. No gameplay executor is enabled.");
}
export async function newDemo() {
  return result(
    () => startDemo(),
    "New SIMULATED run created; no real platform was contacted.",
  );
}
export async function stepDemo(_: OperationState, f: FormData) {
  return result(
    () =>
      advanceDemo(
        z.uuid().parse(f.get("runId")),
        z.coerce.number().int().parse(f.get("step")),
      ),
    "Simulation advanced; all values are fictional.",
  );
}
