import { describe, expect, it } from 'vitest';

import { REPORT_VISIBILITY } from 'src/constants/universal-identifiers';
import { canAccessReport, type LoadedReport } from './deliver';

const report = (visibility: string, ownerId: string | null): LoadedReport =>
  ({ visibility, ownerId } as LoadedReport);

describe('canAccessReport', () => {
  it('WORKSPACE reports are open to any member', () => {
    expect(canAccessReport(report(REPORT_VISIBILITY.WORKSPACE, 'owner-1'), 'someone-else')).toBe(true);
    expect(canAccessReport(report(REPORT_VISIBILITY.WORKSPACE, null), undefined)).toBe(true);
  });

  it('PRIVATE report is accessible only to its owner', () => {
    expect(canAccessReport(report(REPORT_VISIBILITY.PRIVATE, 'owner-1'), 'owner-1')).toBe(true);
    expect(canAccessReport(report(REPORT_VISIBILITY.PRIVATE, 'owner-1'), 'attacker')).toBe(false);
  });

  it('PRIVATE report denies a missing caller id (fail closed, no spoofing)', () => {
    expect(canAccessReport(report(REPORT_VISIBILITY.PRIVATE, 'owner-1'), undefined)).toBe(false);
    expect(canAccessReport(report(REPORT_VISIBILITY.PRIVATE, 'owner-1'), null)).toBe(false);
  });

  it('PRIVATE report with no owner fails closed (never world-open)', () => {
    expect(canAccessReport(report(REPORT_VISIBILITY.PRIVATE, null), 'anyone')).toBe(false);
    expect(canAccessReport(report(REPORT_VISIBILITY.PRIVATE, null), undefined)).toBe(false);
  });
});
