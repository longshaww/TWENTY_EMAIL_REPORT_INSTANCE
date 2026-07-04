import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import {
  LF_DISPATCH_ID,
  REPORT_FREQUENCY,
  RUN_TRIGGER,
} from 'src/constants/universal-identifiers';
import { deliver, loadActiveReports } from 'src/logic-functions/lib/deliver';
import { computeNextRunAt, isDue } from 'src/logic-functions/lib/schedule';

const DELIVER_CONCURRENCY = 3; // process due reports in parallel (each also sends in parallel)

/** Run `fn` over `items` with bounded concurrency, preserving order. */
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const nextRunIso = (r: { frequency: string | null; sendHour: number | null; sendDayOfWeek: number | null; sendDayOfMonth: number | null }, now: Date) => {
  const next = computeNextRunAt(r.frequency!, r.sendHour ?? 8, now, r.sendDayOfWeek, r.sendDayOfMonth);
  return next ? next.toISOString() : null;
};

// Single dispatcher cron. Twenty cron patterns are static in the manifest, so we
// run this every 15 minutes, scan ACTIVE reports whose nextRunAt is due, deliver
// them, and advance nextRunAt. Cron runs have no request-user, so only
// workspace-shared secrets (our server variables) are available — which is
// exactly what the LLM + Brevo integrations use.
const handler = async () => {
  const client = new CoreApiClient();
  const now = new Date();
  const reports = await loadActiveReports(client);
  const scheduled = reports.filter((r) => r.frequency && r.frequency !== REPORT_FREQUENCY.MANUAL);

  // Backfill: an ACTIVE scheduled report with no nextRunAt yet gets its first slot
  // computed and persisted WITHOUT sending — so activation never blasts an email
  // off-schedule (isDue(null) is false; the schedule is initialised here instead).
  const needsBackfill = scheduled.filter((r) => !r.nextRunAt);
  await pool(needsBackfill, DELIVER_CONCURRENCY, (r) =>
    client.mutation({
      updateNorthpeakReport: { __args: { id: r.id, data: { nextRunAt: nextRunIso(r, now) } }, id: true },
    } as any),
  );

  const due = scheduled.filter((r) => isDue(r.nextRunAt, now));
  const outcomes = await pool(due, DELIVER_CONCURRENCY, async (report) => {
    // Advance the schedule in the SAME write deliver() already makes (no 2nd mutation).
    const outcome = await deliver(client, report, RUN_TRIGGER.SCHEDULED, { nextRunAt: nextRunIso(report, now) });
    return { reportId: report.id, status: outcome.status, recipients: outcome.recipientCount, matched: outcome.matchedCount };
  });

  return { scanned: reports.length, backfilled: needsBackfill.length, due: due.length, delivered: outcomes };
};

export default defineLogicFunction({
  universalIdentifier: LF_DISPATCH_ID,
  name: 'dispatch-reports',
  description: 'Dispatcher: delivers any ACTIVE report whose nextRunAt is due, then advances its schedule.',
  timeoutSeconds: 120,
  handler,
  cronTriggerSettings: {
    pattern: '*/15 * * * *',
  },
});
