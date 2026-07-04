// Shared chrome for the builder front-component: the app-surface theme (light/
// dark of Twenty itself) plus small styled controls. This is DISTINCT from the
// report's own email theme (resolveTheme in lib/theme) — this styles the editor,
// that styles the email being edited.

export type UITheme = ReturnType<typeof uiTheme>;

// Twenty's design tokens: Inter font, Radix gray neutrals, Radix indigo accent
// (Twenty maps its "blue" to Radix indigo). Values are the sRGB equivalents of
// the display-p3 colours Twenty ships, so they also render in the email context.
export function uiTheme(dark: boolean) {
  return {
    font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    bg: dark ? '#111111' : '#f9f9f9', // gray1 / gray2 — page background
    panel: dark ? '#222222' : '#ffffff', // elevated surface (gray3 dark / white)
    panel2: dark ? '#2a2a2a' : '#f0f0f0', // gray4 dark / gray3 light
    border: dark ? '#313131' : '#e8e8e8', // gray5 dark / gray4 light
    ink: dark ? '#eeeeee' : '#202020', // gray12 — primary text
    sub: dark ? '#b4b4b4' : '#646464', // gray11 — secondary text
    accent: '#3e63dd', // indigo9
    accentBg: dark ? '#182449' : '#edf2fe', // indigo3
    warn: dark ? '#ffca16' : '#ab6400', // amber11
    inputBg: dark ? '#191919' : '#ffffff', // gray2 dark / white
    canvasBg: dark ? '#191919' : '#f0f0f0', // recessed canvas (gray2 dark / gray3 light)
  };
}

export const Btn = ({ T, kind, ...rest }: any) => (
  <button
    {...rest}
    style={{
      padding: '8px 12px',
      fontSize: 13,
      fontWeight: 600,
      borderRadius: 8,
      cursor: rest.disabled ? 'default' : 'pointer',
      opacity: rest.disabled ? 0.5 : 1,
      border: `1px solid ${kind === 'primary' ? T.accent : T.border}`,
      background: kind === 'primary' ? T.accent : T.panel,
      color: kind === 'primary' ? '#fff' : T.ink,
      ...(rest.style ?? {}),
    }}
  />
);

export const IconBtn = ({ T, ...rest }: any) => (
  <button
    {...rest}
    style={{
      width: 26,
      height: 26,
      borderRadius: 8,
      border: `1px solid ${T.border}`,
      background: T.panel,
      color: T.sub,
      cursor: rest.disabled ? 'default' : 'pointer',
      fontSize: 12,
      opacity: rest.disabled ? 0.4 : 1,
      ...(rest.style ?? {}),
    }}
  />
);

export const Panel = ({ T, title, right, children }: { T: UITheme; title?: string; right?: any; children: any }) => (
  <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: 16 }}>
    {title ? (
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.02em', color: T.ink }}>{title}</div>
        <div style={{ marginLeft: 'auto' }}>{right}</div>
      </div>
    ) : null}
    {children}
  </div>
);

export const Row = ({ T, label, children }: { T: UITheme; label: string; children: any }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
    <label style={{ fontSize: 12, color: T.sub, width: 110 }}>{label}</label>
    <div style={{ flex: 1 }}>{children}</div>
  </div>
);

export const inputStyle = (T: UITheme) => ({
  width: '100%',
  boxSizing: 'border-box' as const,
  padding: '8px 12px',
  fontSize: 13,
  borderRadius: 8,
  border: `1px solid ${T.border}`,
  background: T.inputBg,
  color: T.ink,
  fontFamily: T.font,
});
