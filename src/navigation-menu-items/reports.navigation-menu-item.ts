import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import {
  NAV_FOLDER_ID,
  NAV_REPORTS_ID,
  REPORTS_VIEW_ID,
} from 'src/constants/universal-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier: NAV_REPORTS_ID,
  name: 'Reports',
  icon: 'IconReportAnalytics',
  position: 0,
  type: NavigationMenuItemType.VIEW,
  viewUniversalIdentifier: REPORTS_VIEW_ID,
  folderUniversalIdentifier: NAV_FOLDER_ID,
});
