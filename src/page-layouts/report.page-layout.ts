import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';

import {
  REPORT_BUILDER_FC_ID,
  REPORT_OBJECT_ID,
  REPORT_PAGE_LAYOUT_ID,
  REPORT_PAGE_TAB_BUILDER_ID,
  REPORT_PAGE_WIDGET_BUILDER_ID,
} from 'src/constants/universal-identifiers';

// The Report record page. Twenty always renders the record's fields in the left
// summary panel; this adds a full-width "Builder" tab hosting the drag-and-drop
// email composer front component.
export default definePageLayout({
  universalIdentifier: REPORT_PAGE_LAYOUT_ID,
  name: 'Report',
  type: 'RECORD_PAGE',
  objectUniversalIdentifier: REPORT_OBJECT_ID,
  tabs: [
    {
      universalIdentifier: REPORT_PAGE_TAB_BUILDER_ID,
      title: 'Builder',
      position: 0,
      icon: 'IconLayoutBoard',
      layoutMode: PageLayoutTabLayoutMode.CANVAS,
      widgets: [
        {
          universalIdentifier: REPORT_PAGE_WIDGET_BUILDER_ID,
          title: 'Report builder',
          type: 'FRONT_COMPONENT',
          gridPosition: { row: 0, column: 0, rowSpan: 12, columnSpan: 12 },
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier: REPORT_BUILDER_FC_ID,
          },
        },
      ],
    },
  ],
});
