import { ImpactAnalyzerService } from '@agentris/services';
import { MetadataService } from '@agentris/integrations-salesforce';
import type { ConflictDetail } from '@agentris/shared';

export interface ConflictDetectorOptions {
  metadataService: MetadataService;
  impactAnalyzer: ImpactAnalyzerService;
}

export interface ExtendedConflict extends ConflictDetail {
  affectedComponents: string[];
  suggestedActions: string[];
  riskScore: number;
}

export class ConflictDetector {
  private metadataService: MetadataService;
  private impactAnalyzer: ImpactAnalyzerService;

  constructor(options: ConflictDetectorOptions) {
    this.metadataService = options.metadataService;
    this.impactAnalyzer = options.impactAnalyzer;
  }

  async detectConflicts(
    orgId: string,
    proposedChanges: any,
    existingMetadata?: any
  ): Promise<ExtendedConflict[]> {
    const conflicts: ExtendedConflict[] = [];

    if (!existingMetadata && proposedChanges?.objectName) {
      existingMetadata = await this.metadataService.describeObject(orgId, proposedChanges.objectName);
    }

    if (proposedChanges?.fields && existingMetadata?.fields) {
      const fieldConflicts = await this.detectFieldConflicts(
        proposedChanges.fields,
        existingMetadata.fields
      );
      conflicts.push(...fieldConflicts);
    }

    if (proposedChanges?.validationRules && existingMetadata?.validationRules) {
      const validationConflicts = await this.detectValidationRuleConflicts(
        proposedChanges.validationRules,
        existingMetadata.validationRules
      );
      conflicts.push(...validationConflicts);
    }

    const circularDependencies = await this.detectCircularDependencies(
      proposedChanges,
      existingMetadata
    );
    conflicts.push(...circularDependencies);

    const namingConflicts = await this.detectNamingConflicts(
      proposedChanges,
      existingMetadata,
      orgId
    );
    conflicts.push(...namingConflicts);

    return this.prioritizeConflicts(conflicts);
  }

  private async detectFieldConflicts(
    proposedFields: any[],
    existingFields: any[]
  ): Promise<ExtendedConflict[]> {
    const conflicts: ExtendedConflict[] = [];

    for (const proposedField of proposedFields) {
      const impacts = this.impactAnalyzer.analyzeFieldImpacts(proposedField, existingFields);

      for (const impact of impacts) {
        if (impact.impactType === 'conflict') {
          conflicts.push({
            type: 'duplicate',
            severity: impact.severity as 'low' | 'medium' | 'high' | 'critical',
            conflictingComponent: impact.affectedComponents[0] || 'Unknown',
            description: impact.description,
            resolution: this.generateResolution('duplicate', proposedField.name),
            affectedComponents: impact.affectedComponents,
            suggestedActions: this.generateSuggestedActions('duplicate', proposedField),
            riskScore: this.calculateRiskScore(impact.severity)
          });
        } else if (impact.impactType === 'dependency') {
          conflicts.push({
            type: 'dependency',
            severity: impact.severity as 'low' | 'medium' | 'high' | 'critical',
            conflictingComponent: impact.affectedComponents[0] || 'Unknown',
            description: impact.description,
            resolution: this.generateResolution('dependency', proposedField.name),
            affectedComponents: impact.affectedComponents,
            suggestedActions: this.generateSuggestedActions('dependency', proposedField),
            riskScore: this.calculateRiskScore(impact.severity)
          });
        }
      }
    }

    return conflicts;
  }

  private async detectValidationRuleConflicts(
    proposedRules: any[],
    existingRules: any[]
  ): Promise<ExtendedConflict[]> {
    const conflicts: ExtendedConflict[] = [];

    for (const proposedRule of proposedRules) {
      const ruleConflicts = this.impactAnalyzer.checkValidationRuleConflicts(
        proposedRule,
        existingRules
      );

      for (const conflict of ruleConflicts) {
        const conflictType = conflict.conflictType === 'overlap' ? 'duplicate' :
                           conflict.conflictType === 'contradiction' ? 'validation' :
                           'duplicate';

        conflicts.push({
          type: conflictType,
          severity: conflict.severity as 'low' | 'medium' | 'high' | 'critical',
          conflictingComponent: conflict.existingRule || 'Unknown',
          description: conflict.description,
          resolution: this.generateResolution('validation', proposedRule.name),
          affectedComponents: conflict.existingRule ? [conflict.existingRule] : [],
          suggestedActions: this.generateSuggestedActions('validation', proposedRule),
          riskScore: this.calculateRiskScore(conflict.severity)
        });
      }
    }

    return conflicts;
  }

