import {
  defineField,
  FieldType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';

import {
  REPORT_OBJECT_ID,
  REPORT_SUBSCRIPTIONS_FIELD_ID,
  REPORT_SUBSCRIPTION_OBJECT_ID,
  SUBSCRIPTION_REPORT_FIELD_ID,
} from 'src/constants/universal-identifiers';

// MANY_TO_ONE: many ReportSubscriptions -> one Report. Holds the FK.
export default defineField({
  universalIdentifier: SUBSCRIPTION_REPORT_FIELD_ID,
  objectUniversalIdentifier: REPORT_SUBSCRIPTION_OBJECT_ID,
  type: FieldType.RELATION,
  name: 'report',
  label: 'Report',
  icon: 'IconReportAnalytics',
  relationTargetObjectMetadataUniversalIdentifier: REPORT_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: REPORT_SUBSCRIPTIONS_FIELD_ID,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.CASCADE,
    joinColumnName: 'reportId',
  },
});
