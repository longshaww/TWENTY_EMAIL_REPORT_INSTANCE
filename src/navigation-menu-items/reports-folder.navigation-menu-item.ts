import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import { NAV_FOLDER_ID } from 'src/constants/universal-identifiers';

// Sidebar folder grouping the Reports app's views.
export default defineNavigationMenuItem({
  universalIdentifier: NAV_FOLDER_ID,
  name: 'NorthPeak Reports',
  icon: 'IconReportAnalytics',
  position: 1,
  type: NavigationMenuItemType.FOLDER,
});
