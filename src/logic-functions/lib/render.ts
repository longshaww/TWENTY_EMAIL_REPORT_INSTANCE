/**
 * Blocks + executed results → a self-contained HTML email.
 *
 * Charts are pure HTML/CSS (big-number cards, tables, div-width bars) so they
 * render identically across email clients with no JavaScript. Every report
 * carries its interpretation, row count, data-as-of timestamp and a deep link
 * back into Twenty — so recipients can trust and verify the numbers.
 *
 * Colours + font come from the per-report theme (`layout.theme`) via
 * `resolveTheme`, the same resolver the builder canvas uses, so the live preview
 * and the delivered email are visually identical.
 */
import type { Block, BlockAlign, ReportLayout } from './blocks';
import type { MetricDelta, PeriodComparison } from './compare';
import type { ReportColumn, ReportResult } from './executor';
import { formatMoney } from './report-spec';
import { resolveTheme, type ThemeTokens } from './theme';

export type RenderContext = {
  reportName: string;
  specEnglish: string;
  result: ReportResult;
  narrative: string;
  layout: ReportLayout;
  verifyUrl: string;
  chartImageUrl?: string; // optional QuickChart PNG
  comparison?: PeriodComparison; // present when the report has a time window
  insight?: string; // AI-phrased insight over the comparison
};

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmt(value: number, isCurrency: boolean, currencyCode: string): string {
  if (isCurrency) return formatMoney(value, currencyCode);
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function column(result: ReportResult, alias: string): ReportColumn | undefined {
  return result.metrics.find((m) => m.alias === alias);
}

function alignOf(b: Block): BlockAlign {
  return b.align ?? 'left';
}

// --- individual blocks ------------------------------------------------------
function renderHeader(b: Block, T: ThemeTokens): string {
  const title = esc(b.title || 'Report');
  const sub = b.subtitle ? `<div style="font-size:14px;color:${T.sub};margin-top:4px">${esc(b.subtitle)}</div>` : '';
  return `<tr><td style="padding:24px 24px 8px 24px;text-align:${alignOf(b)}">
    <div style="font-size:22px;font-weight:700;color:${T.ink}">${title}</div>${sub}
  </td></tr>`;
}

function renderSpecEcho(ctx: RenderContext, T: ThemeTokens): string {
  const asOf = new Date(ctx.result.dataAsOf).toUTCString();
  return `<tr><td style="padding:8px 24px">
    <div style="background:${T.bg};border:1px solid ${T.border};border-radius:10px;padding:14px 16px">
      <div style="font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${T.sub};font-weight:600">Interpreted as</div>
      <div style="font-size:14px;color:${T.ink};margin-top:4px">${esc(ctx.specEnglish)}</div>
      <div style="font-size:12px;color:${T.sub};margin-top:10px">
        ${ctx.result.matchedCount.toLocaleString('en-US')} records · data as of ${esc(asOf)}
        &nbsp;·&nbsp;<a href="${esc(ctx.verifyUrl)}" style="color:${T.accent};text-decoration:none">Verify in Twenty →</a>
      </div>
      ${(ctx.result.warnings ?? [])
        .map((w) => `<div style="font-size:12px;color:#b45309;margin-top:8px">⚠ ${esc(w)}</div>`)
        .join('')}
    </div>
  </td></tr>`;
}

function renderMetricRow(b: Block, ctx: RenderContext, T: ThemeTokens): string {
  const aliases = b.metrics && b.metrics.length ? b.metrics : ctx.result.metrics.map((m) => m.alias);
  const cells = aliases
    .map((alias) => {
      const col = column(ctx.result, alias);
      if (!col) return '';
      const val = ctx.result.grandTotals[alias] ?? 0;
      return `<td style="padding:8px" width="${Math.floor(100 / aliases.length)}%" valign="top">
        <div style="background:${T.card};border:1px solid ${T.border};border-radius:10px;padding:16px">
          <div style="font-size:12px;color:${T.sub};font-weight:600">${esc(col.label)}</div>
          <div style="font-size:24px;font-weight:700;color:${T.ink};margin-top:6px">${esc(fmt(val, col.isCurrency, ctx.result.currencyCode))}</div>
        </div>
      </td>`;
    })
    .join('');
  return `<tr><td style="padding:8px 16px"><table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>${cells}</tr></table></td></tr>`;
}

function renderBarBreakdown(b: Block, ctx: RenderContext, T: ThemeTokens): string {
  const { result } = ctx;
  const alias = b.metricAlias && column(result, b.metricAlias) ? b.metricAlias : result.metrics[0]?.alias;
  const col = column(result, alias);
  if (!col || result.groupBy.length === 0) return '';
  const maxRows = b.maxRows ?? 10;
  const sorted = [...result.rows].sort((a, z) => (z.values[alias] ?? 0) - (a.values[alias] ?? 0)).slice(0, maxRows);
  const max = Math.max(1, ...sorted.map((r) => r.values[alias] ?? 0));
  const rows = sorted
    .map((r) => {
      const label = result.groupBy.map((g) => r.group[g.field]).join(' · ');
      const val = r.values[alias] ?? 0;
      const pct = Math.max(2, Math.round((val / max) * 100));
      return `<tr>
        <td style="padding:6px 0;font-size:13px;color:${T.ink};width:38%">${esc(label)}</td>
        <td style="padding:6px 8px;width:44%">
          <div style="background:${T.barTrack};border-radius:6px;height:14px">
            <div style="background:${T.bar};width:${pct}%;height:14px;border-radius:6px"></div>
          </div>
        </td>
        <td style="padding:6px 0;font-size:13px;color:${T.ink};text-align:right;width:18%">${esc(fmt(val, col.isCurrency, result.currencyCode))}</td>
      </tr>`;
    })
    .join('');
  return `<tr><td style="padding:12px 24px">
    <div style="font-size:13px;font-weight:600;color:${T.sub};margin-bottom:6px">${esc(col.label)} by ${esc(result.groupBy.map((g) => g.label).join(' · '))}</div>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${rows}</table>
  </td></tr>`;
}

function renderTable(b: Block, ctx: RenderContext, T: ThemeTokens): string {
  const { result } = ctx;
  if (result.groupBy.length === 0) return '';
  const maxRows = b.maxRows ?? 25;
  const headCells = [
    ...result.groupBy.map((g) => `<th align="left" style="padding:8px 10px;font-size:12px;color:${T.sub};border-bottom:1px solid ${T.border}">${esc(g.label)}</th>`),
    ...result.metrics.map((m) => `<th align="right" style="padding:8px 10px;font-size:12px;color:${T.sub};border-bottom:1px solid ${T.border}">${esc(m.label)}</th>`),
  ].join('');
  const bodyRows = result.rows
    .slice(0, maxRows)
    .map((r) => {
      const gcells = result.groupBy.map((g) => `<td style="padding:8px 10px;font-size:13px;color:${T.ink};border-bottom:1px solid ${T.border}">${esc(r.group[g.field])}</td>`).join('');
      const mcells = result.metrics
        .map((m) => `<td align="right" style="padding:8px 10px;font-size:13px;color:${T.ink};border-bottom:1px solid ${T.border}">${esc(fmt(r.values[m.alias] ?? 0, m.isCurrency, result.currencyCode))}</td>`)
        .join('');
      return `<tr>${gcells}${mcells}</tr>`;
    })
    .join('');
  return `<tr><td style="padding:12px 24px">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse">
      <thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody>
    </table>
  </td></tr>`;
}

function renderNarrative(ctx: RenderContext, T: ThemeTokens): string {
  if (!ctx.narrative) return '';
  return `<tr><td style="padding:12px 24px">
    <div style="background:${T.accentSoft};border-left:3px solid ${T.accent};border-radius:6px;padding:12px 16px">
      <div style="font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${T.accent};font-weight:600">AI summary</div>
      <div style="font-size:14px;color:${T.ink};margin-top:6px;line-height:1.5">${esc(ctx.narrative)}</div>
    </div>
  </td></tr>`;
}

// Semantic trend colours (fixed, theme-independent — consistent with the
// existing warning colour used in renderSpecEcho). Green = up, red = down.
const TREND_UP = '#16a34a';
const TREND_DOWN = '#dc2626';

function trendChip(m: MetricDelta, subColor: string): { text: string; color: string } {
  if (m.direction === 'flat') return { text: 'no change vs previous', color: subColor };
  const arrow = m.direction === 'up' ? '▲' : '▼';
  const color = m.direction === 'up' ? TREND_UP : TREND_DOWN;
  if (m.pctChange === null) return { text: `${arrow} new`, color };
  const sign = m.pctChange >= 0 ? '+' : '';
  return { text: `${arrow} ${sign}${m.pctChange}%`, color };
}

function renderInsights(ctx: RenderContext, T: ThemeTokens): string {
  const c = ctx.comparison;
  // No time window → no prior period to compare; omit silently (like the chart).
  if (!c || c.metrics.length === 0) return '';
  const width = Math.floor(100 / c.metrics.length);
  const chips = c.metrics
    .map((m) => {
      const value = fmt(m.current, m.isCurrency, c.currencyCode);
      const { text, color } = trendChip(m, T.sub);
      return `<td style="padding:8px" width="${width}%" valign="top">
        <div style="background:${T.card};border:1px solid ${T.border};border-radius:10px;padding:14px 16px">
          <div style="font-size:12px;color:${T.sub};font-weight:600">${esc(m.label)}</div>
          <div style="font-size:22px;font-weight:700;color:${T.ink};margin-top:6px">${esc(value)}</div>
          <div style="font-size:12px;font-weight:600;color:${color};margin-top:4px">${esc(text)}</div>
        </div>
      </td>`;
    })
    .join('');
  const insightLine = ctx.insight
    ? `<div style="font-size:14px;color:${T.ink};margin-top:12px;line-height:1.5">${esc(ctx.insight)}</div>`
    : '';
  return `<tr><td style="padding:12px 24px">
    <div style="font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${T.accent};font-weight:600;margin-bottom:8px">Insights · vs ${esc(c.periodLabel)}</div>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>${chips}</tr></table>
    ${insightLine}
    <div style="font-size:11px;color:${T.sub};margin-top:10px">Figures computed from CRM data; wording by AI.</div>
  </td></tr>`;
}

function renderText(b: Block, T: ThemeTokens): string {
  if (!b.markdown) return '';
  return `<tr><td style="padding:8px 24px;font-size:14px;color:${T.ink};line-height:1.5;text-align:${alignOf(b)}">${esc(b.markdown)}</td></tr>`;
}

function renderDivider(T: ThemeTokens): string {
  return `<tr><td style="padding:8px 24px"><hr style="border:none;border-top:1px solid ${T.border};margin:0"/></td></tr>`;
}

function renderChartImage(ctx: RenderContext, T: ThemeTokens): string {
  if (!ctx.chartImageUrl) {
    // No chart available (ungrouped report or QuickChart skipped) — omit silently.
    return '';
  }
  return `<tr><td style="padding:12px 24px" align="center"><img src="${esc(ctx.chartImageUrl)}" alt="Chart" width="520" style="max-width:100%;border:1px solid ${T.border};border-radius:8px"/></td></tr>`;
}

function renderLogo(b: Block, ctx: RenderContext): string {
  const src = b.imageUrl || ctx.layout.theme?.logoUrl;
  if (!src) return '';
  const img = `<img src="${esc(src)}" alt="Logo" style="max-height:48px;max-width:220px;border:0"/>`;
  const inner = b.linkUrl ? `<a href="${esc(b.linkUrl)}" style="border:0">${img}</a>` : img;
  return `<tr><td style="padding:20px 24px 8px 24px;text-align:${b.align ?? 'center'}">${inner}</td></tr>`;
}

function renderImage(b: Block): string {
  if (!b.imageUrl) return '';
  const img = `<img src="${esc(b.imageUrl)}" alt="" width="520" style="max-width:100%;border-radius:8px;border:0"/>`;
  const inner = b.linkUrl ? `<a href="${esc(b.linkUrl)}" style="border:0">${img}</a>` : img;
  return `<tr><td style="padding:12px 24px;text-align:${b.align ?? 'center'}">${inner}</td></tr>`;
}

function renderButton(b: Block, T: ThemeTokens): string {
  const label = esc(b.buttonText || 'Learn more');
  const href = esc(b.buttonUrl || '#'); // editor prompts for a URL; '#' keeps it valid
  return `<tr><td style="padding:12px 24px;text-align:${b.align ?? 'center'}">
    <a href="${href}" style="display:inline-block;background:${T.accent};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:11px 22px;border-radius:8px">${label}</a>
  </td></tr>`;
}

function renderSpacer(b: Block): string {
  const h = Math.max(4, Math.min(120, b.height ?? 24));
  return `<tr><td style="padding:0 24px"><div style="height:${h}px;line-height:${h}px;font-size:1px">&nbsp;</div></td></tr>`;
}

function renderBlock(b: Block, ctx: RenderContext, T: ThemeTokens): string {
  switch (b.type) {
    case 'header':
      return renderHeader(b, T);
    case 'specEcho':
      return renderSpecEcho(ctx, T);
    case 'metricRow':
      return renderMetricRow(b, ctx, T);
    case 'chart':
      return renderChartImage(ctx, T);
    case 'barBreakdown':
      return renderBarBreakdown(b, ctx, T);
    case 'table':
      return renderTable(b, ctx, T);
    case 'narrative':
      return renderNarrative(ctx, T);
    case 'insights':
      return renderInsights(ctx, T);
    case 'text':
      return renderText(b, T);
    case 'divider':
      return renderDivider(T);
    case 'logo':
      return renderLogo(b, ctx);
    case 'image':
      return renderImage(b);
    case 'button':
      return renderButton(b, T);
    case 'spacer':
      return renderSpacer(b);
    default:
      return '';
  }
}

export function renderEmail(ctx: RenderContext): { subject: string; html: string } {
  const T = resolveTheme(ctx.layout.theme);
  const inner = ctx.layout.blocks.map((b) => renderBlock(b, ctx, T)).join('\n');
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:${T.bg}">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${T.bg};padding:24px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background:${T.card};border:1px solid ${T.border};border-radius:14px;font-family:${T.font}">
        ${inner}
        <tr><td style="padding:16px 24px 24px 24px">
          <div style="font-size:11px;color:${T.sub}">Sent by NorthPeak Reports · <a href="${esc(ctx.verifyUrl)}" style="color:${T.sub}">open in Twenty</a></div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return { subject: ctx.reportName, html };
}
