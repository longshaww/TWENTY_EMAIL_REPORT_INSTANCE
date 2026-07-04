import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { PRODUCT_TIER_OPTIONS } from 'src/constants/northpeak-dimensions';
import { OPP_PRODUCT_TIER_FIELD_ID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: OPP_PRODUCT_TIER_FIELD_ID,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
  name: 'productTier',
  type: FieldType.SELECT,
  label: 'Product Tier',
  icon: 'IconStairsUp',
  options: PRODUCT_TIER_OPTIONS.map((o, position) => ({ ...o, position })),
});
