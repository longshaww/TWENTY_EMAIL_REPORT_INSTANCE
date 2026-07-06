import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import { isDefined } from 'twenty-sdk/utils';

import { LF_STAMP_OWNER_ID } from 'src/constants/universal-identifiers';

// Database-event trigger: when a Report is created, stamp its owner to the member
// who created it.
//
// This is the ONLY place ownership can be set from an UNSPOOFABLE, platform-set
// identity: a create event carries `workspaceMemberId` (the acting member). It
// exists to cover reports created through the native "Add New" row, which never
// hit our HTTP create route and would otherwise be born owner-less. An owner-less
// PRIVATE report is inaccessible to everyone (`canAccessReport` fails closed), so
// without this every natively-created report shows "private to its owner" — the
// exact symptom this fixes.
//
// Reports created via create-report already carry an owner (stamped from the
// front-end's authenticated `useUserId` identity); those are made by the app
// access token, so their create event has NO `workspaceMemberId` and we skip them
// here — we never overwrite an owner that was set at creation time.
type CreatedReport = { id?: string; ownerId?: string | null };

const handler = async (event: any) => {
  const memberId: string | undefined = event?.workspaceMemberId ?? undefined;
  const after: CreatedReport = event?.properties?.after ?? {};
  const recordId: string | undefined = event?.recordId ?? after.id ?? undefined;

  // No acting member (e.g. an app-token / system create) or no record id → nothing
  // to attribute. The app-token create path stamps its own owner from the body.
  if (!isDefined(memberId) || !isDefined(recordId)) {
    return { ok: false, skipped: 'no-actor-or-record' };
  }
  // Respect an owner already set at creation time.
  if (isDefined(after.ownerId)) return { ok: true, skipped: 'already-owned' };

  const client = new CoreApiClient();
  await client.mutation({
    updateNorthpeakReport: { __args: { id: recordId, data: { ownerId: memberId } as any }, id: true },
  } as any);
  return { ok: true, reportId: recordId, ownerId: memberId };
};

export default defineLogicFunction({
  universalIdentifier: LF_STAMP_OWNER_ID,
  name: 'stamp-report-owner',
  description:
    'On report creation, set the owner to the creating workspace member (unspoofable identity), so natively-created reports are never owner-less and inaccessible.',
  timeoutSeconds: 10,
  handler,
  databaseEventTriggerSettings: {
    eventName: 'northpeakReport.created',
  },
});
