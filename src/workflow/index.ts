export { default, WorkflowModule, WorkflowProvider, useWorkflow } from "./WorkflowModule";
export type {
  WorkflowFittingRecord,
  OperationLog,
  RoleType,
  RecordStatus,
  FollowUpPriority,
  ReviewField,
  WorkflowState,
  PermissionConfig
} from "./workflow.types";
export {
  ROLE_LABELS,
  STATUS_LABELS,
  PRIORITY_LABELS,
  ROLE_PERMISSIONS,
  canTransition
} from "./workflow.types";
