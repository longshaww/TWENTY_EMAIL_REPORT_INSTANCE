/**
 * Shared report execution + delivery, used by run-report (manual/preview) and
 * the dispatch-reports cron. Keeping it here guarantees a scheduled run and a
 * "send now" behave identically.
 */
import { CoreApiClient } from 'twenty-client-sdk/core';

import { REPORT_VISIBILITY, RUN_STATUS, SUBSCRIPTION_SCOPE_MODE } from 'src/constants/universal-identifiers';
import { sendEmail, type Recipient } from './brevo';
import { coerceLayout, type ReportLayout } from './blocks';
import { computeDeltas, previousPeriodSpec, type PeriodComparison } from './compare';
import { executeSpecOnRecords, fetchSpecRecords, type ReportResult } from './executor';
import { getObjectSchema } from './metadata';
import { chartUrlFromResult } from './quickchart';
import { renderEmail } from './render';
import { insightNarrative, narrate } from './report-service';
import type { ObjectSchema, ReportSpec } from './report-spec';

export type LoadedReport = {
  id: string;
  name: string;
  prompt: string;
  spec: ReportSpec | null;
  specEnglish: string | null;
  layout: unknown;
  visibility: string | null;
  frequency: string | null;
  sendHour: number | null;
  sendDayOfWeek: number | null;
  sendDayOfMonth: number | null;
  status: string | null;
  nextRunAt: string | null;
  ownerId: string | null;
  scopePerRecipient: boolean;
  scopeFieldName: string | null;
  recipients: Recipient[];
};

const REPORT_SELECTION = {
  id: true,
  name: true,
  prompt: true,
  spec: true,
  specEnglish: true,
  layout: true,
  visibility: true,
  frequency: true,
  sendHour: true,
  sendDayOfWeek: true,
  sendDayOfMonth: true,
  status: true,
  nextRunAt: true,
  scopePerRecipient: true,
  scopeFieldName: true,
  owner: { id: true },
  subscriptions: {
    edges: { node: { scopeMode: true, member: { id: true, userEmail: true, name: { firstName: true, lastName: true } } } },
  },
} as const;

function toLoaded(r: any): LoadedReport {
  const recipients: Recipient[] = [];
  const seen = new Set<string>();
  for (const e of r.subscriptions?.edges ?? []) {
    const m = e.node?.member;
    const email = m?.userEmail;
    if (email && !seen.has(email)) {
      seen.add(email);
      recipients.push({
        email,
        name: [m?.name?.firstName, m?.name?.lastName].filter(Boolean).join(' ') || undefined,
        memberId: m?.id ?? undefined,
        scopeMode: e.node?.scopeMode ?? SUBSCRIPTION_SCOPE_MODE.SELF,
      });
    }
  }
  return {
    id: r.id,
    name: r.name,
    prompt: r.prompt ?? '',
    spec: (r.spec as ReportSpec) ?? null,
    specEnglish: r.specEnglish ?? null,
    layout: r.layout,
    visibility: r.visibility ?? null,
    frequency: r.frequency ?? null,
    sendHour: r.sendHour ?? null,
    sendDayOfWeek: r.sendDayOfWeek ?? null,
    sendDayOfMonth: r.sendDayOfMonth ?? null,
    status: r.status ?? null,
    nextRunAt: r.nextRunAt ?? null,
    ownerId: r.owner?.id ?? null,
    scopePerRecipient: Boolean(r.scopePerRecipient),
    scopeFieldName: r.scopeFieldName ?? null,
    recipients,
  };
}

/**
 * Authorization for user-triggered access (preview/send/arrange).
 *
 * WORKSPACE reports are open to any member. A PRIVATE report is only accessible
 * to its owner. `callerMemberId` MUST be derived server-side (see
 * lib/access.ts `currentMemberId`) — never taken from the request body — so it
 * cannot be spoofed. Ownerless PRIVATE reports fail closed (all create paths now
 * stamp an owner, so an ownerless private report is treated as inaccessible
 * rather than world-open). Cron/dispatcher runs never call this — they invoke
 * deliver() directly and are trusted by design.
 */
