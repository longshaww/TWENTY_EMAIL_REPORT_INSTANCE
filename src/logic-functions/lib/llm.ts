/**
 * LLMProvider — the single, thin gateway to the language model.
 *
 * All model access goes through OpenRouter (OpenAI-compatible chat/completions),
 * so the *model* is chosen by config (LLM_MODEL) with no hardcoded provider. The
 * submission default routes to a Claude model; a developer can flip LLM_MODEL to
 * any OpenRouter model without touching code.
 *
 * The LLM only ever produces a constrained Report Spec (validated downstream) or
 * a short natural-language narrative — it never authors GraphQL or touches data.
 */
import type { ObjectSchema, ReportSpec } from './report-spec';
import type { ReportResult } from './executor';
import type { PeriodComparison } from './compare';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

function getConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.LLM_MODEL || 'anthropic/claude-opus-4.8';
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured (set it in the app server variables).');
  }
  return { apiKey, model };
}

async function chat(messages: ChatMessage[], opts: { json: boolean; maxTokens?: number } = { json: true }): Promise<string> {
  const { apiKey, model } = getConfig();
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0,
    max_tokens: opts.maxTokens ?? 1200,
  };
  if (opts.json) body.response_format = { type: 'json_object' };

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      // Optional attribution headers OpenRouter recommends.
      'HTTP-Referer': process.env.PUBLIC_BASE_URL || 'https://twenty.com',
      'X-Title': 'NorthPeak Reports',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LLM request failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const data: any = await res.json();
  const content = extractText(data?.choices?.[0]?.message);
  if (!content) {
    throw new Error('LLM returned an empty response.');
  }
  return content;
}

// OpenRouter/OpenAI-compatible models may return message.content as a plain
// string, as an array of content parts ({type:'text', text}), or null (with the
// text elsewhere). Normalize all shapes to a single string.
function extractText(message: any): string {
  if (!message) return '';
  const content = message.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part: any) => (typeof part === 'string' ? part : (part?.text ?? '')))
      .join('')
      .trim();
  }
  return '';
}

function parseJsonLoose(text: string): any {
  // Strip code fences if the model wrapped the JSON.
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Last resort: grab the outermost {...}. The slice can still be malformed
    // (e.g. prose contains stray braces), so guard the parse and fail with a
    // friendly message instead of leaking a raw SyntaxError.
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        throw new Error('Could not parse JSON from LLM output.');
      }
    }
    throw new Error('Could not parse JSON from LLM output.');
  }
}

const DSL_GUIDE = `You translate a plain-language reporting request into a strict JSON "Report Spec".
Output ONLY JSON of this shape (no prose):
{
  "object": "<object nameSingular from the catalog>",
  "spec": {
    "object": "<same nameSingular>",
    "metrics": [ { "op": "count" } | { "op": "sum|avg|min|max", "field": "<numeric field>" } ],
    "groupBy": [ { "field": "<field>", "dateGranularity": "day|week|month|quarter|year (only for DATE/DATE_TIME)" } ],
    "filters": [ { "field": "<field>", "op": "is|is_not|gt|gte|lt|lte|contains|not_contains|is_empty|is_not_empty", "value": <string|number|array> } ],
    "timeWindow": { "field": "<DATE/DATE_TIME field>", "lastDays": <n> }  // or "from"/"to" ISO strings
  }
}
Rules:
- Use ONLY object nameSingular values and field names that appear in the catalog.
- For SELECT fields, filter "value" must be one of the listed option VALUES (uppercase), or an array of them.
- sum/avg/min/max require a numeric field (NUMBER or CURRENCY). "count" needs no field.
- At most 2 groupBy fields. Prefer grouping by the dimension(s) the user names (rep/owner, region, stage, product tier, industry, lead source, month).
- "won deals" usually means stage is CUSTOMER on opportunity. Money questions use sum of amount.
- Keep it minimal: only include filters/timeWindow/groupBy that the request implies.`;

export type PlanResult = { object: string; spec: unknown };

/** Ask the model to choose the object and draft a spec from the schema catalog. */
export async function planReportSpec(prompt: string, catalog: string, preferredObject?: string): Promise<PlanResult> {
  const bias = preferredObject
    ? `\nPrefer object "${preferredObject}" unless the request clearly names a different one.`
    : '';
  const content = await chat([
    { role: 'system', content: `${DSL_GUIDE}\n\nCATALOG (available objects and their reportable fields):\n${catalog}` },
    { role: 'user', content: `Reporting request: "${prompt}"${bias}\nReturn the JSON Report Spec.` },
  ]);
  const parsed = parseJsonLoose(content);
  const object = parsed?.object ?? parsed?.spec?.object;
  const spec = parsed?.spec ?? parsed;
  return { object: String(object ?? ''), spec };
}

