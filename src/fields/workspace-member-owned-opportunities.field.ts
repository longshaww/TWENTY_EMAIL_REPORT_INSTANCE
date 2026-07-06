import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  OPP_OWNER_FIELD_ID,
  OPP_OWNER_REVERSE_FIELD_ID,
} from 'src/constants/universal-identifiers';

// ONE_TO_MANY inverse of opportunity.owner, added onto the standard WorkspaceMember.
export default defineField({
  universalIdentifier: OPP_OWNER_REVERSE_FIELD_ID,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
  type: FieldType.RELATION,
  name: 'ownedOpportunities',
  label: 'Owned Opportunities',
  icon: 'IconTargetArrow',
  relationTargetObjectMetadataUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier: OPP_OWNER_FIELD_ID,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
