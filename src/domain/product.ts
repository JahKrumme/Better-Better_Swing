import { z } from "zod";
import {
  cents,
  decimal,
  effectivePolicy,
  freeFunding,
  enforceZeroMoney,
  bankroll,
  type PolicyEvidence,
  type LedgerRecord,
} from "./operations";
import { moneyString } from "./operations";
export const productCapabilities = [
  "DISCOVERY",
  "AVAILABILITY",
  "BALANCE",
  "CLAIM",
  "GAMEPLAY",
  "REDEMPTION",
] as const;
export type ProductCapability = (typeof productCapabilities)[number];
export function canAutomate(
  cap: ProductCapability,
  policies: PolicyEvidence[],
  supported: boolean,
  eligible: boolean,
  now = new Date(),
) {
  return (
    eligible &&
    supported &&
    effectivePolicy(policies, cap, false, now) === "PERMITTED"
  );
}
export function officialLink(raw: string) {
  try {
    const u = new URL(raw);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.port ||
      u.search ||
      u.hash ||
      !u.hostname.includes(".") ||
      u.hostname.includes(":") ||
      u.hostname === "localhost" ||
      /^\d+(\.\d+){3}$/.test(u.hostname)
    )
      return null;
    return u.href;
  } catch {
    return null;
  }
}
export function stableJSON(value: unknown): string {
  const normalize = (v: unknown): unknown =>
    v instanceof Date
      ? v.toISOString()
      : Array.isArray(v)
        ? v.map(normalize)
        : v && typeof v === "object"
          ? Object.fromEntries(
              Object.entries(v)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([k, x]) => [k, normalize(x)]),
            )
          : v;
  return JSON.stringify(normalize(value));
}
export const quickUpdateSchema = z
  .object({
    accountId: z.uuid(),
    submissionKey: z.uuid(),
    balance: moneyString.nullable(),
    redeemable: moneyString.nullable(),
    playable: moneyString.nullable(),
    claimed: z.enum(["YES", "NO", "UNKNOWN"]),
    received: moneyString.nullable(),
    checked: z.boolean(),
    rewardKind: z.enum([
      "SC_ONLY",
      "GC_ONLY",
      "GC_AND_SC",
      "NO_REWARD",
      "OTHER",
      "UNKNOWN",
    ]),
    rewardScope: z.enum(["SIGNUP", "RECURRING", "OTHER"]),
    gc: moneyString.nullable(),
    receivedGC: moneyString.nullable(),
    playthroughRemaining: moneyString.nullable(),
    redemptionMinimum: moneyString.nullable(),
    nextRewardAt: z.date().nullable(),
    offerId: z.uuid().nullable(),
    minutes: z.number().min(0).max(240),
    notes: z.string().max(500).nullable(),
    freeOnly: z.literal(true),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      v.balance !== null &&
      cents(v.redeemable ?? "0") + cents(v.playable ?? "0") > cents(v.balance)
    )
      c.addIssue({
        code: "custom",
        message:
          "Playable and redeemable amounts cannot exceed your total balance.",
      });
    if (v.claimed !== "YES" && (v.received !== null || v.receivedGC !== null))
      c.addIssue({
        code: "custom",
        message:
          "Record received amounts only after you actually claim a reward.",
      });
    if (v.received !== null && !["SC_ONLY", "GC_AND_SC"].includes(v.rewardKind))
      c.addIssue({
        code: "custom",
        message: "Choose the reward currency before entering its amount.",
      });
    if (
      v.receivedGC !== null &&
      !["GC_ONLY", "GC_AND_SC"].includes(v.rewardKind)
    )
      c.addIssue({
        code: "custom",
        message: "Choose a GC reward before entering GC.",
      });
    if (v.rewardKind === "NO_REWARD" && v.claimed === "YES")
      c.addIssue({
        code: "custom",
        message: "No reward cannot also be claimed.",
      });
  });
