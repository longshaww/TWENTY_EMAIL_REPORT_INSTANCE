/**
 * The Report Spec DSL — a small, constrained, validated description of a report.
 *
 * The LLM emits a Report Spec (never raw GraphQL); a deterministic executor
 * (lib/executor.ts) runs it against CRM data. This module is PURE — no SDK or
 * network imports — so the validator and the plain-English renderer are trivially
 * unit-testable (see report-spec.unit-test.ts).
 */

// --- Schema shape passed in by the caller (built from Metadata introspection) --
export type FieldType =
  | 'TEXT'
  | 'NUMBER'
  | 'NUMERIC'
  | 'CURRENCY'
  | 'RATING'
  | 'BOOLEAN'
  | 'DATE'
  | 'DATE_TIME'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'RELATION'
  | 'UUID'
  | 'ACTOR'
  | 'POSITION'
  | 'TS_VECTOR'
  | 'FULL_NAME'
  | string;

export type FieldInfo = {
  name: string;
  label: string;
  type: FieldType;
  options?: string[]; // SELECT / MULTI_SELECT option values
  relationTarget?: string; // target object nameSingular for RELATION
};

export type ObjectSchema = {
  nameSingular: string;
  namePlural: string;
  labelSingular: string;
  labelPlural: string;
  fields: Record<string, FieldInfo>;
};

// --- The DSL ----------------------------------------------------------------
export type FilterOp =
  | 'is'
  | 'is_not'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'not_contains'
  | 'is_empty'
  | 'is_not_empty';

export type Filter = {
  field: string;
  op: FilterOp;
  value?: string | number | boolean | Array<string | number>;
};

export type DateGranularity = 'day' | 'week' | 'month' | 'quarter' | 'year';

export type GroupBy = {
  field: string;
  dateGranularity?: DateGranularity;
};

export type MetricOp = 'count' | 'sum' | 'avg' | 'min' | 'max';

export type Metric = {
  op: MetricOp;
  field?: string; // required for sum/avg/min/max; ignored for count
  alias?: string;
  label?: string;
};

export type TimeWindow = {
  field: string;
  lastDays?: number; // relative: [now - lastDays, now]
  from?: string; // ISO
  to?: string; // ISO
};

export type ReportSpec = {
  object: string;
  filters?: Filter[];
  timeWindow?: TimeWindow;
  groupBy?: GroupBy[];
  metrics: Metric[];
  sort?: { by: string; direction: 'ASC' | 'DESC' };
  limit?: number;
};

