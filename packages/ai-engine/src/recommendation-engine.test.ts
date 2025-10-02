import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RecommendationEngine } from './recommendation-engine';
import { LLMService } from './llm-service';
import { PatternAnalyzer } from './pattern-analyzer';
import { MetadataService } from '@agentris/integrations-salesforce';
import { prisma } from '@agentris/db';

vi.mock('@agentris/db', () => ({
  prisma: {
    analysis: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn()
    }
  }
}));

describe('RecommendationEngine', () => {
  let engine: RecommendationEngine;
  let mockLLMService: Partial<LLMService>;
  let mockPatternAnalyzer: Partial<PatternAnalyzer>;
  let mockMetadataService: Partial<MetadataService>;

  beforeEach(() => {
    mockLLMService = {
      generateResponse: vi.fn()
    };
    
    mockPatternAnalyzer = {
      analyzeOrgPatterns: vi.fn()
    };
    
    mockMetadataService = {
      describeObject: vi.fn()
    };

    engine = new RecommendationEngine({
      llmService: mockLLMService as LLMService,
      patternAnalyzer: mockPatternAnalyzer as PatternAnalyzer,
      metadataService: mockMetadataService as MetadataService
    });

    vi.clearAllMocks();
  });

  describe('generateRecommendations', () => {
    it('should generate naming convention recommendations', async () => {
      const mockPatterns = {
        namingPatterns: [
          {
            type: 'field',
            pattern: 'PascalCase__c',
            frequency: 10,
            examples: ['CustomerName__c', 'OrderDate__c'],
            confidence: 0.9
          }
        ],
        fieldTypePatterns: [],
        relationshipPatterns: [],
        validationPatterns: [],
        automationPatterns: []
      };

      const context = {
        ticketId: 'ticket123',
        orgId: 'org123',
        proposedChanges: {
          fields: [
            { name: 'customer_name__c', type: 'text', description: 'Customer full name' }
          ]
        }
      };

      (mockPatternAnalyzer.analyzeOrgPatterns as any).mockResolvedValue(mockPatterns);
      (mockLLMService.generateResponse as any).mockResolvedValue(JSON.stringify({
        recommendedName: 'CustomerName__c',
        pattern: 'PascalCase__c',
        rationale: 'Follows organization naming convention',
        examples: ['CustomerEmail__c', 'CustomerPhone__c'],
        confidence: 0.9
      }));

      const recommendations = await engine.generateRecommendations(context);

      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].type).toBe('naming');
      expect(recommendations[0].category).toBe('suggestion');
      expect(recommendations[0].description).toContain('CustomerName__c');
      expect(recommendations[0].confidence).toBe(0.9);
    });

    it('should generate field type recommendations', async () => {
      const mockPatterns = {
        namingPatterns: [],
        fieldTypePatterns: [
          {
            fieldNamePattern: 'email',
            commonType: 'email',
            frequency: 5,
            examples: [
              { fieldName: 'Contact_Email__c', fieldType: 'email', objectName: 'Contact' }
            ]
          }
        ],
        relationshipPatterns: [],
        validationPatterns: [],
        automationPatterns: []
      };

      const context = {
        ticketId: 'ticket123',
        orgId: 'org123',
        proposedChanges: {
          fields: [
            { name: 'Customer_Email__c', type: 'text', description: 'Customer email address' }
          ]
        }
      };

      (mockPatternAnalyzer.analyzeOrgPatterns as any).mockResolvedValue(mockPatterns);
      (mockLLMService.generateResponse as any).mockResolvedValue(JSON.stringify({
        recommendedType: 'email',
        rationale: 'Email fields in your org typically use email type',
        similarFields: [
          { name: 'Contact_Email__c', type: 'email', object: 'Contact' }
        ],
        considerations: ['Enables email validation'],
        confidence: 0.85
      }));

      const recommendations = await engine.generateRecommendations(context);

      const fieldTypeRec = recommendations.find(r => r.type === 'fieldType');
      expect(fieldTypeRec).toBeDefined();
      expect(fieldTypeRec?.description).toContain('email');
      expect(fieldTypeRec?.impact).toBe('medium');
    });

    it('should detect conflicts with existing metadata', async () => {
      const mockPatterns = {
        namingPatterns: [],
        fieldTypePatterns: [],
        relationshipPatterns: [],
        validationPatterns: [],
        automationPatterns: []
      };

      const context = {
        ticketId: 'ticket123',
        orgId: 'org123',
        proposedChanges: {
          objectName: 'Account',
          fields: [
            { name: 'CustomerEmail__c', type: 'email' }
          ]
        }
      };

      const mockExistingMetadata = {
        fields: [
          { name: 'CustomerEmail__c', type: 'text' }
        ]
      };

      (mockPatternAnalyzer.analyzeOrgPatterns as any).mockResolvedValue(mockPatterns);
      (mockMetadataService.describeObject as any).mockResolvedValue(mockExistingMetadata);
      
      const conflictResponse = JSON.stringify({
        conflicts: [
          {
            type: 'duplicate',
            severity: 'high',
            description: 'Field CustomerEmail__c already exists',
            conflictingComponent: 'Account.CustomerEmail__c',
            resolution: 'Use a different field name or modify existing field'
          }
        ]
      });

      (mockLLMService.generateResponse as any).mockImplementation(({ prompt }: any) => {
        if (prompt.includes('potential conflicts')) {
          return Promise.resolve(conflictResponse);
        }
        return Promise.resolve('{}');
      });

      const recommendations = await engine.generateRecommendations(context);

      const conflictRec = recommendations.find(r => r.type === 'conflict');
      expect(conflictRec).toBeDefined();
      expect(conflictRec?.category).toBe('error');
      expect(conflictRec?.description).toContain('already exists');
    });

    it('should suggest related changes', async () => {
      const mockPatterns = {
        namingPatterns: [],
        fieldTypePatterns: [],
        relationshipPatterns: [],
        validationPatterns: [
          { pattern: 'required_field', frequency: 10, examples: [] }
        ],
        automationPatterns: [
          { type: 'flow' as const, frequency: 5 }
        ]
      };

      const context = {
        ticketId: 'ticket123',
        orgId: 'org123',
        proposedChanges: {
          fields: [
            { name: 'RequiredField__c', type: 'text', required: true }
          ]
        }
      };

      (mockPatternAnalyzer.analyzeOrgPatterns as any).mockResolvedValue(mockPatterns);
      
      const relatedChangesResponse = JSON.stringify({
        relatedChanges: [
          {
            type: 'validation_rule',
            description: 'Add validation rule to ensure field is not blank',
            rationale: 'Organization typically uses validation rules for required fields',
            priority: 'recommended'
          },
          {
            type: 'page_layout',
            description: 'Update page layouts to include the new field',
            rationale: 'Field needs to be visible to users',
            priority: 'required'
          }
        ]
      });

      (mockLLMService.generateResponse as any).mockImplementation(({ prompt }: any) => {
        if (prompt.includes('related changes')) {
          return Promise.resolve(relatedChangesResponse);
        }
        return Promise.resolve('{}');
      });

      const recommendations = await engine.generateRecommendations(context);

      const relatedRecs = recommendations.filter(r => r.type === 'automation');
      expect(relatedRecs.length).toBeGreaterThan(0);
      
      const requiredChange = relatedRecs.find(r => r.category === 'warning');
      expect(requiredChange).toBeDefined();
      expect(requiredChange?.impact).toBe('high');
    });

    it('should cache recommendations in database', async () => {
      const mockPatterns = {
        namingPatterns: [],
        fieldTypePatterns: [],
        relationshipPatterns: [],
        validationPatterns: [],
        automationPatterns: []
      };

      const context = {
        ticketId: 'ticket123',
        orgId: 'org123',
        proposedChanges: {}
      };

      (mockPatternAnalyzer.analyzeOrgPatterns as any).mockResolvedValue(mockPatterns);
      (mockLLMService.generateResponse as any).mockResolvedValue('{}');
      (prisma.analysis.findFirst as any).mockResolvedValue(null);

      await engine.generateRecommendations(context);

      expect(prisma.analysis.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ticketId: 'ticket123',
          type: 'COMPLEXITY',
          suggestions: expect.any(Array)
        })
      });
    });

    it('should update existing analysis with recommendations', async () => {
      const mockPatterns = {
        namingPatterns: [],
        fieldTypePatterns: [],
        relationshipPatterns: [],
        validationPatterns: [],
        automationPatterns: []
      };

      const existingAnalysis = {
        id: 'analysis123',
        ticketId: 'ticket123',
        type: 'COMPLEXITY',
        findings: {},
        suggestions: []
      };

      const context = {
        ticketId: 'ticket123',
        orgId: 'org123',
        proposedChanges: {}
      };

      (mockPatternAnalyzer.analyzeOrgPatterns as any).mockResolvedValue(mockPatterns);
      (mockLLMService.generateResponse as any).mockResolvedValue('{}');
      (prisma.analysis.findFirst as any).mockResolvedValue(existingAnalysis);

      await engine.generateRecommendations(context);

      expect(prisma.analysis.update).toHaveBeenCalledWith({
        where: { id: 'analysis123' },
        data: {
          suggestions: expect.any(Array)
        }
      });
    });
  });

  describe('generateIntelligentSuggestions', () => {
    it('should generate comprehensive recommendations based on ticket description', async () => {
      const mockPatterns = {
        namingPatterns: [
          { type: 'field', pattern: 'PascalCase__c', frequency: 10, examples: [], confidence: 0.9 }
        ],
        fieldTypePatterns: [],
        relationshipPatterns: [],
        validationPatterns: [],
        automationPatterns: []
      };

      const context = {
        ticketId: 'ticket123',
        orgId: 'org123',
        proposedChanges: {
          fields: [{ name: 'NewField__c', type: 'text' }]
        }
      };

      const ticketDescription = 'Add a field to track customer email preferences';

      const intelligentResponse = {
        recommendations: [
          {
            type: 'naming',
            category: 'suggestion',
            title: 'Field Naming',
            description: 'Consider naming the field EmailPreferences__c',
            rationale: 'Follows PascalCase convention used in organization',
            confidence: 0.9,
            examples: ['EmailOptIn__c', 'EmailFrequency__c'],
            impact: 'low'
          },
          {
            type: 'fieldType',
            category: 'suggestion',
            title: 'Field Type',
            description: 'Consider using a picklist for preferences',
            rationale: 'Preference fields typically use picklists for controlled values',
            confidence: 0.75,
            examples: ['CommunicationPreference__c'],
            impact: 'medium'
          }
        ],
        summary: {
          totalRecommendations: 2,
          criticalIssues: 0,
          estimatedEffort: 'low'
        }
      };

      (mockPatternAnalyzer.analyzeOrgPatterns as any).mockResolvedValue(mockPatterns);
      (mockLLMService.generateResponse as any).mockResolvedValue(JSON.stringify(intelligentResponse));
      (prisma.analysis.findFirst as any).mockResolvedValue(null);

      const recommendations = await engine.generateIntelligentSuggestions(context, ticketDescription);

      expect(recommendations).toHaveLength(2);
      expect(recommendations[0].type).toBe('naming');
      expect(recommendations[1].type).toBe('fieldType');
      expect(prisma.analysis.create).toHaveBeenCalled();
    });

    it('should handle LLM response parsing errors gracefully', async () => {
      const mockPatterns = {
        namingPatterns: [],
        fieldTypePatterns: [],
        relationshipPatterns: [],
        validationPatterns: [],
        automationPatterns: []
      };

      const context = {
        ticketId: 'ticket123',
        orgId: 'org123'
      };

      (mockPatternAnalyzer.analyzeOrgPatterns as any).mockResolvedValue(mockPatterns);
      (mockLLMService.generateResponse as any).mockResolvedValue('Invalid JSON response');

      const recommendations = await engine.generateIntelligentSuggestions(context, 'Test description');

      expect(recommendations).toEqual([]);
    });
  });
});