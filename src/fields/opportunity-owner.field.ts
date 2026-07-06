import {
  defineField,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  OPP_OWNER_FIELD_ID,
  OPP_OWNER_REVERSE_FIELD_ID,
} from 'src/constants/universal-identifiers';

// MANY_TO_ONE: many Opportunities -> one WorkspaceMember (the deal owner / AE).
// This is the "scope by" field that lets a report over Opportunity be split per
// recipient (each rep sees only their own deals). Holds the FK.
export default defineField({
  universalIdentifier: OPP_OWNER_FIELD_ID,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
  type: FieldType.RELATION,
  name: 'owner',
  label: 'Owner',
  description: 'The workspace member who owns this opportunity.',
  icon: 'IconUser',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier: OPP_OWNER_REVERSE_FIELD_ID,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.SET_NULL,
    joinColumnName: 'ownerId',
  },
});
