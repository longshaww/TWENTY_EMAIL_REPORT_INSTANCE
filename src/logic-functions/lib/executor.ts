/**
 * Deterministic Report Spec executor.
 *
 * Fetches records for the spec's object via the typed CoreApiClient (a fixed,
 * app-authored selection set — NEVER LLM-authored GraphQL), then applies filters,
 * grouping and aggregation in plain JS. This is what makes the numbers
 * trustworthy: the LLM only chooses *what* to compute, never *how*.
 */
import { CoreApiClient } from 'twenty-client-sdk/core';

import type { Filter, GroupBy, Metric, ObjectSchema, ReportSpec } from './report-spec';
import { metricAlias, metricLabel, NUMERIC_TYPES } from './report-spec';

const PAGE_SIZE = 100;
const HARD_ROW_CAP = 5000;

export type ReportColumn = {
  alias: string;
  label: string;
  op: string;
  field?: string;
  isCurrency: boolean;
};

export type ReportRow = {
  group: Record<string, string>; // field -> display value (humanized label)
  groupKeys?: Record<string, string>; // field -> raw sortable key (ISO date / option / relation id)
  values: Record<string, number>; // alias -> number
};

export type ReportResult = {
  object: string;
  labelPlural: string;
  groupBy: Array<{ field: string; label: string; dateGranularity?: string }>;
  metrics: ReportColumn[];
  rows: ReportRow[];
  grandTotals: Record<string, number>;
  matchedCount: number;
  scannedCount: number;
  truncated: boolean;
  dataAsOf: string;
  currencyCode: string;
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Selection set
// ---------------------------------------------------------------------------
function relationSelection(target?: string): Record<string, unknown> {
  // workspaceMember / person carry a FULL_NAME; others expose a scalar name.
  if (target === 'workspaceMember' || target === 'person') {
    return { id: true, name: { firstName: true, lastName: true } };
  }
  return { id: true, name: true };
}

function buildSelection(spec: ReportSpec, schema: ObjectSchema, extraFields: string[] = []): Record<string, unknown> {
  const needed = new Set<string>();
  for (const g of spec.groupBy ?? []) needed.add(g.field);
  for (const f of spec.filters ?? []) needed.add(f.field);
  if (spec.timeWindow) needed.add(spec.timeWindow.field);
  for (const m of spec.metrics) if (m.field) needed.add(m.field);
  // Extra fields the caller will filter on later in memory (e.g. the per-recipient
  // scope field) — must be selected up front so a single fetch serves every scope.
  for (const f of extraFields) needed.add(f);

  const sel: Record<string, unknown> = { id: true };
  for (const name of needed) {
    const info = schema.fields[name];
    if (!info) continue;
    if (info.type === 'CURRENCY') sel[name] = { amountMicros: true, currencyCode: true };
    else if (info.type === 'RELATION') sel[name] = relationSelection(info.relationTarget);
    else sel[name] = true;
  }
  return sel;
}

// ---------------------------------------------------------------------------
// Value extraction
// ---------------------------------------------------------------------------
function numericValue(record: any, field: string, schema: ObjectSchema): number | null {
  const info = schema.fields[field];
  const raw = record?.[field];
  if (raw === null || raw === undefined) return null;
  if (info?.type === 'CURRENCY') {
    const micros = raw?.amountMicros;
    return micros === null || micros === undefined ? null : Number(micros) / 1_000_000;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function displayValue(record: any, field: string, schema: ObjectSchema): { key: string; label: string } {
  const info = schema.fields[field];
  const raw = record?.[field];
  if (raw === null || raw === undefined) return { key: '∅', label: '(none)' };
  if (info?.type === 'RELATION') {
    const name = raw?.name;
    if (name && typeof name === 'object') {
      const label = [name.firstName, name.lastName].filter(Boolean).join(' ') || raw.id;
      return { key: raw.id ?? label, label };
    }
    return { key: raw.id ?? String(name), label: String(name ?? raw.id ?? '(none)') };
  }
  if (info?.type === 'CURRENCY') {
    const v = numericValue(record, field, schema);
    return { key: String(v), label: String(v) };
  }
  return { key: String(raw), label: String(raw) };
}

function humanizeOption(v: string): string {
  if (v === '∅') return '(none)';
  return v
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------
function truncateDate(iso: string, gran: string): { key: string; label: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { key: '∅', label: '(none)' };
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth(); // 0-based
  switch (gran) {
    case 'year':
      return { key: `${y}`, label: `${y}` };
    case 'quarter': {
      const q = Math.floor(m / 3) + 1;
      return { key: `${y}-Q${q}`, label: `${y} Q${q}` };
    }
    case 'week': {
      const day = d.getUTCDay(); // 0 Sun..6 Sat
      const diff = (day + 6) % 7; // days since Monday
      const monday = new Date(Date.UTC(y, m, d.getUTCDate() - diff));
      const key = monday.toISOString().slice(0, 10);
      return { key, label: `Week of ${key}` };
    }
    case 'day': {
      // Use UTC y/m/d (not the raw ISO slice, which follows the source offset) so
      // day buckets line up with week/month/quarter/year buckets.
      const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      return { key, label: key };
    }
    case 'month':
    default: {
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      return { key, label: key };
    }
  }
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------
function compare(record: any, f: Filter, schema: ObjectSchema): boolean {
  const info = schema.fields[f.field];
  const type = info?.type;
  const isEmptyVal = (v: any) =>
    v === null || v === undefined || v === '' || (typeof v === 'object' && v?.amountMicros == null && v?.name == null && v?.id == null);

  if (f.op === 'is_empty') return isEmptyVal(record?.[f.field]);
  if (f.op === 'is_not_empty') return !isEmptyVal(record?.[f.field]);

  // numeric / date comparisons
  if (['gt', 'gte', 'lt', 'lte'].includes(f.op)) {
    let left: number | null;
    let right: number;
    if (type && (type === 'DATE' || type === 'DATE_TIME')) {
      const lv = record?.[f.field];
      left = lv ? new Date(lv).getTime() : null;
      right = new Date(String(f.value)).getTime();
    } else {
      left = numericValue(record, f.field, schema);
      right = Number(f.value);
    }
    if (left === null || !Number.isFinite(right)) return false;
    if (f.op === 'gt') return left > right;
    if (f.op === 'gte') return left >= right;
    if (f.op === 'lt') return left < right;
    return left <= right;
  }

  // equality / membership
  const { key, label } = displayValue(record, f.field, schema);
  const candidates = new Set([key, label]);
  if (type === 'RELATION') candidates.add(label);
  if (f.op === 'is' || f.op === 'is_not') {
    const values = Array.isArray(f.value) ? f.value.map(String) : [String(f.value)];
    const hit = values.some((v) => candidates.has(v));
    return f.op === 'is' ? hit : !hit;
  }
  if (f.op === 'contains' || f.op === 'not_contains') {
    // For RELATION/CURRENCY the raw value is an object (String(obj) === '[object
    // Object]'), so match against the resolved display label instead; scalars use
    // the raw value.
    const raw = record?.[f.field];
    const hay = (typeof raw === 'object' && raw !== null ? label : String(raw ?? label)).toLowerCase();
    const needle = String(f.value).toLowerCase();
    const hit = hay.includes(needle);
    return f.op === 'contains' ? hit : !hit;
  }
  return true;
}

function withinTimeWindow(record: any, spec: ReportSpec): boolean {
  const tw = spec.timeWindow;
  if (!tw) return true;
  const raw = record?.[tw.field];
  if (!raw) return false;
  const t = new Date(raw).getTime();
  const now = Date.now();
  const from = tw.from ? new Date(tw.from).getTime() : tw.lastDays !== undefined ? now - tw.lastDays * 86400000 : -Infinity;
  const to = tw.to ? new Date(tw.to).getTime() : now;
  return t >= from && t <= to;
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------
function aggregate(records: any[], metrics: Metric[], schema: ObjectSchema): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of metrics) {
    const alias = metricAlias(m);
    if (m.op === 'count') {
      out[alias] = records.length;
      continue;
    }
    const vals: number[] = [];
    for (const r of records) {
      const v = numericValue(r, m.field!, schema);
      if (v !== null) vals.push(v);
    }
    if (vals.length === 0) {
      out[alias] = 0;
      continue;
    }
    switch (m.op) {
      case 'sum':
        out[alias] = round2(vals.reduce((a, b) => a + b, 0));
        break;
      case 'avg':
        out[alias] = round2(vals.reduce((a, b) => a + b, 0) / vals.length);
        break;
      case 'min':
        out[alias] = round2(Math.min(...vals));
        break;
      case 'max':
        out[alias] = round2(Math.max(...vals));
        break;
    }
  }
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function groupKeyParts(
  record: any,
  groupBy: GroupBy[],
  schema: ObjectSchema,
): { keys: string[]; labels: Record<string, string>; rawKeys: Record<string, string> } {
  const keys: string[] = [];
  const labels: Record<string, string> = {};
  // Raw, sortable per-field key (ISO date bucket / option value / relation id) kept
  // alongside the humanized label so rows can be sorted by value, not by label.
  const rawKeys: Record<string, string> = {};
  for (const g of groupBy) {
    const info = schema.fields[g.field];
    let key: string;
    let label: string;
    if ((info?.type === 'DATE' || info?.type === 'DATE_TIME') && g.dateGranularity) {
      const raw = record?.[g.field];
      const t = raw ? truncateDate(raw, g.dateGranularity) : { key: '∅', label: '(none)' };
      key = t.key;
      label = t.label;
    } else {
      const dv = displayValue(record, g.field, schema);
      key = dv.key;
      label = info?.type === 'SELECT' || info?.type === 'MULTI_SELECT' ? humanizeOption(dv.label) : dv.label;
    }
    keys.push(`${g.field}=${key}`);
    labels[g.field] = label;
    rawKeys[g.field] = key;
  }
  return { keys, labels, rawKeys };
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------
async function fetchAllRecords(namePlural: string, selection: Record<string, unknown>): Promise<any[]> {
  const client = new CoreApiClient();
  const records: any[] = [];
  let after: string | undefined;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const args: Record<string, unknown> = { first: PAGE_SIZE };
    if (after) args.after = after;
    const query: any = {
      [namePlural]: {
        __args: args,
        edges: { node: selection, cursor: true },
        pageInfo: { hasNextPage: true, endCursor: true },
      },
    };
    const res: any = await client.query(query);
    const conn = res[namePlural];
    if (!conn) break;
    for (const e of conn.edges ?? []) records.push(e.node);
    if (records.length >= HARD_ROW_CAP) return records.slice(0, HARD_ROW_CAP);
    if (!conn.pageInfo?.hasNextPage) break;
    after = conn.pageInfo.endCursor;
    if (!after) break;
  }
  return records;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
/**
 * Fetch the raw records a spec needs (no filtering/aggregation) — the expensive,
 * network-bound half. `extraFields` forces additional fields into the selection
 * so ONE fetch can serve many in-memory variants (e.g. per-recipient scoping).
 */
export async function fetchSpecRecords(
  spec: ReportSpec,
  schema: ObjectSchema,
  extraFields: string[] = [],
): Promise<any[]> {
  const selection = buildSelection(spec, schema, extraFields);
  return fetchAllRecords(schema.namePlural, selection);
}

export async function executeSpec(spec: ReportSpec, schema: ObjectSchema): Promise<ReportResult> {
  const all = await fetchSpecRecords(spec, schema);
  return executeSpecOnRecords(spec, schema, all);
}

/**
 * The pure compute half: filter + group + aggregate + sort an already-fetched
 * record set. Cheap and synchronous, so per-recipient scoped variants reuse a
 * single fetch instead of re-querying the whole table N times.
 */
export function executeSpecOnRecords(spec: ReportSpec, schema: ObjectSchema, all: any[]): ReportResult {
  const truncated = all.length >= HARD_ROW_CAP;

  const matched = all.filter((r) => withinTimeWindow(r, spec) && (spec.filters ?? []).every((f) => compare(r, f, schema)));

  const columns: ReportColumn[] = spec.metrics.map((m) => ({
    alias: metricAlias(m),
    label: metricLabel(m, schema),
    op: m.op,
    field: m.field,
    isCurrency: m.field ? schema.fields[m.field]?.type === 'CURRENCY' : false,
  }));

  const grandTotals = aggregate(matched, spec.metrics, schema);

  let rows: ReportRow[];
  if (spec.groupBy?.length) {
    const buckets = new Map<string, { labels: Record<string, string>; rawKeys: Record<string, string>; records: any[] }>();
    for (const r of matched) {
      const { keys, labels, rawKeys } = groupKeyParts(r, spec.groupBy, schema);
      const k = keys.join('||');
      if (!buckets.has(k)) buckets.set(k, { labels, rawKeys, records: [] });
      buckets.get(k)!.records.push(r);
    }
    rows = [...buckets.values()].map((b) => ({ group: b.labels, groupKeys: b.rawKeys, values: aggregate(b.records, spec.metrics, schema) }));
    rows = sortRows(rows, spec, columns, schema);
    if (spec.limit) rows = rows.slice(0, spec.limit);
  } else {
    rows = [{ group: {}, groupKeys: {}, values: grandTotals }];
  }

  const { currencyCode, mixed } = detectCurrency(matched, spec, schema);
  const warnings: string[] = [];
  if (mixed) {
    warnings.push(
      `Records use more than one currency; monetary totals are summed as if in ${currencyCode} and may be inaccurate.`,
    );
  }
  if (truncated) {
    warnings.push(`Only the first ${HARD_ROW_CAP} records were scanned; results may be incomplete.`);
  }

  return {
    object: schema.nameSingular,
    labelPlural: schema.labelPlural,
    groupBy: (spec.groupBy ?? []).map((g) => ({
      field: g.field,
      label: schema.fields[g.field]?.label ?? g.field,
      ...(g.dateGranularity ? { dateGranularity: g.dateGranularity } : {}),
    })),
    metrics: columns,
    rows,
    grandTotals,
    matchedCount: matched.length,
    scannedCount: all.length,
    truncated,
    dataAsOf: new Date().toISOString(),
    currencyCode,
    warnings,
  };
}

function sortRows(rows: ReportRow[], spec: ReportSpec, columns: ReportColumn[], schema: ObjectSchema): ReportRow[] {
  const sortBy = spec.sort?.by ?? columns[0]?.alias;
  const dir = spec.sort?.direction ?? 'DESC';
  const groupFields = (spec.groupBy ?? []).map((g) => g.field);
  const sign = dir === 'ASC' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sortBy && groupFields.includes(sortBy)) {
      const type = schema.fields[sortBy]?.type;
      // Numeric/date group fields must compare by their RAW key, not the humanized
      // display label ('10' < '2' as strings; a "2024 Q1" label is unparseable as a
      // Date → NaN). groupKeys holds the sortable value (numbers, and ISO/zero-padded
      // date buckets like "2024-Q1"/"2024-03" that already sort chronologically).
      const av = a.groupKeys?.[sortBy] ?? a.group[sortBy];
      const bv = b.groupKeys?.[sortBy] ?? b.group[sortBy];
      if (NUMERIC_TYPES.has(type ?? '')) return sign * (Number(av) - Number(bv));
      if (type === 'DATE' || type === 'DATE_TIME') {
        // Raw date-bucket keys are lexicographically chronological across every
        // granularity (year/quarter/month/week/day), so a string compare is correct.
        return sign * String(av).localeCompare(String(bv));
      }
      return sign * String(av).localeCompare(String(bv));
    }
    const av = a.values[sortBy] ?? 0;
    const bv = b.values[sortBy] ?? 0;
    return sign * (av - bv);
  });
}

function detectCurrency(
  records: any[],
  spec: ReportSpec,
  schema: ObjectSchema,
): { currencyCode: string; mixed: boolean } {
  const currencyField = spec.metrics.find((m) => m.field && schema.fields[m.field]?.type === 'CURRENCY')?.field;
  if (!currencyField) return { currencyCode: 'USD', mixed: false };
  const codes = new Set<string>();
  for (const r of records) {
    const code = r?.[currencyField]?.currencyCode;
    if (code) codes.add(code);
  }
  const first = codes.values().next().value;
  return { currencyCode: first ?? 'USD', mixed: codes.size > 1 };
}
