// First-run "Discover the editor" tour — a dismissible 4-step overlay shown the
// first time a user opens the builder (adapted from Brevo's coach-marks).
import { useState } from 'react';

import type { UITheme } from './ui';

const STEPS = [
  { icon: '🧩', title: 'Drag & drop', body: 'Drag blocks from the left rail onto the canvas, and drag blocks on the canvas to reorder them. Click any block to edit it on the right.' },
  { icon: '✨', title: 'AI assistant', body: 'Open the AI tab and describe the email. It asks a focused question when anything is unclear, then arranges the data, layout and copy for you.' },
  { icon: '🎨', title: 'Style & theme', body: 'The Style tab sets the accent colour, font and light/dark mode — the live canvas and the delivered email always match.' },
  { icon: '📤', title: 'Preview & test', body: 'Use “Preview & test” to render the real email with live numbers, then set a schedule and subscribers to send it automatically.' },
];

export const OnboardingTour = ({ T, onClose }: { T: UITheme; onClose: () => void }) => {
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;
  const s = STEPS[step];

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ width: 460, maxWidth: '90%', background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>Discover the editor</div>
          <button onClick={onClose} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: T.sub, fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {STEPS.map((st, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 20, height: 20, borderRadius: 999, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: i <= step ? T.accent : T.panel2, color: i <= step ? '#fff' : T.sub }}>{i + 1}</div>
              <span style={{ fontSize: 12, fontWeight: 600, color: i === step ? T.ink : T.sub }}>{st.title}</span>
            </div>
          ))}
        </div>

        <div style={{ background: T.accentBg, borderRadius: 12, padding: 20, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 30 }}>{s.icon}</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>{s.title}</div>
            <div style={{ fontSize: 13, color: T.sub, marginTop: 6, lineHeight: 1.5 }}>{s.body}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', marginTop: 18 }}>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: T.sub, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Skip</button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {step > 0 ? (
              <button onClick={() => setStep((v) => v - 1)} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: `1px solid ${T.border}`, background: T.panel, color: T.ink, cursor: 'pointer' }}>Back</button>
            ) : null}
            <button
              onClick={() => (last ? onClose() : setStep((v) => v + 1))}
              style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: T.accent, color: '#fff', cursor: 'pointer' }}
            >
              {last ? 'Get started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
