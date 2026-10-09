import { opportunityFor } from "./recurrence";
export const scheduleKinds = [
  "HOURLY_INTERVAL",
  "DAILY",
  "EVERY_N_HOURS",
  "WEEKLY",
  "CUSTOM",
] as const;
export type ScheduleSpec = {
  kind: (typeof scheduleKinds)[number];
  hours: number | null;
  anchor: string;
  timezone: string;
  windows: { start: string; end: string }[];
};
export function scheduledOpportunity(
  spec: ScheduleSpec,
  now: Date,
  verifiedAt: Date,
  expiresAt: Date | null,
  source: "official" | "observation" | "simulation",
  purpose: "CLAIM_REWARD" | "CHECK_REWARD",
) {
  const anchor = new Date(spec.anchor);
  if (
    !Number.isFinite(anchor.getTime()) ||
    !Number.isFinite(now.getTime()) ||
    verifiedAt > now ||
    now.getTime() - verifiedAt.getTime() > 30 * 86400000 ||
    (expiresAt && expiresAt <= now) ||
    now < anchor ||
    (source === "observation" && purpose !== "CHECK_REWARD")
  )
    return null;
  let start: Date, end: Date, key: string;
  if (spec.kind === "DAILY" || spec.kind === "WEEKLY") {
    const p = opportunityFor(
      {
        id: "schedule",
        offerType: spec.kind.toLowerCase(),
        recurringCadence: spec.kind.toLowerCase(),
        recurrenceTimezone: spec.timezone,
        startDate: anchor,
        expirationDate: expiresAt,
      },
      now,
    );
    start = p.availableDate;
    end = p.opportunityEndsAt!;
    key = p.periodKey;
  } else if (spec.kind === "CUSTOM") {
    if (
      spec.windows.some(
        (w) =>
          !Number.isFinite(Date.parse(w.start)) ||
          !Number.isFinite(Date.parse(w.end)) ||
          Date.parse(w.end) <= Date.parse(w.start),
      )
    )
      throw new Error("Invalid custom window.");
    const sorted = [...spec.windows].sort(
      (a, b) => Date.parse(a.start) - Date.parse(b.start),
    );
    if (
      sorted.some(
        (w, i) => i > 0 && Date.parse(w.start) < Date.parse(sorted[i - 1].end),
      )
    )
      throw new Error("Overlapping custom windows.");
    const w = sorted.find(
      (w) =>
        Date.parse(w.start) <= now.getTime() &&
        Date.parse(w.end) > now.getTime(),
    );
    if (!w) return null;
    start = new Date(w.start);
    end = new Date(w.end);
    key = `custom:${w.start}`;
  } else {
    const hours = spec.kind === "HOURLY_INTERVAL" ? 1 : spec.hours;
    if (hours === null || !Number.isInteger(hours) || hours < 1 || hours > 168)
      throw new Error("Invalid interval hours.");
    const ms = hours * 3600000,
      slot = Math.floor((now.getTime() - anchor.getTime()) / ms);
    start = new Date(anchor.getTime() + slot * ms);
    end = new Date(start.getTime() + ms);
    key = `interval:${spec.anchor}:${hours}:${slot}`;
  }
  if (expiresAt && expiresAt < end) end = expiresAt;
  if (end <= now) return null;
  return { key, availableAt: start, expiresAt: end };
}
