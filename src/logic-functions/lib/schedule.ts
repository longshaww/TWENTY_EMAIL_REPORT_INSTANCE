/**
 * Scheduling helpers. Because Twenty cron patterns are static in the manifest
 * (one pattern, not one-per-report), we run a single dispatcher on a fixed cadence
 * and advance each report's own `nextRunAt` here.
 *
 * v1 simplification: `sendHour` is interpreted in UTC. `timezone` is stored on the
 * report for a future enhancement.
 */
import { REPORT_FREQUENCY } from 'src/constants/universal-identifiers';

const DAY_MS = 86_400_000;

/**
 * Next delivery time strictly after `now`, at `sendHour` UTC, for the frequency.
 * For WEEKLY, `sendDayOfWeek` (0=Sun … 6=Sat, UTC) pins the delivery day; when it
 * is null/undefined the weekly cadence anchors to the day-of-week of `now` (i.e.
 * the day the report was activated), preserving the original behaviour.
 */
export function computeNextRunAt(
  frequency: string,
  sendHour: number,
  now: Date = new Date(),
  sendDayOfWeek?: number | null,
  sendDayOfMonth?: number | null,
): Date | null {
  if (frequency === REPORT_FREQUENCY.MANUAL) return null;
  const hour = Number.isFinite(sendHour) ? Math.min(23, Math.max(0, Math.floor(sendHour))) : 8;

  // Candidate = today at sendHour UTC.
  const candidate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, 0, 0, 0),
  );

  if (frequency === REPORT_FREQUENCY.DAILY) {
    if (candidate.getTime() <= now.getTime()) candidate.setTime(candidate.getTime() + DAY_MS);
    return candidate;
  }
  if (frequency === REPORT_FREQUENCY.WEEKLY) {
    // If a specific weekday is chosen, shift the candidate forward onto it first.
    const target = Number.isInteger(sendDayOfWeek) ? ((sendDayOfWeek as number) % 7 + 7) % 7 : null;
    if (target !== null) {
      const shift = (target - candidate.getUTCDay() + 7) % 7;
      if (shift) candidate.setTime(candidate.getTime() + shift * DAY_MS);
    }
    while (candidate.getTime() <= now.getTime()) candidate.setTime(candidate.getTime() + 7 * DAY_MS);
    return candidate;
  }
  if (frequency === REPORT_FREQUENCY.MONTHLY) {
    // Anchor to a PERSISTED day-of-month (sendDayOfMonth) so the slot never drifts.
    // Deriving the day from `now` each run would walk the date earlier after any
    // short month (a 31st report clamped to Feb 28 would then stick at the 28th).
    // Clamp the anchor to each target month's last day (so "31" → Feb 28/29) but
    // keep using the original anchor for the following months.
    const anchor =
      Number.isInteger(sendDayOfMonth) ? Math.min(31, Math.max(1, sendDayOfMonth as number)) : now.getUTCDate();
    const y = now.getUTCFullYear();
    const mo = now.getUTCMonth();
    const thisSlot = new Date(Date.UTC(y, mo, Math.min(anchor, daysInMonth(y, mo)), hour, 0, 0, 0));
    if (thisSlot.getTime() > now.getTime()) return thisSlot;
    // This month's slot has passed → the same anchor next month.
    const ny = mo === 11 ? y + 1 : y;
    const nmo = (mo + 1) % 12;
    return new Date(Date.UTC(ny, nmo, Math.min(anchor, daysInMonth(ny, nmo)), hour, 0, 0, 0));
  }
  return null;
}

/** Days in a (possibly overflowing) UTC month; day 0 of month+1 = last day of month. */
function daysInMonth(year: number, monthZeroBased: number): number {
  return new Date(Date.UTC(year, monthZeroBased + 1, 0)).getUTCDate();
}

export function isDue(nextRunAt: string | null | undefined, now: Date = new Date()): boolean {
  // A null nextRunAt is NOT due: a scheduled report only fires once it has a
  // computed slot. (The dispatcher backfills a slot for any ACTIVE report missing
  // one, WITHOUT sending — otherwise activating a report would blast immediately,
  // ignoring the chosen day/hour.)
  if (!nextRunAt) return false;
  return new Date(nextRunAt).getTime() <= now.getTime();
}
