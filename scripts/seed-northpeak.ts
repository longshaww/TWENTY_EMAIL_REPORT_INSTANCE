/**
 * Seed the local Twenty workspace with a fictional NorthPeak B2B SaaS scenario:
 * companies, people, opportunities (rich reporting dimensions) and an
 * activity timeline of tasks + notes.
 *
 * Run:
 *   TWENTY_API_URL=http://localhost:2020 TWENTY_API_KEY=<dev-jwt> \
 *     node scripts/seed-northpeak.ts
 *
 * Idempotency: every seeded record's name is prefixed with "NP·". Re-running
 * skips creation if seeded companies already exist (pass FORCE=1 to add more).
 */
import { CoreApiClient } from 'twenty-client-sdk/core';

const PREFIX = 'NP·';
const API_URL = process.env.TWENTY_API_URL ?? 'http://localhost:2020';
const API_KEY = process.env.TWENTY_API_KEY;

if (!API_KEY) {
  console.error('Set TWENTY_API_KEY (dev JWT) and TWENTY_API_URL.');
  process.exit(1);
}

const client = new CoreApiClient({
  url: `${API_URL}/graphql`,
  headers: { Authorization: `Bearer ${API_KEY}` },
});

// --- deterministic PRNG so re-seeds are reproducible ------------------------
let _seed = 1234567;
const rand = () => {
  _seed = (_seed * 1103515245 + 12345) & 0x7fffffff;
  return _seed / 0x7fffffff;
};
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const jitter = (base: number, pct: number) => Math.round(base * (1 + (rand() - 0.5) * 2 * pct));

// The Twenty API rate-limits to ~100 requests / 60s. Throttle every call so a
// full seed stays comfortably under the ceiling.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let _lastCall = 0;
async function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const gap = 680;
  const wait = _lastCall + gap - Date.now();
  if (wait > 0) await sleep(wait);
  _lastCall = Date.now();
  return fn();
}

// Route every SDK call through the throttle without touching call sites.
const _rawMutation = client.mutation.bind(client);
const _rawQuery = client.query.bind(client);
(client as any).mutation = (arg: any) => throttled(() => _rawMutation(arg));
(client as any).query = (arg: any) => throttled(() => _rawQuery(arg));

// --- reporting dimensions (mirror src/constants/northpeak-dimensions.ts) -----
// Each seeded company hardcodes its own industry/region; opportunities draw from
// these pools so reports have varied dimensions to group by.
const LEAD_SOURCES = ['INBOUND', 'OUTBOUND', 'PARTNER', 'EVENT', 'REFERRAL'];
const TIERS = ['STARTER', 'GROWTH', 'PRO', 'ENTERPRISE', 'PLATFORM'];
const STAGES = ['NEW', 'SCREENING', 'MEETING', 'PROPOSAL', 'CUSTOMER'];
const TIER_BASE: Record<string, number> = {
  STARTER: 6000,
  GROWTH: 18000,
  PRO: 45000,
  ENTERPRISE: 95000,
  PLATFORM: 190000,
};

const COMPANIES = [
  { name: 'Helvetica Health', industry: 'HEALTHCARE', region: 'EMEA', domain: 'helvetica.health' },
  { name: 'Orbit Fintech', industry: 'FINTECH', region: 'NORTH_AMERICA', domain: 'orbitfin.io' },
  { name: 'Cedar Manufacturing', industry: 'MANUFACTURING', region: 'NORTH_AMERICA', domain: 'cedarmfg.com' },
  { name: 'BrightLearn EDU', industry: 'EDUCATION', region: 'APAC', domain: 'brightlearn.edu' },
  { name: 'Northwind Retail', industry: 'RETAIL', region: 'EMEA', domain: 'northwind.shop' },
  { name: 'Vertex SaaS', industry: 'SAAS', region: 'NORTH_AMERICA', domain: 'vertexsaas.com' },
  { name: 'Summit Analytics', industry: 'SAAS', region: 'APAC', domain: 'summit.ai' },
  { name: 'Harbor Logistics', industry: 'MANUFACTURING', region: 'LATAM', domain: 'harborlog.mx' },
];

const FIRST = ['Ava', 'Liam', 'Noah', 'Emma', 'Mia', 'Lucas', 'Sofia', 'Ethan', 'Isla', 'Kai', 'Nora', 'Leo', 'Zoe', 'Omar', 'Ivy', 'Ravi'];
const LAST = ['Reed', 'Kwon', 'Silva', 'Bauer', 'Osei', 'Marsh', 'Duval', 'Iqbal', 'Nyman', 'Costa'];
const TITLES = ['VP Sales', 'Head of Enablement', 'RevOps Manager', 'CRO', 'L&D Director', 'Sales Ops Lead'];

const NOTE_TITLES = [
  'Discovery call — pain points & goals',
  'Security review requested',
  'Pricing negotiation notes',
  'Champion intro to economic buyer',
  'Onboarding plan draft',
  'Competitive displacement (incumbent LMS)',
];
const TASK_TITLES = [
  'Send follow-up deck',
  'Schedule technical demo',
  'Share ROI calculator',
  'Draft proposal',
  'Confirm procurement contact',
  'Book QBR',
];
const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'];

