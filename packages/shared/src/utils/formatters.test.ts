import { describe, it, expect } from 'vitest';
import {
  FieldFormatters,
  ValidationRuleFormatters,
  MetadataDescriptionBuilder,
  I18nFormatters
} from './formatters';

describe('FieldFormatters', () => {
  describe('formatText', () => {
    it('should format text with max length', () => {
      const result = FieldFormatters.formatText('This is a long text', 10);
      expect(result).toBe('This is a ...');
    });

    it('should return empty string for null value', () => {
      const result = FieldFormatters.formatText('', 10);
      expect(result).toBe('');
    });
  });

  describe('formatNumber', () => {
    it('should format number with scale', () => {
      const result = FieldFormatters.formatNumber(123.456789, undefined, 2);
      expect(result).toBe('123.46');
    });

    it('should handle precision limits', () => {
      const result = FieldFormatters.formatNumber(123.456, 5, 2);
      expect(result).toBe('123.46');
    });

    it('should return empty string for null', () => {
      const result = FieldFormatters.formatNumber(null as any, 5, 2);
      expect(result).toBe('');
    });
  });

  describe('formatCurrency', () => {
    it('should format currency with USD', () => {
      const result = FieldFormatters.formatCurrency(1234.56);
      expect(result).toContain('1,234.56');
    });

    it('should format with custom scale', () => {
      const result = FieldFormatters.formatCurrency(1234.5, 'USD', 3);
      expect(result).toContain('1,234.500');
    });
  });

  describe('formatPercent', () => {
    it('should format percentage', () => {
      const result = FieldFormatters.formatPercent(12.345, 1);
      expect(result).toBe('12.3%');
    });
  });

  describe('formatDate', () => {
    it('should format date without time', () => {
      const result = FieldFormatters.formatDate('2024-01-15');
      expect(result).toContain('01');
      expect(result).toContain('15');
      expect(result).toContain('2024');
    });

    it('should format date with time', () => {
      const result = FieldFormatters.formatDate('2024-01-15T14:30:00', true);
      expect(result).toContain('2024');
      expect(result).toContain(':');
    });

    it('should handle invalid date', () => {
      const result = FieldFormatters.formatDate('invalid');
      expect(result).toBe('Invalid date');
    });
  });

  describe('formatBoolean', () => {
    it('should format true', () => {
      expect(FieldFormatters.formatBoolean(true)).toBe('True');
    });

    it('should format false', () => {
      expect(FieldFormatters.formatBoolean(false)).toBe('False');
    });

    it('should handle null', () => {
      expect(FieldFormatters.formatBoolean(null)).toBe('');
    });
  });

  describe('formatPicklist', () => {
    it('should format single picklist value', () => {
      const result = FieldFormatters.formatPicklist(['Option1'], false);
      expect(result).toBe('Option1');
    });

    it('should format multiselect picklist values', () => {
      const result = FieldFormatters.formatPicklist(['Option1', 'Option2', 'Option3'], true);
      expect(result).toBe('Option1; Option2; Option3');
    });
  });
});

describe('ValidationRuleFormatters', () => {
  describe('formatFormula', () => {
    it('should add spacing around operators', () => {
      const result = ValidationRuleFormatters.formatFormula('Field1=Value1');
      expect(result).toBe('Field1 = Value1');
    });
  });

  describe('simplifyFormula', () => {
    it('should simplify ISBLANK', () => {
      const result = ValidationRuleFormatters.simplifyFormula('ISBLANK(Field__c)');
      expect(result).toBe('Field__c is blank');
    });

    it('should simplify NOT(ISBLANK())', () => {
      const result = ValidationRuleFormatters.simplifyFormula('NOT(ISBLANK(Field__c))');
      expect(result).toBe('Field__c is not blank');
    });

    it('should simplify comparison operators', () => {
      const result = ValidationRuleFormatters.simplifyFormula('Amount__c > 100');
      expect(result).toBe('Amount__c is greater than 100');
    });

    it('should simplify equals operator', () => {
      const result = ValidationRuleFormatters.simplifyFormula('Status__c = "Active"');
      expect(result).toBe('Status__c equals "Active"');
    });
  });

  describe('formatErrorMessage', () => {
    it('should add period if missing', () => {
      const result = ValidationRuleFormatters.formatErrorMessage('Error message');
      expect(result).toBe('Error message.');
    });

    it('should not add period if present', () => {
      const result = ValidationRuleFormatters.formatErrorMessage('Error message.');
      expect(result).toBe('Error message.');
    });

    it('should replace field API name with label', () => {
      const result = ValidationRuleFormatters.formatErrorMessage(
        'amount__c is required',
        'amount__c'
      );
      expect(result).toBe('Amount is required.');
    });
  });
});

