import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { INDUSTRY_OPTIONS } from 'src/constants/northpeak-dimensions';
import { COMPANY_INDUSTRY_FIELD_ID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: COMPANY_INDUSTRY_FIELD_ID,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  name: 'industry',
  type: FieldType.SELECT,
  label: 'Industry',
  icon: 'IconBuildingFactory',
  options: INDUSTRY_OPTIONS.map((o, position) => ({ ...o, position })),
});
