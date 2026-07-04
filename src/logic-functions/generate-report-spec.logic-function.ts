import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';

import {
  LF_GENERATE_SPEC_ID,
  ROUTE_GENERATE_SPEC,
} from 'src/constants/universal-identifiers';
import { coerceLayout } from 'src/logic-functions/lib/blocks';
import { generateSpec } from 'src/logic-functions/lib/report-service';
import { isDefined } from 'twenty-sdk/utils';

type Input = { prompt?: string; reportId?: string; object?: string };

// Serves two surfaces with one handler:
//  - HTTP route  → event is a RoutePayload (args in event.body)
//  - AI tool     → event IS the args object
const readInput = (event: any): Input => (isDefined(event?.body) ? event.body : event) ?? {};

const handler = async (event: RoutePayload | Input) => {
  const input = readInput(event);
  const prompt = (input.prompt ?? '').trim();
  if (!prompt) {
    return { ok: false, error: 'A prompt is required.' };
  }

  const generated = await generateSpec(prompt, (input.object ?? '').trim() || undefined);

  // If tied to a report, persist the interpreted spec so the record stays the
  // source of truth. Seed a default layout the first time.
  if (isDefined(input.reportId)) {
    const client = new CoreApiClient();
    const existing: any = await client.query({
      northpeakReport: {
        __args: { filter: { id: { eq: input.reportId } } },
        id: true,
        name: true,
        layout: true,
      },
    } as any);
    const report = existing?.northpeakReport;
    const name = report?.name ?? 'Report';
    // coerceLayout keeps an existing valid layout and rebuilds a default when the
    // report has none (or a malformed one).
    const layoutToStore = coerceLayout(report?.layout, generated.spec, name);

    await client.mutation({
      updateNorthpeakReport: {
        __args: {
          id: input.reportId,
          data: {
            prompt,
            spec: generated.spec as any,
            specEnglish: generated.specEnglish,
            layout: layoutToStore as any,
          },
        },
        id: true,
      },
    } as any);
  }

  return {
    ok: true,
    object: generated.object,
    spec: generated.spec,
    specEnglish: generated.specEnglish,
    warnings: generated.warnings,
    engine: generated.engine,
  };
};

export default defineLogicFunction({
  universalIdentifier: LF_GENERATE_SPEC_ID,
  name: 'generate-report-spec',
  description:
    'Turn a plain-language reporting request (e.g. "weekly won deals by rep and region") into a validated Report Spec over the workspace CRM data, and return a plain-English restatement. Optionally persists it onto a report record.',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: ROUTE_GENERATE_SPEC,
    httpMethod: 'POST',
    isAuthRequired: true,
  },
  // Native AI tool surface — Twenty's own chat / MCP can call this.
  toolTriggerSettings: {
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The plain-language reporting request.' },
        reportId: { type: 'string', description: 'Optional report record id to persist the spec onto.' },
        object: { type: 'string', description: 'Optional preferred data-source object (nameSingular) to bias interpretation toward.' },
      },
      required: ['prompt'],
    },
  },
});
