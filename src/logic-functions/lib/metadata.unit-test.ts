import { describe, expect, it } from 'vitest';

import { memberRelationFields } from './metadata';
import type { ObjectSchema } from './report-spec';

const field = (name: string, relationTarget?: string): any => ({ name, label: name, type: relationTarget ? 'RELATION' : 'TEXT', relationTarget });

const schema: ObjectSchema = {
  nameSingular: 'opportunity',
  namePlural: 'opportunities',
  labelSingular: 'Opportunity',
  labelPlural: 'Opportunities',
  fields: {
    amount: field('amount'),
    owner: field('owner', 'workspaceMember'),
    company: field('company', 'company'),
    pointOfContact: field('pointOfContact', 'workspaceMember'),
  },
};

describe('memberRelationFields', () => {
  it('returns only relation fields that target a workspace member', () => {
    expect(memberRelationFields(schema).sort()).toEqual(['owner', 'pointOfContact']);
  });

  it('is empty when the object has no workspace-member relation', () => {
    expect(memberRelationFields({ ...schema, fields: { amount: field('amount'), company: field('company', 'company') } })).toEqual([]);
  });
});
