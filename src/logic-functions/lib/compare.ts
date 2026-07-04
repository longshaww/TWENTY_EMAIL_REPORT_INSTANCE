/**
 * Period-over-period comparison — the deterministic core of the AI Insight
 * engine. Given a report's spec, `previousPeriodSpec` derives the immediately
 * preceding window; the same `executeSpec` runs both, and `computeDeltas` diffs
 * the two aggregated results.
 *
 * Trust-first: every figure here is computed in code from CRM data. The LLM
 * (see llm.ts `generateInsight`) only ever *phrases* the numbers this module
 * produces — it never invents them. Pure module (types + no SDK/network) so the
 * delta maths is trivially unit-testable, like report-spec.ts.
 */
import type { ReportResult, ReportRow } from './executor';
import type { ReportSpec } from './report-spec';

const DAY_MS = 86_400_000;

export type Direction = 'up' | 'down' | 'flat';

export type MetricDelta = {
  alias: string;
  label: string;
  current: number;
  previous: number;
  delta: number;
  pctChange: number | null; // null when the previous period was 0 (no baseline → "new")
  direction: Direction;
  isCurrency: boolean;
};

export type GroupMover = {
  groupLabel: string;
  current: number;
  previous: number;
  delta: number;
  pctChange: number | null;
  direction: Direction;
};

export type PeriodComparison = {
  periodLabel: string; // e.g. "the previous 7 days"
  periodDays: number;
  currencyCode: string;
  metrics: MetricDelta[];
  topGainer?: GroupMover; // largest riser on the primary metric
  topDecliner?: GroupMover; // largest faller on the primary metric
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function diff(cur: number, prev: number): { delta: number; pctChange: number | null; direction: Direction } {
  const delta = round2(cur - prev);
  // Percentage is relative to the magnitude of the baseline; null when there is
  // no baseline (previous === 0) so the UI can show "new" instead of ∞/NaN.
  const pctChange = prev !== 0 ? round2((delta / Math.abs(prev)) * 100) : null;
  const direction: Direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  return { delta, pctChange, direction };
}

function groupKey(row: ReportRow, groupBy: ReportResult['groupBy']): string {
  return groupBy.map((g) => row.group[g.field] ?? '∅').join('||');
}

function periodInfo(spec: ReportSpec): { days: number; label: string } {
  const tw = spec.timeWindow;
  if (!tw) return { days: 0, label: 'the previous period' };
  if (tw.lastDays !== undefined) return { days: tw.lastDays, label: `the previous ${tw.lastDays} days` };
  const from = tw.from ? new Date(tw.from).getTime() : NaN;
  const to = tw.to ? new Date(tw.to).getTime() : Date.now();
  const days = Number.isFinite(from) ? Math.max(1, Math.round((to - from) / DAY_MS)) : 0;
  return { days, label: days ? `the previous ${days} days` : 'the previous period' };
}

/**
 * Derive a spec for the window immediately preceding the report's own window,
 * of equal length. Returns null when the report has no bounded time window (no
 * prior period to compare against). Everything else — filters, groupBy,
 * metrics, sort, limit — is copied unchanged so the two periods are apples to
 * apples. Emits explicit ISO `from`/`to` (never `lastDays`) so `executeSpec`
 * bounds the prior window precisely.
 */
export function previousPeriodSpec(spec: ReportSpec): ReportSpec | null {
  const tw = spec.timeWindow;
  if (!tw) return null;

  const now = Date.now();
  let curFrom: number;
  let curTo: number;
  if (tw.lastDays !== undefined) {
    curTo = now;
    curFrom = now - tw.lastDays * DAY_MS;
  } else {
    curFrom = tw.from ? new Date(tw.from).getTime() : NaN;
    curTo = tw.to ? new Date(tw.to).getTime() : now;
  }
  if (!Number.isFinite(curFrom) || !Number.isFinite(curTo) || curTo <= curFrom) return null;

  const duration = curTo - curFrom;
  const prevFrom = curFrom - duration;
  const prevTo = curFrom;
  return {
    ...spec,
    timeWindow: {
      field: tw.field,
      from: new Date(prevFrom).toISOString(),
      to: new Date(prevTo).toISOString(),
    },
  };
}

/**
 * Diff two aggregated results (current vs previous period) into a comparison:
 * per-metric grand-total deltas, plus the biggest riser and faller among groups
 * on the primary metric. Groups are matched across periods by their display
 * key (same schema + groupBy → stable labels).
 */
export function computeDeltas(current: ReportResult, previous: ReportResult, spec: ReportSpec): PeriodComparison {
  const info = periodInfo(spec);

  const metrics: MetricDelta[] = current.metrics.map((col) => {
    const cur = current.grandTotals[col.alias] ?? 0;
    const prev = previous.grandTotals[col.alias] ?? 0;
    return {
      alias: col.alias,
      label: col.label,
      current: cur,
      previous: prev,
      isCurrency: col.isCurrency,
      ...diff(cur, prev),
    };
  });

  let topGainer: GroupMover | undefined;
  let topDecliner: GroupMover | undefined;
  const primary = current.metrics[0]?.alias;
  if (primary && current.groupBy.length > 0) {
    const prevByKey = new Map<string, number>();
    for (const r of previous.rows) prevByKey.set(groupKey(r, previous.groupBy), r.values[primary] ?? 0);

    const movers: GroupMover[] = current.rows.map((r) => {
      const cur = r.values[primary] ?? 0;
      const prev = prevByKey.get(groupKey(r, current.groupBy)) ?? 0;
      const groupLabel = current.groupBy.map((g) => r.group[g.field]).join(' · ');
      return { groupLabel, current: cur, previous: prev, ...diff(cur, prev) };
    });

    const sorted = [...movers].sort((a, b) => b.delta - a.delta);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (first && first.delta > 0) topGainer = first;
    if (last && last.delta < 0) topDecliner = last;
  }

  return {
    periodLabel: info.label,
    periodDays: info.days,
    currencyCode: current.currencyCode,
    metrics,
    ...(topGainer ? { topGainer } : {}),
    ...(topDecliner ? { topDecliner } : {}),
  };
}
