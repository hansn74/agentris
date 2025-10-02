export interface NamingPattern {
  type: 'field' | 'object' | 'class' | 'method';
  pattern: string;
  frequency: number;
  examples: string[];
  confidence: number;
}

export interface FieldTypePattern {
  fieldNamePattern: string;
  commonType: string;
  frequency: number;
  examples: Array<{
    fieldName: string;
    fieldType: string;
    objectName: string;
  }>;
}

export interface RelationshipPattern {
  parentObject: string;
  childObject: string;
  relationshipType: 'lookup' | 'master-detail';
  frequency: number;
}

export interface OrgPatterns {
  namingPatterns: NamingPattern[];
  fieldTypePatterns: FieldTypePattern[];
  relationshipPatterns: RelationshipPattern[];
  validationPatterns: Array<{
    pattern: string;
    frequency: number;
    examples: string[];
  }>;
  automationPatterns: Array<{
    type: 'flow' | 'apex' | 'process';
    frequency: number;
  }>;
}

export interface Recommendation {
  id: string;
  type: 'naming' | 'fieldType' | 'relationship' | 'validation' | 'automation' | 'conflict';
  category: 'suggestion' | 'warning' | 'error';
  title: string;
  description: string;
  rationale: string;
  confidence: number;
  examples?: string[];
  impact?: 'low' | 'medium' | 'high';
  relatedChanges?: Recommendation[];
}

export interface ConflictDetail {
  type: 'duplicate' | 'dependency' | 'naming' | 'validation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  conflictingComponent: string;
  description: string;
  resolution?: string;
}

export interface RecommendationContext {
  ticketId: string;
  orgId: string;
  proposedChanges?: any;
  existingMetadata?: any;
}

export interface RecommendationFeedback {
  recommendationId: string;
  action: 'accepted' | 'rejected' | 'modified';
  modifiedValue?: any;
  reason?: string;
  timestamp: Date;
}

export interface LearningData {
  patternId: string;
  feedbackCount: number;
  acceptanceRate: number;
  modifications: Array<{
    original: any;
    modified: any;
    reason?: string;
  }>;
}