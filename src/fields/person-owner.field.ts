import {
  defineField,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  PERSON_OWNER_FIELD_ID,
  PERSON_OWNER_REVERSE_FIELD_ID,
} from 'src/constants/universal-identifiers';

// MANY_TO_ONE: many People -> one WorkspaceMember (the owning rep). This is the
// "scope by" field that lets a report over Person be split per recipient (each
// rep sees only the contacts they own). Holds the FK.
export default defineField({
  universalIdentifier: PERSON_OWNER_FIELD_ID,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.RELATION,
  name: 'owner',
  label: 'Owner',
  description: 'The workspace member who owns this person.',
  icon: 'IconUser',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier: PERSON_OWNER_REVERSE_FIELD_ID,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.SET_NULL,
    joinColumnName: 'ownerId',
  },
});
