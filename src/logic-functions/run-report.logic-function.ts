import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';
import { isDefined } from 'twenty-sdk/utils';

import { LF_RUN_REPORT_ID, ROUTE_RUN_REPORT, RUN_TRIGGER } from 'src/constants/universal-identifiers';
import { resolveCallerMemberId } from 'src/logic-functions/lib/access';
import { accessDeniedError, buildRender, canAccessReport, deliver, loadReport } from 'src/logic-functions/lib/deliver';

// `requestingMemberId` is the caller's member id, resolved on the front-end from
// the host `useUserId()` (the server can't derive it under the app-token model —
// see lib/access.ts). `previewAsMemberId` is honored only for the report's own
// owner (previewing what a scoped recipient sees).
type Input = { reportId?: string; mode?: 'preview' | 'send'; previewAsMemberId?: string; requestingMemberId?: string };

const readInput = (event: any): Input => (isDefined(event?.body) ? event.body : event) ?? {};

// Execute a report and either preview the HTML (no send) or email its subscribers.
const handler = async (event: RoutePayload | Input) => {
  const input = readInput(event);
  const mode = input.mode === 'send' ? 'send' : 'preview';
  if (!isDefined(input.reportId)) return { ok: false, error: 'reportId is required.' };

  const callerMemberId = await resolveCallerMemberId(input.requestingMemberId);

  const client = new CoreApiClient();
  const report = await loadReport(client, input.reportId);
  if (!report) return { ok: false, error: 'Report not found.' };

  // Private reports are only previewable/sendable by their owner (identity
  // resolved server-side, not from the request body).
  if (!canAccessReport(report, callerMemberId)) {
    return { ok: false, error: accessDeniedError(callerMemberId) };
  }

  // "Preview as [recipient]" is an owner-only tool (see what a scoped rep sees);
  // ignore it for anyone else so it can't be used to read another member's slice.
  const isOwner = Boolean(callerMemberId) && callerMemberId === report.ownerId;
  const previewAsMemberId = isOwner && isDefined(input.previewAsMemberId) ? input.previewAsMemberId : undefined;

  if (mode === 'preview') {
    try {
      const rendered = await buildRender(report, previewAsMemberId ? { scopeMemberId: previewAsMemberId } : undefined);
      return {
        ok: true,
        mode,
        subject: rendered.subject,
        html: rendered.html,
        narrative: rendered.narrative,
        insight: rendered.insight,
        comparison: rendered.comparison,
        matchedCount: rendered.result.matchedCount,
        dataAsOf: rendered.result.dataAsOf,
        rows: rendered.result.rows.length,
        // Structured data so the builder canvas can render blocks natively with
        // live numbers (metric cards, bars, tables), not just show the HTML blob.
        result: rendered.result,
        chartImageUrl: rendered.chartImageUrl,
        specEnglish: rendered.specEnglish,
      };
    } catch (e: any) {
      return { ok: false, mode, error: e?.message ?? 'Preview failed.' };
    }
  }

  const outcome = await deliver(client, report, RUN_TRIGGER.MANUAL);
  return { mode, ...outcome }; // outcome already carries `ok`
};

export default defineLogicFunction({
  universalIdentifier: LF_RUN_REPORT_ID,
  name: 'run-report',
  description: 'Execute a report over live CRM data and either preview the HTML or email it to its subscribers.',
  timeoutSeconds: 60,
  handler,
  httpRouteTriggerSettings: {
    path: ROUTE_RUN_REPORT,
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
