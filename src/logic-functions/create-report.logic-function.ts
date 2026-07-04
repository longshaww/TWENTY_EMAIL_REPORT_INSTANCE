import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';
import { isDefined } from 'twenty-sdk/utils';

import {
  LF_CREATE_REPORT_ID,
  REPORT_STATUS,
  REPORT_VISIBILITY,
  ROUTE_CREATE_REPORT,
} from 'src/constants/universal-identifiers';
import { currentMemberId } from 'src/logic-functions/lib/access';
import { defaultLayout } from 'src/logic-functions/lib/blocks';
import { getTemplate } from 'src/logic-functions/lib/report-templates';
import { generateSpec } from 'src/logic-functions/lib/report-service';

// `ownerId` is NOT read from the body — the owner is always the authenticated
// caller, so a report cannot be planted under (or attributed to) another member.
type Input = { prompt?: string; name?: string; visibility?: string; templateId?: string; object?: string };

const readInput = (event: any): Input => (isDefined(event?.body) ? event.body : event) ?? {};

function deriveName(prompt: string): string {
  const trimmed = prompt.trim().replace(/\s+/g, ' ');
  const short = trimmed.length > 60 ? trimmed.slice(0, 57) + '…' : trimmed;
  return short.charAt(0).toUpperCase() + short.slice(1);
}

// Creates a Report from a prompt end-to-end: interpret → validate → persist with
// a default block layout. Used by the "Create report from a prompt" command.
const handler = async (event: RoutePayload | Input) => {
  const input = readInput(event);
  // A template supplies a starter prompt (+ layout/theme); the user may still
  // override the prompt. Either a prompt or a template is required.
  const template = getTemplate(input.templateId);
  const prompt = ((input.prompt ?? '').trim() || template?.prompt) ?? '';
  if (!prompt) return { ok: false, error: 'A prompt or template is required.' };

  // Bias to the picked data source; a template carries its own object.
  const preferredObject = (input.object ?? '').trim() || template?.object || undefined;
  const generated = await generateSpec(prompt, preferredObject);
  const name = (input.name ?? '').trim() || template?.name || deriveName(prompt);
  // Template layouts are curated arrangements + theme; without one we build the
  // default layout from the produced spec. Renderer fallbacks handle blocks
  // whose metric aliases don't match the generated spec.
  const layout = template ? template.layout : defaultLayout(generated.spec, name);
  const visibility =
    input.visibility === REPORT_VISIBILITY.WORKSPACE ? REPORT_VISIBILITY.WORKSPACE : REPORT_VISIBILITY.PRIVATE;

  // Owner = authenticated caller (server-derived). A PRIVATE report is only ever
  // accessible to its owner, so an ownerless private report must never be created.
  const ownerId = await currentMemberId();

  const client = new CoreApiClient();
  const created: any = await client.mutation({
    createNorthpeakReport: {
      __args: {
        data: {
          name,
          prompt,
          spec: generated.spec as any,
          specEnglish: generated.specEnglish,
          layout: layout as any,
          status: REPORT_STATUS.DRAFT,
          visibility,
          ...(isDefined(ownerId) ? { ownerId } : {}),
        },
      },
      id: true,
      name: true,
    },
  } as any);

  return {
    ok: true,
    reportId: created?.createNorthpeakReport?.id,
    name: created?.createNorthpeakReport?.name,
    object: generated.object,
    specEnglish: generated.specEnglish,
    engine: generated.engine,
  };
};

export default defineLogicFunction({
  universalIdentifier: LF_CREATE_REPORT_ID,
  name: 'create-report',
  description: 'Create a new report record from a plain-language prompt (interprets, validates and seeds a default layout).',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: ROUTE_CREATE_REPORT,
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
