import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { LEAD_SOURCE_OPTIONS } from 'src/constants/northpeak-dimensions';
import { OPP_LEAD_SOURCE_FIELD_ID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: OPP_LEAD_SOURCE_FIELD_ID,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
  name: 'leadSource',
  type: FieldType.SELECT,
  label: 'Lead Source',
  icon: 'IconAffiliate',
  options: LEAD_SOURCE_OPTIONS.map((o, position) => ({ ...o, position })),
});
