import { useMemo, useState } from 'react';

import type { Block } from 'src/logic-functions/lib/blocks';
import { REPORT_TEMPLATES, type ReportTemplate, type TemplateCategory } from 'src/logic-functions/lib/report-templates';
import { resolveTheme } from 'src/logic-functions/lib/theme';

// Shared "Create a report" panel UI — the template gallery + "create from
// scratch" surface. Used by BOTH the command-menu Create Report front component
// (create-report.tsx, which creates a brand-new record) and the record-page
// builder's blank-report starter (report-builder.tsx StarterPicker, which seeds
// the already-created record). It is purely presentational: each host wires its
// own behaviour through onUse / onScratch.

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const CATEGORIES: Array<'All' | TemplateCategory> = ['All', 'Basic', 'Sales', 'Executive'];

export type TemplateGalleryProps = {
  objects: Array<{ nameSingular: string; labelPlural: string }>;
  dataSource: string;
  setDataSource: (s: string) => void;
  busy: string | null;
  onUse: (tpl: ReportTemplate, visibility: string) => void;
  onScratch: (prompt: string, visibility: string) => void;
  // create-report needs the visibility control; the builder (record already
  // exists) hides it.
  showVisibility?: boolean;
  // The record-page builder already has its own top-bar data-source dropdown and
  // an ✨ AI assistant panel, so it hides this panel's data-source row and the
  // "Create from scratch" surface to avoid duplicates.
  showDataSource?: boolean;
  showScratch?: boolean;
  title?: string;
  subtitle?: string;
};

export const TemplateGallery = ({
  objects,
  dataSource,
  setDataSource,
  busy,
  onUse,
  onScratch,
  showVisibility = true,
  showDataSource = true,
  showScratch = true,
  title = 'Create a report',
  subtitle = 'Choose what to report on, then let AI build it.',
}: TemplateGalleryProps) => {
  const [view, setView] = useState<'gallery' | 'scratch'>('gallery');
  const [category, setCategory] = useState<'All' | TemplateCategory>('All');
  const [prompt, setPrompt] = useState('');
  const [visibility, setVisibility] = useState('PRIVATE');

  const sourceLabel = useMemo(
    () => objects.find((o) => o.nameSingular === dataSource)?.labelPlural ?? 'Opportunities',
    [objects, dataSource],
  );

  const templates = useMemo(
    () =>
      REPORT_TEMPLATES.filter(
        (t) => t.object === dataSource && (category === 'All' || t.category === category),
      ),
    [category, dataSource],
  );

  return (
    <div style={{ padding: 20, fontFamily: FONT, color: '#1a1a2e', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 17, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>{subtitle}</div>
      </div>

      {/* Step 1: pick the Twenty data source (hidden in the builder, which has
          its own top-bar data-source dropdown) */}
      {showDataSource ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Data source</label>
          <select
            value={dataSource}
            onChange={(e) => { setDataSource(e.target.value); setCategory('All'); }}
            disabled={!!busy}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontFamily: FONT, fontSize: 13 }}
          >
            {(objects.length ? objects : [{ nameSingular: dataSource, labelPlural: sourceLabel }]).map((o) => (
              <option key={o.nameSingular} value={o.nameSingular}>{o.labelPlural}</option>
            ))}
          </select>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>the report is built over this object</span>
        </div>
      ) : null}

      {/* Segmented control: Templates ↔ From scratch (hidden in the builder,
          whose ✨ AI assistant panel is the "from scratch" surface) */}
      {showScratch ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <Seg active={view === 'gallery'} onClick={() => setView('gallery')}>Templates</Seg>
          <Seg active={view === 'scratch'} onClick={() => setView('scratch')}>Create from scratch</Seg>
        </div>
      ) : null}

      {!showScratch || view === 'gallery' ? (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCategory(c)} style={chip(category === c)}>
                {c}
              </button>
            ))}
          </div>
          {templates.length === 0 ? (
            <div style={{ fontSize: 13, color: '#6b7280', padding: '10px 0' }}>
              No templates for {sourceLabel} yet — {showScratch ? (
                <>switch to <b>Create from scratch</b> and describe the report you want.</>
              ) : (
                <>describe the report you want with the <b>✨ AI assistant</b> on the right.</>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
              {templates.map((tpl) => (
                <TemplateCard key={tpl.id} tpl={tpl} busy={busy} onUse={() => onUse(tpl, visibility)} />
              ))}
            </div>
          )}
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            Describe what you want to see about <b>{sourceLabel}</b>, e.g. “monthly won revenue by product tier” or “open pipeline by rep and region”. You can refine it by chatting in the builder.
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your report…"
            style={{ padding: 10, fontSize: 14, borderRadius: 8, border: '1px solid #e5e7eb', minHeight: 90, fontFamily: FONT, resize: 'vertical' }}
          />
          {showVisibility ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 13, color: '#6b7280' }}>Visibility</label>
              <select value={visibility} onChange={(e) => setVisibility(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                <option value="PRIVATE">Private (only me)</option>
                <option value="WORKSPACE">Workspace</option>
              </select>
            </div>
          ) : null}
          <button onClick={() => prompt.trim() && onScratch(prompt, visibility)} disabled={!!busy || !prompt.trim()} style={primaryBtn(!!busy || !prompt.trim())}>
            {busy ?? 'Create report'}
          </button>
        </div>
      )}

      {view === 'gallery' && busy ? <div style={{ fontSize: 12, color: '#6b7280' }}>{busy}</div> : null}
    </div>
  );
};

