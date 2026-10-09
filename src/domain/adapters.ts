import {
  effectivePolicy,
  actionStage,
  executionPlan,
  type ActionType,
  type Engine,
  type PolicyEvidence,
  type Funding,
} from "./operations";
import { RealPrizeAdapter } from "./realprize-adapter";
import { High5Adapter } from "./high5-adapter";
export interface PlatformAdapter {
  platformId: string;
  capabilities: Partial<Record<ActionType, boolean>>;
  discoverOffers(): Promise<unknown>;
  checkRewardAvailability(): Promise<unknown>;
  readPromotionalBalance(): Promise<unknown>;
  readRedeemableBalance(): Promise<unknown>;
  claimReward(): Promise<unknown>;
  executePromotionalPlay(): Promise<unknown>;
  requestRedemption(): Promise<unknown>;
}
// High 5 metadata/manual support only; no automatic capability is enabled.
const adapters = new Map<string, PlatformAdapter>();
export const realAdapters: ReadonlyMap<string, PlatformAdapter> = adapters;
export function registerHigh5Adapter(platformId: string) {
  const a = new High5Adapter(platformId);
  adapters.set(platformId, a);
  return a;
}
export function authorizeAutomatic(input: {
  type: ActionType;
  engine: Engine;
  funding: Funding;
  eligible: boolean;
  excluded: boolean;
  demo: boolean;
  policies: PolicyEvidence[];
  adapterEnabled: boolean;
  availableAt: Date;
  expiresAt: Date | null;
  now: Date;
}) {
  const policy = effectivePolicy(
    input.policies,
    actionStage(input.type),
    input.demo,
    input.now,
  );
  const plan = executionPlan({ ...input, policy });
  if (plan.mode !== "AUTOMATIC")
    throw new Error("Automatic execution rejected: " + plan.reason);
  if (!input.adapterEnabled)
    throw new Error("No enabled executor for this capability.");
  if (
    input.availableAt > input.now ||
    (input.expiresAt && input.expiresAt <= input.now)
  )
    throw new Error("Action is not currently available.");
  return true;
}

export function registerRealPrizeAdapter(platformId: string) {
  const a = new RealPrizeAdapter(platformId);
  adapters.set(platformId, a);
  return a;
}
