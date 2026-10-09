import type { Evidence } from "./eligibility";
export const verificationStates = [
  "VERIFIED_FREE",
  "NEEDS_VERIFICATION",
  "EXCLUDED_REQUIRES_MONEY",
  "EXCLUDED_GEOGRAPHY",
  "EXCLUDED_PLATFORM",
  "EXPIRED",
] as const;
export type VerificationState = (typeof verificationStates)[number];
export const phase2EvidenceFields = [
  "entryFeeRequired",
  "playthroughRequirement",
  "minimumRedemption",
  "recurrence",
  "acquisition",
  "expirationDate",
] as const;
export function currentEvidence(evidence: Evidence[], now: Date) {
  return evidence.filter(
    (e) =>
      !e.supersededAt &&
      e.capturedAt <= now &&
      now.getTime() - e.capturedAt.getTime() <= 30 * 86400000,
  );
}
export function hasEvidenceConflict(evidence: Evidence[], now: Date) {
  const groups = new Map<string, Set<string>>();
  for (const e of currentEvidence(evidence, now)) {
    if (e.sourceType !== "official") continue;
    if (e.conflicting) return true;
    if (e.normalizedValue !== undefined && e.normalizedValue !== null) {
      const values = groups.get(e.field) ?? new Set<string>();
      values.add(e.normalizedValue.trim().toLowerCase());
      groups.set(e.field, values);
    }
  }
  return [...groups.values()].some((values) => values.size > 1);
}
export function automationPolicy(
  platform: {
    automationPolicy: string;
    automationPolicyEvidence: string | null;
    automationPolicySource: string | null;
    automationPolicyLastVerifiedAt: Date | null;
  },
  now = new Date(),
): "PERMITTED" | "PROHIBITED" | "UNKNOWN" {
  const date = platform.automationPolicyLastVerifiedAt;
  if (
    !date ||
    date > now ||
    now.getTime() - date.getTime() > 30 * 86400000 ||
    !platform.automationPolicyEvidence?.trim() ||
    !platform.automationPolicySource?.startsWith("https://")
  )
    return "UNKNOWN";
  return platform.automationPolicy === "permitted"
    ? "PERMITTED"
    : platform.automationPolicy === "prohibited"
      ? "PROHIBITED"
      : "UNKNOWN";
}
export function isRealRecord(record: {
  fixture: boolean;
  platform?: { fixture?: boolean };
}) {
  return !record.fixture && !record.platform?.fixture;
}
