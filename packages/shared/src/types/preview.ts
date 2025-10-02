import { z } from 'zod';

export enum PreviewFormat {
  DIAGRAM = 'diagram',
  MOCKUP = 'mockup',
  CODE_DIFF = 'code-diff',
  DEPENDENCY_GRAPH = 'dependency-graph',
  TABLE = 'table',
  TEXT = 'text',
}

export const previewFormatSchema = z.nativeEnum(PreviewFormat);

export const diagramDataSchema = z.object({
  type: z.literal('diagram'),
  mermaidSyntax: z.string(),
  nodes: z.array(z.object({
    id: z.string(),
    label: z.string(),
    type: z.string(),
    metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  })),
  edges: z.array(z.object({
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
    type: z.string().optional(),
  })),
});

export const mockupDataSchema = z.object({
  type: z.literal('mockup'),
  html: z.string(),
  css: z.string().optional(),
  sections: z.array(z.object({
    name: z.string(),
    fields: z.array(z.object({
      label: z.string(),
      type: z.string(),
      required: z.boolean(),
      value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
    })),
  })),
});

export const codeDiffDataSchema = z.object({
  type: z.literal('code-diff'),
  language: z.string(),
  before: z.string(),
  after: z.string(),
  changes: z.array(z.object({
    type: z.enum(['add', 'remove', 'modify']),
    lineStart: z.number(),
    lineEnd: z.number(),
    content: z.string(),
  })),
});

export const dependencyGraphDataSchema = z.object({
  type: z.literal('dependency-graph'),
  mermaidSyntax: z.string(),
  objects: z.array(z.object({
    name: z.string(),
    type: z.string(),
    fields: z.array(z.string()).optional(),
  })),
  relationships: z.array(z.object({
    from: z.string(),
    to: z.string(),
    type: z.string(),
    field: z.string().optional(),
  })),
});

export const tableDataSchema = z.object({
  type: z.literal('table'),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const textDataSchema = z.object({
  type: z.literal('text'),
  content: z.string(),
  format: z.enum(['plain', 'markdown', 'html']).optional(),
});

export const previewDataSchema = z.discriminatedUnion('type', [
  diagramDataSchema,
  mockupDataSchema,
  codeDiffDataSchema,
  dependencyGraphDataSchema,
  tableDataSchema,
  textDataSchema,
]);

export type DiagramData = z.infer<typeof diagramDataSchema>;
export type MockupData = z.infer<typeof mockupDataSchema>;
export type CodeDiffData = z.infer<typeof codeDiffDataSchema>;
export type DependencyGraphData = z.infer<typeof dependencyGraphDataSchema>;
export type TableData = z.infer<typeof tableDataSchema>;
export type TextData = z.infer<typeof textDataSchema>;
export type PreviewData = z.infer<typeof previewDataSchema>;

// Existing Salesforce metadata schemas
export const FieldMetadataSchema = z.object({
  name: z.string().min(1).max(255),
  label: z.string().min(1).max(255),
  type: z.enum([
    'Text', 'TextArea', 'LongTextArea', 'RichTextArea', 'EncryptedText',
    'Email', 'Phone', 'Url', 'Number', 'Currency', 'Percent',
    'Date', 'DateTime', 'Time', 'Checkbox',
    'Picklist', 'MultiselectPicklist',
    'Lookup', 'MasterDetail',
    'Formula', 'Rollup', 'AutoNumber', 'Geolocation'
  ]),
  required: z.boolean().optional(),
  length: z.number().int().positive().optional(),
  precision: z.number().int().positive().optional(),
  scale: z.number().int().min(0).optional(),
  defaultValue: z.string().optional(),
  helpText: z.string().max(1000).optional(),
  formula: z.string().optional(),
  picklistValues: z.array(z.string()).optional(),
  referenceTo: z.array(z.string()).optional(),
  unique: z.boolean().optional(),
  externalId: z.boolean().optional(),
  caseSensitive: z.boolean().optional(),
  restricted: z.boolean().optional(),
  relationshipName: z.string().optional(),
  deleteConstraint: z.enum(['SetNull', 'Cascade', 'Restrict']).optional(),
  currencyCode: z.string().length(3).optional(),
  formulaTreatBlanksAs: z.enum(['BlankAsZero', 'BlankAsBlank']).optional()
});

export const ValidationRuleMetadataSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  errorConditionFormula: z.string().min(1).max(5000),
  errorMessage: z.string().min(1).max(500),
  active: z.boolean().default(true),
  errorDisplayField: z.string().optional()
});

