import {
  defineField,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  REPORT_SUBSCRIPTION_OBJECT_ID,
  SUBSCRIPTION_MEMBER_FIELD_ID,
  SUBSCRIPTION_MEMBER_REVERSE_FIELD_ID,
} from 'src/constants/universal-identifiers';

// MANY_TO_ONE: many ReportSubscriptions -> one WorkspaceMember (the recipient).
export default defineField({
  universalIdentifier: SUBSCRIPTION_MEMBER_FIELD_ID,
  objectUniversalIdentifier: REPORT_SUBSCRIPTION_OBJECT_ID,
  type: FieldType.RELATION,
  name: 'member',
  label: 'Member',
  description: 'The workspace member who receives this report.',
  icon: 'IconUser',
  relationTargetObjectMetadataUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier: SUBSCRIPTION_MEMBER_REVERSE_FIELD_ID,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.CASCADE,
    joinColumnName: 'memberId',
  },
});