/** Shared currency formatter (used by the email renderer and narrative fallback). */
export function formatMoney(amount: number, currencyCode: string): string {
  return `${currencyCode} ${Number(amount).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export const NUMERIC_TYPES = new Set(['NUMBER', 'NUMERIC', 'CURRENCY', 'RATING']);
export const GROUPABLE_TYPES = new Set([
  'SELECT',
  'MULTI_SELECT',
  'TEXT',
  'BOOLEAN',
  'DATE',
  'DATE_TIME',
  'RELATION',
  'RATING',
  'NUMBER',
]);
export const NON_REPORTABLE_TYPES = new Set(['TS_VECTOR', 'POSITION', 'ACTOR', 'UUID', 'RICH_TEXT']);
export const DATE_TYPES = new Set(['DATE', 'DATE_TIME']);
export const FILTER_OPS: FilterOp[] = [
  'is',
  'is_not',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'not_contains',
  'is_empty',
  'is_not_empty',
];
export const METRIC_OPS: MetricOp[] = ['count', 'sum', 'avg', 'min', 'max'];

export const MAX_LIMIT = 5000;
export const MAX_GROUP_BY = 2;

export type ValidationResult =
  | { ok: true; spec: ReportSpec; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function metricAlias(m: Metric): string {
  if (m.alias) return m.alias;
  if (m.op === 'count') return 'count';
  return `${m.op}_${m.field}`;
}

export function metricLabel(m: Metric, schema?: ObjectSchema): string {
  if (m.label) return m.label;
  if (m.op === 'count') return 'Count';
  const fieldLabel = schema?.fields[m.field ?? '']?.label ?? m.field ?? '';
  const opLabel = { sum: 'Total', avg: 'Average', min: 'Min', max: 'Max' }[m.op] ?? m.op;
  return `${opLabel} ${fieldLabel}`;
}

/**
 * Validate + normalize an untrusted spec (e.g. LLM output) against a schema.
 * Returns a normalized spec on success, or a list of human-readable errors.
 */
export function validateReportSpec(input: unknown, schema: ObjectSchema): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isObj(input)) {
    return { ok: false, errors: ['Spec must be an object.'], warnings };
  }

  const raw = input as Partial<ReportSpec>;

  // object
  if (typeof raw.object !== 'string' || raw.object.length === 0) {
    errors.push('spec.object is required.');
  } else if (raw.object !== schema.nameSingular) {
    errors.push(
      `spec.object "${raw.object}" does not match the report's object "${schema.nameSingular}".`,
    );
  }

  const fieldExists = (name: string) => Object.prototype.hasOwnProperty.call(schema.fields, name);
  const fieldType = (name: string) => schema.fields[name]?.type;

  // metrics
  const metrics: Metric[] = Array.isArray(raw.metrics) ? (raw.metrics as Metric[]) : [];
  if (metrics.length === 0) {
    errors.push('At least one metric is required (e.g. { "op": "count" }).');
  }
  const seenAliases = new Set<string>();
  for (const m of metrics) {
    if (!isObj(m) || !METRIC_OPS.includes(m.op)) {
      errors.push(`Invalid metric op "${(m as Metric)?.op}". Use one of ${METRIC_OPS.join(', ')}.`);
      continue;
    }
    if (m.op !== 'count') {
      if (!m.field) {
        errors.push(`Metric "${m.op}" requires a numeric field.`);
      } else if (!fieldExists(m.field)) {
        errors.push(`Metric field "${m.field}" does not exist on ${schema.nameSingular}.`);
      } else if (!NUMERIC_TYPES.has(fieldType(m.field)!)) {
        errors.push(`Metric field "${m.field}" (${fieldType(m.field)}) is not numeric.`);
      }
    }
    const alias = metricAlias(m);
    if (seenAliases.has(alias)) errors.push(`Duplicate metric alias "${alias}".`);
    seenAliases.add(alias);
  }

  // groupBy
  const groupBy: GroupBy[] = Array.isArray(raw.groupBy) ? (raw.groupBy as GroupBy[]) : [];
  if (groupBy.length > MAX_GROUP_BY) {
    errors.push(`At most ${MAX_GROUP_BY} group-by fields are supported.`);
  }
  for (const g of groupBy) {
    if (!isObj(g) || typeof g.field !== 'string') {
      errors.push('Each groupBy entry needs a "field".');
      continue;
    }
    if (!fieldExists(g.field)) {
      errors.push(`Group-by field "${g.field}" does not exist on ${schema.nameSingular}.`);
    } else if (!GROUPABLE_TYPES.has(fieldType(g.field)!)) {
      errors.push(`Group-by field "${g.field}" (${fieldType(g.field)}) cannot be grouped.`);
    }
    if (g.dateGranularity && !DATE_TYPES.has(fieldType(g.field)!)) {
      warnings.push(`dateGranularity ignored on non-date field "${g.field}".`);
    }
  }

  // filters
  const filters: Filter[] = Array.isArray(raw.filters) ? (raw.filters as Filter[]) : [];
  for (const f of filters) {
    if (!isObj(f) || typeof f.field !== 'string' || !FILTER_OPS.includes(f.op)) {
      errors.push(`Invalid filter ${JSON.stringify(f)}.`);
      continue;
    }
    if (!fieldExists(f.field)) {
      errors.push(`Filter field "${f.field}" does not exist on ${schema.nameSingular}.`);
      continue;
    }
    const needsValue = !['is_empty', 'is_not_empty'].includes(f.op);
    if (needsValue && (f.value === undefined || f.value === null)) {
      errors.push(`Filter on "${f.field}" with op "${f.op}" needs a value.`);
    }
    const ft = fieldType(f.field)!;
    const opts = schema.fields[f.field]?.options;
    if ((ft === 'SELECT' || ft === 'MULTI_SELECT') && opts && needsValue) {
      const values = Array.isArray(f.value) ? f.value : [f.value];
      for (const v of values) {
        if (typeof v === 'string' && !opts.includes(v)) {
          errors.push(`Filter value "${v}" is not a valid option for "${f.field}" (${opts.join(', ')}).`);
        }
      }
    }
  }

  // timeWindow
  let timeWindow: TimeWindow | undefined;
  if (raw.timeWindow !== undefined) {
    const tw = raw.timeWindow as TimeWindow;
    if (!isObj(tw) || typeof tw.field !== 'string') {
      errors.push('timeWindow needs a date "field".');
    } else if (!fieldExists(tw.field)) {
      errors.push(`timeWindow field "${tw.field}" does not exist.`);
    } else if (!DATE_TYPES.has(fieldType(tw.field)!)) {
      errors.push(`timeWindow field "${tw.field}" (${fieldType(tw.field)}) is not a date.`);
    } else if (tw.lastDays === undefined && tw.from === undefined && tw.to === undefined) {
      errors.push('timeWindow needs lastDays, or from/to.');
    } else {
      timeWindow = tw;
    }
  }

  // sort
  let sort = raw.sort;
  if (sort) {
    if (!isObj(sort) || typeof sort.by !== 'string' || !['ASC', 'DESC'].includes(sort.direction)) {
      warnings.push('Invalid sort ignored.');
      sort = undefined;
    }
  }

  // limit
  let limit = raw.limit;
  if (limit !== undefined) {
    if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0) {
      warnings.push('Invalid limit ignored.');
      limit = undefined;
    } else if (limit > MAX_LIMIT) {
      limit = MAX_LIMIT;
      warnings.push(`limit capped at ${MAX_LIMIT}.`);
    } else {
      limit = Math.floor(limit);
    }
  }

  if (errors.length > 0) return { ok: false, errors, warnings };

  const normalized: ReportSpec = {
    object: schema.nameSingular,
    metrics: metrics.map((m) => ({ ...m, alias: metricAlias(m) })),
    ...(groupBy.length ? { groupBy } : {}),
    ...(filters.length ? { filters } : {}),
    ...(timeWindow ? { timeWindow } : {}),
    ...(sort ? { sort } : {}),
    ...(limit !== undefined ? { limit } : {}),
  };
  return { ok: true, spec: normalized, warnings };
}

