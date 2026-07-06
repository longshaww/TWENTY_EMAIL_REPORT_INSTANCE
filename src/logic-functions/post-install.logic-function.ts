import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { definePostInstallLogicFunction, type InstallPayload } from 'twenty-sdk/define';

import { LF_POST_INSTALL_ID } from 'src/constants/universal-identifiers';

/**
 * Per-recipient report scoping needs a field that links a row to a workspace
 * member (see lib/metadata `memberRelationFields`). Standard objects like
 * Opportunity ship that field (`owner`) but it can be DISABLED in a workspace —
 * and `toSchema` drops inactive fields, so scoping detection then reports "no
 * field links a row to a workspace member" even though the field exists.
 *
 * Rather than teach detection to read inactive fields, we simply ENABLE those
 * fields on install/upgrade: scan every non-system object for a workspace-member
 * relation field that is inactive and switch it on. Idempotent — already-active
 * fields are skipped.
 */
type RawField = {
  id: string;
  name: string;
  isActive: boolean;
  isSystem: boolean;
  relation?: { targetObjectMetadata?: { nameSingular?: string } | null } | null;
};
type RawObject = {
  nameSingular: string;
  isActive: boolean;
  isSystem: boolean;
  fields: { edges: Array<{ node: RawField }> };
};

const handler = async (_payload: InstallPayload): Promise<void> => {
  const client = new MetadataApiClient();
  const res: any = await client.query({
    objects: {
      __args: { paging: { first: 500 }, filter: {} },
      edges: {
        node: {
          nameSingular: true,
          isActive: true,
          isSystem: true,
          fields: {
            __args: { paging: { first: 500 } },
            edges: {
              node: {
                id: true,
                name: true,
                isActive: true,
                isSystem: true,
                relation: { targetObjectMetadata: { nameSingular: true } },
              },
            },
          },
        },
      },
    },
  } as any);

  const objects: RawObject[] = (res.objects?.edges ?? []).map((e: any) => e.node);
  const toEnable: Array<{ object: string; field: string; id: string }> = [];
  for (const o of objects) {
    if (o.isSystem) continue; // don't touch Twenty's internal plumbing
    for (const e of o.fields.edges) {
      const f = e.node;
      if (f.relation?.targetObjectMetadata?.nameSingular === 'workspaceMember' && !f.isActive) {
        toEnable.push({ object: o.nameSingular, field: f.name, id: f.id });
      }
    }
  }

  if (toEnable.length === 0) {
    console.log('[post-install] All workspace-member scope fields already active. Nothing to enable.');
    return;
  }

  for (const t of toEnable) {
    try {
      await client.mutation({
        updateOneField: {
          __args: { input: { id: t.id, update: { isActive: true } } },
          id: true,
        },
      } as any);
      console.log(`[post-install] Enabled scope field ${t.object}.${t.field}`);
    } catch (err: any) {
      console.log(`[post-install] Could not enable ${t.object}.${t.field}: ${err?.message ?? err}`);
    }
  }
};

export default definePostInstallLogicFunction({
  universalIdentifier: LF_POST_INSTALL_ID,
  name: 'post-install',
  description:
    'Enables workspace-member relation fields (e.g. Opportunity.owner) so per-recipient report scoping is available out of the box.',
  timeoutSeconds: 120,
  // Run on every deploy (CD bumps the version each push), not just fresh installs,
  // so a field disabled after the fact gets re-enabled.
  shouldRunOnVersionUpgrade: true,
  shouldRunSynchronously: false,
  handler,
});
