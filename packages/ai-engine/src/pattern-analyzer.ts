import { MetadataService } from '@agentris/integrations-salesforce';
import { prisma } from '@agentris/db';
import type { 
  NamingPattern, 
  FieldTypePattern, 
  RelationshipPattern, 
  OrgPatterns 
} from '@agentris/shared';

export class PatternAnalyzer {
  private metadataService: MetadataService;

  constructor(metadataService: MetadataService) {
    this.metadataService = metadataService;
  }

  async analyzeOrgPatterns(orgId: string, ticketId: string): Promise<OrgPatterns> {
    const globalDescribe = await this.metadataService.describeGlobal(orgId);
    
    const namingPatterns = await this.extractNamingPatterns(orgId, globalDescribe);
    const fieldTypePatterns = await this.extractFieldTypePatterns(orgId, globalDescribe);
    const relationshipPatterns = await this.extractRelationshipPatterns(orgId, globalDescribe);
    const validationPatterns = await this.extractValidationPatterns(orgId, globalDescribe);
    const automationPatterns = await this.extractAutomationPatterns(orgId);

    const orgPatterns: OrgPatterns = {
      namingPatterns,
      fieldTypePatterns,
      relationshipPatterns,
      validationPatterns,
      automationPatterns
    };

    await this.storePatternAnalysis(ticketId, orgPatterns);

    return orgPatterns;
  }

  private async extractNamingPatterns(
    orgId: string, 
    globalDescribe: any
  ): Promise<NamingPattern[]> {
    const patterns: Map<string, NamingPattern> = new Map();
    
    for (const sobject of globalDescribe.sobjects) {
      if (!sobject.custom) continue;
      
      const objectMetadata = await this.metadataService.describeObject(orgId, sobject.name);
      
      for (const field of objectMetadata.fields) {
        if (!field.custom) continue;
        
        const pattern = this.detectNamingPattern(field.name);
        if (!patterns.has(pattern)) {
          patterns.set(pattern, {
            type: 'field',
            pattern,
            frequency: 0,
            examples: [],
            confidence: 0
          });
        }
        
        const patternData = patterns.get(pattern)!;
        patternData.frequency++;
        if (patternData.examples.length < 5) {
          patternData.examples.push(field.name);
        }
      }
    }
    
    return Array.from(patterns.values()).map(p => ({
      ...p,
      confidence: this.calculateConfidence(p.frequency)
    }));
  }

  private async extractFieldTypePatterns(
    orgId: string,
    globalDescribe: any
  ): Promise<FieldTypePattern[]> {
    const patterns: Map<string, FieldTypePattern> = new Map();
    
    for (const sobject of globalDescribe.sobjects) {
      const objectMetadata = await this.metadataService.describeObject(orgId, sobject.name);
      
      for (const field of objectMetadata.fields) {
        const namePattern = this.getFieldNamePattern(field.name);
        const key = `${namePattern}-${field.type}`;
        
        if (!patterns.has(key)) {
          patterns.set(key, {
            fieldNamePattern: namePattern,
            commonType: field.type,
            frequency: 0,
            examples: []
          });
        }
        
        const patternData = patterns.get(key)!;
        patternData.frequency++;
        if (patternData.examples.length < 3) {
          patternData.examples.push({
            fieldName: field.name,
            fieldType: field.type,
            objectName: sobject.name
          });
        }
      }
    }
    
    return Array.from(patterns.values())
      .filter(p => p.frequency > 1)
      .sort((a, b) => b.frequency - a.frequency);
  }

  private async extractRelationshipPatterns(
    orgId: string,
    globalDescribe: any
  ): Promise<RelationshipPattern[]> {
    const patterns: RelationshipPattern[] = [];
    const relationshipMap = new Map<string, RelationshipPattern>();
    
    for (const sobject of globalDescribe.sobjects) {
      const objectMetadata = await this.metadataService.describeObject(orgId, sobject.name);
      
      for (const field of objectMetadata.fields) {
        if (field.type === 'reference' && field.referenceTo) {
          const key = `${sobject.name}-${field.referenceTo[0]}`;
          const relationshipType = field.cascadeDelete 
            ? 'master-detail' 
            : 'lookup';
          
          if (!relationshipMap.has(key)) {
            relationshipMap.set(key, {
              parentObject: field.referenceTo[0],
              childObject: sobject.name,
              relationshipType,
              frequency: 0
            });
          }
          
          relationshipMap.get(key)!.frequency++;
        }
      }
    }
    
    return Array.from(relationshipMap.values());
  }