  private async detectCircularDependencies(
    proposedChanges: any,
    existingMetadata: any
  ): Promise<ExtendedConflict[]> {
    const conflicts: ExtendedConflict[] = [];

    if (proposedChanges?.fields) {
      for (const field of proposedChanges.fields) {
        if (field.type === 'Formula' && field.formula) {
          const isCircular = this.checkForCircularReference(
            field,
            proposedChanges.fields,
            existingMetadata?.fields || []
          );

          if (isCircular) {
            conflicts.push({
              type: 'dependency',
              severity: 'critical',
              conflictingComponent: field.name,
              description: `Circular dependency detected in formula field "${field.name}"`,
              resolution: 'Remove circular references from formula',
              affectedComponents: [field.name],
              suggestedActions: [
                'Review formula dependencies',
                'Restructure formula logic to avoid circular references',
                'Consider using workflow rules or process builder instead'
              ],
              riskScore: 90
            });
          }
        }
      }
    }

    return conflicts;
  }

  private async detectNamingConflicts(
    proposedChanges: any,
    existingMetadata: any,
    orgId: string
  ): Promise<ExtendedConflict[]> {
    const conflicts: ExtendedConflict[] = [];

    if (!proposedChanges?.fields) return conflicts;

    const reservedWords = await this.getReservedWords();
    const orgNamingConventions = await this.analyzeOrgNamingConventions(orgId);

    for (const field of proposedChanges.fields) {
      const fieldName = field.name?.replace('__c', '').toLowerCase();

      if (reservedWords.includes(fieldName)) {
        conflicts.push({
          type: 'naming',
          severity: 'high',
          conflictingComponent: field.name,
          description: `Field name "${field.name}" uses reserved word "${fieldName}"`,
          resolution: `Choose a different name that doesn't conflict with reserved words`,
          affectedComponents: [field.name],
          suggestedActions: [
            `Prefix the field name (e.g., "Custom_${field.name}")`,
            'Use a synonym that is not reserved',
            'Add context to make the name unique'
          ],
          riskScore: 75
        });
      }

      if (!this.followsNamingConvention(field.name, orgNamingConventions)) {
        conflicts.push({
          type: 'naming',
          severity: 'low',
          conflictingComponent: field.name,
          description: `Field name "${field.name}" doesn't follow organization naming conventions`,
          resolution: `Rename to follow ${orgNamingConventions.pattern} pattern`,
          affectedComponents: [field.name],
          suggestedActions: orgNamingConventions.suggestions,
          riskScore: 20
        });
      }

      const similarFields = this.findSimilarFieldNames(
        field.name,
        existingMetadata?.fields || []
      );

      if (similarFields.length > 0) {
        conflicts.push({
          type: 'naming',
          severity: 'medium',
          conflictingComponent: similarFields[0],
          description: `Field name "${field.name}" is very similar to existing field "${similarFields[0]}"`,
          resolution: 'Consider using a more distinct name to avoid confusion',
          affectedComponents: similarFields,
          suggestedActions: [
            'Add more specific context to the field name',
            'Use a completely different naming approach',
            `Consider if "${similarFields[0]}" can be reused instead`
          ],
          riskScore: 40
        });
      }
    }

    return conflicts;
  }

  private checkForCircularReference(
    field: any,
    allProposedFields: any[],
    existingFields: any[]
  ): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const allFields = [...allProposedFields, ...existingFields];

    const hasCircularDependency = (fieldName: string): boolean => {
      if (recursionStack.has(fieldName)) {
        return true;
      }

      if (visited.has(fieldName)) {
        return false;
      }

      visited.add(fieldName);
      recursionStack.add(fieldName);

      const currentField = allFields.find(f => f.name === fieldName);
      if (currentField?.formula) {
        const references = this.extractFieldReferences(currentField.formula);
        for (const ref of references) {
          if (hasCircularDependency(ref)) {
            return true;
          }
        }
      }

      recursionStack.delete(fieldName);
      return false;
    };

