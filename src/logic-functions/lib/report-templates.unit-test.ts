import { describe, expect, it } from 'vitest';

import { BLOCK_PALETTE, type BlockType } from './blocks';
import { getTemplate, REPORT_TEMPLATES, SECTION_PRESETS } from './report-templates';

const KNOWN = new Set<BlockType>(BLOCK_PALETTE.map((p) => p.type));

describe('report templates', () => {
  it('exposes ~10 presets with unique ids', () => {
    expect(REPORT_TEMPLATES.length).toBeGreaterThanOrEqual(10);
    const ids = REPORT_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every template declares a data-source object', () => {
    for (const t of REPORT_TEMPLATES) {
      expect(typeof t.object).toBe('string');
      expect(t.object.trim().length).toBeGreaterThan(0);
    }
  });

  it('every template has a valid v2 layout, a prompt, and known block types', () => {
    for (const t of REPORT_TEMPLATES) {
      expect(t.prompt.trim().length).toBeGreaterThan(0);
      expect(t.layout.version).toBe(2);
      expect(t.layout.theme?.accent).toMatch(/^#[0-9a-fA-F]{3,6}$/);
      expect(t.layout.blocks.length).toBeGreaterThan(0);
      const uniqueIds = new Set(t.layout.blocks.map((b) => b.id));
      expect(uniqueIds.size).toBe(t.layout.blocks.length);
      for (const b of t.layout.blocks) expect(KNOWN.has(b.type)).toBe(true);
    }
  });

  it('getTemplate resolves by id and returns undefined otherwise', () => {
    expect(getTemplate('weekly-sales-pulse')?.name).toBe('Weekly Sales Pulse');
    expect(getTemplate('nope')).toBeUndefined();
    expect(getTemplate(undefined)).toBeUndefined();
  });

  it('section presets reference only known block types', () => {
    for (const s of SECTION_PRESETS) {
      expect(s.blocks.length).toBeGreaterThan(0);
      for (const b of s.blocks) expect(KNOWN.has(b.type)).toBe(true);
    }
  });
});
