import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

import {
  REPORT_OBJECT_ID,
  REPORT_RUNS_FIELD_ID,
  REPORT_RUN_OBJECT_ID,
  RUN_REPORT_FIELD_ID,
} from 'src/constants/universal-identifiers';

// ONE_TO_MANY: one Report -> many ReportRuns (delivery history / audit trail).
export default defineField({
  universalIdentifier: REPORT_RUNS_FIELD_ID,
  objectUniversalIdentifier: REPORT_OBJECT_ID,
  type: FieldType.RELATION,
  name: 'runs',
  label: 'Deliveries',
  icon: 'IconMailForward',
  relationTargetObjectMetadataUniversalIdentifier: REPORT_RUN_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: RUN_REPORT_FIELD_ID,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