/** One repair attempt: hand the model the validation errors and ask for a fix. */
export async function repairReportSpec(
  prompt: string,
  object: string,
  schemaSummary: string,
  badSpec: unknown,
  errors: string[],
): Promise<unknown> {
  const content = await chat([
    { role: 'system', content: `${DSL_GUIDE}\n\nThe object is "${object}". Its reportable fields:\n${schemaSummary}` },
    {
      role: 'user',
      content: `Reporting request: "${prompt}"\nYour previous spec was invalid:\n${JSON.stringify(
        badSpec,
      )}\nErrors:\n- ${errors.join('\n- ')}\nReturn a corrected JSON Report Spec (same shape, "spec" key).`,
    },
  ]);
  const parsed = parseJsonLoose(content);
  return parsed?.spec ?? parsed;
}

/**
 * Generate a short, plain-language narrative of the executed numbers — the
 * app's second meaningful AI surface. It only ever sees aggregated results and
 * the interpreted spec (no raw PII rows), which also serves GDPR data-minimization.
 */
export async function generateNarrative(args: {
  prompt: string;
  specEnglish: string;
  result: ReportResult;
}): Promise<string> {
  const { prompt, specEnglish, result } = args;
  const compact = {
    interpretedAs: specEnglish,
    object: result.labelPlural,
    matchedCount: result.matchedCount,
    grandTotals: result.grandTotals,
    groupBy: result.groupBy.map((g) => g.label),
    rows: result.rows.slice(0, 25).map((r) => ({ ...r.group, ...r.values })),
    currency: result.currencyCode,
  };
  const content = await chat(
    [
      {
        role: 'system',
        content:
          'You are a concise analyst. Given aggregated report numbers, write 2–4 short sentences of plain-language insight for a business audience: call out the headline figure, the top and bottom groups, and any notable concentration or trend. Do not invent numbers beyond those provided. Do not use markdown headers. Output plain text only.',
      },
      {
        role: 'user',
        content: `Original request: "${prompt}"\nAggregated data (JSON):\n${JSON.stringify(compact)}`,
      },
    ],
    { json: false, maxTokens: 400 },
  );
  return content.trim();
}

/**
 * Phrase a pre-computed period-over-period comparison into a short insight —
 * the app's most additive AI surface. The model receives ONLY the deltas this
 * app already computed deterministically (see compare.ts); it never sees raw
 * rows and must not invent figures. This is what makes the AI here additive
 * (spotting the story in the change) rather than decorative.
 */
export async function generateInsight(args: {
  specEnglish: string;
  comparison: PeriodComparison;
}): Promise<string> {
  const { specEnglish, comparison } = args;
  const content = await chat(
    [
      {
        role: 'system',
        content:
          'You are a concise sales/revenue analyst. You are given a period-over-period comparison whose figures are ALREADY COMPUTED. Write 1–2 short sentences of plain-language insight for a business audience: lead with the headline metric and its direction versus the previous period, then call out the single most important mover (a group that rose or fell). Be specific about what changed. Do NOT invent or recompute any numbers beyond those provided. No markdown, plain text only.',
      },
      {
        role: 'user',
        content: `Report: "${specEnglish}"\nComparison vs ${comparison.periodLabel} (JSON):\n${JSON.stringify(comparison)}`,
      },
    ],
    { json: false, maxTokens: 300 },
  );
  return content.trim();
}

export type AssistantMessage = { role: 'user' | 'assistant'; content: string };

/**
 * Run a multi-turn assistant conversation constrained to a JSON envelope.
 * Used by the in-builder "arrange the email" assistant, which either asks the
 * user a clarifying question or returns a set of changes to apply.
 */
export async function chatEnvelope(system: string, messages: AssistantMessage[], maxTokens = 1600): Promise<any> {
  const content = await chat([{ role: 'system', content: system }, ...messages], { json: true, maxTokens });
  return parseJsonLoose(content);
}

// Re-export types for convenience where the provider is imported.
export type { ObjectSchema, ReportSpec };
