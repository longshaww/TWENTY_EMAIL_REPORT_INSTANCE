/**
 * Per-report visual theme — the single source of truth for the colours and font
 * used by BOTH the HTML email renderer (`render.ts`) and the client-side WYSIWYG
 * canvas (the builder front-component). Keeping `resolveTheme()` here means the
 * live preview in the builder and the delivered email stay pixel-identical.
 *
 * Pure module (no imports) so it is safe to import from the Web Worker sandbox
 * and from the logic functions alike.
 */

export type ThemeFont = 'sans' | 'serif' | 'mono';
export type ThemeMode = 'light' | 'dark';

// Stored on the report layout (layout.theme). All fields optional at rest; the
// resolver fills in defaults so older (v1) layouts render unchanged.
export type ReportTheme = {
  accent?: string; // brand/link/bar colour, e.g. "#3e63dd"
  font?: ThemeFont;
  mode?: ThemeMode;
  logoUrl?: string; // optional brand logo, used by the `logo` block
};

export const DEFAULT_THEME: Required<Omit<ReportTheme, 'logoUrl'>> & Pick<ReportTheme, 'logoUrl'> = {
  accent: '#3e63dd', // Twenty indigo9 (default; user can pick another swatch)
  font: 'sans',
  mode: 'light',
  logoUrl: undefined,
};

// `sans` leads with Inter to match Twenty (loaded by the host); serif/mono are
// left intact so the user's font choice is preserved.
const FONT_STACKS: Record<ThemeFont, string> = {
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  serif: "Georgia,'Times New Roman',Times,serif",
  mono: "'SF Mono',ui-monospace,Menlo,Consolas,'Liberation Mono',monospace",
};

export type ThemeTokens = {
  ink: string; // primary text
  sub: string; // secondary/dimmed text
  border: string;
  bg: string; // page background around the card
  card: string; // card/surface background
  accent: string; // links + emphasis
  bar: string; // bar fill (follows accent)
  barTrack: string; // bar background track
  font: string; // resolved CSS font stack
  accentSoft: string; // subtle accent-tinted surface (narrative box etc.)
};

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
function safeAccent(accent?: string): string {
  return accent && HEX.test(accent) ? accent : DEFAULT_THEME.accent;
}

/**
 * Resolve a (possibly partial / undefined) theme into concrete style tokens.
 * Neutrals follow Twenty's design system (Radix gray scale, light & dark); the
 * `accent`/`bar`/`font` tokens stay driven by the user's per-report branding.
 */
export function resolveTheme(theme?: ReportTheme): ThemeTokens {
  const accent = safeAccent(theme?.accent);
  const font = FONT_STACKS[theme?.font ?? 'sans'] ?? FONT_STACKS.sans;
  const dark = (theme?.mode ?? 'light') === 'dark';

  if (dark) {
    return {
      ink: '#eeeeee', // gray12
      sub: '#b4b4b4', // gray11
      border: '#313131', // gray5
      bg: '#191919', // gray2
      card: '#222222', // gray3
      accent,
      bar: accent,
      barTrack: '#2a2a2a', // gray4 — accent-agnostic track
      accentSoft: '#182449', // indigo3 (dark)
      font,
    };
  }
  return {
    ink: '#202020', // gray12
    sub: '#646464', // gray11
    border: '#e8e8e8', // gray4
    bg: '#f9f9f9', // gray2
    card: '#ffffff',
    accent,
    bar: accent,
    barTrack: '#f0f0f0', // gray3 — accent-agnostic track
    accentSoft: '#edf2fe', // indigo3
    font,
  };
}

export const ACCENT_SWATCHES = [
  '#3e63dd', // indigo (Twenty default)
  '#0ea5e9', // sky
  '#16a34a', // green
  '#db2777', // pink
  '#ea580c', // orange
  '#0f172a', // slate/near-black
] as const;
