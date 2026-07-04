import { defineView, ViewKey, ViewOpenRecordIn } from 'twenty-sdk/define';

import {
  REPORT_FREQUENCY_FIELD_ID,
  REPORT_NEXT_RUN_AT_FIELD_ID,
  REPORT_OBJECT_ID,
  REPORT_STATUS_FIELD_ID,
  REPORT_VISIBILITY_FIELD_ID,
  REPORTS_VIEW_FIELD_FREQ_ID,
  REPORTS_VIEW_FIELD_NEXTRUN_ID,
  REPORTS_VIEW_FIELD_STATUS_ID,
  REPORTS_VIEW_FIELD_VISIBILITY_ID,
  REPORTS_VIEW_ID,
} from 'src/constants/universal-identifiers';

// Default index view for Reports. The record's name is always the primary
// column; these add the operational fields users scan for.
export default defineView({
  universalIdentifier: REPORTS_VIEW_ID,
  name: 'All Reports',
  objectUniversalIdentifier: REPORT_OBJECT_ID,
  icon: 'IconReportAnalytics',
  key: ViewKey.INDEX,
  position: 0,
  // Open a report on its full record page (not the side panel) so the core
  // "New Report" button lands straight in the builder, where a blank report
  // shows the template picker (StarterPicker). This makes the single core
  // create button carry the whole "pick a template / start from scratch" flow.
  openRecordIn: ViewOpenRecordIn.RECORD_PAGE,
  fields: [
    {
      universalIdentifier: REPORTS_VIEW_FIELD_STATUS_ID,
      fieldMetadataUniversalIdentifier: REPORT_STATUS_FIELD_ID,
      position: 0,
      isVisible: true,
      size: 120,
    },
    {
      universalIdentifier: REPORTS_VIEW_FIELD_FREQ_ID,
      fieldMetadataUniversalIdentifier: REPORT_FREQUENCY_FIELD_ID,
      position: 1,
      isVisible: true,
      size: 120,
    },
    {
      universalIdentifier: REPORTS_VIEW_FIELD_NEXTRUN_ID,
      fieldMetadataUniversalIdentifier: REPORT_NEXT_RUN_AT_FIELD_ID,
      position: 2,
      isVisible: true,
      size: 180,
    },
    {
      universalIdentifier: REPORTS_VIEW_FIELD_VISIBILITY_ID,
      fieldMetadataUniversalIdentifier: REPORT_VISIBILITY_FIELD_ID,
      position: 3,
      isVisible: true,
      size: 120,
    },
  ],
});
