import { z } from 'zod';

// Base metadata component interface
export interface MetadataComponent {
  fullName: string;
  type: string;
}

// Custom Object metadata
export interface CustomObject extends MetadataComponent {
  type: 'CustomObject';
  label: string;
  pluralLabel?: string;
  description?: string;
  enableActivities?: boolean;
  enableHistory?: boolean;
  enableReports?: boolean;
  sharingModel?: 'Private' | 'Read' | 'ReadWrite' | 'FullAccess';
  deploymentStatus?: 'InDevelopment' | 'Deployed';
  fields?: CustomField[];
  validationRules?: ValidationRule[];
}

// Custom Field metadata
export interface CustomField extends MetadataComponent {
  type: 'CustomField';
  label: string;
  fieldType: FieldType;
  length?: number;
  precision?: number;
  scale?: number;
  required?: boolean;
  unique?: boolean;
  defaultValue?: string;
  description?: string;
  helpText?: string;
  formula?: string;
  picklist?: PicklistValue[];
  referenceTo?: string;
  relationshipLabel?: string;
  relationshipName?: string;
}

export type FieldType =
  | 'Text'
  | 'Number'
  | 'Currency'
  | 'Date'
  | 'DateTime'
  | 'Email'
  | 'Phone'
  | 'Picklist'
  | 'MultiselectPicklist'
  | 'TextArea'
  | 'LongTextArea'
  | 'Checkbox'
  | 'Formula'
  | 'Lookup'
  | 'MasterDetail'
  | 'Url'
  | 'Percent';

export interface PicklistValue {
  fullName: string;
  label: string;
  default?: boolean;
}

// Validation Rule metadata
export interface ValidationRule extends MetadataComponent {
  type: 'ValidationRule';
  active: boolean;
  description?: string;
  errorConditionFormula: string;
  errorMessage: string;
  errorDisplayField?: string;
}

// Page Layout metadata
export interface PageLayout extends MetadataComponent {
  type: 'Layout';
  layoutSections?: LayoutSection[];
}

export interface LayoutSection {
  label: string;
  style: 'TwoColumnsLeftToRight' | 'TwoColumnsTopToBottom' | 'OneColumn';
  layoutColumns?: LayoutColumn[];
}

export interface LayoutColumn {
  layoutItems?: LayoutItem[];
}

export interface LayoutItem {
  field?: string;
  behavior?: 'Edit' | 'Required' | 'Readonly';
}

// Deployment metadata
export interface DeploymentInfo {
  id: string;
  status: DeploymentStatus;
  done: boolean;
  numberComponentsDeployed: number;
  numberComponentsTotal: number;
  numberComponentErrors: number;
  numberTestsCompleted: number;
  numberTestsTotal: number;
  createdDate: Date;
  startDate?: Date;
  lastModifiedDate?: Date;
  completedDate?: Date;
  createdBy: string;
  details?: DeploymentDetails;
  errorMessage?: string;
}

export type DeploymentStatus =
  | 'Pending'
  | 'InProgress'
  | 'Succeeded'
  | 'SucceededPartial'
  | 'Failed'
  | 'Canceling'
  | 'Canceled';

export interface DeploymentDetails {
  componentSuccesses?: ComponentStatus[];
  componentFailures?: ComponentStatus[];
  runTestResult?: TestResult;
}

export interface ComponentStatus {
  fullName: string;
  componentType: string;
  created: boolean;
  changed: boolean;
  deleted: boolean;
  problemType?: string;
  problem?: string;
  fileName?: string;
  lineNumber?: number;
  columnNumber?: number;
}

export interface TestResult {
  numFailures: number;
  numTestsRun: number;
  totalTime: number;
  successes?: TestSuccess[];
  failures?: TestFailure[];
}

export interface TestSuccess {
  name: string;
  methodName: string;
  time: number;
}

export interface TestFailure extends TestSuccess {
  message: string;
  stackTrace: string;
}

// Describe result interfaces
export interface DescribeGlobalResult {
  encoding: string;
  maxBatchSize: number;
  sobjects: SObjectDescription[];
}

export interface SObjectDescription {
  name: string;
  label: string;
  labelPlural: string;
  keyPrefix?: string;
  custom: boolean;
  customSetting: boolean;
  createable: boolean;
  deletable: boolean;
  queryable: boolean;
  searchable: boolean;
  updateable: boolean;
  urls: {
    sobject: string;
    describe: string;
    rowTemplate: string;
  };
}

