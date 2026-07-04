// BlockView — renders a single report Block natively (React) using the report's
// own theme tokens (resolveTheme) and the live executed ReportResult, so the
// builder canvas is a faithful WYSIWYG of the delivered email. When no result is
// loaded yet it shows lightweight placeholders so the layout is still legible.
import type { Block } from 'src/logic-functions/lib/blocks';
import type { MetricDelta, PeriodComparison } from 'src/logic-functions/lib/compare';
import type { ReportResult } from 'src/logic-functions/lib/executor';
import { chartUrlFromResult } from 'src/logic-functions/lib/quickchart';
import { formatMoney } from 'src/logic-functions/lib/report-spec';
import type { ThemeTokens } from 'src/logic-functions/lib/theme';

export type CanvasData = {
  result: ReportResult | null;
  narrative: string;
  specEnglish: string;
  chartImageUrl?: string;
  comparison?: PeriodComparison;
  insight?: string;
};

// Trend label + colour for a metric delta (green up / red down), shared by the
// insights block. Mirrors render.ts so canvas and email read identically.
function trendChip(m: MetricDelta, subColor: string): { text: string; color: string } {
  if (m.direction === 'flat') return { text: 'no change vs previous', color: subColor };
  const arrow = m.direction === 'up' ? '▲' : '▼';
  const color = m.direction === 'up' ? '#16a34a' : '#dc2626';
  if (m.pctChange === null) return { text: `${arrow} new`, color };
  return { text: `${arrow} ${m.pctChange >= 0 ? '+' : ''}${m.pctChange}%`, color };
}

