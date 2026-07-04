import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  REPORT_SUBSCRIPTION_OBJECT_ID,
  SUBSCRIPTION_MEMBER_FIELD_ID,
  SUBSCRIPTION_MEMBER_REVERSE_FIELD_ID,
} from 'src/constants/universal-identifiers';

// ONE_TO_MANY inverse of subscription.member, added onto WorkspaceMember.
export default defineField({
  universalIdentifier: SUBSCRIPTION_MEMBER_REVERSE_FIELD_ID,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
  type: FieldType.RELATION,
  name: 'northpeakReportSubscriptions',
  label: 'Report Subscriptions',
  icon: 'IconUserCheck',
  relationTargetObjectMetadataUniversalIdentifier: REPORT_SUBSCRIPTION_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: SUBSCRIPTION_MEMBER_FIELD_ID,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
