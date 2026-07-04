/**
 * Report templates — the ~10 starter presets shown in the "Create a report"
 * gallery, plus reusable multi-block Sections for the builder's Content rail.
 *
 * A template is a *full report preset*: a starter prompt (phrased so the offline
 * fallback planner also understands it) + a curated block layout + a theme. On
 * creation we still run the prompt through `generateSpec()` so the numbers bind
 * to the live workspace schema (trust-first); the template only supplies the
 * arrangement and styling. Block metric aliases are intentionally left generic
 * so the renderer's graceful fallbacks apply whatever spec the prompt yields.
 *
 * Pure module (blocks + theme only) so both the front-component gallery and the
 * create-report logic function can import it.
 */
import { blockId, type Block, type ReportLayout } from './blocks';
import { DEFAULT_THEME, type ReportTheme } from './theme';

export type TemplateCategory = 'Basic' | 'Sales' | 'Executive';

export type ReportTemplate = {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  /** The Twenty data-source object (nameSingular) this preset reports over. */
  object: string;
  prompt: string;
  layout: ReportLayout;
};

// Build a layout from a compact block list, stamping stable ids + a theme.
function layout(blocks: Array<Omit<Block, 'id'>>, theme: ReportTheme): ReportLayout {
  return {
    version: 2,
    theme,
    blocks: blocks.map((b, i) => ({ id: blockId(b.type, i), ...b })),
  };
}

const t = (accent: string, extra: Partial<ReportTheme> = {}): ReportTheme => ({
  ...DEFAULT_THEME,
  accent,
  ...extra,
});

// Common block shorthands ----------------------------------------------------
const header = (title: string, subtitle = ''): Omit<Block, 'id'> => ({ type: 'header', title, subtitle });
const metrics = (): Omit<Block, 'id'> => ({ type: 'metricRow' });
const chart = (chartKind: 'bar' | 'pie' = 'bar'): Omit<Block, 'id'> => ({ type: 'chart', chartKind });
const bars = (maxRows = 10): Omit<Block, 'id'> => ({ type: 'barBreakdown', maxRows });
const table = (maxRows = 25): Omit<Block, 'id'> => ({ type: 'table', maxRows });
const narrative = (): Omit<Block, 'id'> => ({ type: 'narrative' });
const insights = (): Omit<Block, 'id'> => ({ type: 'insights' });
const spec = (): Omit<Block, 'id'> => ({ type: 'specEcho' });
const text = (markdown: string): Omit<Block, 'id'> => ({ type: 'text', markdown });
const divider = (): Omit<Block, 'id'> => ({ type: 'divider' });

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'weekly-sales-pulse',
    name: 'Weekly Sales Pulse',
    category: 'Sales',
    object: 'opportunity',
    description: 'Won revenue this week, broken down by sales rep.',
    prompt: 'weekly won revenue by rep in the last 7 days',
    layout: layout([header('Weekly Sales Pulse', 'Won revenue over the last 7 days'), spec(), metrics(), insights(), chart('bar'), bars(8), narrative()], t('#4f46e5')),
  },
  {
    id: 'pipeline-health',
    name: 'Pipeline Health',
    category: 'Sales',
    object: 'opportunity',
    description: 'Open pipeline value and deal count by stage.',
    prompt: 'open pipeline amount by stage',
    layout: layout([header('Pipeline Health', 'Open opportunities by stage'), metrics(), chart('bar'), table(20), narrative()], t('#0ea5e9')),
  },
  {
    id: 'rep-leaderboard',
    name: 'Rep Leaderboard',
    category: 'Sales',
    object: 'opportunity',
    description: 'Ranked league table of won deals by owner.',
    prompt: 'won deals by rep ranked',
    layout: layout([header('Rep Leaderboard', 'Top performers by won deals'), bars(12), table(25), narrative()], t('#16a34a')),
  },
  {
    id: 'monthly-revenue-review',
    name: 'Monthly Revenue Review',
    category: 'Executive',
    object: 'opportunity',
    description: 'Monthly won revenue trend by product tier.',
    prompt: 'monthly won revenue by product tier',
    layout: layout([header('Monthly Revenue Review', 'Won revenue by month and product tier'), spec(), metrics(), chart('bar'), table(24), narrative()], t('#0f172a')),
  },
  {
    id: 'regional-performance',
    name: 'Regional Performance',
    category: 'Sales',
    object: 'opportunity',
    description: 'Revenue split across regions.',
    prompt: 'won revenue by region',
    layout: layout([header('Regional Performance', 'Won revenue by region'), metrics(), chart('pie'), bars(8), narrative()], t('#ea580c')),
  },
  {
    id: 'lead-source-roi',
    name: 'Lead-Source ROI',
    category: 'Sales',
    object: 'opportunity',
    description: 'Which acquisition channels drive revenue.',
    prompt: 'won revenue by lead source',
    layout: layout([header('Lead-Source ROI', 'Revenue by acquisition channel'), chart('pie'), bars(10), table(20), narrative()], t('#db2777')),
  },
  {
    id: 'product-tier-breakdown',
    name: 'Product-Tier Breakdown',
    category: 'Sales',
    object: 'opportunity',
    description: 'Revenue and deal mix by product tier.',
    prompt: 'won revenue by product tier',
    layout: layout([header('Product-Tier Breakdown', 'Revenue mix by product tier'), metrics(), chart('bar'), bars(6), narrative()], t('#7c3aed')),
  },
  {
    id: 'new-business-this-month',
    name: 'New Business This Month',
    category: 'Sales',
    object: 'opportunity',
    description: 'Deals created this month by rep.',
    prompt: 'number of deals created in the last 30 days by rep',
    layout: layout([header('New Business This Month', 'Deals created in the last 30 days'), metrics(), bars(10), table(20), narrative()], t('#0ea5e9')),
  },
  {
    id: 'stuck-deals',
    name: 'Stuck / Aging Deals',
    category: 'Sales',
    object: 'opportunity',
    description: 'Open opportunities that need attention, by stage.',
    prompt: 'open pipeline by stage',
    layout: layout([header('Stuck / Aging Deals', 'Open opportunities needing attention'), spec(), table(30), bars(8), narrative()], t('#dc2626')),
  },
  {
    id: 'executive-summary',
    name: 'Executive Summary',
    category: 'Executive',
    object: 'opportunity',
    description: 'A lean KPI + narrative brief for leadership.',
    prompt: 'total won revenue and deal count in the last 30 days',
    layout: layout([header('Executive Summary', 'The numbers that matter, in brief'), metrics(), insights(), divider(), narrative(), text('Prepared by NorthPeak Reports.')], t('#0f172a', { font: 'serif' })),
  },
];

export function getTemplate(id: string | undefined | null): ReportTemplate | undefined {
  if (!id) return undefined;
  return REPORT_TEMPLATES.find((tpl) => tpl.id === id);
}

// --- Sections: reusable multi-block groups for the builder's Content rail ----
export type SectionPreset = { id: string; label: string; blocks: Array<Omit<Block, 'id'>> };

export const SECTION_PRESETS: SectionPreset[] = [
  { id: 'title-intro', label: 'Title + intro', blocks: [header('Section title', 'A short subtitle'), text('Add your intro copy here.')] },
  { id: 'kpi-chart', label: 'KPIs + chart', blocks: [metrics(), chart('bar')] },
  { id: 'breakdown', label: 'Breakdown + table', blocks: [bars(10), table(25)] },
  { id: 'cta', label: 'Call to action', blocks: [{ type: 'button', buttonText: 'View in Twenty', align: 'center' }, { type: 'spacer', height: 16 }] },
];
