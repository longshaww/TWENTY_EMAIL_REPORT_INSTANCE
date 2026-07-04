import { defineView, ViewKey } from 'twenty-sdk/define';

import {
  REPORT_SUBSCRIPTION_OBJECT_ID,
  SUBSCRIPTION_MEMBER_FIELD_ID,
  SUBSCRIPTIONS_VIEW_FIELD_NAME_ID,
  SUBSCRIPTIONS_VIEW_ID,
} from 'src/constants/universal-identifiers';

// Minimal index view so the junction object is not "invisible" (subscriptions
// are normally managed from inside the report builder UI).
export default defineView({
  universalIdentifier: SUBSCRIPTIONS_VIEW_ID,
  name: 'All Subscriptions',
  objectUniversalIdentifier: REPORT_SUBSCRIPTION_OBJECT_ID,
  icon: 'IconUserCheck',
  key: ViewKey.INDEX,
  position: 0,
  fields: [
    {
      universalIdentifier: SUBSCRIPTIONS_VIEW_FIELD_NAME_ID,
      fieldMetadataUniversalIdentifier: SUBSCRIPTION_MEMBER_FIELD_ID,
      position: 0,
      isVisible: true,
      size: 220,
    },
  ],
});