export function canAccessReport(report: LoadedReport, callerMemberId?: string | null): boolean {
  if (report.visibility !== REPORT_VISIBILITY.PRIVATE) return true;
  if (!report.ownerId) return false; // ownerless private → fail closed, no open hole
  return Boolean(callerMemberId) && callerMemberId === report.ownerId;
}

export async function loadReport(client: CoreApiClient, reportId: string): Promise<LoadedReport | null> {
  const res: any = await client.query({
    northpeakReport: { __args: { filter: { id: { eq: reportId } } }, ...REPORT_SELECTION },
  } as any);
  return res?.northpeakReport ? toLoaded(res.northpeakReport) : null;
}

/** Load all reports the dispatcher should consider (ACTIVE), following pagination. */
export async function loadActiveReports(client: CoreApiClient): Promise<LoadedReport[]> {
  const out: LoadedReport[] = [];
  let after: string | undefined;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const args: Record<string, unknown> = { filter: { status: { eq: 'ACTIVE' } }, first: 100 };
    if (after) args.after = after;
    const res: any = await client.query({
      northpeakReports: {
        __args: args,
        edges: { node: REPORT_SELECTION },
        pageInfo: { hasNextPage: true, endCursor: true },
      },
    } as any);
    const conn = res?.northpeakReports;
    if (!conn) break;
    for (const e of conn.edges ?? []) out.push(toLoaded(e.node));
    if (!conn.pageInfo?.hasNextPage || !conn.pageInfo?.endCursor) break;
    after = conn.pageInfo.endCursor;
  }
  return out;
}

export type RenderOutput = {
  subject: string;
  html: string;
  result: ReportResult;
  narrative: string;
  specEnglish: string;
  layout: ReportLayout;
  chartImageUrl?: string;
  comparison?: PeriodComparison;
  insight?: string;
  // The raw records fetched for this render — returned so a scoped delivery can
  // reuse ONE fetch across every recipient instead of re-querying per recipient.
  records: any[];
  // The resolved object schema — reused across scoped recipient renders so we
  // don't re-introspect metadata once per recipient.
  schema: ObjectSchema;
};

/**
 * Execute + render a report (no send). Throws with a clear message on problems.
 * `opts.scopeMemberId` (with the report's `scopeFieldName`) row-level-scopes the
 * spec to that member — one recipient's own view — reusing the executor's
 * relation-`is` filter. No scope ⇒ the full shared report.
 *
 * `opts.records` reuses an already-fetched record set (the compute half is pure),
 * so per-recipient scoped renders don't each re-scan the whole table. When the
 * caller will later scope in memory it must pass `opts.extraFields` on the FULL
 * render so the shared fetch includes the scope field.
 */
export async function buildRender(
  report: LoadedReport,
  opts?: { scopeMemberId?: string; records?: any[]; extraFields?: string[]; schema?: ObjectSchema },
): Promise<RenderOutput> {
  if (!report.spec) throw new Error('This report has no spec yet — generate one from a prompt first.');
  const schema = opts?.schema ?? (await getObjectSchema(report.spec.object));
  if (!schema) throw new Error(`Report object "${report.spec.object}" no longer exists.`);

  const spec: ReportSpec =
    opts?.scopeMemberId && report.scopeFieldName
      ? { ...report.spec, filters: [...(report.spec.filters ?? []), { field: report.scopeFieldName, op: 'is', value: opts.scopeMemberId }] }
      : report.spec;

  // One fetch, reused for the base result AND the period-over-period comparison
  // (the executor never time-filters the fetch, so both windows are present).
  const records = opts?.records ?? (await fetchSpecRecords(report.spec, schema, opts?.extraFields ?? []));
  const result = executeSpecOnRecords(spec, schema, records);
  const specEnglish = report.specEnglish ?? '';
  const narrative = await narrate(report.prompt, specEnglish, result);
  const layout = coerceLayout(report.layout, spec, report.name);
  const base = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
  const verifyUrl = `${base}/objects/${schema.namePlural}`;
  // Chart kind follows the first chart block's preference (default bar).
  const chartBlock = layout.blocks.find((b) => b.type === 'chart');
  const chartImageUrl = chartUrlFromResult(result, chartBlock?.chartKind ?? 'bar');

  // Period-over-period comparison — only when the layout actually uses an
  // insights block and the spec has a comparable time window, so reports that
  // don't show insights never pay for the second compute pass.
  let comparison: PeriodComparison | undefined;
  let insight: string | undefined;
  if (layout.blocks.some((b) => b.type === 'insights')) {
    const prevSpec = previousPeriodSpec(spec);
    if (prevSpec) {
      const prevResult = executeSpecOnRecords(prevSpec, schema, records);
      comparison = computeDeltas(result, prevResult, spec);
      insight = await insightNarrative(specEnglish, comparison);
    }
  }

  const { subject, html } = renderEmail({ reportName: report.name, specEnglish, result, narrative, layout, verifyUrl, chartImageUrl, comparison, insight });
  return { subject, html, result, narrative, specEnglish, layout, chartImageUrl, comparison, insight, records, schema };
}

