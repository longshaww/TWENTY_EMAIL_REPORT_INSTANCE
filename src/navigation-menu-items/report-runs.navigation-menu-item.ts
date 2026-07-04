import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import {
  NAV_FOLDER_ID,
  NAV_RUNS_ID,
  RUNS_VIEW_ID,
} from 'src/constants/universal-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier: NAV_RUNS_ID,
  name: 'Deliveries',
  icon: 'IconMailForward',
  position: 1,
  type: NavigationMenuItemType.VIEW,
  viewUniversalIdentifier: RUNS_VIEW_ID,
  folderUniversalIdentifier: NAV_FOLDER_ID,
});
