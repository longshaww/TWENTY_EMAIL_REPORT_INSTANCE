import { defineCommandMenuItem } from 'twenty-sdk/define';

import {
  CREATE_REPORT_CMD_ID,
  CREATE_REPORT_FC_ID,
} from 'src/constants/universal-identifiers';

// Cmd+K entry to spin up a report from a prompt anywhere. NOT pinned: a pinned
// item renders a second create button in the Reports toolbar next to Twenty's
// own core "New Report" button (which can't be hidden via the app SDK), so the
// two looked like duplicate "report" buttons. Instead the core "New Report"
// button is the single create surface — it opens a blank record on the record
// page (see reports.view.ts openRecordIn: RECORD_PAGE) where the builder shows
// the template picker (StarterPicker). This stays available via the ⌘K menu.
export default defineCommandMenuItem({
  universalIdentifier: CREATE_REPORT_CMD_ID,
  label: 'Create report from a prompt',
  shortLabel: 'New report',
  icon: 'IconReportAnalytics',
  isPinned: false,
  availabilityType: 'GLOBAL',
  frontComponentUniversalIdentifier: CREATE_REPORT_FC_ID,
});
