import { describe, expect, it } from 'vitest';

import { executeSpecOnRecords } from './executor';
import type { ObjectSchema, ReportSpec } from './report-spec';

const schema: ObjectSchema = {
  nameSingular: 'opportunity',
  namePlural: 'opportunities',
  labelSingular: 'Opportunity',
  labelPlural: 'Opportunities',
  fields: {
    closeDate: { name: 'closeDate', label: 'Close Date', type: 'DATE' as any },
    amount: { name: 'amount', label: 'Amount', type: 'NUMBER' as any },
  },
};

// Records intentionally out of chronological order.
const records = [
  { id: '1', closeDate: '2024-08-10', amount: 3 }, // Q3, week of 2024-08-05
  { id: '2', closeDate: '2024-02-05', amount: 1 }, // Q1, week of 2024-02-05
  { id: '3', closeDate: '2024-05-20', amount: 2 }, // Q2, week of 2024-05-20
];

describe('executeSpecOnRecords date-group sort', () => {
  it('sorts quarter buckets chronologically (not by the humanized label → no NaN)', () => {
    const spec: ReportSpec = {
      object: 'opportunity',
      metrics: [{ op: 'count' }],
      groupBy: [{ field: 'closeDate', dateGranularity: 'quarter' }],
      sort: { by: 'closeDate', direction: 'ASC' },
    };
    const result = executeSpecOnRecords(spec, schema, records);
    expect(result.rows.map((r) => r.group.closeDate)).toEqual(['2024 Q1', '2024 Q2', '2024 Q3']);
  });

  it('DESC reverses the chronological order', () => {
    const spec: ReportSpec = {
      object: 'opportunity',
      metrics: [{ op: 'count' }],
      groupBy: [{ field: 'closeDate', dateGranularity: 'quarter' }],
      sort: { by: 'closeDate', direction: 'DESC' },
    };
    const result = executeSpecOnRecords(spec, schema, records);
    expect(result.rows.map((r) => r.group.closeDate)).toEqual(['2024 Q3', '2024 Q2', '2024 Q1']);
  });

  it('sorts week buckets chronologically', () => {
    const spec: ReportSpec = {
      object: 'opportunity',
      metrics: [{ op: 'count' }],
      groupBy: [{ field: 'closeDate', dateGranularity: 'week' }],
      sort: { by: 'closeDate', direction: 'ASC' },
    };
    const result = executeSpecOnRecords(spec, schema, records);
    const keys = result.rows.map((r) => r.groupKeys?.closeDate);
    // Raw ISO week keys must be non-decreasing.
    expect([...keys]).toEqual([...keys].sort());
    expect(keys.length).toBe(3);
  });

  it('exposes raw sortable groupKeys alongside humanized labels', () => {
    const spec: ReportSpec = {
      object: 'opportunity',
      metrics: [{ op: 'count' }],
      groupBy: [{ field: 'closeDate', dateGranularity: 'quarter' }],
      sort: { by: 'closeDate', direction: 'ASC' },
    };
    const result = executeSpecOnRecords(spec, schema, records);
    expect(result.rows[0].group.closeDate).toBe('2024 Q1');
    expect(result.rows[0].groupKeys?.closeDate).toBe('2024-Q1');
  });
});