  private async extractValidationPatterns(
    orgId: string,
    globalDescribe: any
  ): Promise<Array<{ pattern: string; frequency: number; examples: string[] }>> {
    const patterns: Map<string, { pattern: string; frequency: number; examples: string[] }> = new Map();
    
    for (const sobject of globalDescribe.sobjects) {
      const objectMetadata = await this.metadataService.describeObject(orgId, sobject.name);
      
      if (objectMetadata.validationRules) {
        for (const rule of objectMetadata.validationRules) {
          const pattern = this.detectValidationPattern(rule.errorConditionFormula);
          
          if (!patterns.has(pattern)) {
            patterns.set(pattern, {
              pattern,
              frequency: 0,
              examples: []
            });
          }
          
          const patternData = patterns.get(pattern)!;
          patternData.frequency++;
          if (patternData.examples.length < 3) {
            patternData.examples.push(rule.errorMessage);
          }
        }
      }
    }
    
    return Array.from(patterns.values());
  }

  private async extractAutomationPatterns(
    orgId: string
  ): Promise<Array<{ type: 'flow' | 'apex' | 'process'; frequency: number }>> {
    const patterns = {
      flow: 0,
      apex: 0,
      process: 0
    };
    
    try {
      const flows = await this.metadataService.listMetadata(orgId, 'Flow');
      patterns.flow = flows?.length || 0;
      
      const apexTriggers = await this.metadataService.listMetadata(orgId, 'ApexTrigger');
      patterns.apex = apexTriggers?.length || 0;
      
      const processes = await this.metadataService.listMetadata(orgId, 'Process');
      patterns.process = processes?.length || 0;
    } catch (error) {
      console.error('Error extracting automation patterns:', error);
    }
    
    return Object.entries(patterns).map(([type, frequency]) => ({
      type: type as 'flow' | 'apex' | 'process',
      frequency
    }));
  }

  private detectNamingPattern(fieldName: string): string {
    if (fieldName.endsWith('__c')) {
      const baseName = fieldName.replace('__c', '');
      
      if (baseName.includes('_')) {
        return 'snake_case__c';
      } else if (/[A-Z]/.test(baseName) && /[a-z]/.test(baseName)) {
        return 'PascalCase__c';
      } else if (baseName === baseName.toLowerCase()) {
        return 'lowercase__c';
      }
    }
    
    return 'standard';
  }

  private getFieldNamePattern(fieldName: string): string {
    const baseName = fieldName.replace('__c', '').toLowerCase();
    
    if (baseName.includes('date') || baseName.includes('time')) return 'temporal';
    if (baseName.includes('amount') || baseName.includes('price') || baseName.includes('cost')) return 'monetary';
    if (baseName.includes('count') || baseName.includes('number') || baseName.includes('qty')) return 'numeric';
    if (baseName.includes('email')) return 'email';
    if (baseName.includes('phone') || baseName.includes('mobile')) return 'phone';
    if (baseName.includes('url') || baseName.includes('link')) return 'url';
    if (baseName.includes('description') || baseName.includes('notes') || baseName.includes('comments')) return 'text_long';
    if (baseName.includes('status') || baseName.includes('stage') || baseName.includes('type')) return 'picklist';
    if (baseName.includes('is') || baseName.includes('has') || baseName.includes('can')) return 'boolean';
    
    return 'general';
  }

  private detectValidationPattern(formula: string): string {
    if (formula.includes('ISBLANK')) return 'required_field';
    if (formula.includes('REGEX')) return 'format_validation';
    if (formula.includes('TODAY()') || formula.includes('NOW()')) return 'date_validation';
    if (formula.includes('>') || formula.includes('<') || formula.includes('>=') || formula.includes('<=')) return 'range_validation';
    if (formula.includes('CONTAINS') || formula.includes('INCLUDES')) return 'value_restriction';
    if (formula.includes('AND(') || formula.includes('OR(')) return 'complex_logic';
    
    return 'custom';
  }

  private calculateConfidence(frequency: number): number {
    if (frequency >= 10) return 0.95;
    if (frequency >= 5) return 0.85;
    if (frequency >= 3) return 0.70;
    if (frequency >= 2) return 0.50;
    return 0.30;
  }

  private async storePatternAnalysis(ticketId: string, patterns: OrgPatterns): Promise<void> {
    await prisma.analysis.create({
      data: {
        ticketId,
        type: 'COMPLEXITY',
        findings: patterns as any,
        score: this.calculatePatternScore(patterns),
        confidence: this.calculateOverallConfidence(patterns),
        suggestions: {}
      }
    });
  }

  private calculatePatternScore(patterns: OrgPatterns): number {
    const namingScore = patterns.namingPatterns.length > 0 ? 1 : 0;
    const fieldTypeScore = patterns.fieldTypePatterns.length > 0 ? 1 : 0;
    const relationshipScore = patterns.relationshipPatterns.length > 0 ? 1 : 0;
    const validationScore = patterns.validationPatterns.length > 0 ? 1 : 0;
    const automationScore = patterns.automationPatterns.some(p => p.frequency > 0) ? 1 : 0;
    
    return (namingScore + fieldTypeScore + relationshipScore + validationScore + automationScore) / 5;
  }

  private calculateOverallConfidence(patterns: OrgPatterns): number {
    const confidences: number[] = [];
    
    patterns.namingPatterns.forEach(p => confidences.push(p.confidence));
    
    if (confidences.length === 0) return 0.5;
    
    return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  }
}