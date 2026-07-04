/**
 * QuickChart integration — turns a grouped result into a real bar/pie chart PNG
 * (https://quickchart.io/chart?c=...) for the email. Kept optional: emails always
 * render the CSS-bar breakdown too, so a QuickChart outage never breaks a report.
 */
import type { ReportResult } from './executor';

const BASE = 'https://quickchart.io/chart';
const MAX_SLICES = 12;

/** Build a QuickChart image URL from the result's first metric, or undefined. */
export function chartUrlFromResult(result: ReportResult, kind: 'bar' | 'pie' = 'bar'): string | undefined {
  if (result.groupBy.length === 0 || result.rows.length === 0) return undefined;
  const metric = result.metrics[0];
  if (!metric) return undefined;

  const sorted = [...result.rows]
    .sort((a, b) => (b.values[metric.alias] ?? 0) - (a.values[metric.alias] ?? 0))
    .slice(0, MAX_SLICES);

  const labels = sorted.map((r) => result.groupBy.map((g) => r.group[g.field]).join(' · '));
  const data = sorted.map((r) => r.values[metric.alias] ?? 0);

  const config = {
    type: kind,
    data: {
      labels,
      datasets: [{ label: metric.label, data, backgroundColor: kind === 'pie' ? PALETTE : '#6366f1' }],
    },
    options: {
      plugins: { legend: { display: kind === 'pie' } },
      scales: kind === 'bar' ? { y: { beginAtZero: true } } : undefined,
    },
  };

  const encoded = encodeURIComponent(JSON.stringify(config));
  const url = `${BASE}?w=520&h=280&bkg=white&c=${encoded}`;
  // QuickChart accepts long GET URLs; guard against extreme cases.
  return url.length > 3800 ? undefined : url;
}

const PALETTE = [
  '#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6',
  '#ef4444', '#14b8a6', '#eab308', '#3b82f6', '#a855f7', '#10b981',
];
