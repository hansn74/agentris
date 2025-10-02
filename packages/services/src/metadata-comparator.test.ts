import { describe, it, expect, beforeEach } from 'vitest';
import { MetadataComparatorService } from './metadata-comparator';

describe('MetadataComparatorService', () => {
  let service: MetadataComparatorService;

  beforeEach(() => {
    service = new MetadataComparatorService();
  });

  describe('compareFields', () => {
    it('should detect added fields', () => {
      const currentFields: any[] = [];
      const proposedFields = [
        { name: 'new_field__c', label: 'New Field', type: 'Text' }
      ];
      
      const comparisons = service.compareFields(currentFields, proposedFields);
      
      expect(comparisons).toHaveLength(1);
      expect(comparisons[0]).toMatchObject({
        fieldName: 'new_field__c',
        status: 'added',
        proposed: proposedFields[0]
      });
    });

    it('should detect removed fields', () => {
      const currentFields = [
        { name: 'old_field__c', label: 'Old Field', type: 'Text' }
      ];
      const proposedFields: any[] = [];
      
      const comparisons = service.compareFields(currentFields, proposedFields);
      
      expect(comparisons).toHaveLength(1);
      expect(comparisons[0]).toMatchObject({
        fieldName: 'old_field__c',
        status: 'removed',
        current: currentFields[0]
      });
    });

    it('should detect modified fields', () => {
      const currentFields = [
        { name: 'field__c', label: 'Field', type: 'Text', length: 50, required: false }
      ];
      const proposedFields = [
        { name: 'field__c', label: 'Updated Field', type: 'Text', length: 100, required: true }
      ];
      
      const comparisons = service.compareFields(currentFields, proposedFields);
      
      expect(comparisons).toHaveLength(1);
      expect(comparisons[0]).toMatchObject({
        fieldName: 'field__c',
        status: 'modified'
      });
      expect(comparisons[0].differences).toHaveLength(3); // label, length, required
    });

    it('should detect unchanged fields', () => {
      const currentFields = [
        { name: 'field__c', label: 'Field', type: 'Text', length: 50 }
      ];
      const proposedFields = [
        { name: 'field__c', label: 'Field', type: 'Text', length: 50 }
      ];
      
      const comparisons = service.compareFields(currentFields, proposedFields);
      
      expect(comparisons).toHaveLength(1);
      expect(comparisons[0]).toMatchObject({
        fieldName: 'field__c',
        status: 'unchanged'
      });
    });

    it('should handle multiple field changes', () => {
      const currentFields = [
        { name: 'field1__c', label: 'Field 1', type: 'Text' },
        { name: 'field2__c', label: 'Field 2', type: 'Number' },
        { name: 'field3__c', label: 'Field 3', type: 'Date' }
      ];
      const proposedFields = [
        { name: 'field1__c', label: 'Field 1 Updated', type: 'Text' }, // modified
        { name: 'field3__c', label: 'Field 3', type: 'Date' }, // unchanged
        { name: 'field4__c', label: 'Field 4', type: 'Checkbox' } // added
        // field2__c removed
      ];
      
      const comparisons = service.compareFields(currentFields, proposedFields);
      
      expect(comparisons).toHaveLength(4);
      
      const added = comparisons.filter(c => c.status === 'added');
      const modified = comparisons.filter(c => c.status === 'modified');
      const removed = comparisons.filter(c => c.status === 'removed');
      const unchanged = comparisons.filter(c => c.status === 'unchanged');
      
      expect(added).toHaveLength(1);
      expect(modified).toHaveLength(1);
      expect(removed).toHaveLength(1);
      expect(unchanged).toHaveLength(1);
    });
  });

  describe('compareValidationRules', () => {
    it('should detect added validation rules', () => {
      const currentRules: any[] = [];
      const proposedRules = [
        {
          name: 'New_Rule',
          errorConditionFormula: 'Amount__c < 0',
          errorMessage: 'Amount cannot be negative'
        }
      ];
      
      const comparisons = service.compareValidationRules(currentRules, proposedRules);
      
      expect(comparisons).toHaveLength(1);
      expect(comparisons[0]).toMatchObject({
        ruleName: 'New_Rule',
        status: 'added',
        proposed: proposedRules[0]
      });
    });

    it('should detect removed validation rules', () => {
      const currentRules = [
        {
          name: 'Old_Rule',
          errorConditionFormula: 'Status__c = "Invalid"',
          errorMessage: 'Invalid status'
        }
      ];
      const proposedRules: any[] = [];
      
      const comparisons = service.compareValidationRules(currentRules, proposedRules);
      
      expect(comparisons).toHaveLength(1);
      expect(comparisons[0]).toMatchObject({
        ruleName: 'Old_Rule',
        status: 'removed',
        current: currentRules[0]
      });
    });

    it('should detect modified validation rules', () => {
      const currentRules = [
        {
          name: 'Amount_Check',
          errorConditionFormula: 'Amount__c < 0',
          errorMessage: 'Amount cannot be negative',
          active: true
        }
      ];
      const proposedRules = [
        {
          name: 'Amount_Check',
          errorConditionFormula: 'Amount__c <= 0',
          errorMessage: 'Amount must be positive',
          active: false
        }
      ];
      
      const comparisons = service.compareValidationRules(currentRules, proposedRules);
      
      expect(comparisons).toHaveLength(1);
      expect(comparisons[0]).toMatchObject({
        ruleName: 'Amount_Check',
        status: 'modified'
      });
      expect(comparisons[0].differences).toHaveLength(3); // formula, message, active
    });
  });

  describe('generateDiff', () => {
    it('should generate complete diff representation', () => {
      const currentState = {
        fields: [
          { name: 'field1__c', label: 'Field 1', type: 'Text' },
          { name: 'field2__c', label: 'Field 2', type: 'Number' }
        ],
        validationRules: [
          {
            name: 'Rule1',
            errorConditionFormula: 'Amount__c < 0',
            errorMessage: 'Negative amount'
          }
        ],
        objectName: 'CustomObject__c'
      };
      
      const proposedFields = [
        { name: 'field1__c', label: 'Field 1 Updated', type: 'Text' }, // modified
        { name: 'field3__c', label: 'Field 3', type: 'Date' } // added
        // field2__c removed
      ];
      
      const proposedRules = [
        {
          name: 'Rule1',
          errorConditionFormula: 'Amount__c < 0',
          errorMessage: 'Negative amount'
        }, // unchanged
        {
          name: 'Rule2',
          errorConditionFormula: 'Status__c = "Invalid"',
          errorMessage: 'Invalid status'
        } // added
      ];
      
      const diff = service.generateDiff(currentState, proposedFields, proposedRules);
      
      expect(diff.summary).toMatchObject({
        totalChanges: 4,
        fieldsAdded: 1,
        fieldsModified: 1,
        fieldsRemoved: 1,
        rulesAdded: 1,
        rulesModified: 0,
        rulesRemoved: 0
      });
      
      expect(diff.fields).toHaveLength(3);
      expect(diff.validationRules).toHaveLength(2);
      expect(diff.changePercentage).toBeGreaterThan(0);
    });

    it('should calculate correct change percentage', () => {
      const currentState = {
        fields: [
          { name: 'field1__c', type: 'Text' },
          { name: 'field2__c', type: 'Number' }
        ],
        validationRules: [],
        objectName: 'CustomObject__c'
      };
      
      const proposedFields = [
        { name: 'field1__c', type: 'TextArea' }, // modified
        { name: 'field2__c', type: 'Number' } // unchanged
      ];
      
      const proposedRules: any[] = [];
      
      const diff = service.generateDiff(currentState, proposedFields, proposedRules);
      
      // 1 change out of 2 total items = 50%
      expect(diff.changePercentage).toBe(50);
    });
  });

  describe('getCurrentState', () => {
    it('should extract and normalize current state', () => {
      const metadata = {
        fields: [
          { fullName: 'field1__c', label: 'Field 1', type: 'Text' },
          { name: 'field2__c', label: 'Field 2', type: 'Number' }
        ],
        validationRules: [
          {
            fullName: 'Rule1',
            errorConditionFormula: 'Amount__c < 0',
            errorMessage: 'Negative'
          }
        ],
        objectName: 'Account',
        lastModified: new Date('2024-01-01')
      };
      
      const state = service.getCurrentState(metadata);
      
      expect(state.fields).toHaveLength(2);
      expect(state.validationRules).toHaveLength(1);
      expect(state.objectName).toBe('Account');
      expect(state.lastModified).toEqual(new Date('2024-01-01'));
      
      // Check normalization
      expect(state.fields[0].name).toBe('field1__c');
      expect(state.fields[1].name).toBe('field2__c');
      expect(state.validationRules[0].name).toBe('Rule1');
    });

    it('should handle empty metadata', () => {
      const metadata = {};
      
      const state = service.getCurrentState(metadata);
      
      expect(state.fields).toHaveLength(0);
      expect(state.validationRules).toHaveLength(0);
      expect(state.objectName).toBe('CustomObject');
      expect(state.lastModified).toBeInstanceOf(Date);
    });
  });
});