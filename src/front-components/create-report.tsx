import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineFrontComponent } from 'twenty-sdk/define';
import { enqueueSnackbar, navigate, useUserId } from 'twenty-sdk/front-component';
import { useEffect, useState } from 'react';

import { CREATE_REPORT_FC_ID, ROUTE_CREATE_REPORT, ROUTE_LIST_OBJECTS } from 'src/constants/universal-identifiers';
import { TemplateGallery } from './builder/template-gallery';

// Absolute base URL for HTTP logic functions: TWENTY_FUNCTIONS_URL (Twenty Cloud)
// or the self-hosting `/s` route under TWENTY_API_URL. A Web Worker fetch()
// cannot resolve a relative path.
const fnUrl = () => {
  const fn = process.env.TWENTY_FUNCTIONS_URL;
  if (fn) return fn.replace(/\/+$/, '');
  const api = process.env.TWENTY_API_URL;
  return api ? `${api.replace(/\/+$/, '')}/s` : '';
};

// Resolve the current user's workspace member id so new reports are owned by
// their creator (private-by-default ownership).
async function currentMemberId(userId: string | null): Promise<string | undefined> {
  if (!userId) return undefined;
  try {
    const res: any = await new CoreApiClient().query({
      workspaceMembers: { __args: { filter: { userId: { eq: userId } }, first: 1 }, edges: { node: { id: true } } },
    } as any);
    return res?.workspaceMembers?.edges?.[0]?.node?.id;
  } catch {
    return undefined;
  }
}

// Command-menu quick action: pick a report template (or start from scratch) →
// the LLM interprets the starter prompt, a Report record is created with the
// template's layout + theme, and we jump straight into the builder. The gallery
// UI itself is the shared TemplateGallery — the same panel the record-page
// builder shows for a blank report.
const CreateReport = () => {
  const [busy, setBusy] = useState<string | null>(null);
  const [objects, setObjects] = useState<Array<{ nameSingular: string; labelPlural: string }>>([]);
  const [dataSource, setDataSource] = useState('opportunity');
  const userId = useUserId();

  // Load the workspace's reportable objects (the "data sources").
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${fnUrl()}${ROUTE_LIST_OBJECTS}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.TWENTY_APP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
          body: '{}',
        });
        const data = await res.json();
        if (data?.ok && Array.isArray(data.objects) && data.objects.length) {
          setObjects(data.objects);
          if (!data.objects.some((o: any) => o.nameSingular === 'opportunity')) setDataSource(data.objects[0].nameSingular);
        }
      } catch {
        /* picker keeps its default; templates still work */
      }
    })();
  }, []);

  const create = async (body: Record<string, unknown>, label: string) => {
    setBusy(label);
    try {
      const ownerId = await currentMemberId(userId);
      const res = await fetch(`${fnUrl()}${ROUTE_CREATE_REPORT}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.TWENTY_APP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId, object: dataSource, ...body }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Request failed (${res.status}): ${text.slice(0, 200)}`);
      }
      const data = await res.json();
      if (data?.ok === false || !data?.reportId) throw new Error(data?.error ?? 'Could not create the report.');
      await enqueueSnackbar({ message: `Created “${data.name}” (${data.engine === 'llm' ? 'AI' : 'fallback'})`, variant: 'success' });
      await navigate(`/object/northpeakReport/${data.reportId}`);
    } catch (e: any) {
      await enqueueSnackbar({ message: `Failed: ${e?.message ?? e}`, variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <TemplateGallery
      objects={objects}
      dataSource={dataSource}
      setDataSource={setDataSource}
      busy={busy}
      showVisibility
      onUse={(tpl, visibility) => create({ templateId: tpl.id, visibility }, `Creating “${tpl.name}”…`)}
      onScratch={(prompt, visibility) => create({ prompt, visibility }, 'Creating…')}
    />
  );
};

export default defineFrontComponent({
  universalIdentifier: CREATE_REPORT_FC_ID,
  name: 'Create Report',
  description: 'Create a report from a template or a plain-language prompt.',
  component: CreateReport,
});
