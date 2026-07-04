/**
 * The email/report block model — the unit the drag-and-drop builder arranges and
 * the renderer turns into HTML. Pure module (imports only the equally-pure
 * report-spec + theme) so it is shared by the front-component builder, the HTML
 * renderer and the logic functions.
 */
import { metricAlias, type ReportSpec } from './report-spec';
import { DEFAULT_THEME, type ReportTheme } from './theme';

export type BlockType =
  | 'header'
  | 'specEcho'
  | 'metricRow'
  | 'chart'
  | 'table'
  | 'barBreakdown'
  | 'narrative'
  | 'insights'
  | 'text'
  | 'divider'
  // content/style blocks (Brevo-style)
  | 'logo'
  | 'image'
  | 'button'
  | 'spacer';

export type BlockAlign = 'left' | 'center' | 'right';

export type Block = {
  id: string;
  type: BlockType;
  // header
  title?: string;
  subtitle?: string;
  // metricRow: which grand-total aliases to show (defaults to all)
  metrics?: string[];
  // table / barBreakdown
  maxRows?: number;
  metricAlias?: string; // barBreakdown: which metric drives the bar length
  // chart
  chartKind?: 'bar' | 'pie';
  // text
  markdown?: string;
  // logo / image
  imageUrl?: string;
  linkUrl?: string;
  // button
  buttonText?: string;
  buttonUrl?: string;
  // spacer
  height?: number;
  // shared styling
  align?: BlockAlign;
};

// version 1 = blocks only (legacy). version 2 = adds an optional per-report theme.
export type ReportLayout = {
  version: 1 | 2;
  theme?: ReportTheme;
  blocks: Block[];
};

// Stable-ish id generator that avoids Math.random for reproducible default
// layouts (callers may pass a seed suffix).
export function blockId(prefix: string, seed: string | number): string {
  return `${prefix}-${seed}`;
}

export const BLOCK_PALETTE: Array<{ type: BlockType; label: string; hint: string; icon: string }> = [
  { type: 'header', label: 'Header', hint: 'Report title + subtitle', icon: 'IconHeading' },
  { type: 'text', label: 'Text', hint: 'Freeform note', icon: 'IconTypography' },
  { type: 'metricRow', label: 'Metric cards', hint: 'Big-number totals', icon: 'IconNumbers' },
  { type: 'chart', label: 'Chart', hint: 'QuickChart bar/pie image', icon: 'IconChartBar' },
  { type: 'barBreakdown', label: 'Bar breakdown', hint: 'Ranked bars per group', icon: 'IconChartHistogram' },
  { type: 'table', label: 'Data table', hint: 'Grouped rows and values', icon: 'IconTable' },
  { type: 'narrative', label: 'AI narrative', hint: 'Plain-language summary', icon: 'IconSparkles' },
  { type: 'insights', label: 'AI insights', hint: 'Change vs the previous period + AI insight', icon: 'IconTrendingUp' },
  { type: 'specEcho', label: 'Interpretation', hint: 'What was measured + data-as-of + verify link', icon: 'IconInfoCircle' },
  { type: 'logo', label: 'Logo', hint: 'Brand logo image', icon: 'IconPhoto' },
  { type: 'image', label: 'Image', hint: 'Any image by URL', icon: 'IconPhoto' },
  { type: 'button', label: 'Button', hint: 'Call-to-action link', icon: 'IconClick' },
  { type: 'divider', label: 'Divider', hint: 'Horizontal rule', icon: 'IconLineDashed' },
  { type: 'spacer', label: 'Spacer', hint: 'Vertical space', icon: 'IconSpacingVertical' },
];

/**
 * Build a sensible starting layout from a validated spec: title, interpretation,
 * metric cards, a ranked breakdown + table when grouped, and the AI narrative.
 */
export function defaultLayout(spec: ReportSpec, reportName: string): ReportLayout {
  const metricAliases = spec.metrics.map((m) => metricAlias(m));
  const firstNumericAlias =
    metricAliases.find((a) => a !== 'count') ?? metricAliases[0] ?? 'count';

  const blocks: Block[] = [
    { id: blockId('header', 0), type: 'header', title: reportName, subtitle: '' },
    { id: blockId('spec', 1), type: 'specEcho' },
    { id: blockId('metrics', 2), type: 'metricRow', metrics: metricAliases },
  ];

  // Only meaningful when there is a time window to compare against a prior one.
  if (spec.timeWindow) {
    blocks.push({ id: blockId('insights', 7), type: 'insights' });
  }

  if (spec.groupBy && spec.groupBy.length > 0) {
    blocks.push({ id: blockId('chart', 3), type: 'chart', chartKind: 'bar' });
    blocks.push({ id: blockId('bars', 4), type: 'barBreakdown', metricAlias: firstNumericAlias, maxRows: 10 });
    blocks.push({ id: blockId('table', 5), type: 'table', maxRows: 25 });
  }

  blocks.push({ id: blockId('narrative', 6), type: 'narrative' });
  return { version: 2, theme: { ...DEFAULT_THEME }, blocks };
}

