// The in-builder AI assistant chat. Presentational: the parent owns the message
// list + send handler so that an "apply" can refresh the canvas/spec/theme.
import { useEffect, useRef, useState } from 'react';

import { inputStyle, type UITheme } from './ui';

export type ChatTurn = { role: 'user' | 'assistant'; content: string; pending?: boolean };

// A simulated "thinking" bubble: the sandbox + single-JSON logic functions can't
// stream tokens, so we animate dots and cycle through plausible stages to make
// the wait legible (JS-timer text updates — Remote DOM strips CSS keyframes).
const THINKING_STAGES = [
  'Reading your CRM schema…',
  'Building the query…',
  'Running the numbers…',
  'Arranging the layout…',
];

const ThinkingIndicator = ({ T }: { T: UITheme }) => {
  const [dots, setDots] = useState(1);
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const d = setInterval(() => setDots((n) => (n % 3) + 1), 400);
    const s = setInterval(() => setStage((n) => (n + 1) % THINKING_STAGES.length), 1600);
    return () => {
      clearInterval(d);
      clearInterval(s);
    };
  }, []);
  return (
    <div style={{ alignSelf: 'flex-start', maxWidth: '88%', background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, color: T.sub, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 15 }}>✨</span>
      <span>{THINKING_STAGES[stage]}{'.'.repeat(dots)}</span>
    </div>
  );
};

export const AiPanel = ({
  T,
  messages,
  input,
  setInput,
  onSend,
  busy,
  selectedTag,
  onClearTag,
}: {
  T: UITheme;
  messages: ChatTurn[];
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  busy: boolean;
  selectedTag?: { label: string } | null;
  onClearTag?: () => void;
}) => {
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages.length, busy]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>✨</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>AI assistant</div>
          <div style={{ fontSize: 11, color: T.sub }}>Describe the email — it'll ask, then arrange it.</div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
        {messages.length === 0 ? (
          <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.6 }}>
            Try: <i>“Arrange this for a busy exec, weekly, focus on won revenue and top reps.”</i>
            <br />Describe changes to the whole email — or <b style={{ color: T.ink }}>click a block first</b> to tweak just that one (e.g. “make it a pie chart”).
            <br />The assistant will clarify anything ambiguous before changing the report.
          </div>
        ) : null}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '88%',
              background: m.role === 'user' ? T.accent : T.panel2,
              color: m.role === 'user' ? '#fff' : T.ink,
              border: m.role === 'user' ? 'none' : `1px solid ${T.border}`,
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 13,
              lineHeight: 1.45,
              opacity: m.pending ? 0.6 : 1,
              whiteSpace: 'pre-wrap',
            }}
          >
            {m.content}
          </div>
        ))}
        {busy ? <ThinkingIndicator T={T} /> : null}
        <div ref={endRef} />
      </div>

      <div style={{ borderTop: `1px solid ${T.border}`, padding: 12 }}>
        {selectedTag ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: T.sub }}>Editing</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: T.accentBg, border: `1px solid ${T.accent}`, borderRadius: 999, padding: '3px 4px 3px 9px', fontSize: 12, color: T.ink }}>
              ◈ {selectedTag.label}
              {onClearTag ? (
                <button onClick={onClearTag} title="Stop editing this block" style={{ border: 'none', background: 'transparent', color: T.sub, cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: '0 2px' }}>✕</button>
              ) : null}
            </span>
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          value={input}
          // Strip a leading newline: in the Remote DOM sandbox preventDefault on
          // Enter is unreliable, so an Enter-to-send can still insert a stray '\n'
          // into the just-cleared input — stripping it here keeps the box clean
          // without affecting Shift+Enter multi-line input (mid-text newlines stay).
          onChange={(e) => setInput(e.target.value.replace(/^\n+/, ''))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (!busy && input.trim()) onSend();
            }
          }}
          placeholder={selectedTag ? `Ask about this ${selectedTag.label}… e.g. "make it a pie chart"` : 'Ask the AI to arrange the email…'}
          style={{ ...inputStyle(T), minHeight: 38, maxHeight: 120, resize: 'none', flex: 1 }}
        />
        <button
          onClick={onSend}
          disabled={busy || !input.trim()}
          style={{
            padding: '8px 12px',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            border: 'none',
            background: T.accent,
            color: '#fff',
            cursor: busy || !input.trim() ? 'default' : 'pointer',
            opacity: busy || !input.trim() ? 0.5 : 1,
          }}
        >
          {busy ? '…' : 'Send'}
        </button>
        </div>
      </div>
    </div>
  );
};
