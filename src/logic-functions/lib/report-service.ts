/**
 * Report service — orchestrates the full NL→spec→execute→narrate pipeline,
 * shared by every logic function so the behaviour is identical whether a report
 * is created from the UI, run on a schedule, or triggered as a native AI tool.
 */
import { applyBlockPatches, BLOCK_CONTENT_FIELDS, BLOCK_PALETTE, defaultLayout, sanitizeBlocks, type Block, type ReportLayout } from './blocks';
import type { PeriodComparison } from './compare';
import { executeSpec, type ReportResult } from './executor';
import { chatEnvelope, generateInsight, generateNarrative, planReportSpec, repairReportSpec, type AssistantMessage } from './llm';
import { buildSchemaSummaryForLLM, getObjectSchema, listReportableSchemas } from './metadata';
import { planFallback } from './planner-fallback';
import {
  type ObjectSchema,
  type ReportSpec,
  formatMoney,
  specToEnglish,
  validateReportSpec,
} from './report-spec';
import { DEFAULT_THEME, type ReportTheme } from './theme';

export type GeneratedSpec = {
  object: string;
  schema: ObjectSchema;
  spec: ReportSpec;
  specEnglish: string;
  warnings: string[];
  engine: 'llm' | 'fallback';
};

function hasLlmKey(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

async function loadReportableSchemas(): Promise<ObjectSchema[]> {
  // One fetch for the whole catalog (was: one fetch per object).
  return listReportableSchemas();
}

/**
 * Turn a plain-language prompt into a validated Report Spec + English echo.
 * Uses the LLM when a key is configured; otherwise a deterministic fallback.
 */
export async function generateSpec(prompt: string, preferredObject?: string): Promise<GeneratedSpec> {
  const schemas = await loadReportableSchemas();
  if (schemas.length === 0) throw new Error('No reportable objects found in this workspace.');

  let engine: 'llm' | 'fallback' = hasLlmKey() ? 'llm' : 'fallback';

  // 1) Draft object + spec. `preferredObject` (the picked data source) is a soft
  // bias only — the planners may still switch object when the prompt clearly
  // names another one.
  let object: string;
  let draftSpec: unknown;
  if (engine === 'llm') {
    try {
      const catalog = schemas.map(buildSchemaSummaryForLLM).join('\n\n');
      const plan = await planReportSpec(prompt, catalog, preferredObject);
      object = plan.object;
      draftSpec = plan.spec;
    } catch {
      // LLM unavailable (429/500/timeout/parse) — degrade to the deterministic
      // planner instead of failing the whole report.
      engine = 'fallback';
      const plan = planFallback(prompt, schemas, preferredObject);
      object = plan.object;
      draftSpec = plan.spec;
    }
  } else {
    const plan = planFallback(prompt, schemas, preferredObject);
    object = plan.object;
    draftSpec = plan.spec;
  }

  // 2) Resolve schema for the chosen object.
  let schema = schemas.find((s) => s.nameSingular === object) ?? null;
  if (!schema) schema = await getObjectSchema(object);
  if (!schema) throw new Error(`The AI chose object "${object}", which does not exist in this workspace.`);

  // 3) Validate; on failure, one LLM repair attempt (LLM engine only).
  let result = validateReportSpec(draftSpec, schema);
  if (!result.ok && engine === 'llm') {
    try {
      const repaired = await repairReportSpec(
        prompt,
        schema.nameSingular,
        buildSchemaSummaryForLLM(schema),
        draftSpec,
        result.errors,
      );
      result = validateReportSpec(repaired, schema);
    } catch {
      // Repair call failed — try the deterministic planner as a last resort.
      const fb = planFallback(prompt, schemas, preferredObject);
      const fbSchema = schemas.find((s) => s.nameSingular === fb.object) ?? schema;
      const fbResult = validateReportSpec(fb.spec, fbSchema);
      if (fbResult.ok) {
        engine = 'fallback';
        return {
          object: fbSchema.nameSingular,
          schema: fbSchema,
          spec: fbResult.spec,
          specEnglish: specToEnglish(fbResult.spec, fbSchema),
          warnings: fbResult.warnings,
          engine,
        };
      }
    }
  }
  if (!result.ok) {
    throw new Error(`Could not build a valid report from that prompt: ${result.errors.join('; ')}`);
  }

  return {
    object: schema.nameSingular,
    schema,
    spec: result.spec,
    specEnglish: specToEnglish(result.spec, schema),
    warnings: result.warnings,
    engine,
  };
}

/** Execute a validated spec against live CRM data. */
export async function runSpec(spec: ReportSpec, schema: ObjectSchema): Promise<ReportResult> {
  return executeSpec(spec, schema);
}

/**
 * Produce the plain-language narrative for a result. Uses the LLM when
 * available, otherwise a deterministic summary so the block is never empty.
 */
export async function narrate(prompt: string, specEnglish: string, result: ReportResult): Promise<string> {
  if (hasLlmKey()) {
    try {
      return await generateNarrative({ prompt, specEnglish, result });
    } catch {
      // fall through to deterministic summary on transient LLM failure
    }
  }
  return deterministicNarrative(result);
}

/**
 * Produce the plain-language INSIGHT for a period-over-period comparison. Like
 * `narrate`, uses the LLM when available and a deterministic sentence otherwise
 * so the insight block is never empty. All figures come from `computeDeltas`
 * (deterministic); this only chooses the wording.
 */
export async function insightNarrative(specEnglish: string, comparison: PeriodComparison): Promise<string> {
  if (hasLlmKey()) {
    try {
      return await generateInsight({ specEnglish, comparison });
    } catch {
      // fall through to the deterministic sentence on transient LLM failure
    }
  }
  return deterministicInsight(comparison);
}

// ---------------------------------------------------------------------------
// AI assistant: "arrange the email" — the app's third AI surface.
//
// A multi-turn assistant that either GRILLS the user with one focused question
// when requirements are ambiguous, or APPLIES a coordinated change to the data
// (via a re-generated, still-validated spec), the block layout, and the copy.
// Trust-first is preserved: the assistant proposes a natural-language dataPrompt,
// not raw spec JSON — generateSpec() validates it deterministically.
// ---------------------------------------------------------------------------
export type ArrangeInput = {
  reportName: string;
  currentSpec: ReportSpec | null;
  currentSpecEnglish: string | null;
  currentLayout: ReportLayout | null;
  messages: AssistantMessage[];
  // The block the user has selected on the canvas (if any) — lets "this/it/that"
  // in their message resolve to a specific block.
  selectedBlock?: { id: string; type: string } | null;
  // Recipient + scoping context so the assistant reasons honestly about "who
  // sees what" (per-recipient row-level scoping).
  recipientNames?: string[];
  scopeableFields?: string[]; // member-relation fields; empty ⇒ scoping impossible
  scopePerRecipient?: boolean;
  scopeFieldName?: string | null;
};

export type ArrangeOutcome = {
  action: 'ask' | 'apply';
  message: string;
  question?: string;
  // present only when action === 'apply'
  spec?: ReportSpec;
  specEnglish?: string;
  layout?: ReportLayout;
  // per-recipient scoping change to persist (when the user asked for it)
  personalization?: { scopePerRecipient: boolean; scopeFieldName: string | null };
  engine?: 'llm' | 'fallback';
  specChanged?: boolean;
};

function mergeTheme(base: ReportTheme | undefined, patch: any): ReportTheme {
  const b = base ?? { ...DEFAULT_THEME };
  const next: ReportTheme = { ...b };
  if (patch && typeof patch === 'object') {
    if (typeof patch.accent === 'string' && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(patch.accent)) next.accent = patch.accent;
    if (patch.font === 'sans' || patch.font === 'serif' || patch.font === 'mono') next.font = patch.font;
    if (patch.mode === 'light' || patch.mode === 'dark') next.mode = patch.mode;
    if (typeof patch.logoUrl === 'string') next.logoUrl = patch.logoUrl;
  }
  return next;
}

const ARRANGE_SYSTEM = `You are the design assistant for an AI email-report builder. You help a user shape a report email that is sent to an audience. You control three things together: WHAT DATA is measured, the ORDER/CHOICE of content BLOCKS, and the COPY.

You MUST reply with ONLY a JSON object of this shape:
{
  "action": "ask" | "apply",
  "message": "one short sentence addressed TO the user describing what you are doing or asking (e.g. \\"I'll build a weekly exec summary focused on won revenue.\\"). Never echo the user's words back as your own intent.",
  "question": "ONE concrete, answerable question (only when action is ask) — e.g. \\"Who is the audience: the sales team, or leadership?\\"",
  "dataPrompt": "plain-language description of WHAT to measure — include ONLY when the underlying data should change; omit to keep the current data",
  "theme": { "accent": "#RRGGBB", "font": "sans|serif|mono", "mode": "light|dark" },
  "personalization": { "scopePerRecipient": true, "scopeFieldName": "<one of the scopeable fields in context>" },
  "blockPatches": [ { "id": "<existing block id from the context>", "chartKind": "pie", "title": "…" } ],
  "blocks": [ { "type": "...", "title": "...", "subtitle": "...", "markdown": "...", "chartKind": "bar|pie", "maxRows": 10, "buttonText": "...", "buttonUrl": "...", "align": "left|center|right", "height": 24 } ]
}

Available block types: ${BLOCK_PALETTE.map((p) => `${p.type} (${p.hint})`).join('; ')}.

Rules:
- Ask AT MOST ONE clarifying question, and only when the request is too vague to act on at all (e.g. "make it nicer" with no audience, metric, or focus). If the user has named an audience, a metric/focus, OR a cadence, that is ENOUGH — set action="apply" and pick sensible defaults for anything unspecified, stating the assumption briefly in "message".
- NEVER ask a second question about something you already asked, and NEVER loop: if the user gives a vague or non-answer (e.g. "now what?", "just do it"), stop asking and set action="apply" with your best interpretation.
- SCOPE THE EDIT. For a change to ONE (or a few) EXISTING blocks — the Selected block, or when the user says "this/it/that/the chart/the header" — return "blockPatches" containing ONLY the changed fields for those block id(s) from the context. Do NOT return "blocks" in that case: every other block is preserved automatically, so you cannot lose their copy. Use the exact "id" values from the Current blocks JSON (for the Selected block, use its id).
- Return the full "blocks" array ONLY when you are adding, removing, or reordering blocks. When you do, copy every unchanged block's fields VERBATIM from the Current blocks JSON.
- "dataPrompt" only when the underlying data must change; "theme" only when styling changes. These may accompany either blockPatches or blocks.
- Write real headlines/intro copy in header/text blocks tailored to the audience and tone. Keep the report trustworthy: prefer to keep a "specEcho" and/or "narrative" block. NEVER put invented numbers in copy — the system computes all figures.
- PERSONALIZATION / WHO SEES WHAT — be honest, never fake privacy:
  - If the user wants each recipient to see only their OWN data (e.g. "send each rep only their own deals", "personalize per person"): if the context says per-recipient scoping IS possible, set "personalization": { scopePerRecipient: true, scopeFieldName: <best matching scopeable field> } and confirm it in "message". If it is NOT possible, DO NOT pretend — say plainly that this data can't be split per recipient so everyone would see the same numbers, and ask whether to proceed.
  - To turn it off, set "personalization": { scopePerRecipient: false }.
  - When there are multiple recipients and scoping is OFF, and you apply a change, briefly remind in "message" that all recipients receive the same numbers.
- Do not output any text outside the JSON object.`;

// Compact JSON of the current blocks — id + type + only the defined content
// fields — so the assistant sees exactly what each block currently is (chart
// kind, copy, etc.) and can patch precisely without losing the others.
function compactBlocks(blocks: Block[] | undefined): string {
  if (!blocks?.length) return '(none)';
  const compact = blocks.map((b) => {
    const o: Record<string, unknown> = { id: b.id, type: b.type };
    for (const k of BLOCK_CONTENT_FIELDS) {
      if ((b as any)[k] !== undefined) o[k] = (b as any)[k];
    }
    return o;
  });
  return JSON.stringify(compact);
}

function contextForAssistant(input: ArrangeInput): string {
  const selected = input.selectedBlock
    ? `\nSelected block (what "this/it/that" refers to): ${input.selectedBlock.type} (id ${input.selectedBlock.id})`
    : '';
  const rc = input.recipientNames ?? [];
  const recipients = `\nRecipients (${rc.length}): ${rc.length ? rc.join(', ') : '(none yet)'}`;
  const scope = input.scopeableFields?.length
    ? `\nPer-recipient scoping IS possible on this object via field(s): ${input.scopeableFields.join(', ')}. Currently ${input.scopePerRecipient ? `ON (each recipient sees only their own rows via "${input.scopeFieldName}")` : 'OFF — every recipient sees the SAME numbers'}.`
    : `\nPer-recipient scoping is NOT possible for this object (no field links a row to a workspace member), so every recipient necessarily sees the same numbers.`;
  return `Report name: "${input.reportName}"
Current data (interpreted): ${input.currentSpecEnglish || '(no data spec yet)'}
Current blocks (JSON — id, type, and current settings): ${compactBlocks(input.currentLayout?.blocks)}${selected}
Current theme: ${JSON.stringify(input.currentLayout?.theme ?? DEFAULT_THEME)}${recipients}${scope}`;
}

export async function arrangeReport(input: ArrangeInput): Promise<ArrangeOutcome> {
  const name = input.reportName || 'Report';

  // Offline path: no grilling, just interpret the latest request deterministically.
  if (!hasLlmKey()) {
    const lastUser = [...input.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    if (!lastUser.trim()) return { action: 'ask', message: 'What would you like the report to show?', question: 'What would you like the report to show?' };
    const generated = await generateSpec(lastUser, input.currentSpec?.object);
    const theme = input.currentLayout?.theme ?? { ...DEFAULT_THEME };
    const layout: ReportLayout = { ...defaultLayout(generated.spec, name), theme };
    return {
      action: 'apply',
      message: 'Applied your request with the offline planner (no AI key configured).',
      spec: generated.spec,
      specEnglish: generated.specEnglish,
      layout,
      engine: 'fallback',
      specChanged: true,
    };
  }

  let envelope: any;
  try {
    envelope = await chatEnvelope(
      `${ARRANGE_SYSTEM}\n\nCONTEXT:\n${contextForAssistant(input)}`,
      input.messages,
    );
  } catch {
    // The assistant model hiccuped (timeout, rate-limit, or output we still
    // couldn't parse after the repair retry). Degrade to a friendly, retryable
    // chat turn instead of failing the whole route with a raw 500 — consistent
    // with how generateSpec()/narrate() degrade rather than crash.
    return {
      action: 'ask',
      message: 'Sorry, I had trouble arranging that just now — mind trying again, maybe a bit more specifically?',
      question: 'Could you rephrase what you would like changed?',
    };
  }

  if (envelope?.action !== 'apply') {
    const question = typeof envelope?.question === 'string' && envelope.question.trim() ? envelope.question.trim() : 'Could you tell me a bit more about what you want and who it is for?';
    return { action: 'ask', message: typeof envelope?.message === 'string' && envelope.message.trim() ? envelope.message.trim() : question, question };
  }

  // Apply: optionally re-derive the data spec (validated), then layout + theme.
  let spec = input.currentSpec ?? undefined;
  let specEnglish = input.currentSpecEnglish ?? undefined;
  let engine: 'llm' | 'fallback' | undefined;
  let specChanged = false;
  const dataPrompt = typeof envelope.dataPrompt === 'string' ? envelope.dataPrompt.trim() : '';
  if (dataPrompt) {
    try {
      // Bias to the current object so follow-ups stay on the same data source
      // unless the user's request clearly names a different one.
      const generated = await generateSpec(dataPrompt, input.currentSpec?.object);
      spec = generated.spec;
      specEnglish = generated.specEnglish;
      engine = generated.engine;
      specChanged = true;
    } catch {
      // Keep current data; surface the miss in the message.
    }
  }

  // Prefer merge-by-id patches (scoped edits): start from the CURRENT blocks and
  // change only the targeted ones, so untouched blocks are preserved verbatim —
  // no model drift. Fall back to a full blocks replace (add/remove/reorder), then
  // to a default/seed layout.
  const base = input.currentLayout?.blocks ?? [];
  const hasPatches = Array.isArray(envelope.blockPatches) && envelope.blockPatches.length > 0;
  let blocks: Block[];
  if (hasPatches && base.length) {
    // Scoped edit: merge patches onto current blocks, others kept verbatim.
    blocks = applyBlockPatches(base, envelope.blockPatches, input.selectedBlock?.id);
  } else {
    const sanitized = sanitizeBlocks(envelope.blocks);
    const fallbackBlocks = base.length
      ? base
      : spec
        ? defaultLayout(spec, name).blocks
        : [{ id: 'header-0', type: 'header' as const, title: name }];
    blocks = sanitized.length ? sanitized : fallbackBlocks;
  }
  const theme = mergeTheme(input.currentLayout?.theme, envelope.theme);
  const layout: ReportLayout = { version: 2, theme, blocks };

  // Per-recipient scoping: only enable with a field the object actually supports
  // (guards against the model inventing one); disabling is always allowed.
  let personalization: ArrangeOutcome['personalization'];
  const p = envelope.personalization;
  if (p && typeof p === 'object') {
    if (p.scopePerRecipient === true) {
      const field =
        typeof p.scopeFieldName === 'string' && input.scopeableFields?.includes(p.scopeFieldName)
          ? p.scopeFieldName
          : input.scopeableFields?.[0];
      if (field) personalization = { scopePerRecipient: true, scopeFieldName: field };
    } else if (p.scopePerRecipient === false) {
      personalization = { scopePerRecipient: false, scopeFieldName: null };
    }
  }

  const message =
    typeof envelope.message === 'string' && envelope.message.trim()
      ? envelope.message.trim() + (dataPrompt && !specChanged ? ' (kept the existing data — that request could not be interpreted.)' : '')
      : 'Updated the report.';

  return { action: 'apply', message, spec, specEnglish, layout, personalization, engine, specChanged };
}

function deterministicNarrative(result: ReportResult): string {
  const parts: string[] = [];
  const primary = result.metrics[0];
  if (primary) {
    const total = result.grandTotals[primary.alias] ?? 0;
    const fmt = primary.isCurrency ? formatMoney(total, result.currencyCode) : String(total);
    parts.push(`${result.matchedCount} ${result.labelPlural.toLowerCase()} matched; ${primary.label.toLowerCase()} is ${fmt}.`);
  }
  if (result.groupBy.length && result.rows.length) {
    const alias = result.metrics[0]?.alias;
    const sorted = [...result.rows].sort((a, b) => (b.values[alias!] ?? 0) - (a.values[alias!] ?? 0));
    const top = sorted[0];
    const label = result.groupBy.map((g) => top.group[g.field]).join(' / ');
    parts.push(`${label} leads on ${result.metrics[0]?.label.toLowerCase()}.`);
  }
  return parts.join(' ');
}

function deterministicInsight(c: PeriodComparison): string {
  const parts: string[] = [];
  const primary = c.metrics[0];
  if (primary) {
    const value = primary.isCurrency ? formatMoney(primary.current, c.currencyCode) : String(primary.current);
    const change =
      primary.pctChange === null
        ? primary.direction === 'up'
          ? `up from zero over ${c.periodLabel}`
          : `flat vs ${c.periodLabel}`
        : `${primary.pctChange >= 0 ? '+' : ''}${primary.pctChange}% vs ${c.periodLabel}`;
    parts.push(`${primary.label} is ${value} (${change}).`);
  }
  if (c.topGainer) {
    const g = c.topGainer;
    parts.push(`${g.groupLabel} rose the most${g.pctChange !== null ? ` (+${g.pctChange}%)` : ''}.`);
  }
  if (c.topDecliner) {
    const d = c.topDecliner;
    parts.push(`${d.groupLabel} fell the most${d.pctChange !== null ? ` (${d.pctChange}%)` : ''}.`);
  }
  return parts.join(' ');
}