// --- template card + mini preview -------------------------------------------
const TemplateCard = ({ tpl, busy, onUse }: { tpl: ReportTemplate; busy: string | null; onUse: () => void }) => {
  const T = resolveTheme(tpl.layout.theme);
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', background: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: T.bg, padding: 12, height: 116, overflow: 'hidden' }}>
        <MiniPreview blocks={tpl.layout.blocks} accent={T.accent} card={T.card} border={T.border} />
      </div>
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{tpl.name}</div>
        <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.35, flex: 1 }}>{tpl.description}</div>
        <button onClick={onUse} disabled={!!busy} style={useBtn(!!busy)}>Use template</button>
      </div>
    </div>
  );
};

// A lightweight visual sketch of a layout — enough to tell templates apart.
const MiniPreview = ({ blocks, accent, card, border }: { blocks: Block[]; accent: string; card: string; border: string }) => (
  <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 5, height: '100%' }}>
    {blocks.slice(0, 6).map((b) => (
      <MiniBlock key={b.id} block={b} accent={accent} />
    ))}
  </div>
);

const MiniBlock = ({ block, accent }: { block: Block; accent: string }) => {
  const line = (w: string, h = 5, bg = '#d7dae0') => <div style={{ width: w, height: h, borderRadius: 2, background: bg }} />;
  switch (block.type) {
    case 'header':
      return <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{line('55%', 7, '#9aa0aa')}{line('35%', 4)}</div>;
    case 'metricRow':
      return (
        <div style={{ display: 'flex', gap: 4 }}>
          {[0, 1, 2].map((i) => <div key={i} style={{ flex: 1, height: 16, borderRadius: 3, border: '1px solid #e5e7eb' }} />)}
        </div>
      );
    case 'chart':
      return <div style={{ height: 22, borderRadius: 3, background: `linear-gradient(180deg, ${accent}22, ${accent}44)`, border: `1px solid ${accent}55` }} />;
    case 'barBreakdown':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {['80%', '55%', '35%'].map((w, i) => <div key={i} style={{ width: w, height: 5, borderRadius: 2, background: accent }} />)}
        </div>
      );
    case 'table':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: 'flex', gap: 3 }}>{line('40%', 4)}{line('25%', 4)}{line('20%', 4)}</div>
          ))}
        </div>
      );
    case 'narrative':
      return <div style={{ borderLeft: `3px solid ${accent}`, paddingLeft: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>{line('90%', 4)}{line('70%', 4)}</div>;
    case 'insights':
      return (
        <div style={{ display: 'flex', gap: 4 }}>
          {[0, 1].map((i) => <div key={i} style={{ flex: 1, height: 16, borderRadius: 3, border: `1px solid ${accent}55`, background: `${accent}11` }} />)}
        </div>
      );
    case 'button':
      return <div style={{ alignSelf: 'center', width: '45%', height: 12, borderRadius: 6, background: accent }} />;
    case 'divider':
      return <div style={{ height: 1, background: '#e5e7eb' }} />;
    case 'spacer':
      return <div style={{ height: 6 }} />;
    default:
      return <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{line('92%', 4)}{line('60%', 4)}</div>;
  }
};

// --- small styled controls --------------------------------------------------
const Seg = ({ active, onClick, children }: any) => (
  <button
    onClick={onClick}
    style={{
      padding: '7px 14px', fontSize: 13, fontWeight: 600, borderRadius: 999, cursor: 'pointer',
      border: `1px solid ${active ? '#4f46e5' : '#e5e7eb'}`, background: active ? '#4f46e5' : '#fff', color: active ? '#fff' : '#1a1a2e',
    }}
  >
    {children}
  </button>
);

const chip = (active: boolean) => ({
  padding: '4px 12px', fontSize: 12, borderRadius: 999, cursor: 'pointer',
  border: `1px solid ${active ? '#4f46e5' : '#e5e7eb'}`, background: active ? '#f2f1ff' : '#fff', color: active ? '#4f46e5' : '#6b7280', fontWeight: 600,
});

const useBtn = (disabled: boolean) => ({
  padding: '7px 12px', fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: disabled ? 'default' : 'pointer',
  border: '1px solid #e5e7eb', background: '#fff', color: '#1a1a2e', opacity: disabled ? 0.5 : 1,
});

const primaryBtn = (disabled: boolean) => ({
  padding: '10px 16px', fontSize: 14, fontWeight: 600, color: '#fff', background: '#4f46e5', border: 'none', borderRadius: 8,
  cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
});
