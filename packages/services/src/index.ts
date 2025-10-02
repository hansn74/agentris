export { AutomationOrchestrator } from './automation-orchestrator';
export type { 
  AutomationConfig, 
  AutomationResult, 
  FieldCreationOptions 
} from './automation-orchestrator';

export { ChangePreviewService } from './change-preview';
export type {
  FieldDescription,
  ValidationRuleDescription,
  FieldProperties,
  ChangeSummary
} from './change-preview';

export { ImpactAnalyzerService } from './impact-analyzer';
export type {
  FieldImpact,
  ValidationRuleConflict,
  Dependency,
  RiskAssessment
} from './impact-analyzer';

export { MetadataComparatorService } from './metadata-comparator';
export type {
  FieldComparison,
  FieldDifference,
  ValidationRuleComparison,
  RuleDifference,
  DiffRepresentation,
  CurrentState
} from './metadata-comparator';

export { ApprovalService } from './approval';
export type {
  ApprovalWithDetails,
  ApproveChangesInput,
  RejectChangesInput,
  ModifyAndApproveInput,
  BulkApproveInput,
  ApprovalHistoryFilters,
  ApprovalHistoryOptions
} from './approval';

export { DeploymentService } from './deployment';
export type {
  DeployApprovedChangesInput,
  InitiateRollbackInput,
  DeploymentEvent
} from './deployment';

export { DeploymentLogger } from './deployment-logger';
export type { LogContext } from './deployment-logger';

export { FeedbackProcessor } from './feedback-processor';
export type { FeedbackMetrics } from './feedback-processor';

export { BatchProcessor } from './batch-processor';
export type { 
  BatchGroupingConfig, 
  BatchGroupingResult, 
  BatchValidationResult 
} from './batch-processor';
