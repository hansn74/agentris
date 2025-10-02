import { describe, it, expect, beforeEach } from 'vitest';
import { ChangePreviewService } from './change-preview';

describe('ChangePreviewService', () => {
  let service: ChangePreviewService;

  beforeEach(() => {
    service = new ChangePreviewService();
  });

  describe('generateFieldDescription', () => {
    it('should generate description for a simple text field', () => {
      const field = {
        name: 'test_field__c',
        label: 'Test Field',
        type: 'Text',
        required: true,
        length: 255,
        helpText: 'Enter test data'
      };

      const description = service.generateFieldDescription(field);
      expect(description).toBe(
        'Required text field "Test Field" with maximum length of 255 characters. Help: Enter test data'
      );
    });

    it('should generate description for a number field with precision', () => {
      const field = {
        name: 'amount__c',
        label: 'Amount',
        type: 'Number',
        required: false,
        precision: 10,
        scale: 2,
        defaultValue: '0.00'
      };

      const description = service.generateFieldDescription(field);
      expect(description).toBe(
        'Optional number field "Amount" with 10 total digits and 2 decimal places. Default value: "0.00"'
      );
    });

    it('should generate description for a picklist field', () => {
      const field = {
        name: 'status__c',
        label: 'Status',
        type: 'Picklist',
        required: true,
        picklistValues: ['New', 'In Progress', 'Complete', 'Cancelled', 'On Hold', 'Pending', 'Review']
      };

      const description = service.generateFieldDescription(field);
      expect(description).toBe(
        'Required picklist field "Status". Values: New, In Progress, Complete, Cancelled, On Hold and 2 more'
      );
    });

    it('should generate description for a lookup field', () => {
      const field = {
        name: 'account__c',
        label: 'Account',
        type: 'Lookup',
        required: false,
        referenceTo: ['Account']
      };

      const description = service.generateFieldDescription(field);
      expect(description).toBe(
        'Optional lookup relationship field "Account". References: Account'
      );
    });

    it('should generate description for a formula field', () => {
      const field = {
        name: 'days_open__c',
        label: 'Days Open',
        type: 'Formula',
        required: false,
        formula: 'TODAY() - CreatedDate'
      };

      const description = service.generateFieldDescription(field);
      expect(description).toBe(
        'Optional formula field "Days Open". Formula: TODAY() - CreatedDate'
      );
    });
  });

  describe('generateValidationRuleDescription', () => {
    it('should generate description for an active validation rule', () => {
      const rule = {
        name: 'Amount_Required',
        description: 'Amount must be specified for approved records',
        errorConditionFormula: 'AND(Status__c = "Approved", ISBLANK(Amount__c))',
        errorMessage: 'Amount is required when status is Approved',
        active: true
      };

      const description = service.generateValidationRuleDescription(rule);
      expect(description).toBe(
        'Validation rule "Amount_Required": Amount must be specified for approved records. ' +
        'Triggers when: (Status__c = "Approved", Amount__c is blank). ' +
        'Error message: "Amount is required when status is Approved"'
      );
    });

    it('should generate description for an inactive validation rule', () => {
      const rule = {
        name: 'Date_Validation',
        errorConditionFormula: 'End_Date__c < Start_Date__c',
        errorMessage: 'End date cannot be before start date',
        active: false
      };

      const description = service.generateValidationRuleDescription(rule);
      expect(description).toBe(
        'Validation rule "Date_Validation". ' +
        'Triggers when: End_Date__c < Start_Date__c. ' +
        'Error message: "End date cannot be before start date" (Currently inactive)'
      );
    });
  });

  describe('formatFieldProperties', () => {
    it('should format text field properties', () => {
      const field = {
        name: 'description__c',
        label: 'Description',
        type: 'TextArea',
        required: true,
        length: 1000,
        helpText: 'Enter detailed description'
      };

      const properties = service.formatFieldProperties(field);
      expect(properties).toEqual({
        name: 'description__c',
        label: 'Description',
        type: 'TextArea',
        attributes: {
          required: true,
          maxLength: 1000,
          helpText: 'Enter detailed description'
        }
      });
    });

    it('should format currency field properties', () => {
      const field = {
        name: 'price__c',
        label: 'Price',
        type: 'Currency',
        required: false,
        precision: 12,
        scale: 2,
        defaultValue: '0.00'
      };

      const properties = service.formatFieldProperties(field);
      expect(properties).toEqual({
        name: 'price__c',
        label: 'Price',
        type: 'Currency',
        attributes: {
          required: false,
          precision: 12,
          scale: 2,
          defaultValue: '0.00'
        }
      });
    });

    it('should format picklist field properties', () => {
      const field = {
        name: 'category__c',
        label: 'Category',
        type: 'Picklist',
        required: true,
        picklistValues: ['A', 'B', 'C'],
        restricted: true
      };

      const properties = service.formatFieldProperties(field);
      expect(properties).toEqual({
        name: 'category__c',
        label: 'Category',
        type: 'Picklist',
        attributes: {
          required: true,
          values: ['A', 'B', 'C'],
          restricted: true
        }
      });
    });

    it('should format lookup field properties', () => {
      const field = {
        name: 'contact__c',
        label: 'Contact',
        type: 'Lookup',
        required: false,
        referenceTo: ['Contact'],
        relationshipName: 'ContactRelation',
        deleteConstraint: 'SetNull'
      };

      const properties = service.formatFieldProperties(field);
      expect(properties).toEqual({
        name: 'contact__c',
        label: 'Contact',
        type: 'Lookup',
        attributes: {
          required: false,
          referenceTo: ['Contact'],
          relationshipName: 'ContactRelation',
          deleteConstraint: 'SetNull'
        }
      });
    });

    it('should format checkbox field properties', () => {
      const field = {
        name: 'is_active__c',
        label: 'Is Active',
        type: 'Checkbox',
        required: false,
        defaultValue: true
      };

      const properties = service.formatFieldProperties(field);
      expect(properties).toEqual({
        name: 'is_active__c',
        label: 'Is Active',
        type: 'Checkbox',
        attributes: {
          required: false,
          defaultValue: true
        }
      });
    });
  });

  describe('getChangesSummary', () => {
    it('should summarize changes correctly', () => {
      const changes = [
        { type: 'field', operation: 'create', impact: 'low' },
        { type: 'field', operation: 'create', impact: 'medium' },
        { type: 'field', operation: 'update', impact: 'high' },
        { type: 'validationRule', operation: 'create', impact: 'medium' },
        { type: 'validationRule', operation: 'update', impact: 'low' },
        { type: 'field', operation: 'delete', impact: 'high' }
      ];

      const summary = service.getChangesSummary(changes);
      expect(summary).toEqual({
        totalChanges: 6,
        fields: {
          new: 2,
          modified: 1,
          deleted: 1
        },
        validationRules: {
          new: 1,
          modified: 1,
          deleted: 0
        },
        impacts: {
          high: 2,
          medium: 2,
          low: 2
        }
      });
    });

    it('should handle empty changes array', () => {
      const summary = service.getChangesSummary([]);
      expect(summary).toEqual({
        totalChanges: 0,
        fields: {
          new: 0,
          modified: 0,
          deleted: 0
        },
        validationRules: {
          new: 0,
          modified: 0,
          deleted: 0
        },
        impacts: {
          high: 0,
          medium: 0,
          low: 0
        }
      });
    });
  });
});