import { describe, expect, it } from 'vitest';

import { planFallback } from 'src/logic-functions/lib/planner-fallback';
import type { ObjectSchema } from 'src/logic-functions/lib/report-spec';

const opp: ObjectSchema = {
  nameSingular: 'opportunity',
  namePlural: 'opportunities',
  labelSingular: 'Opportunity',
  labelPlural: 'Opportunities',
  fields: {
    name: { name: 'name', label: 'Name', type: 'TEXT' },
    amount: { name: 'amount', label: 'Amount', type: 'CURRENCY' },
    stage: { name: 'stage', label: 'Stage', type: 'SELECT', options: ['NEW', 'CUSTOMER'] },
    owner: { name: 'owner', label: 'Owner', type: 'RELATION', relationTarget: 'workspaceMember' },
    region: { name: 'region', label: 'Region', type: 'SELECT', options: ['EMEA', 'APAC'] },
    closeDate: { name: 'closeDate', label: 'Close Date', type: 'DATE_TIME' },
  },
};

const company: ObjectSchema = {
  nameSingular: 'company',
  namePlural: 'companies',
  labelSingular: 'Company',
  labelPlural: 'Companies',
  fields: {
    name: { name: 'name', label: 'Name', type: 'TEXT' },
    industry: { name: 'industry', label: 'Industry', type: 'SELECT', options: ['SAAS', 'FINTECH'] },
    createdAt: { name: 'createdAt', label: 'Created At', type: 'DATE_TIME' },
  },
};

const firstMetric = (p: string) => planFallback(p, [opp]).spec.metrics[0];

describe('planFallback metric intent', () => {
  it('"total number of deals by rep" → primary metric is count (not sum)', () => {
    const m = firstMetric('total number of deals by rep');
    expect(m.op).toBe('count');
  });

  it('"how many opportunities by region" → count', () => {
    expect(firstMetric('how many opportunities by region').op).toBe('count');
  });

  it('"total won revenue by rep" → primary metric is sum(amount)', () => {
    const m = firstMetric('total won revenue by rep');
    expect(m.op).toBe('sum');
    expect(m.field).toBe('amount');
  });

  it('"average deal amount" → avg(amount)', () => {
    const m = firstMetric('average deal amount by region');
    expect(m.op).toBe('avg');
    expect(m.field).toBe('amount');
  });
});

describe('planFallback dimensions & filters', () => {
  it('groups by rep and region and filters won deals', () => {
    const { spec } = planFallback('won deals by rep and region', [opp]);
    const groupFields = (spec.groupBy ?? []).map((g) => g.field);
    expect(groupFields).toContain('owner');
    expect(groupFields).toContain('region');
    expect((spec.filters ?? []).some((f) => f.field === 'stage' && f.value === 'CUSTOMER')).toBe(true);
  });

  it('parses a relative time window', () => {
    const { spec } = planFallback('won deals in the last 7 days', [opp]);
    expect(spec.timeWindow?.lastDays).toBe(7);
  });
});

describe('planFallback preferredObject bias', () => {
  it('defaults to the preferred object when the prompt has no object keyword', () => {
    const { object } = planFallback('count by month', [opp, company], 'company');
    expect(object).toBe('company');
  });

  it('lets a strong object keyword in the prompt override the preferred object', () => {
    const { object } = planFallback('won deals by rep', [opp, company], 'company');
    expect(object).toBe('opportunity');
  });

  it('without a preferred object, still defaults to opportunity', () => {
    const { object } = planFallback('count by month', [opp, company]);
    expect(object).toBe('opportunity');
  });
});
