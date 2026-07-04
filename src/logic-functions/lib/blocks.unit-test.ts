import { describe, expect, it } from 'vitest';

import { applyBlockPatches, coerceLayout, defaultLayout, sanitizeBlockPatch, sanitizeBlocks, upgradeLayout, type Block, type ReportLayout } from './blocks';
import type { ReportSpec } from './report-spec';
import { DEFAULT_THEME } from './theme';

const spec: ReportSpec = {
  object: 'opportunity',
  metrics: [{ op: 'sum', field: 'amount' }, { op: 'count' }],
  groupBy: [{ field: 'owner' }],
};

describe('defaultLayout', () => {
  it('stamps version 2 and a default theme', () => {
    const layout = defaultLayout(spec, 'My Report');
    expect(layout.version).toBe(2);
    expect(layout.theme).toEqual(DEFAULT_THEME);
    expect(layout.blocks[0]).toMatchObject({ type: 'header', title: 'My Report' });
  });

  it('adds chart/bars/table only when grouped', () => {
    const grouped = defaultLayout(spec, 'r').blocks.map((b) => b.type);
    expect(grouped).toContain('chart');
    expect(grouped).toContain('table');
    const ungrouped = defaultLayout({ ...spec, groupBy: [] }, 'r').blocks.map((b) => b.type);
    expect(ungrouped).not.toContain('table');
  });
});

describe('upgradeLayout / coerceLayout migration', () => {
  it('migrates a v1 layout (blocks only) to v2 with a theme, keeping blocks', () => {
    const v1 = { version: 1, blocks: [{ id: 'h', type: 'header', title: 'Kept' }] } as unknown as ReportLayout;
    const up = upgradeLayout(v1);
    expect(up.version).toBe(2);
    expect(up.theme).toEqual(DEFAULT_THEME);
    expect(up.blocks[0].title).toBe('Kept');
  });

  it('coerceLayout preserves a valid layout (upgraded) and rebuilds an empty one', () => {
    const valid = coerceLayout({ version: 1, blocks: [{ id: 'x', type: 'divider' }] }, spec, 'r');
    expect(valid.version).toBe(2);
    expect(valid.blocks).toHaveLength(1);

    const rebuilt = coerceLayout({ blocks: [] }, spec, 'r');
    expect(rebuilt.blocks.length).toBeGreaterThan(1);
  });

  it('keeps an existing v2 theme untouched', () => {
    const themed = { version: 2, theme: { accent: '#ff0000', font: 'serif', mode: 'dark' }, blocks: [{ id: 'a', type: 'header' }] } as unknown as ReportLayout;
    expect(upgradeLayout(themed).theme).toEqual({ accent: '#ff0000', font: 'serif', mode: 'dark' });
  });
});

describe('sanitizeBlocks', () => {
  it('drops unknown types and whitelists known fields', () => {
    const out = sanitizeBlocks([
      { type: 'header', title: 'T', subtitle: 'S', bogus: 'nope' },
      { type: 'not-a-block', title: 'x' },
      { type: 'chart', chartKind: 'pie' },
      { type: 'chart', chartKind: 'invalid' },
      { type: 'spacer', height: 999 },
      { type: 'button', buttonText: 'Go', align: 'center' },
    ]);
    expect(out.map((b) => b.type)).toEqual(['header', 'chart', 'chart', 'spacer', 'button']);
    expect((out[0] as any).bogus).toBeUndefined();
    expect(out[0]).toMatchObject({ title: 'T', subtitle: 'S' });
    expect(out[1].chartKind).toBe('pie');
    expect(out[2].chartKind).toBeUndefined(); // invalid dropped
    expect(out[3].height).toBe(120); // clamped
    expect(out[4]).toMatchObject({ buttonText: 'Go', align: 'center' });
  });

  it('assigns ids and returns [] for non-arrays', () => {
    expect(sanitizeBlocks('nope')).toEqual([]);
    const [b] = sanitizeBlocks([{ type: 'divider' }]);
    expect(typeof b.id).toBe('string');
    expect(b.id.length).toBeGreaterThan(0);
  });
});

describe('sanitizeBlockPatch', () => {
  it('whitelists changed fields and captures id, dropping unknown/type', () => {
    const p = sanitizeBlockPatch({ id: 'chart-3', type: 'table', chartKind: 'pie', bogus: 1, maxRows: 999 });
    expect(p.id).toBe('chart-3');
    expect(p.fields).toEqual({ chartKind: 'pie', maxRows: 100 }); // type dropped, maxRows clamped, bogus dropped
    expect((p.fields as any).type).toBeUndefined();
  });

  it('returns empty fields for junk and no id when absent', () => {
    expect(sanitizeBlockPatch(null)).toEqual({ fields: {} });
    expect(sanitizeBlockPatch({ chartKind: 'bad' })).toEqual({ fields: {} });
  });
});

describe('applyBlockPatches (drift-free scoped edit)', () => {
  const base: Block[] = [
    { id: 'header-0', type: 'header', title: 'Weekly', subtitle: 'MTD' },
    { id: 'chart-1', type: 'chart', chartKind: 'bar' },
    { id: 'narr-2', type: 'narrative' },
  ];

  it('changes only the targeted block and keeps the others byte-for-byte', () => {
    const out = applyBlockPatches(base, [{ id: 'chart-1', chartKind: 'pie' }]);
    expect(out[1]).toEqual({ id: 'chart-1', type: 'chart', chartKind: 'pie' });
    // untouched blocks are the SAME references (verbatim, no drift)
    expect(out[0]).toBe(base[0]);
    expect(out[2]).toBe(base[2]);
    expect(out.map((b) => b.id)).toEqual(['header-0', 'chart-1', 'narr-2']); // order preserved
  });

  it('falls back to the selected block id when a patch omits id', () => {
    const out = applyBlockPatches(base, [{ chartKind: 'pie' }], 'chart-1');
    expect(out[1].chartKind).toBe('pie');
    expect(out[0]).toBe(base[0]);
  });

  it('ignores patches for unknown ids (no hallucinated blocks) and no-op inputs', () => {
    expect(applyBlockPatches(base, [{ id: 'ghost', chartKind: 'pie' }])).toEqual(base);
    expect(applyBlockPatches(base, [])).toBe(base);
    expect(applyBlockPatches([], [{ id: 'x', title: 'y' }])).toEqual([]);
  });
});
