import { describe, expect, it } from 'vitest';

import { DEFAULT_THEME, resolveTheme } from './theme';

describe('resolveTheme', () => {
  it('uses Twenty light design tokens by default', () => {
    const t = resolveTheme(undefined);
    expect(t.ink).toBe('#202020');
    expect(t.bg).toBe('#f9f9f9');
    expect(t.card).toBe('#ffffff');
    expect(t.accent).toBe(DEFAULT_THEME.accent);
    expect(t.bar).toBe(DEFAULT_THEME.accent);
    expect(t.font.toLowerCase()).toContain('inter');
  });

  it('uses the accent for links and bars, and validates hex', () => {
    expect(resolveTheme({ accent: '#0ea5e9' }).accent).toBe('#0ea5e9');
    expect(resolveTheme({ accent: 'red' }).accent).toBe(DEFAULT_THEME.accent); // invalid → default
    expect(resolveTheme({ accent: '#abc' }).accent).toBe('#abc'); // short hex ok
  });

  it('switches to a dark surface in dark mode', () => {
    const d = resolveTheme({ mode: 'dark', accent: '#16a34a' });
    expect(d.card).not.toBe('#ffffff');
    expect(d.ink).toBe('#eeeeee');
    expect(d.bar).toBe('#16a34a');
  });

  it('maps font choices to real stacks', () => {
    expect(resolveTheme({ font: 'serif' }).font.toLowerCase()).toContain('georgia');
    expect(resolveTheme({ font: 'mono' }).font.toLowerCase()).toContain('mono');
  });
});