export type QuickUpdate = z.infer<typeof quickUpdateSchema>;
export function zeroIntegrity(
  events: {
    origin: string;
    userCashContribution: string;
    currency?: string;
    category?: string;
    actualCashAmount?: string | null;
  }[],
) {
  try {
    return events.every(
      (e) =>
        e.origin === "FREE_PROMOTIONAL" &&
        cents(e.userCashContribution) === 0 &&
        (e.currency !== "GC" ||
          (e.category === "PROMOTIONAL" && e.actualCashAmount == null)),
    );
  } catch {
    return false;
  }
}
export type MoneyGroup = {
  platformId: string;
  platform: string;
  currency: string;
  amount: number;
  engine: string;
};
export function moneyGroups(
  accounts: {
    id: string;
    platformId: string;
    demo: boolean;
    engine: string;
    label: string;
  }[],
  platforms: {
    id: string;
    name: string;
    fixture: boolean;
    excluded: boolean;
  }[],
  events: (LedgerRecord & { accountId: string; currency: string })[],
  category: "FREE" | "REDEEMABLE" | "ACTUAL",
) {
  const result: MoneyGroup[] = [];
  for (const a of accounts) {
    const p = platforms.find((p) => p.id === a.platformId);
    if (a.demo || !p || p.fixture || p.excluded) continue;
    for (const currency of new Set(
      events.filter((e) => e.accountId === a.id).map((e) => e.currency),
    )) {
      const b = bankroll(
        events.filter((e) => e.accountId === a.id && e.currency === currency),
      );
      if (category === "ACTUAL") {
        for (const [cash, n] of b.cash)
          result.push({
            platformId: p.id,
            platform: p.name,
            currency: cash,
            amount: n,
            engine: a.engine,
          });
      } else {
        const n =
          category === "REDEEMABLE"
            ? b.availableRedeemable
            : b.balances.PROMOTIONAL +
              b.balances.PLAYABLE +
              b.balances.REDEEMABLE;
        if (n > 0)
          result.push({
            platformId: p.id,
            platform: p.name,
            currency,
            amount: n,
            engine: a.engine,
          });
      }
    }
  }
  // Separate issuers even when their currency labels happen to match.
  return result;
}
export function platformStatus(input: {
  verified: boolean;
  redeemable: number | null;
  balance: string | null;
  due: boolean;
  pending: number;
  expiresAt: Date | null;
  failed: boolean;
  now: Date;
}) {
  if (input.redeemable !== null && input.redeemable > 0)
    return {
      kind: "REDEEM_NOW",
      title: "Redeem now",
      priority: 0,
      action: "REDEEM NOW",
    };
  if (input.failed)
    return {
      kind: "CHECK_FAILED",
      title: "Couldn't refresh right now",
      priority: 2,
      action: "OPEN PLATFORM",
    };
  if (
    input.expiresAt &&
    input.expiresAt > input.now &&
    input.expiresAt.getTime() - input.now.getTime() < 48 * 3600000
  )
    return {
      kind: "EXPIRING_SOON",
      title: "Free credit expires soon",
      priority: 1,
      action: "OPEN PLATFORM",
    };
  if (input.pending > 0)
    return {
      kind: "ACTION_NEEDED",
      title: "Redemption pending",
      priority: 3,
      action: "OPEN PLATFORM",
    };
  if (!input.verified)
    return {
      kind: "INTEGRATION_NEEDS_ATTENTION",
      title: "Needs verification",
      priority: 5,
      action: "OPEN PLATFORM",
    };
  if (input.due)
    return {
      kind: "FREE_MONEY_READY",
      title: "Free reward may be ready",
      priority: 4,
      action: "OPEN PLATFORM",
    };
  return {
    kind: "WAIT",
    title: "Checked · waiting for the next reward",
    priority: 6,
    action: "OPEN PLATFORM",
  };
}
export function runtimeStatus(
  state:
    | {
        enabled: boolean;
        heartbeatAt: Date | null;
        nextRunAt: Date | null;
        lastRunAt: Date | null;
      }
    | undefined,
  now = new Date(),
) {
  const alive =
    !!state?.enabled &&
    !!state.heartbeatAt &&
    state.heartbeatAt <= now &&
    now.getTime() - state.heartbeatAt.getTime() < 45000;
  return {
    on: alive,
    lastRunAt: state?.lastRunAt ?? null,
    nextRunAt: alive ? (state?.nextRunAt ?? null) : null,
  };
}
export function friendlyEvent(
  e: LedgerRecord & { currency: string },
  name: string,
) {
  const amount = `${decimal(cents(e.amount))} ${e.currency}`;
  switch (e.eventType) {
    case "FREE_REWARD_RECEIVED":
      return `${name} — ${amount} free reward received`;
    case "OBSERVATION_RECONCILIATION":
      return `${name} — balance updated`;
    case "BECAME_REDEEMABLE":
      return `${name} — ${amount} became redeemable`;
    case "REDEMPTION_REQUESTED":
      return `${name} — redemption requested`;
    case "REDEMPTION_COMPLETED":
      return `${name} — redemption completed${e.actualCashAmount !== null ? ` · ${e.actualCashAmount} ${e.cashCurrency} received` : " · received value unknown"}`;
    case "REDEMPTION_VALUE_RECORDED":
      return `${name} — ${e.actualCashAmount} ${e.cashCurrency} received`;
    case "REDEMPTION_CANCELLED":
      return `${name} — redemption cancelled`;
    case "PROMOTIONAL_WAGER":
      return `${name} — ${amount} free currency played`;
    case "PROMOTIONAL_WIN":
    case "PROMOTIONAL_LOSS":
      return `${name} — manual play result recorded`;
    case "PLAYTHROUGH_COMPLETED":
      return `${name} — playthrough completed; check redemption`;
    case "EXPIRED":
      return `${name} — ${amount} expired`;
    default:
      return `${name} — free balance updated`;
  }
}
export const authorizedReceipt = z
  .object({
    received: z.literal(true),
    receiptId: z.string().min(1).max(150),
    amount: moneyString,
    currency: z.string().min(1).max(40),
    freeOnly: z.literal(true),
  })
  .strict();
