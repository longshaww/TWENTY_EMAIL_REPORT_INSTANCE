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
import { defaultLayout } from 'src/logic-functions/lib/blocks';
import { getTemplate } from 'src/logic-functions/lib/report-templates';
import { generateSpec } from 'src/logic-functions/lib/report-service';

// `ownerId` is the creating member, resolved on the FRONT-END from the host's
// `useUserId()` and passed in the body. Logic functions run under the app access
// token, so the server cannot re-derive the human here — the client-supplied id is
// trusted. Isolation is advisory (the app role can read all records regardless);
// the front-end identity is only the authenticated *creator* claiming their own
// report, not a way to read someone else's. See stamp-report-owner for the native
// "Add New" path.
type Input = { prompt?: string; name?: string; visibility?: string; templateId?: string; object?: string; ownerId?: string };

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

  // Owner = the authenticated creator (front-end `useUserId()` → member id).
  const ownerId = (input.ownerId ?? '').trim() || undefined;
  // A PRIVATE report with no owner is accessible to nobody (canAccessReport fails
  // closed), so if we couldn't establish an owner, create it workspace-visible
  // rather than as an orphan no one can open.
  const visibility = !isDefined(ownerId)
    ? REPORT_VISIBILITY.WORKSPACE
    : input.visibility === REPORT_VISIBILITY.WORKSPACE
      ? REPORT_VISIBILITY.WORKSPACE
      : REPORT_VISIBILITY.PRIVATE;

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