function fmt(value: number, isCurrency: boolean, code: string): string {
  if (isCurrency) return formatMoney(value, code);
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

const Placeholder = ({ T, label }: { T: ThemeTokens; label: string }) => (
  <div style={{ border: `1px dashed ${T.border}`, borderRadius: 8, padding: 12, color: T.sub, fontSize: 12, textAlign: 'center' }}>
    {label} — run a preview to load live data
  </div>
);

export const BlockView = ({ block: b, T, data }: { block: Block; T: ThemeTokens; data: CanvasData }) => {
  const { result } = data;
  const textAlign = (b.align ?? 'left') as any;

  switch (b.type) {
    case 'header':
      return (
        <div style={{ padding: '20px 24px 8px', textAlign }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>{b.title || 'Report'}</div>
          {b.subtitle ? <div style={{ fontSize: 14, color: T.sub, marginTop: 4 }}>{b.subtitle}</div> : null}
        </div>
      );

    case 'specEcho':
      return (
        <div style={{ padding: '8px 24px' }}>
          <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: 12, letterSpacing: '.04em', textTransform: 'uppercase', color: T.sub, fontWeight: 600 }}>Interpreted as</div>
            <div style={{ fontSize: 14, color: T.ink, marginTop: 4 }}>{data.specEnglish || 'Your report interpretation appears here.'}</div>
            <div style={{ fontSize: 12, color: T.sub, marginTop: 10 }}>
              {result ? `${result.matchedCount.toLocaleString('en-US')} records · data as of ${new Date(result.dataAsOf).toUTCString()}` : 'record count · data-as-of · Verify in Twenty →'}
            </div>
          </div>
        </div>
      );

    case 'metricRow': {
      const aliases = b.metrics && b.metrics.length ? b.metrics : result ? result.metrics.map((m) => m.alias) : ['sample', 'count'];
      return (
        <div style={{ padding: '8px 16px', display: 'flex', gap: 8 }}>
          {aliases.map((alias) => {
            const col = result?.metrics.find((m) => m.alias === alias);
            const val = result?.grandTotals[alias];
            return (
              <div key={alias} style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 12, color: T.sub, fontWeight: 600 }}>{col?.label ?? 'Metric'}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: T.ink, marginTop: 6 }}>
                  {result && col ? fmt(val ?? 0, col.isCurrency, result.currencyCode) : '—'}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    case 'chart': {
      // Build the QuickChart image from the live result honouring THIS block's
      // chartKind, so switching Bar↔Pie updates the canvas immediately (the
      // server-rendered data.chartImageUrl only reflects the first chart block's
      // kind at the last Preview). Fall back to it if no result is loaded yet.
      const chartUrl = (data.result ? chartUrlFromResult(data.result, b.chartKind ?? 'bar') : undefined) ?? data.chartImageUrl;
      return (
        <div style={{ padding: '12px 24px', textAlign: 'center' }}>
          {chartUrl ? (
            <img src={chartUrl} alt="Chart" style={{ maxWidth: '100%', border: `1px solid ${T.border}`, borderRadius: 8 }} />
          ) : (
            <Placeholder T={T} label={`${b.chartKind === 'pie' ? 'Pie' : 'Bar'} chart`} />
          )}
        </div>
      );
    }

    case 'barBreakdown': {
      if (!result || result.groupBy.length === 0) return <div style={{ padding: '12px 24px' }}><Placeholder T={T} label="Bar breakdown" /></div>;
      const alias = b.metricAlias && result.metrics.some((m) => m.alias === b.metricAlias) ? b.metricAlias : result.metrics[0]?.alias;
      const col = result.metrics.find((m) => m.alias === alias);
      const sorted = [...result.rows].sort((a, z) => (z.values[alias] ?? 0) - (a.values[alias] ?? 0)).slice(0, b.maxRows ?? 10);
      const max = Math.max(1, ...sorted.map((r) => r.values[alias] ?? 0));
      return (
        <div style={{ padding: '12px 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.sub, marginBottom: 6 }}>
            {col?.label} by {result.groupBy.map((g) => g.label).join(' · ')}
          </div>
          {sorted.map((r, i) => {
            const val = r.values[alias] ?? 0;
            const pct = Math.max(2, Math.round((val / max) * 100));
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                <div style={{ width: '36%', fontSize: 13, color: T.ink }}>{result.groupBy.map((g) => r.group[g.field]).join(' · ')}</div>
                <div style={{ flex: 1, background: T.barTrack, borderRadius: 6, height: 14 }}>
                  <div style={{ background: T.bar, width: `${pct}%`, height: 14, borderRadius: 6 }} />
                </div>
                <div style={{ width: '18%', textAlign: 'right', fontSize: 13, color: T.ink }}>{col ? fmt(val, col.isCurrency, result.currencyCode) : val}</div>
              </div>
            );
          })}
        </div>
      );
    }

    case 'table': {
      if (!result || result.groupBy.length === 0) return <div style={{ padding: '12px 24px' }}><Placeholder T={T} label="Data table" /></div>;
      const cell = { padding: '8px 10px', fontSize: 13, color: T.ink, borderBottom: `1px solid ${T.border}` } as any;
      const head = { ...cell, fontSize: 12, color: T.sub } as any;
      return (
        <div style={{ padding: '12px 24px', overflowX: 'auto' as const }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr>
                {result.groupBy.map((g) => <th key={g.field} style={{ ...head, textAlign: 'left' }}>{g.label}</th>)}
                {result.metrics.map((m) => <th key={m.alias} style={{ ...head, textAlign: 'right' }}>{m.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {result.rows.slice(0, b.maxRows ?? 25).map((r, i) => (
                <tr key={i}>
                  {result.groupBy.map((g) => <td key={g.field} style={cell}>{r.group[g.field]}</td>)}
                  {result.metrics.map((m) => <td key={m.alias} style={{ ...cell, textAlign: 'right' }}>{fmt(r.values[m.alias] ?? 0, m.isCurrency, result.currencyCode)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case 'narrative':
      return (
        <div style={{ padding: '12px 24px' }}>
          <div style={{ background: T.accentSoft, borderLeft: `3px solid ${T.accent}`, borderRadius: 6, padding: '12px 16px' }}>
            <div style={{ fontSize: 12, letterSpacing: '.04em', textTransform: 'uppercase', color: T.accent, fontWeight: 600 }}>AI summary</div>
            <div style={{ fontSize: 14, color: T.ink, marginTop: 6, lineHeight: 1.5 }}>{data.narrative || 'A plain-language summary of the numbers appears here.'}</div>
          </div>
        </div>
      );

    case 'insights': {
      const c = data.comparison;
      if (!c || c.metrics.length === 0)
        return <div style={{ padding: '12px 24px' }}><Placeholder T={T} label="AI insights (report needs a time window)" /></div>;
      return (
        <div style={{ padding: '12px 24px' }}>
          <div style={{ fontSize: 12, letterSpacing: '.04em', textTransform: 'uppercase', color: T.accent, fontWeight: 600, marginBottom: 8 }}>
            Insights · vs {c.periodLabel}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {c.metrics.map((m) => {
              const t = trendChip(m, T.sub);
              return (
                <div key={m.alias} style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: '12px 16px' }}>
                  <div style={{ fontSize: 12, color: T.sub, fontWeight: 600 }}>{m.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: T.ink, marginTop: 6 }}>{fmt(m.current, m.isCurrency, c.currencyCode)}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.color, marginTop: 4 }}>{t.text}</div>
                </div>
              );
            })}
          </div>
          {data.insight ? <div style={{ fontSize: 14, color: T.ink, marginTop: 12, lineHeight: 1.5 }}>{data.insight}</div> : null}
          <div style={{ fontSize: 11, color: T.sub, marginTop: 10 }}>Figures computed from CRM data; wording by AI.</div>
        </div>
      );
    }

    case 'text':
      return <div style={{ padding: '8px 24px', fontSize: 14, color: T.ink, lineHeight: 1.5, textAlign }}>{b.markdown || 'Add a note…'}</div>;

    case 'divider':
      return <div style={{ padding: '8px 24px' }}><div style={{ borderTop: `1px solid ${T.border}` }} /></div>;

    case 'logo':
    case 'image': {
      return (
        <div style={{ padding: '16px 24px', textAlign: (b.align ?? 'center') as any }}>
          {b.imageUrl ? (
            <img src={b.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: b.type === 'logo' ? 48 : 260, borderRadius: 8 }} />
          ) : (
            <Placeholder T={T} label={b.type === 'logo' ? 'Logo (set an image URL)' : 'Image (set an image URL)'} />
          )}
        </div>
      );
    }

    case 'button':
      return (
        <div style={{ padding: '12px 24px', textAlign: (b.align ?? 'center') as any }}>
          <span style={{ display: 'inline-block', background: T.accent, color: '#fff', fontSize: 14, fontWeight: 600, padding: '12px 20px', borderRadius: 8 }}>
            {b.buttonText || 'Learn more'}
          </span>
        </div>
      );

    case 'spacer':
      return <div style={{ height: Math.max(4, Math.min(120, b.height ?? 24)) }} />;

    default:
      return null;
  }
};
