import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';
import { isDefined } from 'twenty-sdk/utils';

import {
  LF_LIST_SCOPE_FIELDS_ID,
  ROUTE_LIST_SCOPE_FIELDS,
} from 'src/constants/universal-identifiers';
import { getObjectSchema, memberRelationFields } from 'src/logic-functions/lib/metadata';

type Input = { object?: string };

const readInput = (event: any): Input => (isDefined(event?.body) ? event.body : event) ?? {};

// Returns the workspace-member relation fields on a data-source object — the
// candidates for "scope per recipient" (matching a recipient to their own rows).
// Lets the builder's Setup checkbox auto-pick a scope field instead of punting
// the user to the AI assistant.
const handler = async (event: RoutePayload | Input) => {
  const input = readInput(event);
  const object = (input.object ?? '').trim();
  if (!object) return { ok: false, error: 'An object is required.' };
  try {
    const schema = await getObjectSchema(object);
    if (!schema) return { ok: false, error: `Unknown data source: ${object}.` };
    return { ok: true, fields: memberRelationFields(schema) };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Could not resolve scope fields.' };
  }
};

export default defineLogicFunction({
  universalIdentifier: LF_LIST_SCOPE_FIELDS_ID,
  name: 'list-scope-fields',
  description: 'List the workspace-member relation fields on a data-source object (candidates for per-recipient scoping).',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: ROUTE_LIST_SCOPE_FIELDS,
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