// --- Plain-English rendering (trust-first) ----------------------------------
function humanizeOptionValue(v: string): string {
  return v
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function filterToEnglish(f: Filter, schema: ObjectSchema): string {
  const label = schema.fields[f.field]?.label ?? f.field;
  const val = Array.isArray(f.value)
    ? f.value.map((v) => (typeof v === 'string' ? humanizeOptionValue(v) : String(v))).join(' or ')
    : typeof f.value === 'string'
      ? humanizeOptionValue(f.value)
      : String(f.value);
  switch (f.op) {
    case 'is':
      return `${label} is ${val}`;
    case 'is_not':
      return `${label} is not ${val}`;
    case 'gt':
      return `${label} > ${val}`;
    case 'gte':
      return `${label} ≥ ${val}`;
    case 'lt':
      return `${label} < ${val}`;
    case 'lte':
      return `${label} ≤ ${val}`;
    case 'contains':
      return `${label} contains "${val}"`;
    case 'not_contains':
      return `${label} does not contain "${val}"`;
    case 'is_empty':
      return `${label} is empty`;
    case 'is_not_empty':
      return `${label} is set`;
    default:
      return `${label} ${f.op} ${val}`;
  }
}

/**
 * Deterministic plain-English restatement of a spec, e.g.:
 *  "Total Amount and count of Opportunities where Stage is Customer and Close
 *   Date in the last 7 days, grouped by Owner and Product Tier."
 */
export function specToEnglish(spec: ReportSpec, schema: ObjectSchema): string {
  const metricPhrases = spec.metrics.map((m) => {
    if (m.op === 'count') return `count of ${schema.labelPlural.toLowerCase()}`;
    const fl = schema.fields[m.field ?? '']?.label ?? m.field;
    const op = { sum: 'total', avg: 'average', min: 'minimum', max: 'maximum' }[m.op] ?? m.op;
    return `${op} ${fl}`;
  });
  const metricsText =
    metricPhrases.length === 1
      ? metricPhrases[0]
      : metricPhrases.slice(0, -1).join(', ') + ' and ' + metricPhrases[metricPhrases.length - 1];

  const clauses: string[] = [];
  for (const f of spec.filters ?? []) clauses.push(filterToEnglish(f, schema));
  if (spec.timeWindow) {
    const tl = schema.fields[spec.timeWindow.field]?.label ?? spec.timeWindow.field;
    if (spec.timeWindow.lastDays !== undefined) {
      clauses.push(`${tl} in the last ${spec.timeWindow.lastDays} days`);
    } else {
      const from = spec.timeWindow.from ? spec.timeWindow.from.slice(0, 10) : '…';
      const to = spec.timeWindow.to ? spec.timeWindow.to.slice(0, 10) : '…';
      clauses.push(`${tl} between ${from} and ${to}`);
    }
  }

  let sentence = capitalize(metricsText);
  if (clauses.length) sentence += ` where ${clauses.join(' and ')}`;
  if (spec.groupBy?.length) {
    const groups = spec.groupBy.map((g) => {
      const gl = schema.fields[g.field]?.label ?? g.field;
      return g.dateGranularity ? `${gl} (by ${g.dateGranularity})` : gl;
    });
    sentence += `, grouped by ${groups.join(' and ')}`;
  }
  if (spec.sort) {
    sentence += `, sorted by ${spec.sort.by} ${spec.sort.direction === 'DESC' ? 'descending' : 'ascending'}`;
  }
  if (spec.limit) sentence += `, top ${spec.limit}`;
  return sentence + '.';
}

function capitalize(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
