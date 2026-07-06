import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineFrontComponent } from 'twenty-sdk/define';
import { enqueueSnackbar, useColorScheme, useRecordId, useSelectedRecordIds } from 'twenty-sdk/front-component';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { REPORT_BUILDER_FC_ID, ROUTE_ARRANGE_REPORT, ROUTE_GENERATE_SPEC, ROUTE_LIST_OBJECTS, ROUTE_LIST_SCOPE_FIELDS, ROUTE_RUN_REPORT } from 'src/constants/universal-identifiers';
import { BLOCK_PALETTE, type Block, type BlockType, type ReportLayout } from 'src/logic-functions/lib/blocks';
import { metricAlias } from 'src/logic-functions/lib/report-spec';
import type { ReportResult } from 'src/logic-functions/lib/executor';
import { computeNextRunAt } from 'src/logic-functions/lib/schedule';
import { ACCENT_SWATCHES, DEFAULT_THEME, resolveTheme, type ReportTheme, type ThemeFont } from 'src/logic-functions/lib/theme';
import { SECTION_PRESETS, type ReportTemplate } from 'src/logic-functions/lib/report-templates';

import { Btn, IconBtn, Panel, Row, inputStyle, uiTheme, type UITheme } from './builder/ui';
import { BlockView, type CanvasData } from './builder/block-view';
import { AiPanel, type ChatTurn } from './builder/ai-panel';
import { OnboardingTour } from './builder/onboarding';
import { TemplateGallery } from './builder/template-gallery';

// ---------------------------------------------------------------------------
// Brevo-style WYSIWYG report/email builder. Runs in Twenty's Web Worker + Remote
// DOM sandbox, so the canvas is composed of native React blocks (no HTML
// injection / DOM measurement) and drag uses native HTML5 drag events. Left rail
// = Content/Style; centre = live canvas with drop zones; right = AI chat / the
// selected block's editor / schedule + subscribers.
// ---------------------------------------------------------------------------

type ReportRecord = {
  id: string;
  name: string;
  prompt: string | null;
  specEnglish: string | null;
  spec: any;
  layout: ReportLayout | null;
  frequency: string | null;
  sendHour: number | null;
  sendDayOfWeek: number | null;
  sendDayOfMonth: number | null;
  visibility: string | null;
  status: string | null;
  chatHistory: any;
  tourSeen: boolean | null;
  scopePerRecipient: boolean | null;
  scopeFieldName: string | null;
};

type Member = { id: string; label: string; email: string };
type Subscription = { id: string; memberId: string; label: string; scopeMode: string };
type Snap = { blocks: Block[]; theme: ReportTheme };

const FN_URL = () => {
  const fn = process.env.TWENTY_FUNCTIONS_URL;
  if (fn) return fn.replace(/\/+$/, '');
  const api = process.env.TWENTY_API_URL;
  return api ? `${api.replace(/\/+$/, '')}/s` : '';
};
const TOKEN = () => process.env.TWENTY_APP_ACCESS_TOKEN ?? '';

async function callFn<T = any>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${FN_URL()}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Request failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

// Collision-safe block id. A monotonic counter (not Math.random) guarantees
// uniqueness within a session — `rid()` feeds React keys and is the target for
// patch/remove/move-by-id, so two blocks must never share one. The Date.now()
// prefix keeps ids distinct across reloads and across records.
let _blockSeq = 0;
const rid = () => `${Date.now().toString(36)}-${(_blockSeq++).toString(36)}`;
const newBlock = (type: BlockType): Block => {
  const id = `${type}-${rid()}`;
  switch (type) {
    case 'header':
      return { id, type, title: 'Section title', subtitle: '' };
    case 'text':
      return { id, type, markdown: 'Add a note…' };
    case 'table':
      return { id, type, maxRows: 25 };
    case 'barBreakdown':
      return { id, type, maxRows: 10 };
    case 'chart':
      return { id, type, chartKind: 'bar' };
    case 'button':
      return { id, type, buttonText: 'Learn more', buttonUrl: '', align: 'center' };
    case 'image':
    case 'logo':
      return { id, type, imageUrl: '', align: 'center' };
    case 'spacer':
      return { id, type, height: 24 };
    default:
      return { id, type };
  }
};

