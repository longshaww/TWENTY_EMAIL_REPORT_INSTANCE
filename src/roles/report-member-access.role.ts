import {
  defineRole,
  RowLevelPermissionPredicateGroupLogicalOperator,
  RowLevelPermissionPredicateOperand,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  MEMBER_ACCESS_ROLE_UNIVERSAL_IDENTIFIER,
  REPORT_OBJECT_ID,
  REPORT_OWNER_FIELD_ID,
  REPORT_RLP_GROUP_OR_ID,
  REPORT_RLP_PRED_OWNER_ID,
  REPORT_RLP_PRED_WORKSPACE_ID,
  REPORT_VISIBILITY,
  REPORT_VISIBILITY_FIELD_ID,
} from 'src/constants/universal-identifiers';

// The current workspace member's id, injected at query time by the RLP engine.
const CURRENT_MEMBER =
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.fields.id.universalIdentifier;

// A user-assignable role that turns the Report `visibility` field into a real
// row-level boundary in Twenty's native table: a member sees/edits a Report row
// iff they OWN it OR it is WORKSPACE-visible. Private reports owned by others are
// hidden at the DB level.
//
// This is SEPARATE from the app's function role (src/default-role.ts, which stays
// the sole defineApplicationRole and keeps canReadAllObjectRecords so the cron
// dispatcher can see every report). Two opt-in conditions must hold for this to
// bite: (1) the workspace's Twenty plan must enforce row-level security — on other
// plans the predicates still sync but are simply not enforced; (2) an admin must
// assign members to this role (it then governs their object access). The app-layer
// canAccessReport (logic-functions/lib/deliver.ts) remains the guaranteed boundary
// for app features regardless of plan.
export default defineRole({
  universalIdentifier: MEMBER_ACCESS_ROLE_UNIVERSAL_IDENTIFIER,
  label: 'NorthPeak Reports — Members',
  description:
    'Assign workspace members here to enforce Report visibility: private reports are visible only to their owner; workspace reports to everyone.',
  canReadAllObjectRecords: false,
  canUpdateAllObjectRecords: false,
  canSoftDeleteAllObjectRecords: false,
  canDestroyAllObjectRecords: false,
  canUpdateAllSettings: false,
  canBeAssignedToUsers: true,
  canBeAssignedToAgents: false,
  canBeAssignedToApiKeys: false,
  objectPermissions: [
    {
      objectUniversalIdentifier: REPORT_OBJECT_ID,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: true,
      canDestroyObjectRecords: false,
    },
  ],
  fieldPermissions: [],
  permissionFlagUniversalIdentifiers: [],
  // A single OR group holds both predicates; without a group Twenty AND-combines
  // them (which would be wrong — no report is both owned-by-me and workspace).
  rowLevelPermissionPredicateGroups: [
    {
      universalIdentifier: REPORT_RLP_GROUP_OR_ID,
      objectUniversalIdentifier: REPORT_OBJECT_ID,
      logicalOperator: RowLevelPermissionPredicateGroupLogicalOperator.OR,
    },
  ],
  rowLevelPermissionPredicates: [
    // owner IS current workspace member (no `value`; member id injected at query time)
    {
      universalIdentifier: REPORT_RLP_PRED_OWNER_ID,
      objectUniversalIdentifier: REPORT_OBJECT_ID,
      fieldUniversalIdentifier: REPORT_OWNER_FIELD_ID,
      operand: RowLevelPermissionPredicateOperand.IS,
      workspaceMemberFieldUniversalIdentifier: CURRENT_MEMBER,
      predicateGroupUniversalIdentifier: REPORT_RLP_GROUP_OR_ID,
    },
    // visibility IS 'WORKSPACE' (raw SELECT option value, kept in sync via the constant)
    {
      universalIdentifier: REPORT_RLP_PRED_WORKSPACE_ID,
      objectUniversalIdentifier: REPORT_OBJECT_ID,
      fieldUniversalIdentifier: REPORT_VISIBILITY_FIELD_ID,
      operand: RowLevelPermissionPredicateOperand.IS,
      value: REPORT_VISIBILITY.WORKSPACE,
      predicateGroupUniversalIdentifier: REPORT_RLP_GROUP_OR_ID,
    },
  ],
});