const now = new Date();
const dayMs = 86400000;
const isoOffsetDays = (d: number) => new Date(now.getTime() + d * dayMs).toISOString();

type Member = { id: string };

async function fetchReps(): Promise<Member[]> {
  const res = await client.query({
    workspaceMembers: {
      __args: { first: 8 },
      edges: { node: { id: true } },
    },
  } as any);
  const members: Member[] = (res as any).workspaceMembers.edges.map((e: any) => ({ id: e.node.id }));
  return members.length ? members : [];
}

async function seededCompanyNames(): Promise<Set<string>> {
  const res = await client.query({
    companies: {
      __args: { filter: { name: { ilike: `${PREFIX}%` } }, first: 60 },
      edges: { node: { name: true } },
    },
  } as any);
  return new Set((res as any).companies.edges.map((e: any) => e.node.name));
}

async function main() {
  const existing = await seededCompanyNames();
  const reps = await fetchReps();
  if (!reps.length) throw new Error('No workspace members found to assign as reps.');
  console.log(`Using ${reps.length} reps. ${existing.size} NorthPeak companies already present.`);

  let oppCount = 0;
  let personCount = 0;
  let taskCount = 0;
  let noteCount = 0;

  for (const c of COMPANIES) {
    if (existing.has(`${PREFIX}${c.name}`) && process.env.FORCE !== '1') {
      console.log(`  skip ${c.name} (already seeded)`);
      continue;
    }
    const accountOwner = pick(reps);
    const created = await client.mutation({
      createCompany: {
        __args: {
          data: {
            name: `${PREFIX}${c.name}`,
            industry: c.industry,
            region: c.region,
            domainName: { primaryLinkUrl: `https://${c.domain}`, primaryLinkLabel: c.domain },
            annualRevenue: { amountMicros: String(jitter(5_000_000, 0.6) * 1_000_000), currencyCode: 'USD' },
            accountOwnerId: accountOwner.id,
          },
        },
        id: true,
        name: true,
      },
    } as any);
    const companyId = (created as any).createCompany.id;

    // 2 people per company
    const people: string[] = [];
    for (let i = 0; i < 2; i++) {
      const p = await client.mutation({
        createPerson: {
          __args: {
            data: {
              name: { firstName: pick(FIRST), lastName: pick(LAST) },
              jobTitle: pick(TITLES),
              emails: { primaryEmail: `contact${personCount}@${c.domain}` },
              companyId,
              ownerId: accountOwner.id,
            },
          },
          id: true,
        },
      } as any);
      people.push((p as any).createPerson.id);
      personCount++;
    }

    // 5–7 opportunities per company
    const nOpps = 5 + Math.floor(rand() * 3);
    for (let i = 0; i < nOpps; i++) {
      const tier = pick(TIERS);
      const stage = pick(STAGES);
      const closeOffset = Math.floor((rand() - 0.55) * 120); // roughly -66..+54 days
      const opp = await client.mutation({
        createOpportunity: {
          __args: {
            data: {
              name: `${PREFIX}${c.name} — ${tier}`,
              stage,
              productTier: tier,
              leadSource: pick(LEAD_SOURCES),
              region: c.region,
              amount: { amountMicros: String(jitter(TIER_BASE[tier], 0.3) * 1_000_000), currencyCode: 'USD' },
              closeDate: isoOffsetDays(closeOffset),
              companyId,
              pointOfContactId: pick(people),
              ownerId: pick(reps).id,
            },
          },
          id: true,
        },
      } as any);
      const oppId = (opp as any).createOpportunity.id;
      oppCount++;

      // ~1 task + ~1 note per opportunity → timeline
      if (rand() > 0.3) {
        const t = await client.mutation({
          createTask: {
            __args: {
              data: {
                title: `${pick(TASK_TITLES)} — ${c.name}`,
                status: pick(TASK_STATUSES),
                dueAt: isoOffsetDays(Math.floor((rand() - 0.3) * 21)),
                assigneeId: pick(reps).id,
              },
            },
            id: true,
          },
        } as any);
        await client.mutation({
          createTaskTarget: {
            __args: { data: { taskId: (t as any).createTask.id, targetOpportunityId: oppId, targetCompanyId: companyId } },
            id: true,
          },
        } as any);
        taskCount++;
      }
      if (rand() > 0.5) {
        const n = await client.mutation({
          createNote: {
            __args: { data: { title: `${pick(NOTE_TITLES)} — ${c.name}` } },
            id: true,
          },
        } as any);
        await client.mutation({
          createNoteTarget: {
            __args: { data: { noteId: (n as any).createNote.id, targetOpportunityId: oppId, targetCompanyId: companyId } },
            id: true,
          },
        } as any);
        noteCount++;
      }
    }
    console.log(`  seeded ${c.name}`);
  }

  console.log(
    `Done. Companies: ${COMPANIES.length}, People: ${personCount}, Opportunities: ${oppCount}, Tasks: ${taskCount}, Notes: ${noteCount}.`,
  );
}

main().catch((e) => {
  console.error('Seed failed:', e?.message ?? e);
  process.exit(1);
});
