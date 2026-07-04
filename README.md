# NorthPeak Reports — AI Email Report Builder for Twenty CRM

A Twenty CRM app that solves one problem deeply: **turn a plain-language prompt
into a trustworthy, scheduled email report over your CRM data** — no dashboard
sprawl, no SQL, usable by a non-technical teammate.

> A user **picks a data source** (a Twenty object), describes what they want in plain
> language → an LLM turns it into a **validated Report Spec** → a deterministic engine
> runs it over live CRM data → the user refines the output through **one AI assistant**
> in a **drag-and-drop WYSIWYG builder** → a good-looking HTML email is delivered to
> workspace subscribers on a schedule.

Scenario data is a fictional B2B SaaS, **NorthPeak** (a sales-enablement/LMS
platform), seeded across pipeline stage, rep/owner, industry, region, lead source,
product tier, deal size and close date.

---

## What it demonstrates (checklist)

| Requirement | How it's met |
| --- | --- |
| Twenty app + **custom object** | `Report`, `Report Subscription`, `Report Run` (`src/objects`) |
| **Non-native drag-and-drop** | Email block composer front-component (`src/front-components/report-builder.tsx`) — HTML5 drag + keyboard/button reorder, sandbox-safe |
| **Meaningful AI** | LLM turns NL → **validated Report Spec** (never raw GraphQL); an **Insight engine** compares this period vs the previous one — deltas computed **in code**, the LLM only *phrases* them; also exposed as a **native Twenty AI tool** |
| **Reuse native UX** | Index views, sidebar folder + nav items, record-page tab, relations, command-menu quick action |
| **≥1 third-party integration** | **Brevo** (email) · **OpenRouter** (LLM) · **QuickChart** (chart PNGs) |
| **Secure + GDPR** | Private-by-default ownership, workspace-member-only recipients, data-minimized AI, server-side secrets, audited deliveries, scoped role — see [`docs/SECURITY.md`](docs/SECURITY.md) |
| **Non-technical usable** | Plain prompt, plain-English echo, drag-drop layout, [`docs/ENABLEMENT.md`](docs/ENABLEMENT.md) |
| **Fake company + data** | `scripts/seed-northpeak.ts` |

---

## Architecture

```
Prompt ──▶ generate-report-spec (logic fn, also an AI tool)
             │  LLMProvider (OpenRouter, model via LLM_MODEL) → Report Spec (JSON DSL)
             │  validateReportSpec()  ── rejects/repairs invalid specs
             ▼
        Report record (spec + plain-English echo + block layout)
             │
   Builder (front component) ── one AI assistant (data+layout+copy), subscribers, schedule
             │
run-report / dispatch-reports (cron) ──▶ executeSpec() deterministic aggregation
             │                            (CoreApiClient fetch + JS group/agg)
             ├─ computeDeltas() vs the previous period → generateInsight()
             │     (deltas in code; LLM only phrases them — never invents numbers)
             ├─ generateNarrative() (aggregates only)
             ├─ renderEmail() HTML/CSS + QuickChart PNG
             └─ Brevo send → Report Run (audit)
```

**Trust-first:** the LLM only ever chooses *what* to compute. A deterministic
executor decides *how*, so numbers are reproducible and match a native Twenty view.
Every report shows its interpreted spec in plain English, the row count, a
"data as of" timestamp, and a deep link to verify in Twenty.

### Key modules (`src/logic-functions/lib/`)

| Module | Responsibility |
| --- | --- |
| `report-spec.ts` | The DSL types, `validateReportSpec()`, `specToEnglish()` — **pure, unit-tested** |
| `metadata.ts` | Runtime schema introspection (`MetadataApiClient`) — no hardcoded schema |
| `executor.ts` | Deterministic fetch + group + aggregate → `ReportResult` |
| `compare.ts` | Derives the previous period + diffs it vs the current one (`computeDeltas`) — **pure, unit-tested** |
| `llm.ts` | The single OpenRouter gateway (model = `LLM_MODEL`); `generateInsight` phrases the deltas |
| `planner-fallback.ts` | Deterministic keyword planner when no LLM key is set (keeps it demoable offline) |
| `report-service.ts` | Orchestrates NL → spec → execute → narrate |
| `render.ts` / `quickchart.ts` | Blocks → HTML/CSS email + chart PNG |
| `brevo.ts` | Transactional email send |
| `deliver.ts` / `schedule.ts` | Shared execute-render-send-audit + `nextRunAt` maths |

---

## Configuration

Set these in the app's **Settings → server variables** (secrets) once as admin:

| Variable | Secret | Purpose |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | ✅ | LLM access via OpenRouter |
| `BREVO_API_KEY` | ✅ | Transactional email |

Non-secret application variables (have sensible defaults, editable in Settings):

| Variable | Default | Purpose |
| --- | --- | --- |
| `LLM_MODEL` | `anthropic/claude-opus-4.8` | OpenRouter model id (submission runs on **Claude**; flip to any model without code changes) |
| `BREVO_SENDER_EMAIL` / `BREVO_SENDER_NAME` | — | Verified Brevo sender |
| `PUBLIC_BASE_URL` | `http://localhost:3000` | Used for "verify in Twenty" deep links |

> Without `OPENROUTER_API_KEY` the app falls back to a deterministic keyword
> planner; without `BREVO_API_KEY` sends become no-op "dry runs". Both let you
> demo the full pipeline offline; set the keys to run genuinely on Claude + real email.

---

## Run it locally

```bash
nvm use                     # Node 24.5.0
corepack enable
yarn install
yarn twenty docker:start    # local Twenty server (http://localhost:2020)
yarn twenty dev             # build + live-sync the app, generates the typed client

# Seed the fictional NorthPeak dataset:
TWENTY_API_URL=http://localhost:2020 TWENTY_API_KEY=<dev-jwt> yarn seed
```

Then in Twenty: **Cmd+K → "Create report from a prompt"**, or open the **Reports**
sidebar folder.

### Tests

```bash
yarn test:unit              # pure DSL validator/echo tests (no server)
yarn twenty dev:typecheck   # tsc --noEmit
yarn test                   # integration tests (installs/uninstalls against a live server)
```

Manually exercise a function:

```bash
yarn twenty dev:function:exec -n create-report -p '{"prompt":"monthly won revenue by product tier"}'
yarn twenty dev:function:exec -n run-report    -p '{"reportId":"<id>","mode":"preview"}'
yarn twenty dev:function:exec -n dispatch-reports
```

---

## Docs

- [`docs/ENABLEMENT.md`](docs/ENABLEMENT.md) — non-technical "how to use it" guide
- [`docs/SECURITY.md`](docs/SECURITY.md) — security & GDPR model
- [`docs/AI-USAGE.md`](docs/AI-USAGE.md) — how AI is used (and how it was built)
- [`docs/PLATFORM-NOTES.md`](docs/PLATFORM-NOTES.md) — Remote DOM sandbox limits & how we work within them (incl. why reorder is click-to-place)
- [`docs/LOOM-SCRIPT.md`](docs/LOOM-SCRIPT.md) — demo walkthrough script

Login for the local dev server: `tim@apple.dev` / `tim@apple.dev`.