const ReportBuilder = () => {
  const selected = useSelectedRecordIds();
  const legacy = useRecordId();
  const scheme = useColorScheme();
  const reportId = selected?.[0] ?? legacy ?? null;

  const [report, setReport] = useState<ReportRecord | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [theme, setTheme] = useState<ReportTheme>({ ...DEFAULT_THEME });
  const [members, setMembers] = useState<Member[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [dataSources, setDataSources] = useState<Array<{ nameSingular: string; labelPlural: string }>>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [data, setData] = useState<CanvasData>({ result: null, narrative: '', specEnglish: '' });
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const [loading, setLoading] = useState(true);
  const [sendHourInput, setSendHourInput] = useState('8');

  const [leftTab, setLeftTab] = useState<'content' | 'style'>('content');
  const [rightTab, setRightTab] = useState<'ai' | 'block' | 'setup'>('ai');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null); // block picked up for click-to-place
  const [showTour, setShowTour] = useState(false);
  const [previewAsId, setPreviewAsId] = useState<string>(''); // "Preview as [recipient]" member id
  const [starterObject, setStarterObject] = useState<string>('opportunity'); // data source for the blank-report template picker

  const [aiMessages, setAiMessages] = useState<ChatTurn[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  // Bumped on each send to remount the composer textarea — a plain setAiInput('')
  // does not reset the controlled <textarea> inside the Remote DOM sandbox, so we
  // change its React key to force a fresh (empty) element instead.
  const [composerNonce, setComposerNonce] = useState(0);

  const [past, setPast] = useState<Snap[]>([]);
  const [future, setFuture] = useState<Snap[]>([]);

  const dirtyRef = useRef(false);
  const loadSeq = useRef(0);
  const chatLoadedFor = useRef<string | null>(null); // restore chat once per report
  const tourCheckedFor = useRef<string | null>(null); // auto-show the tour at most once per report load
  const saveTimer = useRef<any>(null); // debounced layout auto-save
  // Remote DOM does not reliably honour stopPropagation, so a toolbar-button click
  // can still bubble to the block wrapper's select-onClick. A toolbar handler sets
  // this flag; the wrapper checks and clears it, so e.g. deleting a block no longer
  // re-selects the just-removed id. (Self-healing: if propagation *was* stopped, the
  // next plain wrapper click clears the stale flag.)
  const suppressSelectRef = useRef(false);

  const T = useMemo(() => uiTheme(scheme === 'dark'), [scheme]);
  const tokens = useMemo(() => resolveTheme(theme), [theme]);
  const client = useMemo(() => new CoreApiClient(), []);

  const aliases: string[] = useMemo(() => {
    if (data.result) return data.result.metrics.map((m) => m.alias);
    const m = report?.spec?.metrics ?? [];
    return m.map((x: any) => metricAlias(x));
  }, [data.result, report]);

  const selectedBlock = useMemo(() => blocks.find((b) => b.id === selectedId) ?? null, [blocks, selectedId]);

  const load = useCallback(
    async (opts?: { forceBlocks?: boolean }) => {
      if (!reportId) return;
      const seq = ++loadSeq.current;
      setBusy('Loading…');
      try {
        const res: any = await client.query({
          northpeakReport: {
            __args: { filter: { id: { eq: reportId } } },
            id: true,
            name: true,
            prompt: true,
            specEnglish: true,
            spec: true,
            layout: true,
            frequency: true,
            sendHour: true,
            sendDayOfWeek: true,
            sendDayOfMonth: true,
            visibility: true,
            status: true,
            chatHistory: true,
            tourSeen: true,
            scopePerRecipient: true,
            scopeFieldName: true,
            subscriptions: { edges: { node: { id: true, scopeMode: true, member: { id: true, name: { firstName: true, lastName: true } } } } },
          },
        } as any);
        if (seq !== loadSeq.current) return;
        const r = res?.northpeakReport;
        if (!r) return;
        const rec: ReportRecord = { ...r, layout: r.layout ?? null };
        setReport(rec);
        setSendHourInput(String(r.sendHour ?? 8));
        // Restore the persisted chat once per report (don't clobber an in-progress convo on reloads).
        if (chatLoadedFor.current !== reportId) {
          chatLoadedFor.current = reportId;
          if (Array.isArray(r.chatHistory)) setAiMessages(r.chatHistory as ChatTurn[]);
        }
        if (opts?.forceBlocks || !dirtyRef.current) {
          setBlocks(Array.isArray(r.layout?.blocks) ? r.layout.blocks : []);
          setTheme(r.layout?.theme ? { ...DEFAULT_THEME, ...r.layout.theme } : { ...DEFAULT_THEME });
          setDirty(false);
          dirtyRef.current = false;
          setPast([]);
          setFuture([]);
        }
        setSubs(
          (r.subscriptions?.edges ?? []).map((e: any) => ({
            id: e.node.id,
            memberId: e.node.member?.id,
            label: [e.node.member?.name?.firstName, e.node.member?.name?.lastName].filter(Boolean).join(' ') || 'Member',
            scopeMode: e.node.scopeMode ?? 'SELF',
          })),
        );
        const mem: any = await client.query({
          workspaceMembers: { __args: { first: 200 }, edges: { node: { id: true, userId: true, userEmail: true, name: { firstName: true, lastName: true } } } },
        } as any);
        if (seq !== loadSeq.current) return;
        const edges = mem?.workspaceMembers?.edges ?? [];
        setMembers(
          edges.map((e: any) => ({
            id: e.node.id,
            email: e.node.userEmail,
            label: [e.node.name?.firstName, e.node.name?.lastName].filter(Boolean).join(' ') || e.node.userEmail,
          })),
        );
      } catch (e: any) {
        if (seq === loadSeq.current) enqueueSnackbar({ message: `Load failed: ${e?.message ?? e}`, variant: 'error' });
      } finally {
        if (seq === loadSeq.current) {
          setBusy(null);
          setLoading(false);
        }
      }
    },
    [reportId, client],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Show the first-run tour once per report. The seen-flag is persisted on the
  // record (northpeakReport.tourSeen) rather than localStorage, which isn't
  // reliably available in the Remote DOM Web Worker sandbox — see the guard ref
  // so a reload of the same report never re-triggers it.
  useEffect(() => {
    if (!reportId || !report) return;
    if (tourCheckedFor.current === reportId) return;
    tourCheckedFor.current = reportId;
    if (!report.tourSeen) setShowTour(true);
  }, [reportId, report]);

  const dismissTour = () => {
    setShowTour(false);
    if (!reportId || report?.tourSeen) return;
    setReport((r) => (r ? { ...r, tourSeen: true } : r));
    // Best-effort persist; local state already prevents a re-show this session.
    client
      .mutation({ updateNorthpeakReport: { __args: { id: reportId, data: { tourSeen: true } }, id: true } } as any)
      .catch(() => {});
  };

  // Auto-load live numbers into the canvas once a spec exists (best-effort).
  const previewLoadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (report?.spec && reportId && previewLoadedFor.current !== reportId) {
      previewLoadedFor.current = reportId;
      runPreview(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report?.spec, reportId]);

  // Load the workspace's reportable objects once, for the data-source picker.
  useEffect(() => {
    (async () => {
      try {
        const r = await callFn(ROUTE_LIST_OBJECTS, {});
        if (r?.ok && Array.isArray(r.objects)) setDataSources(r.objects);
      } catch {
        /* picker just shows the current object label */
      }
    })();
  }, []);

  const currentObject = report?.spec?.object ?? '';
  const currentSourceLabel = useMemo(
    () => dataSources.find((o) => o.nameSingular === currentObject)?.labelPlural ?? currentObject,
    [dataSources, currentObject],
  );

  // --- history-aware edits ---------------------------------------------------
  const commit = (nextBlocks: Block[], nextTheme: ReportTheme) => {
    setPast((p) => [...p.slice(-49), { blocks, theme }]);
    setFuture([]);
    setBlocks(nextBlocks);
    setTheme(nextTheme);
    setDirty(true);
    dirtyRef.current = true;
  };
  const undo = () => {
    setPast((p) => {
      if (!p.length) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [{ blocks, theme }, ...f].slice(0, 50));
      setBlocks(prev.blocks);
      setTheme(prev.theme);
      setDirty(true);
      dirtyRef.current = true;
      return p.slice(0, -1);
    });
  };
  const redo = () => {
    setFuture((f) => {
      if (!f.length) return f;
      const next = f[0];
      setPast((p) => [...p, { blocks, theme }].slice(-50));
      setBlocks(next.blocks);
      setTheme(next.theme);
      setDirty(true);
      dirtyRef.current = true;
      return f.slice(1);
    });
  };

  // Auto-save layout + theme to the record (debounced ~800ms). No manual Save.
  useEffect(() => {
    if (!reportId || !dirtyRef.current) return;
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const layout: ReportLayout = { version: 2, theme, blocks };
        await client.mutation({ updateNorthpeakReport: { __args: { id: reportId, data: { layout: layout as any } }, id: true } } as any);
        setDirty(false);
        dirtyRef.current = false;
        setSaveState('saved');
      } catch (e: any) {
        setSaveState('saved');
        enqueueSnackbar({ message: `Auto-save failed: ${e?.message ?? e}`, variant: 'error' });
      }
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [blocks, theme, reportId, client]);

  const move = (index: number, to: number) => {
    if (to < 0 || to >= blocks.length || index === to) return;
    const next = [...blocks];
    const [b] = next.splice(index, 1);
    next.splice(to, 0, b);
    commit(next, theme);
  };
  const insertAt = (type: BlockType, index: number) => {
    const b = newBlock(type);
    const next = [...blocks];
    next.splice(index, 0, b);
    commit(next, theme);
    setSelectedId(b.id);
    setRightTab('block');
  };
  const insertSection = (sectionId: string, index: number) => {
    const preset = SECTION_PRESETS.find((s) => s.id === sectionId);
    if (!preset) return;
    const created = preset.blocks.map((pb) => ({ id: `${pb.type}-${rid()}`, ...pb }));
    const next = [...blocks];
    next.splice(index, 0, ...created);
    commit(next, theme);
  };
  const remove = (id: string) => {
    commit(blocks.filter((b) => b.id !== id), theme);
    if (selectedId === id) setSelectedId(null);
  };
  const patch = (id: string, p: Partial<Block>) => commit(blocks.map((b) => (b.id === id ? { ...b, ...p } : b)), theme);
  const patchTheme = (p: Partial<ReportTheme>) => commit(blocks, { ...theme, ...p });

  // Click-to-place reorder. Native HTML5 drag does NOT work in Twenty's Remote
  // DOM sandbox — the `draggable` attribute isn't forwarded to the host DOM — so
  // a block is picked up via its ⠿ grip and dropped by clicking a "Move here"
  // slot (clicks DO forward). ↑/↓ remain as a fallback.
  const placeAt = (index: number) => {
    if (movingId === null) return;
    const from = blocks.findIndex((b) => b.id === movingId);
    setMovingId(null);
    if (from < 0) return;
    const target = from < index ? index - 1 : index;
    if (target !== from) move(from, target);
  };

  // Cancel a pending move with Escape (best-effort in the sandbox).
  useEffect(() => {
    if (!movingId) return;
    const doc: any = (globalThis as any)?.document;
    const onKey = (e: any) => { if (e?.key === 'Escape') setMovingId(null); };
    doc?.addEventListener?.('keydown', onKey);
    return () => doc?.removeEventListener?.('keydown', onKey);
  }, [movingId]);


  // Switch the report's data source (Twenty object). Re-seeds a clean base spec
  // on the chosen object; the user then refines it by chatting with the assistant.
  const switchDataSource = async (object: string, label: string) => {
    if (!object || object === currentObject) return;
    setBusy('Switching data source…');
    try {
      const r = await callFn(ROUTE_GENERATE_SPEC, { object, reportId, prompt: `count of ${label}` });
      if (r?.ok === false) throw new Error(r.error);
      enqueueSnackbar({ message: `Data source set to ${label}`, variant: 'success' });
      await load({ forceBlocks: true });
      await runPreview(true);
    } catch (e: any) {
      enqueueSnackbar({ message: `Could not switch data source: ${e?.message ?? e}`, variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  // A brand-new (blank) report — created by Twenty's native "New" button on the
  // Reports list — has neither a spec nor any layout blocks. Instead of dropping
  // the user onto an empty canvas, the builder shows a template picker so EVERY
  // entry point (the command-menu "Create report" and the native New button)
  // converges on the same "pick a template" flow.
  const isBlank = !report?.spec && blocks.length === 0;

  // Apply a template to THIS existing record: seed its spec from the template's
  // starter prompt (persisted server-side via generate-report-spec), then apply
  // the template's curated block layout + theme locally (auto-saved), overwriting
  // the default layout the seed produced.
  const applyTemplate = async (tpl: ReportTemplate) => {
    setBusy(`Applying “${tpl.name}”…`);
    try {
      const r = await callFn(ROUTE_GENERATE_SPEC, { reportId, object: tpl.object, prompt: tpl.prompt });
      if (r?.ok === false) throw new Error(r.error);
      commit(
        // Regenerate every block id — templates ship with baked-in ids, so
        // copying them verbatim would collide across two reports built from the
        // same template (and with same-template blocks inserted later).
        tpl.layout.blocks.map((pb) => ({ ...pb, id: `${pb.type}-${rid()}` })),
        { ...DEFAULT_THEME, ...tpl.layout.theme },
      );
      // Refresh the record's spec/name; dirtyRef is true after commit(), so
      // load() keeps our just-applied template blocks rather than clobbering them.
      await load({ forceBlocks: false });
      await runPreview(true);
      enqueueSnackbar({ message: `Applied “${tpl.name}”`, variant: 'success' });
    } catch (e: any) {
      enqueueSnackbar({ message: `Could not apply template: ${e?.message ?? e}`, variant: 'error' });
    } finally {
      setBusy(null);
    }
  };


  const runPreview = async (silent = false) => {
    if (!silent) setBusy('Loading live data…');
    try {
      // When scoping is on and a specific recipient is chosen, preview their own view.
      const previewAsMemberId = report?.scopePerRecipient && previewAsId ? previewAsId : undefined;
      const r = await callFn(ROUTE_RUN_REPORT, { reportId, mode: 'preview', previewAsMemberId });
      if (r?.ok === false) throw new Error(r.error);
      setData({ result: r.result as ReportResult, narrative: r.narrative, specEnglish: r.specEnglish ?? report?.specEnglish ?? '', chartImageUrl: r.chartImageUrl, comparison: r.comparison, insight: r.insight });
    } catch (e: any) {
      if (!silent) enqueueSnackbar({ message: `Preview failed: ${e?.message ?? e}`, variant: 'error' });
    } finally {
      if (!silent) setBusy(null);
    }
  };

  const sendNow = async () => {
    setBusy('Sending…');
    try {
      const r = await callFn(ROUTE_RUN_REPORT, { reportId, mode: 'send' });
      if (r?.ok === false) throw new Error(r.error);
      const msg =
        r.status === 'SUCCESS'
          ? `Sent to ${r.recipientCount} subscriber(s)`
          : r.status === 'SKIPPED'
            ? `Skipped: ${r.error ?? 'no subscribers / no email key'}`
            : `Status: ${r.status}`;
      enqueueSnackbar({ message: msg, variant: r.status === 'SUCCESS' ? 'success' : 'info' });
    } catch (e: any) {
      enqueueSnackbar({ message: `Send failed: ${e?.message ?? e}`, variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const saveSchedule = async (dataPatch: Record<string, unknown>, activating: boolean) => {
    if (!reportId) return;
    const timingChanged =
      'frequency' in dataPatch || 'sendHour' in dataPatch || 'sendDayOfWeek' in dataPatch || 'sendDayOfMonth' in dataPatch;
    const resetNext = activating || (report?.status === 'ACTIVE' && timingChanged);
    // On activation or a timing change, recompute the FIRST real slot (never null) —
    // isDue(null) is false, and a null previously made the dispatcher blast the
    // report immediately, ignoring the chosen day/hour.
    let nextPatch: Record<string, unknown> = {};
    if (resetNext) {
      const pick = <K extends keyof ReportRecord>(k: K, def: any) =>
        (k in dataPatch ? (dataPatch as any)[k] : report?.[k]) ?? def;
      const next = computeNextRunAt(
        pick('frequency', 'WEEKLY') as string,
        pick('sendHour', 8) as number,
        new Date(),
        pick('sendDayOfWeek', null) as number | null,
        pick('sendDayOfMonth', null) as number | null,
      );
      nextPatch = { nextRunAt: next ? next.toISOString() : null };
    }
    setBusy('Saving…');
    try {
      await client.mutation({
        updateNorthpeakReport: { __args: { id: reportId, data: { ...dataPatch, ...nextPatch } as any }, id: true },
      } as any);
      await load();
      enqueueSnackbar({ message: 'Saved', variant: 'success' });
    } catch (e: any) {
      enqueueSnackbar({ message: `Save failed: ${e?.message ?? e}`, variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const addSub = async (memberId: string) => {
    if (!memberId || subs.some((s) => s.memberId === memberId)) return;
    setBusy('Adding…');
    try {
      await client.mutation({ createNorthpeakReportSubscription: { __args: { data: { reportId, memberId } }, id: true } } as any);
      await load();
    } catch (e: any) {
      enqueueSnackbar({ message: `Add failed: ${e?.message ?? e}`, variant: 'error' });
    } finally {
      setBusy(null);
    }
  };
  const removeSub = async (id: string) => {
    setBusy('Removing…');
    try {
      await client.mutation({ deleteNorthpeakReportSubscription: { __args: { id }, id: true } } as any);
      await load();
    } catch (e: any) {
      enqueueSnackbar({ message: `Remove failed: ${e?.message ?? e}`, variant: 'error' });
    } finally {
      setBusy(null);
    }
  };
  // Per-subscriber SELF|ALL (full report for a manager vs only-their-own).
  const setScopeMode = async (id: string, scopeMode: string) => {
    setBusy('Saving…');
    try {
      await client.mutation({ updateNorthpeakReportSubscription: { __args: { id, data: { scopeMode } }, id: true } } as any);
      await load();
    } catch (e: any) {
      enqueueSnackbar({ message: `Save failed: ${e?.message ?? e}`, variant: 'error' });
    } finally {
      setBusy(null);
    }
  };
  // Turn per-recipient scoping on/off. Enabling needs a scope field: reuse the
  // report's own field if set, otherwise auto-pick the first workspace-member
  // relation on the data source (same choice the AI assistant would make) so the
  // checkbox just works. Only if the object has no such field do we bail out.
  const setScopeEnabled = async (on: boolean) => {
    if (!reportId) return;
    setBusy('Saving…');
    try {
      const data: Record<string, unknown> = { scopePerRecipient: on };
      if (on && !report?.scopeFieldName) {
        const object = report?.spec?.object;
        if (!object) {
          enqueueSnackbar({ message: 'Add report data first — then you can scope it per recipient.', variant: 'info' });
          return;
        }
        const r = await callFn(ROUTE_LIST_SCOPE_FIELDS, { object });
        const field = r?.ok && Array.isArray(r.fields) ? r.fields[0] : undefined;
        if (!field) {
          enqueueSnackbar({ message: `“${currentSourceLabel || object}” has no member field to scope by (e.g. an owner). Turn it off, or pick a data source that has one.`, variant: 'info' });
          return;
        }
        data.scopeFieldName = field;
      }
      await client.mutation({ updateNorthpeakReport: { __args: { id: reportId, data: data as any }, id: true } } as any);
      await load();
    } catch (e: any) {
      enqueueSnackbar({ message: `Save failed: ${e?.message ?? e}`, variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  // --- AI assistant ----------------------------------------------------------
  // Persist the conversation to the record (best-effort) so it survives refresh.
  const persistChat = async (msgs: ChatTurn[]) => {
    if (!reportId) return;
    try {
      await client.mutation({ updateNorthpeakReport: { __args: { id: reportId, data: { chatHistory: msgs.slice(-50) as any } }, id: true } } as any);
    } catch {
      /* chat persistence is non-fatal */
    }
  };

  const sendAi = async () => {
    const text = aiInput.trim();
    if (!text || !reportId) return;
    const convo: ChatTurn[] = [...aiMessages, { role: 'user', content: text }];
    // The animated ThinkingIndicator in AiPanel covers the wait (driven by aiBusy),
    // so we don't push a static "Thinking…" bubble.
    setAiMessages(convo);
    setAiInput('');
    setComposerNonce((n) => n + 1);
    setAiBusy(true);
    try {
      const r = await callFn(ROUTE_ARRANGE_REPORT, {
        reportId,
        messages: convo.map(({ role, content }) => ({ role, content })),
        // Tag the selected canvas block so "this/it" resolves to it.
        selectedBlockId: selectedBlock?.id,
        selectedBlockType: selectedBlock?.type,
      });
      if (r?.ok === false) throw new Error(r.error);
      // On "ask" the model returns BOTH a preamble message and the actual
      // question — show both so the user sees what to answer (don't swallow the
      // question). On "apply" the message alone is the confirmation.
      const content =
        r.action === 'apply'
          ? r.message || 'Updated the report.'
          : [r.message, r.question].filter(Boolean).join('\n\n') || 'Could you tell me a bit more about what you want?';
      const applied: ChatTurn[] = [...convo, { role: 'assistant', content }];
      setAiMessages(applied);
      void persistChat(applied);
      if (r.action === 'apply') {
        await load({ forceBlocks: true });
        await runPreview(true);
        enqueueSnackbar({ message: 'AI updated the report', variant: 'success' });
      }
    } catch (e: any) {
      const failed: ChatTurn[] = [...convo, { role: 'assistant', content: `Sorry — ${e?.message ?? e}` }];
      setAiMessages(failed);
      void persistChat(failed);
    } finally {
      setAiBusy(false);
    }
  };

  if (!reportId) {
    return <div style={{ padding: 24, fontFamily: T.font, color: T.sub }}>Open a report to use the builder.</div>;
  }

  if (loading) {
    return <BuilderSkeleton T={T} />;
  }

  const canvasWidth = device === 'mobile' ? 375 : 600;

  return (
    <div style={{ position: 'relative', height: '100%', maxHeight: '100dvh', display: 'flex', flexDirection: 'column', background: T.bg, color: T.ink, fontFamily: T.font, minHeight: 520, overflow: 'hidden' }}>
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderBottom: `1px solid ${T.border}`, background: T.panel }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{report?.name ?? 'Report'}</div>
        <span style={{ fontSize: 11, color: T.sub }}>{saveState === 'saving' || dirty ? '⟳ Saving…' : 'Saved ✓'}</span>
        <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
          <IconBtn T={T} title="Undo" onClick={undo} disabled={!past.length}>↶</IconBtn>
          <IconBtn T={T} title="Redo" onClick={redo} disabled={!future.length}>↷</IconBtn>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }} title="What this report is built over">
          <span style={{ fontSize: 12, color: T.sub }}>Data source</span>
          <select
            // On a blank report this is the single data-source control: it only
            // filters the template picker (setStarterObject). Once the report has
            // a spec, changing it re-seeds via switchDataSource.
            value={isBlank ? starterObject : currentObject}
            disabled={!!busy}
            onChange={(e) => {
              const o = dataSources.find((s) => s.nameSingular === e.target.value);
              if (!o) return;
              if (isBlank) setStarterObject(o.nameSingular);
              else switchDataSource(o.nameSingular, o.labelPlural);
            }}
            style={{ ...inputStyle(T), width: 'auto', padding: '4px 8px', fontSize: 12 }}
          >
            {(dataSources.length ? dataSources : [{ nameSingular: isBlank ? starterObject : currentObject, labelPlural: currentSourceLabel || 'Data source' }]).map((o) => (
              <option key={o.nameSingular} value={o.nameSingular}>{o.labelPlural}</option>
            ))}
          </select>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ display: 'flex', border: `1px solid ${T.border}`, borderRadius: 8, overflow: 'hidden' }}>
            <button onClick={() => setDevice('desktop')} title="Desktop" style={segStyle(T, device === 'desktop')}>🖥</button>
            <button onClick={() => setDevice('mobile')} title="Mobile" style={segStyle(T, device === 'mobile')}>📱</button>
          </div>
          <IconBtn T={T} title="Show tour" onClick={() => setShowTour(true)}>?</IconBtn>
          <Btn T={T} kind="primary" onClick={() => runPreview()} disabled={!!busy}>Preview &amp; test</Btn>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* ── Left rail: Content / Style ──────────────────────────── */}
        <div style={{ width: 250, borderRight: `1px solid ${T.border}`, background: T.panel, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}` }}>
            <TabBtn T={T} active={leftTab === 'content'} onClick={() => setLeftTab('content')}>Content</TabBtn>
            <TabBtn T={T} active={leftTab === 'style'} onClick={() => setLeftTab('style')}>Style</TabBtn>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
            {leftTab === 'content' ? (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Blocks</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {BLOCK_PALETTE.map((p) => (
                    <div
                      key={p.type}
                      onClick={() => insertAt(p.type, blocks.length)}
                      title={`${p.hint} — click to add`}
                      style={paletteTile(T)}
                    >
                      {p.label}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: 'uppercase', letterSpacing: '.04em', margin: '14px 0 8px' }}>Sections</div>
                {SECTION_PRESETS.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => insertSection(s.id, blocks.length)}
                    title="Click to add this section"
                    style={{ ...paletteTile(T), marginBottom: 8, textAlign: 'left' }}
                  >
                    + {s.label}
                  </div>
                ))}
              </>
            ) : (
              <StylePanel T={T} theme={theme} patchTheme={patchTheme} />
            )}
          </div>
        </div>

        {/* ── Centre: WYSIWYG canvas ──────────────────────────────── */}
        {/* NB: no container-level "click to deselect" — Remote DOM does not reliably
            honour stopPropagation from the block handlers, so a container onClick
            would clear the selection the instant a block is clicked. Selection is
            changed by clicking another block or the "Deselect" button below. */}
        <div style={{ flex: 1, position: 'relative', minHeight: 0, display: 'flex' }}>
        <div style={{ flex: 1, overflow: 'auto', background: T.canvasBg, padding: '24px 0', minHeight: 0, opacity: aiBusy ? 0.55 : 1 }}>
          {movingId ? (
            <div style={{ width: canvasWidth, maxWidth: '100%', margin: '0 auto 12px', display: 'flex', alignItems: 'center', gap: 8, background: T.accentBg, border: `1px solid ${T.accent}`, color: T.accent, borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 600 }}>
              Moving a block — click a “▸ Move here ◂” slot to drop it.
              <button onClick={() => setMovingId(null)} style={{ marginLeft: 'auto', border: `1px solid ${T.accent}`, background: 'transparent', color: T.accent, borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
            </div>
          ) : null}
          <div style={{ width: canvasWidth, maxWidth: '100%', margin: '0 auto', background: tokens.card, border: `1px solid ${tokens.border}`, borderRadius: 12, overflow: 'hidden', fontFamily: tokens.font }}>
            <DropZone T={T} active={!!movingId} onClick={() => placeAt(0)} />
            {isBlank ? (
              <TemplateGallery
                objects={dataSources}
                dataSource={starterObject}
                setDataSource={setStarterObject}
                busy={busy}
                showVisibility={false}
                showDataSource={false}
                showScratch={false}
                title="Start your report"
                subtitle="Pick a template — or describe it with the ✨ AI assistant on the right."
                onUse={(tpl) => applyTemplate(tpl)}
                onScratch={() => {}}
              />
            ) : blocks.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: tokens.sub, fontSize: 13 }}>
                Add blocks from the left rail, or ask the AI assistant to build the email.
              </div>
            ) : (
              blocks.map((b, i) => (
                <div key={b.id}>
                  <div
                    onClick={() => {
                      // A toolbar click may have bubbled here (sandbox quirk) — if so,
                      // the handler already did the right thing; don't re-select.
                      if (suppressSelectRef.current) { suppressSelectRef.current = false; return; }
                      setSelectedId(b.id);
                      setRightTab('block');
                    }}
                    title={movingId === b.id ? 'Moving — click a "Move here" slot' : 'Click to edit'}
                    style={{ position: 'relative', outline: movingId === b.id ? `2px dashed ${T.accent}` : selectedId === b.id ? `2px solid ${T.accent}` : 'none', outlineOffset: -2, cursor: 'pointer', opacity: movingId === b.id ? 0.5 : 1 }}
                  >
                    {/* move grip — pick the block up, then click a slot to drop it */}
                    <button
                      onClick={() => { suppressSelectRef.current = true; setSelectedId(b.id); setMovingId(movingId === b.id ? null : b.id); }}
                      title="Move this block"
                      style={{ position: 'absolute', top: 4, left: 4, zIndex: 2, fontSize: 11, fontWeight: 600, cursor: 'pointer', color: movingId === b.id ? '#fff' : T.sub, background: movingId === b.id ? T.accent : T.panel, border: `1px solid ${movingId === b.id ? T.accent : T.border}`, borderRadius: 6, padding: '2px 7px', lineHeight: '16px' }}
                    >
                      ⠿ {movingId === b.id ? 'Moving…' : 'Move'}
                    </button>
                    {selectedId === b.id ? (
                      <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4, zIndex: 2 }}>
                        <IconBtn T={T} title="Move up" onClick={() => { suppressSelectRef.current = true; move(i, i - 1); }}>↑</IconBtn>
                        <IconBtn T={T} title="Move down" onClick={() => { suppressSelectRef.current = true; move(i, i + 1); }}>↓</IconBtn>
                        <IconBtn T={T} title="Delete" onClick={() => { suppressSelectRef.current = true; remove(b.id); }}>✕</IconBtn>
                      </div>
                    ) : null}
                    <BlockView block={b} T={tokens} data={data} />
                  </div>
                  <DropZone T={T} active={!!movingId} onClick={() => placeAt(i + 1)} />
                </div>
              ))
            )}
          </div>
        </div>
          {aiBusy ? (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,15,20,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 999, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: T.ink }}>
                <span style={{ fontSize: 15 }}>✨</span> Updating your report…
              </div>
            </div>
          ) : null}
        </div>

        {/* ── Right: AI / Block / Setup ───────────────────────────── */}
        <div style={{ width: 340, borderLeft: `1px solid ${T.border}`, background: T.panel, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}` }}>
            <TabBtn T={T} active={rightTab === 'ai'} onClick={() => setRightTab('ai')}>✨ AI</TabBtn>
            <TabBtn T={T} active={rightTab === 'block'} onClick={() => setRightTab('block')}>Block</TabBtn>
            <TabBtn T={T} active={rightTab === 'setup'} onClick={() => setRightTab('setup')}>Setup</TabBtn>
          </div>
          <div style={{ flex: 1, overflow: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {rightTab === 'ai' ? (
              <AiPanel
                T={T}
                messages={aiMessages}
                input={aiInput}
                setInput={setAiInput}
                composerNonce={composerNonce}
                onSend={sendAi}
                busy={aiBusy}
                selectedTag={selectedBlock ? { label: BLOCK_PALETTE.find((p) => p.type === selectedBlock.type)?.label ?? selectedBlock.type } : null}
                onClearTag={() => setSelectedId(null)}
              />
            ) : rightTab === 'block' ? (
              <div style={{ padding: 14 }}>
                {selectedBlock ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                      <button onClick={() => setRightTab('ai')} style={{ border: `1px solid ${T.border}`, background: T.panel, color: T.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 8, padding: '4px 10px' }}>✨ Ask AI about this</button>
                      <button onClick={() => setSelectedId(null)} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: T.sub, fontSize: 12, cursor: 'pointer' }}>Deselect ✕</button>
                    </div>
                    <BlockEditor block={selectedBlock} T={T} aliases={aliases} patch={patch} />
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: T.sub }}>Click a block on the canvas to edit it here.</div>
                )}
              </div>
            ) : (
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Panel T={T} title="Data source">
                  <div style={{ fontSize: 13, color: T.ink }}>Reporting on <b>{currentSourceLabel || '—'}</b>.</div>
                  {report?.specEnglish ? <div style={{ marginTop: 8, fontSize: 12, color: T.sub }}><b style={{ color: T.ink }}>Interpreted as:</b> {report.specEnglish}</div> : null}
                  <div style={{ marginTop: 10, fontSize: 12, color: T.sub }}>Change the data source in the top bar, or ask the <b>✨ AI</b> assistant to change what's measured.</div>
                </Panel>

                <Panel T={T} title="Preview & send">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn T={T} onClick={() => runPreview()} disabled={!!busy}>Refresh data</Btn>
                    <Btn T={T} onClick={sendNow} disabled={!!busy} kind="primary">Send now</Btn>
                  </div>
                  {report?.scopePerRecipient && subs.length ? (
                    <div style={{ marginTop: 10 }}>
                      <Row label="Preview as" T={T}>
                        <select value={previewAsId} disabled={!!busy} onChange={(e) => setPreviewAsId(e.target.value)} style={inputStyle(T)}>
                          <option value="">Full report</option>
                          {subs.map((s) => <option key={s.id} value={s.memberId}>{s.label}</option>)}
                        </select>
                      </Row>
                      <Btn T={T} onClick={() => runPreview()} disabled={!!busy}>Preview this view</Btn>
                    </div>
                  ) : null}
                  {data.result ? (
                    <div style={{ marginTop: 10, fontSize: 12, color: T.sub }}>{data.result.matchedCount} records · {data.result.rows.length} groups · data as of {new Date(data.result.dataAsOf).toUTCString()}</div>
                  ) : null}
                </Panel>

                <Panel T={T} title="Schedule">
                  <Row label="Frequency" T={T}>
                    <select value={report?.frequency ?? 'WEEKLY'} disabled={!!busy} onChange={(e) => saveSchedule({ frequency: e.target.value }, false)} style={inputStyle(T)}>
                      {['MANUAL', 'DAILY', 'WEEKLY', 'MONTHLY'].map((f) => <option key={f} value={f}>{f[0] + f.slice(1).toLowerCase()}</option>)}
                    </select>
                  </Row>
                  {(report?.frequency ?? 'WEEKLY') === 'WEEKLY' ? (
                    <Row label="Send day" T={T}>
                      <select
                        value={report?.sendDayOfWeek ?? ''}
                        disabled={!!busy}
                        onChange={(e) => saveSchedule({ sendDayOfWeek: e.target.value === '' ? null : Number(e.target.value) }, false)}
                        style={inputStyle(T)}
                      >
                        <option value="">Day activated (auto)</option>
                        {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
                          <option key={d} value={i}>{d}</option>
                        ))}
                      </select>
                    </Row>
                  ) : null}
                  {(report?.frequency ?? 'WEEKLY') === 'MONTHLY' ? (
                    <Row label="Send day" T={T}>
                      <select
                        value={report?.sendDayOfMonth ?? ''}
                        disabled={!!busy}
                        onChange={(e) => saveSchedule({ sendDayOfMonth: e.target.value === '' ? null : Number(e.target.value) }, false)}
                        style={inputStyle(T)}
                      >
                        <option value="">Day activated (auto)</option>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d}>{d}{d > 28 ? ' (clamped in short months)' : ''}</option>
                        ))}
                      </select>
                    </Row>
                  ) : null}
                  <Row label="Send hour (UTC)" T={T}>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={sendHourInput}
                      disabled={!!busy}
                      onChange={(e) => setSendHourInput(e.target.value)}
                      onBlur={() => {
                        if (sendHourInput.trim() === '') { setSendHourInput(String(report?.sendHour ?? 8)); return; }
                        const h = Math.min(23, Math.max(0, Math.floor(Number(sendHourInput))));
                        if (!Number.isFinite(h)) { setSendHourInput(String(report?.sendHour ?? 8)); return; }
                        setSendHourInput(String(h));
                        if (h !== (report?.sendHour ?? 8)) saveSchedule({ sendHour: h }, false);
                      }}
                      style={inputStyle(T)}
                    />
                  </Row>
                  <Row label="Visibility" T={T}>
                    <select value={report?.visibility ?? 'PRIVATE'} disabled={!!busy} onChange={(e) => saveSchedule({ visibility: e.target.value }, false)} style={inputStyle(T)}>
                      <option value="PRIVATE">Private</option>
                      <option value="WORKSPACE">Workspace</option>
                    </select>
                  </Row>
                  <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                    {report?.status === 'ACTIVE' ? (
                      <Btn T={T} onClick={() => saveSchedule({ status: 'PAUSED' }, false)} disabled={!!busy}>Pause</Btn>
                    ) : (
                      <Btn T={T} kind="primary" onClick={() => saveSchedule({ status: 'ACTIVE' }, true)} disabled={!!busy}>Activate</Btn>
                    )}
                    <span style={{ fontSize: 12, color: T.sub }}>Status: {report?.status ?? 'DRAFT'}</span>
                  </div>
                </Panel>

                <Panel T={T} title="Recipients & personalization">
                  {/* Awareness note — who receives this and whether numbers are shared or scoped */}
                  <div style={{ fontSize: 12, color: T.sub, background: T.accentBg, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 10px', marginBottom: 10, lineHeight: 1.5 }}>
                    {report?.scopePerRecipient ? (
                      <>🔒 Each recipient sees <b style={{ color: T.ink }}>only their own</b> data{report?.scopeFieldName ? <> (matched by <b style={{ color: T.ink }}>{report.scopeFieldName}</b>)</> : null}. Recipients set to <b style={{ color: T.ink }}>Full report</b> get everything. Empty recipients are skipped.</>
                    ) : subs.length > 1 ? (
                      <>👥 All <b style={{ color: T.ink }}>{subs.length}</b> recipients receive the <b style={{ color: T.ink }}>same numbers</b>. To send each person only their own rows, turn on scoping below (or ask the ✨ AI).</>
                    ) : (
                      <>This report is sent as a single shared email.</>
                    )}
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13, color: T.ink }}>
                    <input type="checkbox" checked={!!report?.scopePerRecipient} disabled={!!busy} onChange={(e) => setScopeEnabled(e.target.checked)} />
                    Scope per recipient (each sees only their own data)
                  </label>

                  {subs.length === 0 ? <div style={{ fontSize: 12, color: T.sub }}>No subscribers yet.</div> : null}
                  {subs.map((s) => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                      <span style={{ fontSize: 13, flex: 1 }}>{s.label}</span>
                      {report?.scopePerRecipient ? (
                        <select value={s.scopeMode} disabled={!!busy} onChange={(e) => setScopeMode(s.id, e.target.value)} style={{ ...inputStyle(T), width: 130 }}>
                          <option value="SELF">Only their own</option>
                          <option value="ALL">Full report</option>
                        </select>
                      ) : null}
                      <IconBtn T={T} onClick={() => removeSub(s.id)} title="Remove">✕</IconBtn>
                    </div>
                  ))}
                  <select value="" disabled={!!busy} onChange={(e) => addSub(e.target.value)} style={{ ...inputStyle(T), marginTop: 8 }}>
                    <option value="">+ Add a member…</option>
                    {members.filter((m) => !subs.some((s) => s.memberId === m.id)).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </Panel>
              </div>
            )}
          </div>
        </div>
      </div>

      {busy ? <div style={{ position: 'absolute', bottom: 8, left: 14, fontSize: 12, color: T.sub, background: T.panel, padding: '4px 10px', borderRadius: 8, border: `1px solid ${T.border}` }}>{busy}</div> : null}
      {showTour ? <OnboardingTour T={T} onClose={dismissTour} /> : null}
    </div>
  );
};

// --- drop zone between blocks ------------------------------------------------
// Loading skeleton so a refresh doesn't flash empty→full. One shared pulse (JS
// timer — Remote DOM strips CSS keyframes) drives the greyed placeholders.
const BuilderSkeleton = ({ T }: { T: UITheme }) => {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setOn((v) => !v), 700);
    return () => clearInterval(t);
  }, []);
  const box = (w: number | string, h: number, extra: any = {}) => (
    <div style={{ width: w, height: h, borderRadius: 6, background: T.panel2, opacity: on ? 0.9 : 0.45, transition: 'opacity .5s', ...extra }} />
  );
  return (
    <div style={{ height: '100%', maxHeight: '100dvh', minHeight: 520, display: 'flex', flexDirection: 'column', background: T.bg, fontFamily: T.font, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderBottom: `1px solid ${T.border}`, background: T.panel }}>
        {box(140, 16)}
        {box(70, 12)}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>{box(120, 26)}</div>
      </div>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ width: 250, borderRight: `1px solid ${T.border}`, background: T.panel, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {box('60%', 10)}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {Array.from({ length: 6 }).map((_, i) => <div key={i}>{box('100%', 40)}</div>)}
          </div>
        </div>
        <div style={{ flex: 1, background: T.canvasBg, padding: '24px 0', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 600, maxWidth: '90%', height: 'fit-content', background: T.panel, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {box('50%', 22)}
            <div style={{ display: 'flex', gap: 8 }}>{box('100%', 60)}{box('100%', 60)}</div>
            {box('100%', 120)}
            {box('100%', 80)}
          </div>
        </div>
        <div style={{ width: 340, borderLeft: `1px solid ${T.border}`, background: T.panel, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {box('40%', 12)}
          {box('80%', 30)}
          {box('60%', 30, { alignSelf: 'flex-end' })}
          {box('75%', 30)}
        </div>
      </div>
    </div>
  );
};

// A slot between blocks. Idle: a thin spacer. When a block is "picked up"
// (`active`), it becomes a big, obvious clickable "Move here" target — clicks are
// the only reliable pointer interaction in Twenty's Remote DOM sandbox (native
// drag events never fire because `draggable` isn't forwarded to the host DOM).
const DropZone = ({ T, active, onClick }: { T: UITheme; active?: boolean; onClick?: () => void }) => {
  if (!active) return <div style={{ height: 8 }} />;
  return (
    <div onClick={onClick} title="Move the block here" style={{ padding: '5px 12px', cursor: 'pointer' }}>
      <div style={{ background: T.accentBg, color: T.accent, border: `1px dashed ${T.accent}`, borderRadius: 6, padding: '5px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        ▸ Move here ◂
      </div>
    </div>
  );
};

// --- style panel -------------------------------------------------------------
const StylePanel = ({ T, theme, patchTheme }: { T: UITheme; theme: ReportTheme; patchTheme: (p: Partial<ReportTheme>) => void }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div>
      <div style={{ fontSize: 12, color: T.sub, fontWeight: 600, marginBottom: 6 }}>Accent colour</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {ACCENT_SWATCHES.map((c) => (
          <button key={c} onClick={() => patchTheme({ accent: c })} title={c} style={{ width: 26, height: 26, borderRadius: 999, background: c, border: theme.accent === c ? `2px solid ${T.ink}` : `1px solid ${T.border}`, cursor: 'pointer' }} />
        ))}
      </div>
      <input value={theme.accent ?? ''} onChange={(e) => patchTheme({ accent: e.target.value })} placeholder="#3e63dd" style={{ ...inputStyle(T), marginTop: 8 }} />
    </div>
    <div>
      <div style={{ fontSize: 12, color: T.sub, fontWeight: 600, marginBottom: 6 }}>Font</div>
      <select value={theme.font ?? 'sans'} onChange={(e) => patchTheme({ font: e.target.value as ThemeFont })} style={inputStyle(T)}>
        <option value="sans">Sans-serif</option>
        <option value="serif">Serif</option>
        <option value="mono">Monospace</option>
      </select>
    </div>
    <div>
      <div style={{ fontSize: 12, color: T.sub, fontWeight: 600, marginBottom: 6 }}>Mode</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => patchTheme({ mode: 'light' })} style={segStyle(T, (theme.mode ?? 'light') === 'light')}>Light</button>
        <button onClick={() => patchTheme({ mode: 'dark' })} style={segStyle(T, theme.mode === 'dark')}>Dark</button>
      </div>
    </div>
    <div>
      <div style={{ fontSize: 12, color: T.sub, fontWeight: 600, marginBottom: 6 }}>Logo URL</div>
      <input value={theme.logoUrl ?? ''} onChange={(e) => patchTheme({ logoUrl: e.target.value })} placeholder="https://…/logo.png" style={inputStyle(T)} />
    </div>
  </div>
);

// --- selected block editor ---------------------------------------------------
const AlignRow = ({ T, block, patch }: { T: UITheme; block: Block; patch: (id: string, p: Partial<Block>) => void }) => (
  <Row label="Align" T={T}>
    <select value={block.align ?? 'left'} onChange={(e) => patch(block.id, { align: e.target.value as any })} style={inputStyle(T)}>
      <option value="left">Left</option>
      <option value="center">Center</option>
      <option value="right">Right</option>
    </select>
  </Row>
);

const BlockEditor = ({ block: b, T, aliases, patch }: { block: Block; T: UITheme; aliases: string[]; patch: (id: string, p: Partial<Block>) => void }) => {
  const label = BLOCK_PALETTE.find((p) => p.type === b.type)?.label ?? b.type;
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{label}</div>
      {b.type === 'header' ? (
        <>
          <input value={b.title ?? ''} onChange={(e) => patch(b.id, { title: e.target.value })} placeholder="Title" style={{ ...inputStyle(T), marginBottom: 8 }} />
          <input value={b.subtitle ?? ''} onChange={(e) => patch(b.id, { subtitle: e.target.value })} placeholder="Subtitle" style={{ ...inputStyle(T), marginBottom: 8 }} />
          <AlignRow T={T} block={b} patch={patch} />
        </>
      ) : null}
      {b.type === 'text' ? (
        <>
          <textarea value={b.markdown ?? ''} onChange={(e) => patch(b.id, { markdown: e.target.value })} style={{ ...inputStyle(T), minHeight: 90, marginBottom: 8 }} />
          <AlignRow T={T} block={b} patch={patch} />
        </>
      ) : null}
      {b.type === 'chart' ? (
        <Row label="Chart type" T={T}>
          <select value={b.chartKind ?? 'bar'} onChange={(e) => patch(b.id, { chartKind: e.target.value as any })} style={inputStyle(T)}>
            <option value="bar">Bar</option>
            <option value="pie">Pie</option>
          </select>
        </Row>
      ) : null}
      {b.type === 'table' || b.type === 'barBreakdown' ? (
        <Row label="Max rows" T={T}>
          <input type="number" min={1} max={100} value={b.maxRows ?? 10} onChange={(e) => patch(b.id, { maxRows: Number(e.target.value) })} style={inputStyle(T)} />
        </Row>
      ) : null}
      {b.type === 'barBreakdown' && aliases.length ? (
        <Row label="Metric" T={T}>
          <select value={b.metricAlias ?? aliases[0]} onChange={(e) => patch(b.id, { metricAlias: e.target.value })} style={inputStyle(T)}>
            {aliases.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </Row>
      ) : null}
      {b.type === 'metricRow' && aliases.length ? (
        <div>
          <div style={{ fontSize: 12, color: T.sub, marginBottom: 6 }}>Metrics shown</div>
          {aliases.map((a) => {
            const shown = !b.metrics || b.metrics.includes(a);
            return (
              <label key={a} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '3px 0' }}>
                <input
                  type="checkbox"
                  checked={shown}
                  onChange={() => {
                    const base = b.metrics ?? aliases;
                    const next = shown ? base.filter((x) => x !== a) : [...base, a];
                    patch(b.id, { metrics: next });
                  }}
                />
                {a}
              </label>
            );
          })}
        </div>
      ) : null}
      {b.type === 'button' ? (
        <>
          <input value={b.buttonText ?? ''} onChange={(e) => patch(b.id, { buttonText: e.target.value })} placeholder="Button text" style={{ ...inputStyle(T), marginBottom: 8 }} />
          <input value={b.buttonUrl ?? ''} onChange={(e) => patch(b.id, { buttonUrl: e.target.value })} placeholder="https://…" style={{ ...inputStyle(T), marginBottom: 8 }} />
          <AlignRow T={T} block={b} patch={patch} />
        </>
      ) : null}
      {b.type === 'image' || b.type === 'logo' ? (
        <>
          <input value={b.imageUrl ?? ''} onChange={(e) => patch(b.id, { imageUrl: e.target.value })} placeholder="Image URL" style={{ ...inputStyle(T), marginBottom: 8 }} />
          <input value={b.linkUrl ?? ''} onChange={(e) => patch(b.id, { linkUrl: e.target.value })} placeholder="Link URL (optional)" style={{ ...inputStyle(T), marginBottom: 8 }} />
          <AlignRow T={T} block={b} patch={patch} />
        </>
      ) : null}
      {b.type === 'spacer' ? (
        <Row label="Height (px)" T={T}>
          <input type="number" min={4} max={120} value={b.height ?? 24} onChange={(e) => patch(b.id, { height: Number(e.target.value) })} style={inputStyle(T)} />
        </Row>
      ) : null}
      {['specEcho', 'narrative', 'insights', 'divider'].includes(b.type) ? (
        <div style={{ fontSize: 12, color: T.sub }}>This block renders automatically from the report data — no settings.</div>
      ) : null}
    </div>
  );
};

// --- tab + segmented button styles ------------------------------------------
const TabBtn = ({ T, active, onClick, children }: any) => (
  <button
    onClick={onClick}
    style={{
      flex: 1,
      padding: '8px 8px',
      fontSize: 12,
      fontWeight: 700,
      border: 'none',
      borderBottom: `2px solid ${active ? T.accent : 'transparent'}`,
      background: 'transparent',
      color: active ? T.ink : T.sub,
      cursor: 'pointer',
    }}
  >
    {children}
  </button>
);

const segStyle = (T: UITheme, active: boolean) => ({
  padding: '6px 12px',
  fontSize: 13,
  border: 'none',
  background: active ? T.accent : T.panel,
  color: active ? '#fff' : T.sub,
  cursor: 'pointer',
});

const paletteTile = (T: UITheme) => ({
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  padding: '12px 8px',
  fontSize: 12,
  fontWeight: 600,
  color: T.ink,
  background: T.panel2,
  cursor: 'grab',
  textAlign: 'center' as const,
  userSelect: 'none' as const,
});

export default defineFrontComponent({
  universalIdentifier: REPORT_BUILDER_FC_ID,
  name: 'Report Builder',
  description: 'Brevo-style WYSIWYG email/report builder with live preview, an AI assistant, per-report theme, schedule and subscribers.',
  component: ReportBuilder,
});
