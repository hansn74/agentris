import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictDetector } from './conflict-detector';
import { ImpactAnalyzerService } from '@agentris/services';
import { MetadataService } from '@agentris/integrations-salesforce';

describe('ConflictDetector', () => {
  let detector: ConflictDetector;
  let mockMetadataService: Partial<MetadataService>;
  let mockImpactAnalyzer: Partial<ImpactAnalyzerService>;

  beforeEach(() => {
    mockMetadataService = {
      describeObject: vi.fn()
    };

    mockImpactAnalyzer = {
      analyzeFieldImpacts: vi.fn(),
      checkValidationRuleConflicts: vi.fn()
    };

    detector = new ConflictDetector({
      metadataService: mockMetadataService as MetadataService,
      impactAnalyzer: mockImpactAnalyzer as ImpactAnalyzerService
    });
  });

  describe('detectConflicts', () => {
    it('should detect duplicate field name conflicts', async () => {
      const proposedChanges = {
        objectName: 'Account',
        fields: [
          { name: 'CustomerEmail__c', type: 'email', label: 'Customer Email' }
        ]
      };

      const existingMetadata = {
        fields: [
          { name: 'CustomerEmail__c', type: 'text', label: 'Customer Email' }
        ]
      };

      (mockImpactAnalyzer.analyzeFieldImpacts as any).mockReturnValue([
        {
          fieldName: 'CustomerEmail__c',
          impactType: 'conflict',
          severity: 'high',
          description: 'Field name "CustomerEmail__c" already exists',
          affectedComponents: ['CustomerEmail__c']
        }
      ]);

      const conflicts = await detector.detectConflicts('org123', proposedChanges, existingMetadata);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe('duplicate');
      expect(conflicts[0].severity).toBe('high');
      expect(conflicts[0].conflictingComponent).toBe('CustomerEmail__c');
      expect(conflicts[0].suggestedActions).toBeDefined();
      expect(conflicts[0].suggestedActions.length).toBeGreaterThan(0);
    });

    it('should detect field dependency conflicts', async () => {
      const proposedChanges = {
        fields: [
          {
            name: 'TotalPrice__c',
            type: 'Formula',
            formula: 'Quantity__c * UnitPrice__c'
          }
        ]
      };

      const existingMetadata = {
        fields: [
          { name: 'UnitPrice__c', type: 'currency' }
        ]
      };

      (mockImpactAnalyzer.analyzeFieldImpacts as any).mockReturnValue([
        {
          fieldName: 'TotalPrice__c',
          impactType: 'dependency',
          severity: 'high',
          description: 'Formula references non-existent fields: Quantity__c',
          affectedComponents: ['Quantity__c']
        }
      ]);

      const conflicts = await detector.detectConflicts('org123', proposedChanges, existingMetadata);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe('dependency');
      expect(conflicts[0].description).toContain('non-existent fields');
      expect(conflicts[0].resolution).toContain('Ensure all referenced components exist');
    });

    it('should detect validation rule conflicts', async () => {
      const proposedChanges = {
        validationRules: [
          {
            name: 'RequireEmail',
            errorConditionFormula: 'ISBLANK(Email__c)',
            errorMessage: 'Email is required'
          }
        ]
      };

      const existingMetadata = {
        validationRules: [
          {
            name: 'RequireEmail',
            errorConditionFormula: 'ISBLANK(Email__c)',
            errorMessage: 'Email field cannot be empty'
          }
        ]
      };

      (mockImpactAnalyzer.checkValidationRuleConflicts as any).mockReturnValue([
        {
          ruleName: 'RequireEmail',
          conflictType: 'overlap',
          severity: 'high',
          description: 'Validation rule name "RequireEmail" already exists',
          existingRule: 'RequireEmail'
        }
      ]);

      const conflicts = await detector.detectConflicts('org123', proposedChanges, existingMetadata);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe('duplicate');
      expect(conflicts[0].severity).toBe('high');
      expect(conflicts[0].affectedComponents).toContain('RequireEmail');
    });

    it('should detect circular dependencies in formula fields', async () => {
      const proposedChanges = {
        fields: [
          {
            name: 'FieldA__c',
            type: 'Formula',
            formula: 'FieldB__c + 1'
          },
          {
            name: 'FieldB__c',
            type: 'Formula',
            formula: 'FieldA__c * 2'
          }
        ]
      };

      const existingMetadata = { fields: [] };

      (mockImpactAnalyzer.analyzeFieldImpacts as any).mockReturnValue([]);

      const conflicts = await detector.detectConflicts('org123', proposedChanges, existingMetadata);

      const circularConflicts = conflicts.filter(c => 
        c.type === 'dependency' && c.description.includes('Circular')
      );

      expect(circularConflicts.length).toBeGreaterThan(0);
      expect(circularConflicts[0].severity).toBe('critical');
      expect(circularConflicts[0].riskScore).toBe(90);
    });

    it('should detect naming conflicts with reserved words', async () => {
      const proposedChanges = {
        fields: [
          { name: 'Account__c', type: 'text' },
          { name: 'Select__c', type: 'text' }
        ]
      };

      const existingMetadata = { fields: [] };

      (mockImpactAnalyzer.analyzeFieldImpacts as any).mockReturnValue([]);

      const conflicts = await detector.detectConflicts('org123', proposedChanges, existingMetadata);

      const namingConflicts = conflicts.filter(c => c.type === 'naming');
      expect(namingConflicts.length).toBeGreaterThan(0);
      
      const reservedWordConflict = namingConflicts.find(c => 
        c.description.includes('reserved word')
      );
      expect(reservedWordConflict).toBeDefined();
      expect(reservedWordConflict?.severity).toBe('high');
    });

    it('should detect similar field names', async () => {
      const proposedChanges = {
        fields: [
          { name: 'CustomerEmail__c', type: 'email' }
        ]
      };

      const existingMetadata = {
        fields: [
          { name: 'Customer_Email__c', type: 'email' },
          { name: 'CustomrEmail__c', type: 'email' }
        ]
      };

      (mockImpactAnalyzer.analyzeFieldImpacts as any).mockReturnValue([]);

      const conflicts = await detector.detectConflicts('org123', proposedChanges, existingMetadata);

      const similarNameConflict = conflicts.find(c => 
        c.type === 'naming' && c.description.includes('similar')
      );
      
      expect(similarNameConflict).toBeDefined();
      expect(similarNameConflict?.severity).toBe('medium');
      expect(similarNameConflict?.suggestedActions).toContain(
        'Add more specific context to the field name'
      );
    });

    it('should detect naming convention violations', async () => {
      const proposedChanges = {
        fields: [
          { name: 'customer_email__c', type: 'email' }
        ]
      };

      const existingMetadata = {
        fields: [
          { name: 'CustomerName__c', type: 'text' },
          { name: 'CustomerPhone__c', type: 'phone' }
        ]
      };

      (mockImpactAnalyzer.analyzeFieldImpacts as any).mockReturnValue([]);

      const conflicts = await detector.detectConflicts('org123', proposedChanges, existingMetadata);

      const conventionConflict = conflicts.find(c => 
        c.type === 'naming' && c.description.includes('naming convention')
      );
      
      expect(conventionConflict).toBeDefined();
      expect(conventionConflict?.severity).toBe('low');
      expect(conventionConflict?.resolution).toContain('PascalCase');
    });

    it('should prioritize conflicts by severity and risk', async () => {
      const proposedChanges = {
        fields: [
          { name: 'Field1__c', type: 'text' },
          { name: 'Field2__c', type: 'Formula', formula: 'Field3__c' },
          { name: 'account__c', type: 'text' }
        ]
      };

      const existingMetadata = {
        fields: [{ name: 'Field1__c', type: 'text' }]
      };

      (mockImpactAnalyzer.analyzeFieldImpacts as any).mockImplementation((field: any) => {
        if (field.name === 'Field1__c') {
          return [{
            fieldName: 'Field1__c',
            impactType: 'conflict',
            severity: 'medium',
            description: 'Duplicate field',
            affectedComponents: ['Field1__c']
          }];
        }
        if (field.name === 'Field2__c') {
          return [{
            fieldName: 'Field2__c',
            impactType: 'dependency',
            severity: 'high',
            description: 'Missing dependency',
            affectedComponents: ['Field3__c']
          }];
        }
        return [];
      });

      const conflicts = await detector.detectConflicts('org123', proposedChanges, existingMetadata);

      expect(conflicts.length).toBeGreaterThan(0);
      
      for (let i = 1; i < conflicts.length; i++) {
        const prevSeverityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const currSeverityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        
        const prevScore = prevSeverityOrder[conflicts[i - 1].severity];
        const currScore = currSeverityOrder[conflicts[i].severity];
        
        expect(prevScore).toBeGreaterThanOrEqual(currScore);
        
        if (prevScore === currScore) {
          expect(conflicts[i - 1].riskScore).toBeGreaterThanOrEqual(conflicts[i].riskScore);
        }
      }
    });

    it('should fetch metadata if not provided', async () => {
      const proposedChanges = {
        objectName: 'Account',
        fields: [{ name: 'NewField__c', type: 'text' }]
      };

      const mockFetchedMetadata = {
        fields: [{ name: 'ExistingField__c', type: 'text' }]
      };

      (mockMetadataService.describeObject as any).mockResolvedValue(mockFetchedMetadata);
      (mockImpactAnalyzer.analyzeFieldImpacts as any).mockReturnValue([]);

      await detector.detectConflicts('org123', proposedChanges);

      expect(mockMetadataService.describeObject).toHaveBeenCalledWith('org123', 'Account');
    });
  });
});