export type DeliveryResult = {
  ok: boolean;
  status: string;
  error?: string;
  recipientCount: number;
  matchedCount: number;
  dataAsOf: string;
};

const SCOPED_RECIPIENT_CAP = 200; // guard the function timeout: N scoped renders + sends
const SEND_CONCURRENCY = 10; // parallel Brevo sends
const RENDER_CONCURRENCY = 5; // parallel scoped renders (each may make an LLM narrate call)

/** Run `fn` over `items` with bounded concurrency, preserving input order. */
async function pool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

type SendJob = { recipient: Recipient; subject: string; html: string };

/**
 * Execute → email subscribers → write a ReportRun audit row → update the report.
 * `trigger` is SCHEDULED | MANUAL | PREVIEW (preview never reaches here).
 * `opts.nextRunAt` (from the dispatcher) is folded into the report's single final
 * update so scheduling doesn't need a second write.
 *
 * Privacy: every recipient is emailed in their OWN message (a single-address
 * `to`), never batched into one shared To: header — a shared To: would leak the
 * whole subscriber list to every recipient.
 */
export async function deliver(
  client: CoreApiClient,
  report: LoadedReport,
  trigger: string,
  opts?: { nextRunAt?: string | null },
): Promise<DeliveryResult> {
  const nextRunAtPatch = opts && 'nextRunAt' in opts ? { nextRunAt: opts.nextRunAt ?? null } : {};

  // The full (unscoped) render — always needed (ALL-mode recipients + the audit
  // row's row-count/data-as-of + the persisted narrative). For a scoped report we
  // fetch WITH the scope field so this one fetch is reused for every recipient.
  const scopeExtra = report.scopePerRecipient && report.scopeFieldName ? [report.scopeFieldName] : [];
  let full: RenderOutput;
  try {
    full = await buildRender(report, scopeExtra.length ? { extraFields: scopeExtra } : undefined);
  } catch (e: any) {
    const message = e?.message ?? 'Execution failed.';
    await writeRun(client, report, {
      status: RUN_STATUS.FAILED,
      trigger,
      error: message,
      rowCount: 0,
      recipientCount: 0,
      recipients: '',
      dataAsOf: new Date().toISOString(),
      specEnglish: report.specEnglish ?? '',
    });
    await client.mutation({
      updateNorthpeakReport: { __args: { id: report.id, data: { lastError: message, ...nextRunAtPatch } }, id: true },
    } as any);
    return { ok: false, status: RUN_STATUS.FAILED, error: message, recipientCount: 0, matchedCount: 0, dataAsOf: new Date().toISOString() };
  }

  const scoped = Boolean(report.scopePerRecipient && report.scopeFieldName) && report.recipients.length > 0;
  let status: string = RUN_STATUS.SUCCESS;
  let error = '';
  const sentEmails: string[] = [];
  const skipped: string[] = [];

  // 1) Build one send job per recipient (single-address `to` each).
  let jobs: SendJob[] = [];
  if (report.recipients.length === 0) {
    status = RUN_STATUS.SKIPPED;
    error = 'No subscribers.';
  } else if (!scoped) {
    // Shared report: everyone gets the same numbers, but as separate messages.
    jobs = report.recipients.map((r) => ({ recipient: r, subject: full.subject, html: full.html }));
  } else {
    // ALL-mode recipients (managers) see the full report; SELF recipients see only
    // their own rows via a scoped render that REUSES the single fetch (full.records).
    const allRecips = report.recipients.filter((r) => r.scopeMode === SUBSCRIPTION_SCOPE_MODE.ALL);
    const selfRecips = report.recipients.filter((r) => r.scopeMode !== SUBSCRIPTION_SCOPE_MODE.ALL);
    for (const r of allRecips) jobs.push({ recipient: r, subject: full.subject, html: full.html });

    const capped = selfRecips.slice(0, SCOPED_RECIPIENT_CAP);
    for (const r of selfRecips.slice(SCOPED_RECIPIENT_CAP)) skipped.push(`${r.email} (over cap)`);

    const rendered = await pool(capped, RENDER_CONCURRENCY, async (r): Promise<SendJob | { recipient: Recipient; skip: string }> => {
      if (!r.memberId) return { recipient: r, subject: full.subject, html: full.html }; // can't scope → full view
      try {
        const out = await buildRender(report, { scopeMemberId: r.memberId, records: full.records, schema: full.schema });
        if (out.result.matchedCount === 0) return { recipient: r, skip: 'no data' };
        return { recipient: r, subject: out.subject, html: out.html };
      } catch {
        return { recipient: r, skip: 'render error' };
      }
    });
    for (const j of rendered) {
      if ('skip' in j) skipped.push(`${j.recipient.email} (${j.skip})`);
      else jobs.push(j);
    }
  }

  // 2) Send all jobs with bounded concurrency.
  let dryRun = false;
  let sendErr = '';
  if (jobs.length) {
    const sends = await pool(jobs, SEND_CONCURRENCY, (j) => sendEmail({ to: [j.recipient], subject: j.subject, html: j.html }));
    sends.forEach((s, i) => {
      if (s.error) sendErr = sendErr || s.error;
      else if (s.dryRun) dryRun = true;
      else sentEmails.push(jobs[i].recipient.email);
    });
  }

  // 3) Aggregate status (skip the "No subscribers" case set above).
  if (status !== RUN_STATUS.SKIPPED) {
    if (sendErr) {
      status = RUN_STATUS.FAILED;
      error = sendErr;
    } else if (sentEmails.length === 0) {
      status = RUN_STATUS.SKIPPED;
      error = dryRun ? 'Brevo API key not configured (dry run).' : skipped.length ? 'All recipients skipped (no data).' : 'No recipients.';
    }
  }
  if (skipped.length) error = [error, `Skipped: ${skipped.join('; ')}`].filter(Boolean).join(' · ');

  const nowIso = new Date().toISOString();
  await writeRun(client, report, {
    status,
    trigger,
    error,
    rowCount: full.result.matchedCount,
    recipientCount: sentEmails.length,
    recipients: sentEmails.join(', '),
    dataAsOf: full.result.dataAsOf,
    specEnglish: full.specEnglish,
  });
  await client.mutation({
    updateNorthpeakReport: {
      __args: { id: report.id, data: { lastRunAt: nowIso, narrative: full.narrative, lastError: error, ...nextRunAtPatch }, },
      id: true,
    },
  } as any);

  return {
    ok: status !== RUN_STATUS.FAILED,
    status,
    error: error || undefined,
    recipientCount: sentEmails.length,
    matchedCount: full.result.matchedCount,
    dataAsOf: full.result.dataAsOf,
  };
}

async function writeRun(
  client: CoreApiClient,
  report: LoadedReport,
  run: {
    status: string;
    trigger: string;
    error: string;
    rowCount: number;
    recipientCount: number;
    recipients: string;
    dataAsOf: string;
    specEnglish: string;
  },
): Promise<void> {
  const nowIso = new Date().toISOString();
  await client.mutation({
    createNorthpeakReportRun: {
      __args: {
        data: {
          name: `${report.name} — ${nowIso.slice(0, 16).replace('T', ' ')}`,
          status: run.status as any,
          trigger: run.trigger as any,
          ranAt: nowIso,
          dataAsOf: run.dataAsOf,
          rowCount: run.rowCount,
          recipientCount: run.recipientCount,
          recipients: run.recipients,
          specEnglish: run.specEnglish,
          error: run.error,
          reportId: report.id,
        },
      },
      id: true,
    },
  } as any);
}
