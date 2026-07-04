import { defineObject, FieldType } from 'twenty-sdk/define';

import {
  REPORT_SUBSCRIPTION_OBJECT_ID,
  SUBSCRIPTION_SCOPE_MODE,
  SUBSCRIPTION_SCOPE_MODE_FIELD_ID,
} from 'src/constants/universal-identifiers';

// A ReportSubscription is a junction between a Report and a WorkspaceMember —
// "this member receives this report". Recipients are restricted to workspace
// members (never arbitrary external addresses) to stay private-by-default and
// GDPR-safe. Both relation sides are defined in src/fields.
export default defineObject({
  universalIdentifier: REPORT_SUBSCRIPTION_OBJECT_ID,
  nameSingular: 'northpeakReportSubscription',
  namePlural: 'northpeakReportSubscriptions',
  labelSingular: 'Report Subscription',
  labelPlural: 'Report Subscriptions',
  description: 'Links a workspace member to a report they receive by email.',
  icon: 'IconUserCheck',
  isSearchable: true,
  fields: [
    {
      universalIdentifier: SUBSCRIPTION_SCOPE_MODE_FIELD_ID,
      name: 'scopeMode',
      type: FieldType.SELECT,
      label: 'Scope',
      description: 'When the report is scoped per recipient: SELF = this member sees only their own rows; ALL = this member receives the full unscoped report (e.g. a manager).',
      icon: 'IconUserShield',
      defaultValue: `'${SUBSCRIPTION_SCOPE_MODE.SELF}'`,
      options: [
        { value: SUBSCRIPTION_SCOPE_MODE.SELF, label: 'Only their own', position: 0, color: 'blue' },
        { value: SUBSCRIPTION_SCOPE_MODE.ALL, label: 'Full report', position: 1, color: 'purple' },
      ],
    },
  ],
});
