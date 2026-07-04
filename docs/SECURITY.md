# Security & GDPR model

NorthPeak Reports is **private-by-default** and designed so personal data stays
inside the workspace and is minimised at every hop.

## Recipients: workspace members only

A report can only be sent to **workspace members**, modelled as a relation
(`Report Subscription → Workspace Member`). There is **no free-text email field**,
so a report can never be addressed to an arbitrary external address. This is a
structural guarantee, not a runtime check that could be bypassed.

## Data minimisation to the AI

The LLM never sees raw CRM rows:

- **Spec generation** receives only the *schema* (object + field names/types and
  SELECT options) and the user's prompt — no records at all.
- **Narrative generation** receives only the *aggregated* result (group labels +
  computed numbers, capped to the top rows) — never individual records or contact
  details beyond the dimension labels the user chose to group by.

The deterministic executor — not the model — reads the records, so the model has
no path to bulk-export data.

## Secrets stay server-side

`OPENROUTER_API_KEY` and `BREVO_API_KEY` are declared as **secret server
variables**. Twenty injects them only into server-side logic functions; they are
**never** exposed to front components (the browser). All third-party calls
(OpenRouter, Brevo, QuickChart) happen from logic functions.

## Ownership & visibility

Each `Report` has an **owner** (set to its creator) and a **visibility**
(`Private` / `Workspace`). New reports default to **Private**. Visibility and
ownership are stored on the record and surfaced in the Builder.

**Enforcement (server-derived identity).** `run-report` (preview / send-now) and
`arrange-report` resolve the caller's workspace member **server-side** via
`currentMemberId()` (`src/logic-functions/lib/access.ts`, backed by
`MetadataApiClient.currentUser`) and pass it to `canAccessReport()`
(`src/logic-functions/lib/deliver.ts`). The identity is **never taken from the
request body**, so it cannot be spoofed. A `Private` report can only be
previewed/sent/arranged by its owner; a private report with no owner **fails
closed** (never world-open); and "Preview as [recipient]" is honoured only for the
report's own owner, so it can't be used to read another member's scoped slice.
`create-report` stamps the owner from the same server-derived identity, so a report
can't be planted under another member or left ownerless.

**Known platform limits.** Twenty cron runs have *no* request user, so the scheduled
dispatcher calls `deliver()` directly and is trusted by design (it only ever emails
the subscribers the owner chose). For defence in depth on plans that support it, the
manifest and data model remain compatible with adding a row-level predicate
(`Report.owner IS current member`) on a user-assigned role; it is intentionally *not*
placed on the app's function role, because the dispatcher must read every owner's
reports.

## Recipient privacy (no cross-recipient leakage)

Every subscriber is emailed in their **own message** (a single-address `to`) — the
delivery path never batches multiple recipients into one shared `To:` header, so a
report can't leak the subscriber list to its recipients. A report is only ever
emailed to the workspace members its owner explicitly added as subscribers — never
to arbitrary addresses.

## Least-privilege role

The app runs under a dedicated function role (`src/default-role.ts`) that can
**write only its own three objects** (`Report`, `Report Subscription`,
`Report Run`). It has broad *read* access because a reporting tool must aggregate
across whichever objects the user points it at — but it cannot modify or destroy
CRM records, and cannot change workspace settings.

## Auditability

Every execution writes a **Report Run** record: status, trigger (scheduled /
sent-now / preview), rows matched, recipient count and addresses, the interpreted
spec, the data-as-of timestamp, and any error. This is a complete, queryable audit
trail of who received what and when.

## Erasure / soft-delete

All reads go through the standard Twenty API, which excludes soft-deleted records
by default — so deletions and erasure requests are honoured automatically in every
report. Deleting a report cascades to its subscriptions and runs.

## Trust surface

Reports never ask the reader to take numbers on faith: each shows the interpreted
spec, the matched row count, the data-as-of time, and a deep link to verify the
equivalent native Twenty view.
