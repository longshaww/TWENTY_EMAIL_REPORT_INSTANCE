import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { REGION_OPTIONS } from 'src/constants/northpeak-dimensions';
import { COMPANY_REGION_FIELD_ID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: COMPANY_REGION_FIELD_ID,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  name: 'region',
  type: FieldType.SELECT,
  label: 'Region',
  icon: 'IconWorld',
  options: REGION_OPTIONS.map((o, position) => ({ ...o, position })),
});
