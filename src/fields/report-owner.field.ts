import {
  defineField,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  REPORT_OBJECT_ID,
  REPORT_OWNER_FIELD_ID,
  REPORT_OWNER_REVERSE_FIELD_ID,
} from 'src/constants/universal-identifiers';

// MANY_TO_ONE: many Reports -> one WorkspaceMember (the owner). Holds the FK.
export default defineField({
  universalIdentifier: REPORT_OWNER_FIELD_ID,
  objectUniversalIdentifier: REPORT_OBJECT_ID,
  type: FieldType.RELATION,
  name: 'owner',
  label: 'Owner',
  description: 'The workspace member who owns this report.',
  icon: 'IconUser',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier: REPORT_OWNER_REVERSE_FIELD_ID,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.SET_NULL,
    joinColumnName: 'ownerId',
  },
});
