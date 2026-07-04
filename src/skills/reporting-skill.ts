import { defineSkill } from 'twenty-sdk/define';

import { SKILL_ID } from 'src/constants/universal-identifiers';

// Guides Twenty's native AI agents to use the app's report tool when a user asks
// for a metric/report, rather than trying to answer from memory.
export default defineSkill({
  universalIdentifier: SKILL_ID,
  name: 'northpeak-reporting',
  label: 'NorthPeak Reporting',
  description: 'Build validated reports over CRM data from plain-language requests.',
  icon: 'IconReportAnalytics',
  content: `When a user asks for a metric, breakdown, or report over CRM data
(e.g. "won deals by rep", "pipeline by region", "monthly revenue by product tier"),
call the "generate-report-spec" tool with their request as the "prompt".
The tool returns a validated Report Spec plus a plain-English restatement of what
was measured — share that restatement so the user can trust the numbers, and never
invent figures yourself.
To shape the email itself (arrange blocks, rewrite copy, restyle, or change what is
measured) on an existing report, call the "arrange-report" tool with the reportId and
the conversation "messages"; it will ask a clarifying question when the request is
ambiguous, otherwise apply a coordinated data + layout + copy change.
If the user wants the report emailed on a schedule, tell them to open the report
record's Builder tab to arrange blocks, add subscribers, and activate a
daily/weekly/monthly delivery.`,
});