export async function permittedClaim(input: {
  supported: boolean;
  eligible: boolean;
  policies: PolicyEvidence[];
  funding: unknown;
  claim: () => Promise<unknown>;
  now?: Date;
}) {
  enforceZeroMoney(input.funding);
  if (
    !canAutomate(
      "CLAIM",
      input.policies,
      input.supported,
      input.eligible,
      input.now,
    )
  )
    return { manual: true as const, receipt: null };
  const receipt = authorizedReceipt.parse(await input.claim());
  return { manual: false as const, receipt };
}
export { freeFunding };

export interface SupportedAccount {
  platformId: string;
  name: string;
  engine: "CASINO" | "SPORTSBOOK";
  eligible: boolean;
  excluded: boolean;
  policies: PolicyEvidence[];
  supported: Partial<Record<ProductCapability, boolean>>;
  availableAt: Date;
  expiresAt: Date | null;
  funding: unknown;
  discover?: () => Promise<void>;
  availability?: () => Promise<boolean>;
  balance?: () => Promise<void>;
  claim?: () => Promise<unknown>;
  // Receipt storage must commit idempotently before the UI can say "collected".
  received?: (receipt: z.infer<typeof authorizedReceipt>) => Promise<boolean>;
}
export async function executeSupportedChecks(
  accounts: SupportedAccount[],
  now = new Date(),
) {
  const result: {
    collected: { platform: string; amount: string; currency: string }[];
    needsYou: string[];
    nothing: string[];
    publicReads: number;
    failures: string[];
  } = {
    collected: [],
    needsYou: [],
    nothing: [],
    publicReads: 0,
    failures: [],
  };
  for (const a of accounts) {
    try {
      enforceZeroMoney(a.funding);
      const eligible = a.eligible && !a.excluded;
      if (!eligible || (a.expiresAt && a.expiresAt <= now)) {
        result.nothing.push(a.name);
        continue;
      }
      if (
        a.discover &&
        canAutomate(
          "DISCOVERY",
          a.policies,
          a.supported.DISCOVERY === true,
          eligible,
          now,
        )
      ) {
        await a.discover();
        result.publicReads++;
      }
      if (
        a.balance &&
        canAutomate(
          "BALANCE",
          a.policies,
          a.supported.BALANCE === true,
          eligible,
          now,
        )
      )
        await a.balance();
      let available = a.availableAt <= now;
      if (
        a.availability &&
        canAutomate(
          "AVAILABILITY",
          a.policies,
          a.supported.AVAILABILITY === true,
          eligible,
          now,
        )
      )
        available = await a.availability();
      if (!available) {
        result.nothing.push(a.name);
        continue;
      }
      if (!a.claim || !a.received) {
        result.needsYou.push(a.name);
        continue;
      }
      const r = await permittedClaim({
        supported: a.supported.CLAIM === true,
        eligible,
        policies: a.policies,
        funding: a.funding,
        claim: a.claim,
        now,
      });
      if (r.manual) {
        result.needsYou.push(a.name);
        continue;
      }
      if (await a.received(r.receipt))
        result.collected.push({
          platform: a.name,
          amount: r.receipt.amount,
          currency: r.receipt.currency,
        });
      else result.nothing.push(a.name);
      // There is intentionally no automatic wager or redemption path here.
    } catch {
      result.failures.push(a.name);
      result.needsYou.push(a.name);
    }
  }
  return result;
}

// Display aliases do not convert currency or combine different platform issuers.
export function displayUnit(currency: string) {
  return [
    "SC (promotional)",
    "Sweep Coins (promotional)",
    "Sweeps Coins (promotional)",
  ].includes(currency)
    ? "SC"
    : currency === "GC"
      ? "GC (no cash value)"
      : currency;
}