    return hasCircularDependency(field.name);
  }

  private extractFieldReferences(formula: string): string[] {
    const fieldPattern = /\b([A-Za-z_][A-Za-z0-9_]*__c)\b/g;
    const standardFieldPattern = /\b(Id|Name|CreatedDate|CreatedById|LastModifiedDate|LastModifiedById|OwnerId|RecordTypeId)\b/g;
    
    const customFields = [...(formula.match(fieldPattern) || [])];
    const standardFields = [...(formula.match(standardFieldPattern) || [])];
    
    return [...new Set([...customFields, ...standardFields])];
  }

  private async getReservedWords(): Promise<string[]> {
    return [
      'account', 'case', 'contact', 'lead', 'opportunity',
      'product', 'user', 'task', 'event', 'note',
      'id', 'name', 'type', 'status', 'date',
      'currency', 'percent', 'formula', 'master', 'detail',
      'limit', 'offset', 'order', 'by', 'where',
      'select', 'from', 'and', 'or', 'not'
    ];
  }

  private async analyzeOrgNamingConventions(orgId: string): Promise<any> {
    return {
      pattern: 'PascalCase__c',
      suggestions: [
        'Use PascalCase for field names (e.g., CustomerEmail__c)',
        'Include descriptive context in the name',
        'Avoid abbreviations when possible'
      ]
    };
  }

  private followsNamingConvention(fieldName: string, convention: any): boolean {
    if (!fieldName.endsWith('__c')) return false;

    const baseName = fieldName.replace('__c', '');
    
    if (convention.pattern === 'PascalCase__c') {
      return /^[A-Z][a-zA-Z0-9]*$/.test(baseName);
    } else if (convention.pattern === 'snake_case__c') {
      return /^[a-z]+(_[a-z]+)*$/.test(baseName);
    }

    return true;
  }

  private findSimilarFieldNames(fieldName: string, existingFields: any[]): string[] {
    const similar: string[] = [];
    const normalizedName = fieldName.toLowerCase().replace(/__c$/, '');

    for (const field of existingFields) {
      const existingNormalized = field.name?.toLowerCase().replace(/__c$/, '');
      
      if (!existingNormalized) continue;

      const similarity = this.calculateStringSimilarity(normalizedName, existingNormalized);
      
      if (similarity > 0.7 && similarity < 1) {
        similar.push(field.name);
      }
    }

    return similar;
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private generateResolution(type: string, componentName: string): string {
    switch (type) {
      case 'duplicate':
        return `Choose a different name for "${componentName}" or modify the existing component`;
      case 'dependency':
        return `Ensure all referenced components exist before creating "${componentName}"`;
      case 'validation':
        return `Review and modify validation logic to avoid conflicts`;
      case 'naming':
        return `Rename "${componentName}" to follow naming conventions`;
      default:
        return 'Review and resolve the conflict before proceeding';
    }
  }

  private generateSuggestedActions(type: string, component: any): string[] {
    switch (type) {
      case 'duplicate':
        return [
          `Use a more specific name for ${component.name}`,
          'Check if the existing field can be reused',
          'Add a prefix or suffix to differentiate'
        ];
      case 'dependency':
        return [
          'Create required dependencies first',
          'Update formula to reference existing fields',
          'Consider using a different field type'
        ];
      case 'validation':
        return [
          'Combine validation rules if they serve the same purpose',
          'Adjust validation conditions to avoid overlap',
          'Use custom error messages to differentiate'
        ];
      default:
        return ['Review the conflict and take appropriate action'];
    }
  }

  private calculateRiskScore(severity: string): number {
    switch (severity) {
      case 'critical':
        return 90;
      case 'high':
        return 70;
      case 'medium':
        return 40;
      case 'low':
        return 20;
      default:
        return 10;
    }
  }

  private prioritizeConflicts(conflicts: ExtendedConflict[]): ExtendedConflict[] {
    return conflicts.sort((a, b) => {
      if (a.severity !== b.severity) {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      }
      return b.riskScore - a.riskScore;
    });
  }
}