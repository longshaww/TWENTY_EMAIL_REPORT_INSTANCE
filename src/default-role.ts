import { defineApplicationRole } from 'twenty-sdk/define';

import {
  DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
  REPORT_OBJECT_ID,
  REPORT_RUN_OBJECT_ID,
  REPORT_SUBSCRIPTION_OBJECT_ID,
} from 'src/constants/universal-identifiers';

// The app's logic functions and front components run under this role.
//
// A reporting tool needs broad *read* access (it aggregates over whichever CRM
// objects the user points a report at) but only needs to *write* its own three
// objects. Row-level isolation of private reports is enforced in our own query
// path (see logic-functions/lib/access.ts), because row-level security is only
// enforced on some Twenty plans.
export default defineApplicationRole({
  universalIdentifier: DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
  label: 'NorthPeak Reports function role',
  description:
    'Reads CRM records to build reports; writes only NorthPeak Reports objects (Report, Subscription, Run).',
  canReadAllObjectRecords: true,
  canUpdateAllObjectRecords: false,
  canSoftDeleteAllObjectRecords: false,
  canDestroyAllObjectRecords: false,
  canUpdateAllSettings: false,
  canBeAssignedToAgents: false,
  canBeAssignedToUsers: false,
  canBeAssignedToApiKeys: false,
  objectPermissions: [
    {
      objectUniversalIdentifier: REPORT_OBJECT_ID,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: true,
      canDestroyObjectRecords: false,
    },
    {
      objectUniversalIdentifier: REPORT_SUBSCRIPTION_OBJECT_ID,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: true,
      canDestroyObjectRecords: false,
    },
    {
      objectUniversalIdentifier: REPORT_RUN_OBJECT_ID,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: true,
      canDestroyObjectRecords: false,
    },
  ],
  fieldPermissions: [],
  permissionFlagUniversalIdentifiers: [],
});
