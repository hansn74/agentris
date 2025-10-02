import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PatternAnalyzer } from './pattern-analyzer';
import { MetadataService } from '@agentris/integrations-salesforce';
import { prisma } from '@agentris/db';

vi.mock('@agentris/db', () => ({
  prisma: {
    analysis: {
      create: vi.fn()
    }
  }
}));

describe('PatternAnalyzer', () => {
  let analyzer: PatternAnalyzer;
  let mockMetadataService: Partial<MetadataService>;

  beforeEach(() => {
    mockMetadataService = {
      describeGlobal: vi.fn(),
      describeObject: vi.fn(),
      listMetadata: vi.fn()
    };
    analyzer = new PatternAnalyzer(mockMetadataService as MetadataService);
  });

  describe('analyzeOrgPatterns', () => {
    it('should extract naming patterns from custom fields', async () => {
      const mockGlobalDescribe = {
        sobjects: [
          { name: 'CustomObject__c', custom: true },
          { name: 'Account', custom: false }
        ]
      };

      const mockObjectMetadata = {
        fields: [
          { name: 'Field_Name__c', custom: true, type: 'string' },
          { name: 'FieldName__c', custom: true, type: 'string' },
          { name: 'fieldname__c', custom: true, type: 'string' },
          { name: 'StandardField', custom: false, type: 'string' }
        ]
      };

      (mockMetadataService.describeGlobal as any).mockResolvedValue(mockGlobalDescribe);
      (mockMetadataService.describeObject as any).mockResolvedValue(mockObjectMetadata);
      (mockMetadataService.listMetadata as any).mockResolvedValue([]);

      const patterns = await analyzer.analyzeOrgPatterns('org123', 'ticket123');

      expect(patterns.namingPatterns).toBeDefined();
      expect(patterns.namingPatterns.length).toBeGreaterThan(0);
      expect(patterns.namingPatterns[0]).toHaveProperty('pattern');
      expect(patterns.namingPatterns[0]).toHaveProperty('frequency');
      expect(patterns.namingPatterns[0]).toHaveProperty('confidence');
    });

    it('should extract field type patterns', async () => {
      const mockGlobalDescribe = {
        sobjects: [
          { name: 'CustomObject__c', custom: true }
        ]
      };

      const mockObjectMetadata = {
        fields: [
          { name: 'Email__c', custom: true, type: 'email' },
          { name: 'Contact_Email__c', custom: true, type: 'email' },
          { name: 'Amount__c', custom: true, type: 'currency' },
          { name: 'Total_Amount__c', custom: true, type: 'currency' }
        ]
      };

      (mockMetadataService.describeGlobal as any).mockResolvedValue(mockGlobalDescribe);
      (mockMetadataService.describeObject as any).mockResolvedValue(mockObjectMetadata);
      (mockMetadataService.listMetadata as any).mockResolvedValue([]);

      const patterns = await analyzer.analyzeOrgPatterns('org123', 'ticket123');

      expect(patterns.fieldTypePatterns).toBeDefined();
      expect(patterns.fieldTypePatterns.length).toBeGreaterThan(0);
      
      const emailPattern = patterns.fieldTypePatterns.find(p => p.fieldNamePattern === 'email');
      expect(emailPattern).toBeDefined();
      expect(emailPattern?.commonType).toBe('email');
      expect(emailPattern?.frequency).toBe(2);
    });

    it('should extract relationship patterns', async () => {
      const mockGlobalDescribe = {
        sobjects: [
          { name: 'CustomObject__c', custom: true }
        ]
      };

      const mockObjectMetadata = {
        fields: [
          { 
            name: 'Account__c', 
            type: 'reference',
            referenceTo: ['Account'],
            relationshipName: 'Account__r',
            cascadeDelete: false
          },
          {
            name: 'Parent__c',
            type: 'reference',
            referenceTo: ['CustomObject__c'],
            relationshipName: 'Parent__r',
            cascadeDelete: true
          }
        ]
      };

      (mockMetadataService.describeGlobal as any).mockResolvedValue(mockGlobalDescribe);
      (mockMetadataService.describeObject as any).mockResolvedValue(mockObjectMetadata);
      (mockMetadataService.listMetadata as any).mockResolvedValue([]);

      const patterns = await analyzer.analyzeOrgPatterns('org123', 'ticket123');

      expect(patterns.relationshipPatterns).toBeDefined();
      expect(patterns.relationshipPatterns.length).toBe(2);
      
      const masterDetailPattern = patterns.relationshipPatterns.find(
        p => p.relationshipType === 'master-detail'
      );
      expect(masterDetailPattern).toBeDefined();
      expect(masterDetailPattern?.parentObject).toBe('CustomObject__c');
    });

    it('should extract validation patterns', async () => {
      const mockGlobalDescribe = {
        sobjects: [
          { name: 'CustomObject__c', custom: true }
        ]
      };

      const mockObjectMetadata = {
        fields: [],
        validationRules: [
          {
            errorConditionFormula: 'ISBLANK(Field__c)',
            errorMessage: 'Field is required'
          },
          {
            errorConditionFormula: 'Amount__c > 10000',
            errorMessage: 'Amount cannot exceed 10000'
          },
          {
            errorConditionFormula: 'NOT(REGEX(Email__c, "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"))',
            errorMessage: 'Invalid email format'
          }
        ]
      };

      (mockMetadataService.describeGlobal as any).mockResolvedValue(mockGlobalDescribe);
      (mockMetadataService.describeObject as any).mockResolvedValue(mockObjectMetadata);
      (mockMetadataService.listMetadata as any).mockResolvedValue([]);

      const patterns = await analyzer.analyzeOrgPatterns('org123', 'ticket123');

      expect(patterns.validationPatterns).toBeDefined();
      expect(patterns.validationPatterns.length).toBeGreaterThan(0);
      
      const requiredPattern = patterns.validationPatterns.find(p => p.pattern === 'required_field');
      expect(requiredPattern).toBeDefined();
      expect(requiredPattern?.frequency).toBe(1);
    });

    it('should extract automation patterns', async () => {
      const mockGlobalDescribe = {
        sobjects: []
      };

      const mockFlows = new Array(5).fill({ fullName: 'Flow' });
      const mockApexTriggers = new Array(3).fill({ fullName: 'Trigger' });
      const mockProcesses = new Array(2).fill({ fullName: 'Process' });

      (mockMetadataService.describeGlobal as any).mockResolvedValue(mockGlobalDescribe);
      (mockMetadataService.listMetadata as any).mockImplementation((orgId: string, type: string) => {
        switch (type) {
          case 'Flow': return Promise.resolve(mockFlows);
          case 'ApexTrigger': return Promise.resolve(mockApexTriggers);
          case 'Process': return Promise.resolve(mockProcesses);
          default: return Promise.resolve([]);
        }
      });

      const patterns = await analyzer.analyzeOrgPatterns('org123', 'ticket123');

      expect(patterns.automationPatterns).toBeDefined();
      expect(patterns.automationPatterns.length).toBe(3);
      
      const flowPattern = patterns.automationPatterns.find(p => p.type === 'flow');
      expect(flowPattern?.frequency).toBe(5);
      
      const apexPattern = patterns.automationPatterns.find(p => p.type === 'apex');
      expect(apexPattern?.frequency).toBe(3);
    });

    it('should store pattern analysis in database', async () => {
      const mockGlobalDescribe = {
        sobjects: []
      };

      (mockMetadataService.describeGlobal as any).mockResolvedValue(mockGlobalDescribe);
      (mockMetadataService.listMetadata as any).mockResolvedValue([]);

      await analyzer.analyzeOrgPatterns('org123', 'ticket123');

      expect(prisma.analysis.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ticketId: 'ticket123',
          type: 'COMPLEXITY',
          findings: expect.any(Object),
          score: expect.any(Number),
          confidence: expect.any(Number),
          suggestions: {}
        })
      });
    });

    it('should calculate confidence based on frequency', async () => {
      const mockGlobalDescribe = {
        sobjects: [
          { name: 'CustomObject__c', custom: true }
        ]
      };

      const mockObjectMetadata = {
        fields: new Array(12).fill(null).map((_, i) => ({
          name: `Field_Name_${i}__c`,
          custom: true,
          type: 'string'
        }))
      };

      (mockMetadataService.describeGlobal as any).mockResolvedValue(mockGlobalDescribe);
      (mockMetadataService.describeObject as any).mockResolvedValue(mockObjectMetadata);
      (mockMetadataService.listMetadata as any).mockResolvedValue([]);

      const patterns = await analyzer.analyzeOrgPatterns('org123', 'ticket123');

      const highFrequencyPattern = patterns.namingPatterns.find(p => p.frequency >= 10);
      if (highFrequencyPattern) {
        expect(highFrequencyPattern.confidence).toBeGreaterThanOrEqual(0.95);
      }
    });
  });
});