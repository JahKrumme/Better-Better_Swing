"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { recordManualClaim, changeManualClaimState } from "@/db/claim-service";
import { claimStates } from "@/domain/recurrence";
import type { FormState } from "../research/actions";
export async function markClaimed(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const id = z.uuid().safeParse(form.get("offerId"));
  const received = z
    .string()
    .regex(/^(\d{1,10}(\.\d{1,2})?)?$/)
    .safeParse(form.get("received") ?? "");
  if (!received.success)
    return {
      ok: false,
      message: "Enter a nonnegative promotional amount or leave unknown.",
    };
  if (!id.success) return { ok: false, message: "Invalid offer." };
  try {
    await recordManualClaim(id.data, new Date(), received.data || null);
    revalidatePath("/", "layout");
    return {
      ok: true,
      message:
        "Manual claim recorded. Next recurring instance remains available on its own date.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Unable to record claim.",
    };
  }
}
export async function updateClaim(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const v = z
    .object({
      id: z.uuid(),
      state: z.enum(claimStates),
      actual: z
        .string()
        .regex(/^(\d{1,10}(\.\d{1,2})?)?$/)
        .transform((v) => v || null),
    })
    .safeParse(Object.fromEntries(form));
  if (!v.success)
    return {
      ok: false,
      message: "Choose a claim state and a nonnegative cash amount.",
    };
  try {
    await changeManualClaimState(v.data.id, v.data.state, v.data.actual);
    revalidatePath("/", "layout");
    return {
      ok: true,
      message:
        "Manual claim state updated. Promotional and actual cash values remain separate.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Unable to update claim.",
    };
  }
}
