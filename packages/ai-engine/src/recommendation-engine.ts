import { LLMService } from './llm-service';
import { PatternAnalyzer } from './pattern-analyzer';
import { prisma } from '@agentris/db';
import { MetadataService } from '@agentris/integrations-salesforce';
import type {
  Recommendation,
  OrgPatterns,
  RecommendationContext,
  ConflictDetail,
  FieldTypePattern,
  NamingPattern
} from '@agentris/shared';
import {
  namingConventionPrompt,
  fieldTypeRecommendationPrompt,
  relatedChangesPrompt,
  conflictDetectionPrompt,
  intelligentSuggestionPrompt
} from './prompts/recommendation';

export interface RecommendationEngineOptions {
  llmService: LLMService;
  patternAnalyzer: PatternAnalyzer;
  metadataService: MetadataService;
}

export class RecommendationEngine {
  private llmService: LLMService;
  private patternAnalyzer: PatternAnalyzer;
  private metadataService: MetadataService;

  constructor(options: RecommendationEngineOptions) {
    this.llmService = options.llmService;
    this.patternAnalyzer = options.patternAnalyzer;
    this.metadataService = options.metadataService;
  }

  async generateRecommendations(context: RecommendationContext): Promise<Recommendation[]> {
    const { ticketId, orgId, proposedChanges } = context;

    const patterns = await this.patternAnalyzer.analyzeOrgPatterns(orgId, ticketId);
    const existingMetadata = await this.fetchExistingMetadata(orgId, proposedChanges);

    const recommendations: Recommendation[] = [];

    if (proposedChanges?.fields) {
      const namingRecs = await this.generateNamingRecommendations(
        proposedChanges.fields,
        patterns.namingPatterns
      );
      recommendations.push(...namingRecs);

      const fieldTypeRecs = await this.generateFieldTypeRecommendations(
        proposedChanges.fields,
        patterns.fieldTypePatterns
      );
      recommendations.push(...fieldTypeRecs);
    }

    const relatedChangeRecs = await this.generateRelatedChangeRecommendations(
      proposedChanges,
      patterns
    );
    recommendations.push(...relatedChangeRecs);

    const conflicts = await this.detectConflicts(proposedChanges, existingMetadata);
    const conflictRecs = this.conflictsToRecommendations(conflicts);
    recommendations.push(...conflictRecs);

    await this.cacheRecommendations(ticketId, recommendations);

    return recommendations;
  }

  private async generateNamingRecommendations(
    fields: any[],
    patterns: NamingPattern[]
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    for (const field of fields) {
      const prompt = namingConventionPrompt
        .replace('{patterns}', JSON.stringify(patterns))
        .replace('{proposedName}', field.name);

      const response = await this.llmService.generateResponse({
        prompt,
        temperature: 0.3,
        maxTokens: 500
      });

      try {
        const result = JSON.parse(response);
        
        if (result.recommendedName !== field.name) {
          recommendations.push({
            id: `naming-${field.name}`,
            type: 'naming',
            category: 'suggestion',
            title: `Naming Convention: ${field.name}`,
            description: `Consider renaming to '${result.recommendedName}' to follow organization patterns`,
            rationale: result.rationale,
            confidence: result.confidence,
            examples: result.examples,
            impact: 'low'
          });
        }
      } catch (error) {
        console.error('Error parsing naming recommendation:', error);
      }
    }

    return recommendations;
  }

  private async generateFieldTypeRecommendations(
    fields: any[],
    patterns: FieldTypePattern[]
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    for (const field of fields) {
      const fieldNamePattern = this.getFieldNamePattern(field.name);
      const matchingPatterns = patterns.filter(p => p.fieldNamePattern === fieldNamePattern);

      if (matchingPatterns.length > 0) {
        const prompt = fieldTypeRecommendationPrompt
          .replace('{patterns}', JSON.stringify(matchingPatterns))
          .replace('{fieldName}', field.name)
          .replace('{fieldPurpose}', field.description || 'Not specified')
          .replace('{currentType}', field.type);

        const response = await this.llmService.generateResponse({
          prompt,
          temperature: 0.3,
          maxTokens: 500
        });

        try {
          const result = JSON.parse(response);
          
          if (result.recommendedType !== field.type) {
            recommendations.push({
              id: `fieldtype-${field.name}`,
              type: 'fieldType',
              category: 'suggestion',
              title: `Field Type: ${field.name}`,
              description: `Consider using '${result.recommendedType}' type based on similar fields`,
              rationale: result.rationale,
              confidence: result.confidence,
              examples: result.similarFields.map((f: any) => `${f.name} (${f.type})`),
              impact: 'medium'
            });
          }
        } catch (error) {
          console.error('Error parsing field type recommendation:', error);
        }
      }
    }

    return recommendations;
  }

