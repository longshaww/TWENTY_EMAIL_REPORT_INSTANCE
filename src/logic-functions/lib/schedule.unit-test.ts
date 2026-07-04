import { describe, expect, it } from 'vitest';

import { computeNextRunAt, isDue } from 'src/logic-functions/lib/schedule';

const at = (iso: string) => new Date(iso);

describe('computeNextRunAt', () => {
  it('MANUAL has no next run', () => {
    expect(computeNextRunAt('MANUAL', 8, at('2026-01-15T00:00:00Z'))).toBeNull();
  });

  it('DAILY: today if slot ahead, else tomorrow', () => {
    // now 06:00, slot 08:00 → today 08:00
    expect(computeNextRunAt('DAILY', 8, at('2026-01-15T06:00:00Z'))!.toISOString()).toBe('2026-01-15T08:00:00.000Z');
    // now 09:00, slot 08:00 → tomorrow 08:00
    expect(computeNextRunAt('DAILY', 8, at('2026-01-15T09:00:00Z'))!.toISOString()).toBe('2026-01-16T08:00:00.000Z');
  });

  it('WEEKLY: advances 7 days when the slot has passed', () => {
    const next = computeNextRunAt('WEEKLY', 8, at('2026-01-15T09:00:00Z'))!;
    expect(next.toISOString()).toBe('2026-01-22T08:00:00.000Z');
  });

  // 2026-01-15 is a Thursday (getUTCDay() === 4).
  it('WEEKLY: null sendDayOfWeek anchors to the current weekday (unchanged behaviour)', () => {
    expect(computeNextRunAt('WEEKLY', 8, at('2026-01-15T09:00:00Z'), null)!.toISOString()).toBe('2026-01-22T08:00:00.000Z');
  });

  it('WEEKLY: sendDayOfWeek shifts forward to the chosen day (Thu → Sat)', () => {
    // now Thu 06:00, slot still ahead, target Saturday (6) → this Saturday.
    const next = computeNextRunAt('WEEKLY', 8, at('2026-01-15T06:00:00Z'), 6)!;
    expect(next.toISOString()).toBe('2026-01-17T08:00:00.000Z');
    expect(next.getUTCDay()).toBe(6);
  });

  it('WEEKLY: chosen day earlier in the week wraps to next week (Thu → Sun)', () => {
    const next = computeNextRunAt('WEEKLY', 8, at('2026-01-15T06:00:00Z'), 0)!;
    expect(next.toISOString()).toBe('2026-01-18T08:00:00.000Z'); // Sunday
    expect(next.getUTCDay()).toBe(0);
  });

  it('WEEKLY: same chosen day whose slot has passed advances a full week', () => {
    // now Thursday 09:00, target Thursday (4), slot 08:00 already gone → +7.
    const next = computeNextRunAt('WEEKLY', 8, at('2026-01-15T09:00:00Z'), 4)!;
    expect(next.toISOString()).toBe('2026-01-22T08:00:00.000Z');
    expect(next.getUTCDay()).toBe(4);
  });

  it('MONTHLY from Jan 31 does NOT overflow into March (clamps to Feb 28)', () => {
    // Jan 31 09:00, slot 08:00 already passed today → next month, clamped.
    const next = computeNextRunAt('MONTHLY', 8, at('2026-01-31T09:00:00Z'))!;
    expect(next.toISOString()).toBe('2026-02-28T08:00:00.000Z'); // 2026 not a leap year
    expect(next.getUTCMonth()).toBe(1); // February, not March
  });

  it('MONTHLY leap-year Feb clamps to 29', () => {
    const next = computeNextRunAt('MONTHLY', 8, at('2028-01-31T09:00:00Z'))!;
    expect(next.toISOString()).toBe('2028-02-29T08:00:00.000Z');
  });

  it('MONTHLY December rolls into next January', () => {
    const next = computeNextRunAt('MONTHLY', 8, at('2026-12-31T09:00:00Z'))!;
    expect(next.toISOString()).toBe('2027-01-31T08:00:00.000Z');
  });

  it('MONTHLY keeps today when the slot is still ahead', () => {
    const next = computeNextRunAt('MONTHLY', 8, at('2026-01-15T06:00:00Z'))!;
    expect(next.toISOString()).toBe('2026-01-15T08:00:00.000Z');
  });

  it('MONTHLY sendDayOfMonth anchor does NOT drift after a short month (Feb 28 → Mar 31)', () => {
    // The 31st report ran/clamped to Feb 28; the NEXT computation must return Mar 31,
    // not Mar 28 — the stored anchor (31), not the current day (28), drives it.
    const next = computeNextRunAt('MONTHLY', 8, at('2026-02-28T09:00:00Z'), null, 31)!;
    expect(next.toISOString()).toBe('2026-03-31T08:00:00.000Z');
  });

  it('MONTHLY sendDayOfMonth clamps to the month length but keeps the anchor', () => {
    // Anchor 31 in a 30-day month clamps to the 30th (not drift to a stored 30).
    const next = computeNextRunAt('MONTHLY', 8, at('2026-04-15T09:00:00Z'), null, 31)!;
    expect(next.toISOString()).toBe('2026-04-30T08:00:00.000Z');
  });

  it('MONTHLY sendDayOfMonth uses this month when the anchor slot is still ahead', () => {
    const next = computeNextRunAt('MONTHLY', 8, at('2026-01-05T09:00:00Z'), null, 20)!;
    expect(next.toISOString()).toBe('2026-01-20T08:00:00.000Z');
  });

  it('clamps out-of-range sendHour', () => {
    const next = computeNextRunAt('DAILY', 99, at('2026-01-15T00:00:00Z'))!;
    expect(next.getUTCHours()).toBe(23);
  });
});

describe('isDue', () => {
  it('null nextRunAt is NOT due (dispatcher backfills a slot instead of blasting)', () => {
    expect(isDue(null, at('2026-01-15T00:00:00Z'))).toBe(false);
    expect(isDue(undefined, at('2026-01-15T00:00:00Z'))).toBe(false);
  });
  it('past is due, future is not', () => {
    const now = at('2026-01-15T12:00:00Z');
    expect(isDue('2026-01-15T08:00:00Z', now)).toBe(true);
    expect(isDue('2026-01-15T18:00:00Z', now)).toBe(false);
  });
  it('activation always yields a FUTURE slot (never immediate)', () => {
    // A WEEKLY report activated mid-week must not be due right after activation.
    const now = at('2026-01-15T14:00:00Z'); // Thursday afternoon
    const next = computeNextRunAt('WEEKLY', 8, now, 1)!; // Mondays 08:00
    expect(next.getTime()).toBeGreaterThan(now.getTime());
    expect(isDue(next.toISOString(), now)).toBe(false);
  });
});
