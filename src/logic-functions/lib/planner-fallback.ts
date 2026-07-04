/**
 * Deterministic keyword planner — a graceful fallback used ONLY when no
 * OPENROUTER_API_KEY is configured. It lets the whole pipeline (spec → execute →
 * render → email) work offline for local dev and demos, and degrades cleanly if
 * the LLM is unavailable. When a key is present, the real LLM path is used
 * instead (see report-service.ts).
 */
import type { ObjectSchema, ReportSpec } from './report-spec';
import { NUMERIC_TYPES } from './report-spec';

type Dim = { keywords: string[]; field: string };

function pickObject(prompt: string, objects: ObjectSchema[], preferredObject?: string): ObjectSchema {
  const p = prompt.toLowerCase();
  const byName = (n: string) => objects.find((o) => o.nameSingular === n);
  // A strong object keyword in the prompt always wins (keeps the chat flexible).
  if (/deal|pipeline|opportunit|revenue|won|sales|quota|forecast/.test(p) && byName('opportunity'))
    return byName('opportunity')!;
  if (/compan|account/.test(p) && byName('company')) return byName('company')!;
  if (/people|contact|person|lead\b/.test(p) && byName('person')) return byName('person')!;
  if (/task/.test(p) && byName('task')) return byName('task')!;
  if (/note/.test(p) && byName('note')) return byName('note')!;
  // Otherwise fall back to the picked data source, then opportunity, then anything.
  return (preferredObject ? byName(preferredObject) : undefined) ?? byName('opportunity') ?? objects[0];
}

export function planFallback(prompt: string, objects: ObjectSchema[], preferredObject?: string): { object: string; spec: ReportSpec } {
  const schema = pickObject(prompt, objects, preferredObject);
  const p = prompt.toLowerCase();
  const has = (f: string) => Object.prototype.hasOwnProperty.call(schema.fields, f);

  // metrics
  const currencyField = Object.values(schema.fields).find((f) => f.type === 'CURRENCY')?.name;
  const metrics: ReportSpec['metrics'] = [];
  // Explicit count intent ("how many", "number of") must NOT get a money metric
  // as the headline. Money words are only revenue-specific ones — "total" alone is
  // too ambiguous ("total number of deals" is a count).
  const wantsCount = /\bhow many\b|\bnumber of\b|\bcount\b|\bhow much\b(?=.*\b(deal|record|opportunit|compan|lead)s?\b)/.test(p);
  const wantsMoney = !wantsCount && /revenue|amount|\$|money|\bsum\b|pipeline value|total (revenue|amount|value|deal value)/.test(p) && !!currencyField;
  if (wantsMoney) {
    const op = /average|avg|mean/.test(p) ? 'avg' : 'sum';
    metrics.push({ op, field: currencyField! });
  }
  metrics.push({ op: 'count' });

  // groupBy
  const dims: Dim[] = [
    { keywords: ['rep', 'owner', 'salesperson', 'by person', 'per rep'], field: 'owner' },
    { keywords: ['region', 'geograph', 'territory'], field: 'region' },
    { keywords: ['stage', 'funnel'], field: 'stage' },
    { keywords: ['tier', 'product', 'plan'], field: 'productTier' },
    { keywords: ['source', 'channel'], field: 'leadSource' },
    { keywords: ['industry', 'vertical', 'sector'], field: 'industry' },
  ];
  const groupBy: ReportSpec['groupBy'] = [];
  for (const d of dims) {
    if (groupBy.length >= 2) break;
    if (d.keywords.some((k) => p.includes(k)) && has(d.field)) groupBy.push({ field: d.field });
  }
  // date grouping
  const dateField = has('closeDate') ? 'closeDate' : has('createdAt') ? 'createdAt' : undefined;
  if (dateField && groupBy.length < 2) {
    if (/monthly|per month|by month/.test(p)) groupBy.push({ field: dateField, dateGranularity: 'month' });
    else if (/quarter/.test(p)) groupBy.push({ field: dateField, dateGranularity: 'quarter' });
    else if (/weekly|per week|by week/.test(p)) groupBy.push({ field: dateField, dateGranularity: 'week' });
  }

  // filters
  const filters: ReportSpec['filters'] = [];
  if (has('stage')) {
    const stageOpts = schema.fields['stage'].options ?? [];
    if (/won|closed[- ]?won|customers?\b/.test(p) && stageOpts.includes('CUSTOMER'))
      filters.push({ field: 'stage', op: 'is', value: 'CUSTOMER' });
    else if (/open|in[- ]?pipeline|active deal/.test(p) && stageOpts.includes('CUSTOMER'))
      filters.push({ field: 'stage', op: 'is_not', value: 'CUSTOMER' });
  }

  // timeWindow
  let timeWindow: ReportSpec['timeWindow'];
  if (dateField) {
    const m = p.match(/last\s+(\d+)\s+day/);
    if (m) timeWindow = { field: dateField, lastDays: parseInt(m[1], 10) };
    else if (/last week|past week|weekly|this week/.test(p)) timeWindow = { field: dateField, lastDays: 7 };
    else if (/last month|past month|last 30/.test(p)) timeWindow = { field: dateField, lastDays: 30 };
    else if (/last quarter|past quarter|last 90/.test(p)) timeWindow = { field: dateField, lastDays: 90 };
  }

  // limit
  const topM = p.match(/top\s+(\d+)/);
  const limit = topM ? parseInt(topM[1], 10) : undefined;

  // ensure any numeric metric field is actually numeric on this schema
  const safeMetrics = metrics.filter((m) => m.op === 'count' || (m.field && NUMERIC_TYPES.has(schema.fields[m.field]?.type)));
  if (safeMetrics.length === 0) safeMetrics.push({ op: 'count' });

  const spec: ReportSpec = {
    object: schema.nameSingular,
    metrics: safeMetrics,
    ...(groupBy.length ? { groupBy } : {}),
    ...(filters.length ? { filters } : {}),
    ...(timeWindow ? { timeWindow } : {}),
    ...(limit ? { limit } : {}),
  };
  return { object: schema.nameSingular, spec };
}