/**
 * Coerce arbitrary persisted JSON into a valid layout, or rebuild a default.
 * Also migrates a valid v1 layout (blocks only) up to v2 by attaching a default
 * theme, so older reports keep their block arrangement but gain styling.
 */
export function coerceLayout(raw: unknown, spec: ReportSpec, reportName: string): ReportLayout {
  if (
    raw &&
    typeof raw === 'object' &&
    Array.isArray((raw as ReportLayout).blocks) &&
    (raw as ReportLayout).blocks.length > 0
  ) {
    return upgradeLayout(raw as ReportLayout);
  }
  return defaultLayout(spec, reportName);
}

const KNOWN_BLOCK_TYPES = new Set<BlockType>(BLOCK_PALETTE.map((p) => p.type));

// The content/style fields a block may carry (everything except id + type).
// Used to build the compact context sent to the AI and shared by both
// sanitizers so a value can never reach the renderer un-whitelisted.
export const BLOCK_CONTENT_FIELDS = [
  'title', 'subtitle', 'metrics', 'maxRows', 'metricAlias', 'chartKind',
  'markdown', 'imageUrl', 'linkUrl', 'buttonText', 'buttonUrl', 'height', 'align',
] as const;

// Whitelist + coerce the content/style fields of a raw object onto `target`.
function assignBlockFields(target: Partial<Block>, r: any): void {
  if (typeof r.title === 'string') target.title = r.title;
  if (typeof r.subtitle === 'string') target.subtitle = r.subtitle;
  if (Array.isArray(r.metrics)) target.metrics = r.metrics.filter((x: unknown) => typeof x === 'string');
  if (Number.isFinite(r.maxRows)) target.maxRows = Math.max(1, Math.min(100, Math.floor(r.maxRows)));
  if (typeof r.metricAlias === 'string') target.metricAlias = r.metricAlias;
  if (r.chartKind === 'bar' || r.chartKind === 'pie') target.chartKind = r.chartKind;
  if (typeof r.markdown === 'string') target.markdown = r.markdown;
  if (typeof r.imageUrl === 'string') target.imageUrl = r.imageUrl;
  if (typeof r.linkUrl === 'string') target.linkUrl = r.linkUrl;
  if (typeof r.buttonText === 'string') target.buttonText = r.buttonText;
  if (typeof r.buttonUrl === 'string') target.buttonUrl = r.buttonUrl;
  if (Number.isFinite(r.height)) target.height = Math.max(4, Math.min(120, Math.floor(r.height)));
  if (r.align === 'left' || r.align === 'center' || r.align === 'right') target.align = r.align;
}

/**
 * Sanitize an arbitrary (e.g. AI-authored) block array into safe Block objects:
 * drop unknown types, whitelist known fields, coerce primitives, and assign
 * stable ids. Never trusts free-form JSON to reach the renderer as-is.
 */
export function sanitizeBlocks(raw: unknown): Block[] {
  if (!Array.isArray(raw)) return [];
  const out: Block[] = [];
  raw.forEach((r: any, i: number) => {
    const type = r?.type as BlockType;
    if (!KNOWN_BLOCK_TYPES.has(type)) return;
    const b: Block = { id: typeof r?.id === 'string' && r.id ? r.id : blockId(type, i), type };
    assignBlockFields(b, r);
    out.push(b);
  });
  return out;
}

/**
 * Sanitize a single partial block patch (AI-authored) for a merge-by-id edit:
 * returns the target block id (if provided) plus only the whitelisted content
 * fields to change. Never changes `type`; unknown fields are dropped.
 */
export function sanitizeBlockPatch(raw: unknown): { id?: string; fields: Partial<Block> } {
  const r = raw as any;
  const fields: Partial<Block> = {};
  if (!r || typeof r !== 'object') return { fields };
  assignBlockFields(fields, r);
  const id = typeof r.id === 'string' && r.id ? r.id : undefined;
  return { id, fields };
}

/**
 * Merge-by-id: apply partial patches onto `base` blocks, changing only the
 * targeted ids and keeping every other block VERBATIM (order preserved). A patch
 * without an id targets `selectedId`. Patches for unknown ids are ignored (no
 * hallucinated blocks). This is what makes a scoped "just edit this chart" safe.
 */
export function applyBlockPatches(base: Block[], patches: unknown, selectedId?: string): Block[] {
  if (!Array.isArray(patches) || patches.length === 0 || base.length === 0) return base;
  const byId = new Map(base.map((b) => [b.id, b] as const));
  for (const raw of patches) {
    const { id, fields } = sanitizeBlockPatch(raw);
    const targetId = id ?? selectedId;
    if (!targetId) continue;
    const cur = byId.get(targetId);
    if (!cur) continue;
    byId.set(targetId, { ...cur, ...fields });
  }
  return base.map((b) => byId.get(b.id) ?? b);
}

/** Bring any valid layout object up to the current version (adds a theme). */
export function upgradeLayout(layout: ReportLayout): ReportLayout {
  if (layout.version === 2 && layout.theme) return layout;
  return {
    version: 2,
    theme: layout.theme ?? { ...DEFAULT_THEME },
    blocks: layout.blocks,
  };
}
