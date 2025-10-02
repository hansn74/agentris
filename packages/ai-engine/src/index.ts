export { RequirementsParser } from './requirements-parser';
export type { 
  FieldRequirement, 
  ValidationRuleRequirement, 
  ParsedRequirements 
} from './requirements-parser';

export { MetadataGenerator } from './metadata-generator';
export type { 
  SalesforceFieldMetadata, 
  SalesforceValidationRuleMetadata, 
  GeneratedMetadata 
} from './metadata-generator';

export { 
  fieldExtractionTemplate, 
  validationExtractionTemplate,
  PromptVersionManager
} from './prompts/field-extraction';

// LLM Service exports
export { LLMService } from './llm-service';
export type { LLMServiceConfig } from './llm-service';

// Provider exports
export { 
  BaseProvider,
  AnthropicProvider,
  ProviderFactory 
} from './providers';
export type {
  LLMMessage,
  LLMResponse,
  LLMStreamResponse,
  ProviderConfig,
} from './providers';

// Clarification Generator exports
export { ClarificationGenerator } from './clarification-generator';
export type { 
  ClarificationQuestion,
  GenerateQuestionsOptions 
} from './clarification-generator';

// Ambiguity Detector exports
export { AmbiguityDetector } from './ambiguity-detector';
export { SalesforceTerminology } from './salesforce-terminology';

// Preview Generator exports
export { ChangeDetector, ChangeType } from './change-detector';
export { PreviewGenerator } from './preview-generator';
export type { 
  PreviewGeneratorOptions,
  GeneratePreviewParams 
} from './preview-generator';

// Pattern Analyzer exports
export { PatternAnalyzer } from './pattern-analyzer';

// Recommendation Engine exports
export { RecommendationEngine } from './recommendation-engine';
export type { RecommendationEngineOptions } from './recommendation-engine';

// Conflict Detector exports
export { ConflictDetector } from './conflict-detector';
export type { ConflictDetectorOptions, ExtendedConflict } from './conflict-detector';

// Batch Processing exports
export { BatchAnalyzer } from './batch-analyzer';
export type { 
  SimilarityScore,
  BatchGroupingSuggestion,
  BatchAnalysisResult 
} from './batch-analyzer';

export { BatchPreviewGenerator } from './batch-preview-generator';
export type {
  BatchPreviewOptions,
  BatchPreviewResult,
  TicketChange
} from './batch-preview-generator';
