/**
 * Runtime schema introspection via MetadataApiClient. We never hardcode the
 * CRM schema — objects/fields are read live so the app stays correct as the
 * workspace evolves and honors the "no hardcoded schema" rule.
 */
import { MetadataApiClient } from 'twenty-client-sdk/metadata';

import type { FieldInfo, ObjectSchema } from './report-spec';
import { NON_REPORTABLE_TYPES } from './report-spec';

// Objects we never want users to build reports over (our own plumbing + noise).
const HIDDEN_OBJECTS = new Set([
  'northpeakReport',
  'northpeakReportSubscription',
  'northpeakReportRun',
  'dashboard',
  'workflow',
  'workflowVersion',
  'workflowRun',
  'viewField',
  'view',
]);

type RawField = {
  name: string;
  label: string;
  type: string;
  isActive: boolean;
  isSystem: boolean;
  options?: Array<{ value: string; label: string }> | null;
  relation?: { targetObjectMetadata?: { nameSingular?: string } | null } | null;
};

type RawObject = {
  nameSingular: string;
  namePlural: string;
  labelSingular: string;
  labelPlural: string;
  isActive: boolean;
  isSystem: boolean;
  fields: { edges: Array<{ node: RawField }> };
};

// No module-level cache: a warm runtime can serve more than one workspace, and a
// shared cache would leak one workspace's schema into another (and go stale after
// a schema edit). We fetch per invocation instead; callers that need many schemas
// in one call use `listReportableSchemas()` (a single fetch), and `deliver` fetches
// the object schema once and reuses it across recipients.
async function fetchAllObjects(): Promise<RawObject[]> {
  const client = new MetadataApiClient();
  const res: any = await client.query({
    objects: {
      __args: { paging: { first: 500 }, filter: {} },
      edges: {
        node: {
          nameSingular: true,
          namePlural: true,
          labelSingular: true,
          labelPlural: true,
          isActive: true,
          isSystem: true,
          fields: {
            __args: { paging: { first: 500 } },
            edges: {
              node: {
                name: true,
                label: true,
                type: true,
                isActive: true,
                isSystem: true,
                options: true,
                relation: { targetObjectMetadata: { nameSingular: true } },
              },
            },
          },
        },
      },
    },
  } as any);
  return (res.objects?.edges ?? []).map((e: any) => e.node) as RawObject[];
}

function toSchema(obj: RawObject): ObjectSchema {
  const fields: Record<string, FieldInfo> = {};
  for (const e of obj.fields.edges) {
    const f = e.node;
    if (!f.isActive) continue;
    fields[f.name] = {
      name: f.name,
      label: f.label,
      type: f.type,
      ...(f.options && f.options.length ? { options: f.options.map((o) => o.value) } : {}),
      ...(f.relation?.targetObjectMetadata?.nameSingular
        ? { relationTarget: f.relation.targetObjectMetadata.nameSingular }
        : {}),
    };
  }
  return {
    nameSingular: obj.nameSingular,
    namePlural: obj.namePlural,
    labelSingular: obj.labelSingular,
    labelPlural: obj.labelPlural,
    fields,
  };
}

/** Introspect a single object by its nameSingular. Returns null if not found. */
export async function getObjectSchema(nameSingular: string): Promise<ObjectSchema | null> {
  const objects = await fetchAllObjects();
  const obj = objects.find((o) => o.nameSingular === nameSingular && o.isActive);
  return obj ? toSchema(obj) : null;
}

function isReportable(o: RawObject): boolean {
  return o.isActive && !o.isSystem && !HIDDEN_OBJECTS.has(o.nameSingular);
}

/** List objects a user may build a report over (active, non-system, not hidden). */
export async function listReportableObjects(): Promise<
  Array<{ nameSingular: string; namePlural: string; labelSingular: string; labelPlural: string }>
> {
  const objects = await fetchAllObjects();
  return objects.filter(isReportable).map((o) => ({
    nameSingular: o.nameSingular,
    namePlural: o.namePlural,
    labelSingular: o.labelSingular,
    labelPlural: o.labelPlural,
  }));
}

/**
 * Full schemas for every reportable object in ONE fetch — for callers (the spec
 * planner) that need the whole catalog, so they don't fetch objects once per
 * object via getObjectSchema.
 */
export async function listReportableSchemas(): Promise<ObjectSchema[]> {
  const objects = await fetchAllObjects();
  return objects.filter(isReportable).map(toSchema);
}

/**
 * Compact, LLM-friendly summary of an object's reportable fields — fed to the
 * model so it emits specs that reference only real fields/options.
 */
export function buildSchemaSummaryForLLM(schema: ObjectSchema): string {
  const lines: string[] = [];
  for (const f of Object.values(schema.fields)) {
    if (NON_REPORTABLE_TYPES.has(f.type)) continue;
    if (['createdAt', 'updatedAt', 'deletedAt', 'searchVector'].includes(f.name)) {
      if (f.name === 'deletedAt' || f.name === 'searchVector') continue;
    }
    let line = `- ${f.name} (${f.type})`;
    if (f.options?.length) line += ` options: [${f.options.join(', ')}]`;
    if (f.relationTarget) line += ` → ${f.relationTarget}`;
    lines.push(line);
  }
  return `Object "${schema.nameSingular}" (${schema.labelPlural}). Reportable fields:\n${lines.join('\n')}`;
}

/**
 * Field names on an object that are RELATIONS to a workspace member — the valid
 * "scope by" fields for per-recipient row-level scoping (a recipient is a
 * workspace member, so we match rows whose member-relation equals their id).
 * Empty ⇒ this object can't be scoped per recipient.
 */
export function memberRelationFields(schema: ObjectSchema): string[] {
  // relationTarget is only populated for RELATION fields, so this implies RELATION.
  return Object.values(schema.fields)
    .filter((f) => f.relationTarget === 'workspaceMember')
    .map((f) => f.name);
}
