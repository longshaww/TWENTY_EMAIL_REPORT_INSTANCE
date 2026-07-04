import { defineView, ViewKey } from 'twenty-sdk/define';

import {
  REPORT_RUN_OBJECT_ID,
  RUN_RAN_AT_FIELD_ID,
  RUN_RECIPIENTS_FIELD_ID,
  RUN_ROW_COUNT_FIELD_ID,
  RUN_STATUS_FIELD_ID,
  RUNS_VIEW_FIELD_RANAT_ID,
  RUNS_VIEW_FIELD_RECIPIENTS_ID,
  RUNS_VIEW_FIELD_ROWCOUNT_ID,
  RUNS_VIEW_FIELD_STATUS_ID,
  RUNS_VIEW_ID,
} from 'src/constants/universal-identifiers';

// Default index view for Report Deliveries (audit trail).
export default defineView({
  universalIdentifier: RUNS_VIEW_ID,
  name: 'All Deliveries',
  objectUniversalIdentifier: REPORT_RUN_OBJECT_ID,
  icon: 'IconMailForward',
  key: ViewKey.INDEX,
  position: 0,
  fields: [
    {
      universalIdentifier: RUNS_VIEW_FIELD_STATUS_ID,
      fieldMetadataUniversalIdentifier: RUN_STATUS_FIELD_ID,
      position: 0,
      isVisible: true,
      size: 110,
    },
    {
      universalIdentifier: RUNS_VIEW_FIELD_RANAT_ID,
      fieldMetadataUniversalIdentifier: RUN_RAN_AT_FIELD_ID,
      position: 1,
      isVisible: true,
      size: 180,
    },
    {
      universalIdentifier: RUNS_VIEW_FIELD_ROWCOUNT_ID,
      fieldMetadataUniversalIdentifier: RUN_ROW_COUNT_FIELD_ID,
      position: 2,
      isVisible: true,
      size: 110,
    },
    {
      universalIdentifier: RUNS_VIEW_FIELD_RECIPIENTS_ID,
      fieldMetadataUniversalIdentifier: RUN_RECIPIENTS_FIELD_ID,
      position: 3,
      isVisible: true,
      size: 260,
    },
  ],
});
