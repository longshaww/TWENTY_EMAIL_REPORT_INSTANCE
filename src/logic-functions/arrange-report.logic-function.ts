import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';
import { isDefined } from 'twenty-sdk/utils';

import { LF_ARRANGE_REPORT_ID, ROUTE_ARRANGE_REPORT } from 'src/constants/universal-identifiers';
import { currentMemberId } from 'src/logic-functions/lib/access';
import { upgradeLayout, type ReportLayout } from 'src/logic-functions/lib/blocks';
import { accessDeniedError, canAccessReport, loadReport } from 'src/logic-functions/lib/deliver';
import { getObjectSchema, memberRelationFields } from 'src/logic-functions/lib/metadata';
import { arrangeReport } from 'src/logic-functions/lib/report-service';
import type { AssistantMessage } from 'src/logic-functions/lib/llm';

// `requestingMemberId` is NOT read from the body — identity is derived
// server-side to prevent spoofing another member's access to a private report.
type Input = {
  reportId?: string;
  messages?: AssistantMessage[];
  selectedBlockId?: string;
  selectedBlockType?: string;
};

const readInput = (event: any): Input => (isDefined(event?.body) ? event.body : event) ?? {};

// Sanitize the conversation the front-end sends: only user/assistant turns with
// string content, capped so an oversized history can't blow the token budget.
function cleanMessages(raw: unknown): AssistantMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string' && m.content.trim())
    .slice(-12)
    .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 2000) }));
}

// The in-builder AI assistant: given the conversation + current report, it either
// asks a clarifying question or applies a coordinated data+layout+copy change.
const handler = async (event: RoutePayload | Input) => {
  const input = readInput(event);
  if (!isDefined(input.reportId)) return { ok: false, error: 'reportId is required.' };
  const messages = cleanMessages(input.messages);
  if (messages.length === 0) return { ok: false, error: 'At least one message is required.' };

  const callerMemberId = await currentMemberId();

  const client = new CoreApiClient();
  const report = await loadReport(client, input.reportId);
  if (!report) return { ok: false, error: 'Report not found.' };
  if (!canAccessReport(report, callerMemberId)) {
    return { ok: false, error: accessDeniedError(callerMemberId) };
  }

  const currentLayout: ReportLayout | null =
    report.layout && typeof report.layout === 'object' && Array.isArray((report.layout as ReportLayout).blocks)
      ? upgradeLayout(report.layout as ReportLayout)
      : null;

  const selectedBlock =
    isDefined(input.selectedBlockId) && isDefined(input.selectedBlockType)
      ? { id: String(input.selectedBlockId), type: String(input.selectedBlockType) }
      : null;

  // Scoping context: which member-relation fields exist on the report's object
  // (empty ⇒ per-recipient scoping is impossible) + the recipient list.
  let scopeableFields: string[] = [];
  if (report.spec?.object) {
    const schema = await getObjectSchema(report.spec.object);
    if (schema) scopeableFields = memberRelationFields(schema);
  }
  const recipientNames = report.recipients.map((r) => r.name || r.email);

  const outcome = await arrangeReport({
    reportName: report.name,
    currentSpec: report.spec,
    currentSpecEnglish: report.specEnglish,
    currentLayout,
    messages,
    selectedBlock,
    recipientNames,
    scopeableFields,
    scopePerRecipient: report.scopePerRecipient,
    scopeFieldName: report.scopeFieldName,
  });

  // Persist only when the assistant actually applied changes.
  if (outcome.action === 'apply') {
    const data: Record<string, unknown> = {};
    if (isDefined(outcome.spec)) data.spec = outcome.spec as any;
    if (isDefined(outcome.specEnglish)) data.specEnglish = outcome.specEnglish;
    if (isDefined(outcome.layout)) data.layout = outcome.layout as any;
    if (isDefined(outcome.personalization)) {
      data.scopePerRecipient = outcome.personalization.scopePerRecipient;
      data.scopeFieldName = outcome.personalization.scopeFieldName;
    }
    if (Object.keys(data).length > 0) {
      await client.mutation({
        updateNorthpeakReport: { __args: { id: input.reportId, data: data as any }, id: true },
      } as any);
    }
  }

  return { ok: true, ...outcome };
};

export default defineLogicFunction({
  universalIdentifier: LF_ARRANGE_REPORT_ID,
  name: 'arrange-report',
  description:
    'Conversational assistant that arranges a report email — it grills the user with a focused question when requirements are unclear, then applies a coordinated change to the data, block layout and copy.',
  timeoutSeconds: 60,
  handler,
  httpRouteTriggerSettings: {
    path: ROUTE_ARRANGE_REPORT,
    httpMethod: 'POST',
    isAuthRequired: true,
  },
  toolTriggerSettings: {
    inputSchema: {
      type: 'object',
      properties: {
        reportId: { type: 'string', description: 'The report record id to arrange.' },
        selectedBlockId: { type: 'string', description: 'Optional id of the block the user has selected (what "this/it" refers to).' },
        selectedBlockType: { type: 'string', description: 'Optional type of the selected block.' },
        messages: {
          type: 'array',
          description: 'The conversation so far (user/assistant turns).',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['user', 'assistant'] },
              content: { type: 'string' },
            },
            required: ['role', 'content'],
          },
        },
      },
      required: ['reportId', 'messages'],
    },
  },
});
