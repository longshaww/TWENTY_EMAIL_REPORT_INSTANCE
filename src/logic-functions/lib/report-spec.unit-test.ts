import { describe, expect, it } from 'vitest';

import {
  type ObjectSchema,
  specToEnglish,
  validateReportSpec,
} from 'src/logic-functions/lib/report-spec';

const oppSchema: ObjectSchema = {
  nameSingular: 'opportunity',
  namePlural: 'opportunities',
  labelSingular: 'Opportunity',
  labelPlural: 'Opportunities',
  fields: {
    name: { name: 'name', label: 'Name', type: 'TEXT' },
    stage: { name: 'stage', label: 'Stage', type: 'SELECT', options: ['NEW', 'PROPOSAL', 'CUSTOMER'] },
    productTier: { name: 'productTier', label: 'Product Tier', type: 'SELECT', options: ['STARTER', 'PRO'] },
    amount: { name: 'amount', label: 'Amount', type: 'CURRENCY' },
    closeDate: { name: 'closeDate', label: 'Close Date', type: 'DATE_TIME' },
    owner: { name: 'owner', label: 'Owner', type: 'RELATION', relationTarget: 'workspaceMember' },
  },
};

describe('validateReportSpec', () => {
  it('accepts a valid grouped/aggregated spec and normalizes metric aliases', () => {
    const res = validateReportSpec(
      {
        object: 'opportunity',
        groupBy: [{ field: 'owner' }, { field: 'stage' }],
        metrics: [{ op: 'count' }, { op: 'sum', field: 'amount' }],
        filters: [{ field: 'stage', op: 'is', value: 'CUSTOMER' }],
        timeWindow: { field: 'closeDate', lastDays: 7 },
      },
      oppSchema,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.spec.metrics.map((m) => m.alias)).toEqual(['count', 'sum_amount']);
      expect(res.spec.object).toBe('opportunity');
    }
  });

  it('rejects a wrong object', () => {
    const res = validateReportSpec({ object: 'company', metrics: [{ op: 'count' }] }, oppSchema);
    expect(res.ok).toBe(false);
  });

  it('rejects a non-numeric sum field', () => {
    const res = validateReportSpec(
      { object: 'opportunity', metrics: [{ op: 'sum', field: 'stage' }] },
      oppSchema,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.join(' ')).toMatch(/not numeric/);
  });

  it('rejects an unknown field and an invalid SELECT option', () => {
    const unknown = validateReportSpec(
      { object: 'opportunity', groupBy: [{ field: 'nope' }], metrics: [{ op: 'count' }] },
      oppSchema,
    );
    expect(unknown.ok).toBe(false);

    const badOption = validateReportSpec(
      { object: 'opportunity', metrics: [{ op: 'count' }], filters: [{ field: 'stage', op: 'is', value: 'WON' }] },
      oppSchema,
    );
    expect(badOption.ok).toBe(false);
  });

  it('requires at least one metric', () => {
    const res = validateReportSpec({ object: 'opportunity', metrics: [] }, oppSchema);
    expect(res.ok).toBe(false);
  });

  it('caps limit and warns', () => {
    const res = validateReportSpec(
      { object: 'opportunity', metrics: [{ op: 'count' }], limit: 999999 },
      oppSchema,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.spec.limit).toBe(5000);
      expect(res.warnings.join(' ')).toMatch(/capped/);
    }
  });
});

describe('specToEnglish', () => {
  it('renders a trust-friendly sentence', () => {
    const res = validateReportSpec(
      {
        object: 'opportunity',
        groupBy: [{ field: 'owner' }],
        metrics: [{ op: 'sum', field: 'amount' }, { op: 'count' }],
        filters: [{ field: 'stage', op: 'is', value: 'CUSTOMER' }],
        timeWindow: { field: 'closeDate', lastDays: 7 },
      },
      oppSchema,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      const english = specToEnglish(res.spec, oppSchema);
      expect(english).toContain('Total Amount');
      expect(english).toContain('Stage is Customer');
      expect(english).toContain('last 7 days');
      expect(english).toContain('grouped by Owner');
    }
  });
});
