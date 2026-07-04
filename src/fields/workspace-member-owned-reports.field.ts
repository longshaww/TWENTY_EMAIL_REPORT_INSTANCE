import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  REPORT_OBJECT_ID,
  REPORT_OWNER_FIELD_ID,
  REPORT_OWNER_REVERSE_FIELD_ID,
} from 'src/constants/universal-identifiers';

// ONE_TO_MANY inverse of report.owner, added onto the standard WorkspaceMember.
export default defineField({
  universalIdentifier: REPORT_OWNER_REVERSE_FIELD_ID,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
  type: FieldType.RELATION,
  name: 'ownedNorthpeakReports',
  label: 'Owned Reports',
  icon: 'IconReportAnalytics',
  relationTargetObjectMetadataUniversalIdentifier: REPORT_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: REPORT_OWNER_FIELD_ID,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
