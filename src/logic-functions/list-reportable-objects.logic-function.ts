import { defineLogicFunction } from 'twenty-sdk/define';

import { LF_LIST_OBJECTS_ID, ROUTE_LIST_OBJECTS } from 'src/constants/universal-identifiers';
import { listReportableObjects } from 'src/logic-functions/lib/metadata';

// Powers the "pick a data source" step in the create-report UI and the
// data-source indicator in the builder. Returns the live list of Twenty objects
// a user may report over (active, non-system, not our own plumbing) — never a
// hardcoded schema.
const handler = async () => {
  try {
    const objects = await listReportableObjects();
    return { ok: true, objects };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Could not list data sources.' };
  }
};

export default defineLogicFunction({
  universalIdentifier: LF_LIST_OBJECTS_ID,
  name: 'list-reportable-objects',
  description: 'List the Twenty objects a user may build a report over (active, non-system data sources).',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: ROUTE_LIST_OBJECTS,
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