export interface DescribeSObjectResult {
  name: string;
  label: string;
  labelPlural: string;
  custom: boolean;
  keyPrefix?: string;
  fields: FieldDescription[];
  recordTypeInfos?: RecordTypeInfo[];
  childRelationships?: ChildRelationship[];
}

export interface FieldDescription {
  name: string;
  label: string;
  type: string;
  length?: number;
  precision?: number;
  scale?: number;
  custom: boolean;
  nillable: boolean;
  defaultValue?: any;
  calculated: boolean;
  createable: boolean;
  updateable: boolean;
  unique: boolean;
  picklistValues?: PicklistEntry[];
  referenceTo?: string[];
  relationshipName?: string;
}

export interface PicklistEntry {
  value: string;
  label: string;
  active: boolean;
  defaultValue: boolean;
}

export interface RecordTypeInfo {
  recordTypeId: string;
  name: string;
  available: boolean;
  defaultRecordTypeMapping: boolean;
  master: boolean;
}

export interface ChildRelationship {
  childSObject: string;
  field: string;
  relationshipName?: string;
  cascadeDelete: boolean;
}

// Metadata API List Result
export interface MetadataListResult {
  createdById: string;
  createdByName: string;
  createdDate: Date;
  fileName: string;
  fullName: string;
  id: string;
  lastModifiedById: string;
  lastModifiedByName: string;
  lastModifiedDate: Date;
  type: string;
}

// Governor Limits
export interface OrgLimits {
  DailyApiRequests: LimitInfo;
  ConcurrentAsyncGetReportInstances: LimitInfo;
  ConcurrentSyncReportRuns: LimitInfo;
  DailyAsyncApexExecutions: LimitInfo;
  DailyBulkApiRequests: LimitInfo;
  DailyDurableStreamingApiEvents: LimitInfo;
  DailyGenericStreamingApiEvents: LimitInfo;
  DailyStreamingApiEvents: LimitInfo;
  DailyWorkflowEmails: LimitInfo;
  DataStorageMB: LimitInfo;
  FileStorageMB: LimitInfo;
  HourlyAsyncReportRuns: LimitInfo;
  HourlyDashboardRefreshes: LimitInfo;
  HourlyDashboardResults: LimitInfo;
  HourlyDashboardStatuses: LimitInfo;
  HourlyODataCallout: LimitInfo;
  HourlySyncReportRuns: LimitInfo;
  HourlyTimeBasedWorkflow: LimitInfo;
  MassEmail: LimitInfo;
  SingleEmail: LimitInfo;
}

export interface LimitInfo {
  Max: number;
  Remaining: number;
  Used: number;
}

// Zod schemas for validation
export const customFieldSchema = z.object({
  fullName: z.string(),
  label: z.string(),
  type: z.enum([
    'Text',
    'Number',
    'Currency',
    'Date',
    'DateTime',
    'Email',
    'Phone',
    'Picklist',
    'MultiselectPicklist',
    'TextArea',
    'LongTextArea',
    'Checkbox',
    'Formula',
    'Lookup',
    'MasterDetail',
    'Url',
    'Percent',
  ]),
  length: z.number().optional(),
  precision: z.number().optional(),
  scale: z.number().optional(),
  required: z.boolean().optional(),
  unique: z.boolean().optional(),
  defaultValue: z.string().optional(),
  description: z.string().optional(),
  helpText: z.string().optional(),
  formula: z.string().optional(),
  referenceTo: z.string().optional(),
  relationshipLabel: z.string().optional(),
  relationshipName: z.string().optional(),
});

export const metadataComponentSchema = z.object({
  fullName: z.string(),
  type: z.string(),
});

export const deploymentStatusSchema = z.enum([
  'Pending',
  'InProgress',
  'Succeeded',
  'SucceededPartial',
  'Failed',
  'Canceling',
  'Canceled',
]);

// Error classes for metadata operations
export class MetadataError extends Error {
  constructor(
    message: string,
    public operation: string,
    public componentType?: string,
    public componentName?: string
  ) {
    super(message);
    this.name = 'MetadataError';
  }
}

export class DeploymentError extends Error {
  constructor(
    message: string,
    public deploymentId: string,
    public status?: DeploymentStatus,
    public details?: DeploymentDetails
  ) {
    super(message);
    this.name = 'DeploymentError';
  }
}

export class GovernorLimitError extends Error {
  constructor(
    message: string,
    public limitType: string,
    public limitInfo?: LimitInfo
  ) {
    super(message);
    this.name = 'GovernorLimitError';
  }
}
