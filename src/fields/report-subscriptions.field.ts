import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

import {
  REPORT_OBJECT_ID,
  REPORT_SUBSCRIPTIONS_FIELD_ID,
  REPORT_SUBSCRIPTION_OBJECT_ID,
  SUBSCRIPTION_REPORT_FIELD_ID,
} from 'src/constants/universal-identifiers';

// ONE_TO_MANY: one Report -> many ReportSubscriptions.
export default defineField({
  universalIdentifier: REPORT_SUBSCRIPTIONS_FIELD_ID,
  objectUniversalIdentifier: REPORT_OBJECT_ID,
  type: FieldType.RELATION,
  name: 'subscriptions',
  label: 'Subscriptions',
  icon: 'IconUserCheck',
  relationTargetObjectMetadataUniversalIdentifier: REPORT_SUBSCRIPTION_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: SUBSCRIPTION_REPORT_FIELD_ID,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
