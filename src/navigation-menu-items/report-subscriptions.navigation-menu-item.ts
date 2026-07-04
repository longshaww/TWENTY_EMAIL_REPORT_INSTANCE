import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import {
  NAV_FOLDER_ID,
  NAV_SUBSCRIPTIONS_ID,
  SUBSCRIPTIONS_VIEW_ID,
} from 'src/constants/universal-identifiers';

// Sidebar entry for the "All Subscriptions" index view, so the ReportSubscription
// junction object is reachable/auditable from the UI (who receives which report).
export default defineNavigationMenuItem({
  universalIdentifier: NAV_SUBSCRIPTIONS_ID,
  name: 'Subscriptions',
  icon: 'IconUserCheck',
  position: 2,
  type: NavigationMenuItemType.VIEW,
  viewUniversalIdentifier: SUBSCRIPTIONS_VIEW_ID,
  folderUniversalIdentifier: NAV_FOLDER_ID,
});
