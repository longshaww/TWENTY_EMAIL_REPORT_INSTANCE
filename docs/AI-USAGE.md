# How AI is used

## AI inside the product (three meaningful surfaces)

### 1. Natural language → validated Report Spec
The core feature. A user's plain-language request is sent to an LLM which returns a
**constrained JSON "Report Spec"** (target object, filters, group-by, aggregations,
time window). The model **never writes GraphQL or SQL** and never touches data.

The spec is then **validated against the live schema** (`validateReportSpec`) —
every field, option value and metric type is checked. If the model produces an
invalid spec, the app feeds the errors back for **one repair attempt**. A
deterministic executor runs the validated spec, so results are reproducible and
verifiable. This "LLM proposes, deterministic engine disposes" split is what makes
the numbers trustworthy.

### 2. Period-over-period insight (numbers in code, wording by AI)
This is where the AI earns its place. When a report has a time window, the app runs
the **same validated spec over the immediately preceding period** and diffs the two
results in code (`compare.ts` → `computeDeltas`): per-metric % change and the biggest
rising/falling group. The LLM (`generateInsight`) receives **only those already-computed
deltas** and writes one or two sentences of insight — it cannot invent or recompute a
number. So the AI adds genuine value (spotting the story in the change) while every
figure stays deterministic and verifiable. A deterministic sentence stands in when no
LLM key is set, so the block is never empty.

### 3. Plain-language narrative
After a report runs, a second LLM call turns the **aggregated numbers** into a short
business summary ("headline figure, top/bottom groups, notable concentration").
It only ever sees aggregates, never raw rows.

### Native Twenty AI tool
`generate-report-spec` is also exposed via `toolTriggerSettings`, so Twenty's own
chat/MCP agents can build a report on request. A `defineSkill` guides those agents
to use it and to share the plain-English interpretation rather than inventing
figures.

## One gateway, model chosen by config

All model access goes through a single adapter (`lib/llm.ts`) calling **OpenRouter**
(OpenAI-compatible). The model is set by the `LLM_MODEL` variable — the submission
default is **`anthropic/claude-opus-4.8`**, so it genuinely runs on Claude, and a
developer can switch models with **zero code changes** and no hardcoded provider.

If no key is configured, a deterministic keyword planner stands in so the whole
pipeline still works offline for demos.

## How AI was used to *build* this app

- **Claude (via Claude Code)** drove the implementation: reading the Twenty app
  docs, designing the Report Spec DSL, writing the objects/fields/relations, the
  query engine, the logic functions, the sandbox-safe drag-and-drop front
  component, and these docs.
- Every phase was **verified against the live local Twenty server** — schema syncs,
  `dev:function:exec` runs, and a cross-check that the executor's aggregate
  (37 won opportunities) exactly matched a direct GraphQL `totalCount`.
- The DSL validator is covered by **unit tests** (`report-spec.unit-test.ts`).
