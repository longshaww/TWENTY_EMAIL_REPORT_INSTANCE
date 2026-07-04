import { describe, expect, it } from 'vitest';

import { computeDeltas, previousPeriodSpec } from './compare';
import type { ReportColumn, ReportResult } from './executor';
import type { ReportSpec } from './report-spec';

const DAY_MS = 86_400_000;

const metrics: ReportColumn[] = [
  { alias: 'sum_amount', label: 'Total Amount', op: 'sum', field: 'amount', isCurrency: true },
  { alias: 'count', label: 'Count', op: 'count', isCurrency: false },
];

function result(grandTotals: Record<string, number>, rows: ReportResult['rows']): ReportResult {
  return {
    object: 'opportunity',
    labelPlural: 'Opportunities',
    groupBy: [{ field: 'region', label: 'Region' }],
    metrics,
    rows,
    grandTotals,
    matchedCount: rows.reduce((n, r) => n + (r.values.count ?? 0), 0),
    scannedCount: 100,
    truncated: false,
    dataAsOf: '2026-07-03T00:00:00.000Z',
    currencyCode: 'USD',
    warnings: [],
  };
}

describe('previousPeriodSpec', () => {
  it('shifts a lastDays window back one equal-length period', () => {
    const spec: ReportSpec = {
      object: 'opportunity',
      metrics: [{ op: 'sum', field: 'amount', alias: 'sum_amount' }],
      timeWindow: { field: 'closeDate', lastDays: 7 },
    };
    const prev = previousPeriodSpec(spec);
    expect(prev).not.toBeNull();
    const tw = prev!.timeWindow!;
    expect(tw.field).toBe('closeDate');
    expect(tw.lastDays).toBeUndefined(); // emitted as explicit from/to
    // Duration is preserved exactly (7 days) regardless of "now".
    expect(new Date(tw.to!).getTime() - new Date(tw.from!).getTime()).toBe(7 * DAY_MS);
    // Non-time fields are copied unchanged.
    expect(prev!.metrics).toEqual(spec.metrics);
  });

  it('shifts an explicit from/to window back by its own duration', () => {
    const spec: ReportSpec = {
      object: 'opportunity',
      metrics: [{ op: 'count', alias: 'count' }],
      timeWindow: { field: 'closeDate', from: '2026-06-01T00:00:00.000Z', to: '2026-06-08T00:00:00.000Z' },
    };
    const prev = previousPeriodSpec(spec);
    expect(prev?.timeWindow?.to).toBe('2026-06-01T00:00:00.000Z');
    expect(prev?.timeWindow?.from).toBe('2026-05-25T00:00:00.000Z');
  });

  it('returns null when there is no comparable window', () => {
    expect(previousPeriodSpec({ object: 'opportunity', metrics: [{ op: 'count' }] })).toBeNull();
    expect(
      previousPeriodSpec({ object: 'opportunity', metrics: [{ op: 'count' }], timeWindow: { field: 'closeDate' } }),
    ).toBeNull();
  });
});

describe('computeDeltas', () => {
  const spec: ReportSpec = {
    object: 'opportunity',
    metrics: [{ op: 'sum', field: 'amount', alias: 'sum_amount' }, { op: 'count', alias: 'count' }],
    groupBy: [{ field: 'region' }],
    timeWindow: { field: 'closeDate', lastDays: 7 },
  };

  const current = result(
    { sum_amount: 412000, count: 40 },
    [
      { group: { region: 'EMEA' }, values: { sum_amount: 100000, count: 10 } },
      { group: { region: 'North America' }, values: { sum_amount: 312000, count: 30 } },
    ],
  );
  const previous = result(
    { sum_amount: 350000, count: 40 },
    [
      { group: { region: 'EMEA' }, values: { sum_amount: 128000, count: 12 } },
      { group: { region: 'North America' }, values: { sum_amount: 222000, count: 28 } },
    ],
  );

  it('computes per-metric deltas, pct change and direction', () => {
    const c = computeDeltas(current, previous, spec);
    expect(c.periodLabel).toBe('the previous 7 days');
    expect(c.periodDays).toBe(7);

    const amount = c.metrics[0];
    expect(amount).toMatchObject({ current: 412000, previous: 350000, delta: 62000, direction: 'up' });
    expect(amount.pctChange).toBe(17.71);

    const count = c.metrics[1];
    expect(count).toMatchObject({ delta: 0, direction: 'flat' });
  });

  it('identifies the top gainer and decliner among groups on the primary metric', () => {
    const c = computeDeltas(current, previous, spec);
    expect(c.topGainer?.groupLabel).toBe('North America');
    expect(c.topGainer?.delta).toBe(90000);
    expect(c.topDecliner?.groupLabel).toBe('EMEA');
    expect(c.topDecliner?.delta).toBe(-28000);
    expect(c.topDecliner?.direction).toBe('down');
  });

  it('reports pctChange as null ("new") when the previous period was zero', () => {
    const cur = result({ sum_amount: 5000, count: 2 }, [{ group: { region: 'APAC' }, values: { sum_amount: 5000, count: 2 } }]);
    const prev = result({ sum_amount: 0, count: 0 }, []);
    const c = computeDeltas(cur, prev, spec);
    expect(c.metrics[0].pctChange).toBeNull();
    expect(c.metrics[0].direction).toBe('up');
  });
});