describe('MetadataDescriptionBuilder', () => {
  describe('buildFieldDescription', () => {
    it('should build description for text field', () => {
      const field = {
        type: 'Text',
        label: 'Customer Name',
        required: true,
        length: 255,
        helpText: 'Enter the customer full name'
      };
      
      const result = MetadataDescriptionBuilder.buildFieldDescription(field);
      expect(result).toContain('Text field');
      expect(result).toContain('Customer Name');
      expect(result).toContain('required');
      expect(result).toContain('255 characters');
    });

    it('should build description for picklist field', () => {
      const field = {
        type: 'Picklist',
        label: 'Status',
        picklistValues: ['New', 'In Progress', 'Complete', 'Cancelled', 'On Hold']
      };
      
      const result = MetadataDescriptionBuilder.buildFieldDescription(field);
      expect(result).toContain('Picklist field');
      expect(result).toContain('Status');
      expect(result).toContain('New, In Progress, Complete');
      expect(result).toContain('and 2 more');
    });

    it('should build description for formula field', () => {
      const field = {
        type: 'Formula',
        label: 'Days Open',
        formula: 'TODAY() - CreatedDate'
      };
      
      const result = MetadataDescriptionBuilder.buildFieldDescription(field);
      expect(result).toContain('Formula field');
      expect(result).toContain('Days Open');
      expect(result).toContain('calculated as');
    });
  });

  describe('buildValidationRuleDescription', () => {
    it('should build description for validation rule', () => {
      const rule = {
        name: 'Amount_Required',
        description: 'Ensure amount is provided',
        errorConditionFormula: 'ISBLANK(Amount__c)',
        errorMessage: 'Amount is required',
        active: true
      };
      
      const result = MetadataDescriptionBuilder.buildValidationRuleDescription(rule);
      expect(result).toContain('Amount_Required');
      expect(result).toContain('Ensure amount is provided');
      expect(result).toContain('triggers when');
      expect(result).toContain('Amount is required');
    });

    it('should indicate inactive rules', () => {
      const rule = {
        name: 'Test_Rule',
        errorConditionFormula: 'Field__c = "Test"',
        errorMessage: 'Test error',
        active: false
      };
      
      const result = MetadataDescriptionBuilder.buildValidationRuleDescription(rule);
      expect(result).toContain('currently inactive');
    });
  });
});

describe('I18nFormatters', () => {
  describe('translate', () => {
    it('should translate known keys', () => {
      expect(I18nFormatters.translate('field.required')).toBe('Required');
      expect(I18nFormatters.translate('impact.high')).toBe('High Impact');
    });

    it('should return key for unknown translations', () => {
      expect(I18nFormatters.translate('unknown.key')).toBe('unknown.key');
    });
  });

  describe('formatWithLocale', () => {
    it('should format number with locale', () => {
      const result = I18nFormatters.formatWithLocale(1234.56, 'number', 'en');
      expect(result).toContain('1');
      expect(result).toContain('234');
    });

    it('should format date with locale', () => {
      const result = I18nFormatters.formatWithLocale('2024-01-15', 'date', 'en');
      expect(result).toContain('2024');
    });

    it('should format currency with locale', () => {
      const result = I18nFormatters.formatWithLocale(1234.56, 'currency', 'en');
      expect(result).toContain('1');
      expect(result).toContain('234');
    });
  });
});