export const GeneratedMetadataSchema = z.object({
  fields: z.array(FieldMetadataSchema).default([]),
  validationRules: z.array(ValidationRuleMetadataSchema).default([]),
  objectName: z.string().default('CustomObject__c')
});

export const PreviewMetadataSchema = z.object({
  diffData: z.object({
    before: z.record(z.unknown()).optional(),
    after: z.record(z.unknown()).optional(),
    changes: z.array(z.object({
      field: z.string(),
      type: z.enum(['added', 'removed', 'modified']),
      before: z.unknown().optional(),
      after: z.unknown().optional(),
    })).optional(),
  }),
  fieldDescriptions: z.array(z.object({
    name: z.string(),
    description: z.string(),
    properties: z.record(z.union([z.string(), z.number(), z.boolean()]))
  })),
  ruleDescriptions: z.array(z.object({
    name: z.string(),
    description: z.string()
  })),
  fieldImpacts: z.array(z.object({
    field: z.string(),
    impact: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
    description: z.string().optional(),
  })),
  ruleConflicts: z.array(z.object({
    rule: z.string(),
    conflictWith: z.string(),
    severity: z.enum(['warning', 'error']),
    description: z.string(),
  })),
  riskAssessment: z.object({
    score: z.number().min(0).max(100),
    level: z.enum(['low', 'medium', 'high', 'critical']),
    factors: z.array(z.string()),
    recommendations: z.array(z.string())
  })
});

// Type exports for Salesforce metadata
export type FieldMetadata = z.infer<typeof FieldMetadataSchema>;
export type ValidationRuleMetadata = z.infer<typeof ValidationRuleMetadataSchema>;
export type GeneratedMetadata = z.infer<typeof GeneratedMetadataSchema>;
export type PreviewMetadata = z.infer<typeof PreviewMetadataSchema>;

// Preview request/response interfaces
export interface GeneratePreviewRequest {
  ticketId: string;
  format?: PreviewFormat;
  metadata?: Record<string, any>;
}

export interface PreviewResponse {
  id: string;
  ticketId: string;
  format: PreviewFormat;
  data: PreviewData;
  generatedAt: Date;
  expiresAt: Date;
  availableFormats: PreviewFormat[];
}

// Sanitization helper
export function sanitizeString(input: string): string {
  // Remove potential script tags and dangerous HTML
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
}

export function sanitizeMetadata(metadata: unknown): GeneratedMetadata {
  // Parse and validate metadata with Zod schema
  const parsed = GeneratedMetadataSchema.parse(metadata);
  
  // Additional sanitization for string fields
  if (parsed.fields) {
    parsed.fields = parsed.fields.map(field => ({
      ...field,
      label: sanitizeString(field.label),
      helpText: field.helpText ? sanitizeString(field.helpText) : undefined,
      defaultValue: field.defaultValue ? sanitizeString(field.defaultValue) : undefined,
      formula: field.formula ? sanitizeString(field.formula) : undefined,
      picklistValues: field.picklistValues?.map(v => sanitizeString(v))
    }));
  }
  
  if (parsed.validationRules) {
    parsed.validationRules = parsed.validationRules.map(rule => ({
      ...rule,
      description: rule.description ? sanitizeString(rule.description) : undefined,
      errorMessage: sanitizeString(rule.errorMessage),
      errorConditionFormula: sanitizeString(rule.errorConditionFormula)
    }));
  }
  
  return parsed;
}