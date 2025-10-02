import { describe, it, expect, beforeEach } from 'vitest';
import { ImpactAnalyzerService } from './impact-analyzer';

describe('ImpactAnalyzerService', () => {
  let service: ImpactAnalyzerService;

  beforeEach(() => {
    service = new ImpactAnalyzerService();
  });

  describe('analyzeFieldImpacts', () => {
    it('should detect field name conflicts', () => {
      const newField = {
        name: 'status__c',
        label: 'Status',
        type: 'Text'
      };
      
      const existingFields = [
        { name: 'status__c', label: 'Current Status', type: 'Picklist' }
      ];
      
      const impacts = service.analyzeFieldImpacts(newField, existingFields);
      
      expect(impacts).toHaveLength(1);
      expect(impacts[0]).toMatchObject({
        impactType: 'conflict',
        severity: 'high',
        description: 'Field name "status__c" already exists'
      });
    });

    it('should detect field label conflicts', () => {
      const newField = {
        name: 'new_status__c',
        label: 'Status',
        type: 'Text'
      };
      
      const existingFields = [
        { name: 'status__c', label: 'Status', type: 'Picklist' }
      ];
      
      const impacts = service.analyzeFieldImpacts(newField, existingFields);
      
      expect(impacts).toHaveLength(1);
      expect(impacts[0]).toMatchObject({
        impactType: 'conflict',
        severity: 'medium',
        description: 'Field label "Status" is already used by field "status__c"'
      });
    });

    it('should detect master-detail relationship limits', () => {
      const newField = {
        name: 'parent__c',
        label: 'Parent',
        type: 'MasterDetail',
        referenceTo: ['Account']
      };
      
      const existingFields = [
        { name: 'master1__c', type: 'MasterDetail', referenceTo: ['Contact'] },
        { name: 'master2__c', type: 'MasterDetail', referenceTo: ['Opportunity'] }
      ];
      
      const impacts = service.analyzeFieldImpacts(newField, existingFields);
      
      expect(impacts).toHaveLength(1);
      expect(impacts[0]).toMatchObject({
        impactType: 'conflict',
        severity: 'high',
        description: 'Object already has maximum number of master-detail relationships (2)'
      });
    });

    it('should detect formula field missing dependencies', () => {
      const newField = {
        name: 'calculated__c',
        label: 'Calculated',
        type: 'Formula',
        formula: 'Amount__c * Quantity__c'
      };
      
      const existingFields = [
        { name: 'Amount__c', type: 'Currency' }
        // Quantity__c is missing
      ];
      
      const impacts = service.analyzeFieldImpacts(newField, existingFields);
      
      expect(impacts).toHaveLength(1);
      expect(impacts[0]).toMatchObject({
        impactType: 'dependency',
        severity: 'high',
        description: 'Formula references non-existent fields: Quantity__c'
      });
    });

    it('should detect unique field limits', () => {
      const newField = {
        name: 'unique_id__c',
        label: 'Unique ID',
        type: 'Text',
        unique: true
      };
      
      const existingFields = Array.from({ length: 10 }, (_, i) => ({
        name: `unique_${i}__c`,
        type: 'Text',
        unique: true
      }));
      
      const impacts = service.analyzeFieldImpacts(newField, existingFields);
      
      expect(impacts).toHaveLength(1);
      expect(impacts[0]).toMatchObject({
        impactType: 'conflict',
        severity: 'medium',
        description: 'Approaching limit of unique fields on object'
      });
    });

    it('should return empty array when no impacts detected', () => {
      const newField = {
        name: 'description__c',
        label: 'Description',
        type: 'TextArea'
      };
      
      const existingFields = [
        { name: 'name__c', label: 'Name', type: 'Text' }
      ];
      
      const impacts = service.analyzeFieldImpacts(newField, existingFields);
      
      expect(impacts).toHaveLength(0);
    });
  });

  describe('checkValidationRuleConflicts', () => {
    it('should detect validation rule name conflicts', () => {
      const newRule = {
        name: 'Amount_Check',
        errorConditionFormula: 'Amount__c < 0',
        errorMessage: 'Amount cannot be negative'
      };
      
      const existingRules = [
        {
          name: 'Amount_Check',
          errorConditionFormula: 'Amount__c > 1000000',
          errorMessage: 'Amount too large'
        }
      ];
      
      const conflicts = service.checkValidationRuleConflicts(newRule, existingRules);
      
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toMatchObject({
        conflictType: 'overlap',
        severity: 'high',
        description: 'Validation rule name "Amount_Check" already exists'
      });
    });

    it('should detect redundant validation rules', () => {
      const newRule = {
        name: 'Required_Amount',
        errorConditionFormula: 'ISBLANK(Amount__c)',
        errorMessage: 'Amount is required'
      };
      
      const existingRules = [
        {
          name: 'Amount_Required',
          errorConditionFormula: 'ISBLANK(Amount__c)',
          errorMessage: 'Please enter amount'
        }
      ];
      
      const conflicts = service.checkValidationRuleConflicts(newRule, existingRules);
      
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0]).toMatchObject({
        conflictType: 'redundancy',
        severity: 'medium'
      });
    });

    it('should detect contradictory validation rules', () => {
      const newRule = {
        name: 'Amount_Positive',
        errorConditionFormula: 'Amount__c <= 0',
        errorMessage: 'Amount must be positive'
      };
      
      const existingRules = [
        {
          name: 'Amount_Negative',
          errorConditionFormula: 'NOT(Amount__c <= 0)',
          errorMessage: 'Amount must be zero or negative'
        }
      ];
      
      const conflicts = service.checkValidationRuleConflicts(newRule, existingRules);
      
      const contradictionFound = conflicts.some(c => c.conflictType === 'contradiction');
      expect(contradictionFound).toBe(true);
    });

    it('should return empty array when no conflicts detected', () => {
      const newRule = {
        name: 'Date_Check',
        errorConditionFormula: 'End_Date__c < Start_Date__c',
        errorMessage: 'End date must be after start date'
      };
      
      const existingRules = [
        {
          name: 'Amount_Check',
          errorConditionFormula: 'Amount__c < 0',
          errorMessage: 'Amount cannot be negative'
        }
      ];
      
      const conflicts = service.checkValidationRuleConflicts(newRule, existingRules);
      
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('detectDependencies', () => {
    it('should detect formula field dependencies', () => {
      const component = {
        type: 'field',
        name: 'Amount__c',
        fieldType: 'Currency'
      };
      
      const allComponents = [
        {
          type: 'field',
          name: 'Total__c',
          fieldType: 'Formula',
          formula: 'Amount__c * Quantity__c'
        }
      ];
      
      const dependencies = service.detectDependencies(component, allComponents);
      
      expect(dependencies).toHaveLength(1);
      expect(dependencies[0]).toMatchObject({
        sourceComponent: 'Total__c',
        targetComponent: 'Amount__c',
        dependencyType: 'formula',
        description: 'Formula field "Total__c" references this field'
      });
    });

    it('should detect validation rule dependencies', () => {
      const component = {
        type: 'field',
        name: 'Status__c',
        fieldType: 'Picklist'
      };
      
      const allComponents = [
        {
          type: 'validationRule',
          name: 'Status_Check',
          errorConditionFormula: 'Status__c = "Closed" AND ISBLANK(Resolution__c)'
        }
      ];
      
      const dependencies = service.detectDependencies(component, allComponents);
      
      expect(dependencies).toHaveLength(1);
      expect(dependencies[0]).toMatchObject({
        sourceComponent: 'Status_Check',
        targetComponent: 'Status__c',
        dependencyType: 'validation',
        description: 'Validation rule "Status_Check" references this field'
      });
    });

    it('should return empty array when no dependencies detected', () => {
      const component = {
        type: 'field',
        name: 'Description__c',
        fieldType: 'TextArea'
      };
      
      const allComponents = [
        {
          type: 'field',
          name: 'Name__c',
          fieldType: 'Text'
        }
      ];
      
      const dependencies = service.detectDependencies(component, allComponents);
      
      expect(dependencies).toHaveLength(0);
    });
  });

  describe('getRiskScore', () => {
    it('should calculate critical risk for field deletions', () => {
      const changes = [
        { type: 'field', operation: 'delete' },
        { type: 'field', operation: 'delete' },
        { type: 'field', operation: 'delete' }
      ];
      
      const assessment = service.getRiskScore(changes);
      
      expect(assessment.level).toBe('critical');
      expect(assessment.score).toBe(75);
      expect(assessment.factors).toContain('Field deletion detected');
    });

    it('should calculate high risk for master-detail changes', () => {
      const changes = [
        { type: 'field', fieldType: 'MasterDetail', operation: 'create' },
        { type: 'field', required: true, operation: 'create' },
        { type: 'validationRule', operation: 'create' }
      ];
      
      const assessment = service.getRiskScore(changes);
      
      expect(assessment.score).toBeGreaterThanOrEqual(45);
      expect(assessment.factors).toContain('Master-detail relationship change');
    });

    it('should calculate medium risk for required fields', () => {
      const changes = [
        { type: 'field', required: true, operation: 'create' },
        { type: 'field', unique: true, operation: 'create' }
      ];
      
      const assessment = service.getRiskScore(changes);
      
      expect(assessment.level).toBe('medium');
      expect(assessment.factors).toContain('Required field added');
      expect(assessment.factors).toContain('Unique field constraint added');
    });

    it('should calculate low risk for optional fields', () => {
      const changes = [
        { type: 'field', required: false, operation: 'create' },
        { type: 'field', required: false, operation: 'create' }
      ];
      
      const assessment = service.getRiskScore(changes);
      
      expect(assessment.level).toBe('low');
      expect(assessment.factors).toContain('Optional field added');
    });

    it('should provide recommendations based on risk', () => {
      const changes = [
        { type: 'field', operation: 'delete' },
        { type: 'validationRule', operation: 'create' }
      ];
      
      const assessment = service.getRiskScore(changes);
      
      expect(assessment.recommendations.length).toBeGreaterThan(0);
      expect(assessment.recommendations).toContain('Ensure no dependencies exist on deleted fields');
      expect(assessment.recommendations).toContain('Test with existing data to ensure compliance');
    });
  });
});