  private async generateRelatedChangeRecommendations(
    proposedChanges: any,
    patterns: OrgPatterns
  ): Promise<Recommendation[]> {
    const prompt = relatedChangesPrompt
      .replace('{change}', JSON.stringify(proposedChanges))
      .replace('{patterns}', JSON.stringify(patterns));

    const response = await this.llmService.generateResponse({
      prompt,
      temperature: 0.4,
      maxTokens: 800
    });

    const recommendations: Recommendation[] = [];

    try {
      const result = JSON.parse(response);
      
      if (!result.relatedChanges || !Array.isArray(result.relatedChanges)) {
        return recommendations;
      }
      
      for (const change of result.relatedChanges) {
        const recommendation: Recommendation = {
          id: `related-${Date.now()}-${Math.random()}`,
          type: 'automation',
          category: change.priority === 'required' ? 'warning' : 'suggestion',
          title: `Related Change: ${change.type}`,
          description: change.description,
          rationale: change.rationale,
          confidence: change.priority === 'required' ? 0.9 : 0.7,
          impact: change.priority === 'required' ? 'high' : 'medium'
        };

        if (change.priority === 'required') {
          recommendation.relatedChanges = [recommendation];
        }

        recommendations.push(recommendation);
      }
    } catch (error) {
      console.error('Error parsing related changes:', error);
    }

    return recommendations;
  }

  private async detectConflicts(
    proposedChanges: any,
    existingMetadata: any
  ): Promise<ConflictDetail[]> {
    const prompt = conflictDetectionPrompt
      .replace('{changes}', JSON.stringify(proposedChanges))
      .replace('{metadata}', JSON.stringify(existingMetadata));

    const response = await this.llmService.generateResponse({
      prompt,
      temperature: 0.2,
      maxTokens: 1000
    });

    try {
      const result = JSON.parse(response);
      return result.conflicts || [];
    } catch (error) {
      console.error('Error detecting conflicts:', error);
      return [];
    }
  }

  private conflictsToRecommendations(conflicts: ConflictDetail[]): Recommendation[] {
    return conflicts.map(conflict => ({
      id: `conflict-${Date.now()}-${Math.random()}`,
      type: 'conflict',
      category: conflict.severity === 'critical' || conflict.severity === 'high' ? 'error' : 'warning',
      title: `Conflict: ${conflict.type}`,
      description: conflict.description,
      rationale: `Conflicts with ${conflict.conflictingComponent}`,
      confidence: 1.0,
      impact: conflict.severity as 'low' | 'medium' | 'high'
    }));
  }

  private async fetchExistingMetadata(orgId: string, proposedChanges: any): Promise<any> {
    const metadata: any = {};

    if (proposedChanges?.objectName) {
      try {
        metadata.object = await this.metadataService.describeObject(orgId, proposedChanges.objectName);
      } catch (error) {
        console.error('Error fetching object metadata:', error);
      }
    }

    return metadata;
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

  private async cacheRecommendations(ticketId: string, recommendations: Recommendation[]): Promise<void> {
    const existingAnalysis = await prisma.analysis.findFirst({
      where: {
        ticketId,
        type: 'COMPLEXITY'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (existingAnalysis) {
      await prisma.analysis.update({
        where: { id: existingAnalysis.id },
        data: {
          suggestions: recommendations as any
        }
      });
    } else {
      await prisma.analysis.create({
        data: {
          ticketId,
          type: 'COMPLEXITY',
          findings: {},
          score: 0.5,
          confidence: 0.7,
          suggestions: recommendations as any
        }
      });
    }
  }

  async generateIntelligentSuggestions(
    context: RecommendationContext,
    ticketDescription: string
  ): Promise<Recommendation[]> {
    const patterns = await this.patternAnalyzer.analyzeOrgPatterns(context.orgId, context.ticketId);

    const prompt = intelligentSuggestionPrompt
      .replace('{orgId}', context.orgId)
      .replace('{ticketDescription}', ticketDescription)
      .replace('{patterns}', JSON.stringify(patterns))
      .replace('{proposedChanges}', JSON.stringify(context.proposedChanges || {}));

    const response = await this.llmService.generateResponse({
      prompt,
      temperature: 0.4,
      maxTokens: 1500
    });

    try {
      const result = JSON.parse(response);
      await this.cacheRecommendations(context.ticketId, result.recommendations);
      return result.recommendations;
    } catch (error) {
      console.error('Error generating intelligent suggestions:', error);
      return [];
    }
  }
}