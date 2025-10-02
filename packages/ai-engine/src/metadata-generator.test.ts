import { describe, it, expect, beforeEach } from 'vitest';
import { MetadataGenerator } from './metadata-generator';
import type { FieldRequirement, ValidationRuleRequirement } from './requirements-parser';

describe('MetadataGenerator', () => {
  let generator: MetadataGenerator;

  beforeEach(() => {
    generator = new MetadataGenerator();
  });

  describe('generateCustomField', () => {
    it('should generate Text field metadata', () => {
      const requirement: FieldRequirement = {
        fieldName: 'Account_Code',
        fieldLabel: 'Account Code',
        fieldType: 'Text',
        description: 'Unique account identifier',
        required: true,
        maxLength: 50,
      };

      const metadata = generator.generateCustomField(requirement);

      expect(metadata.fullName).toBe('Account_Code__c');
      expect(metadata.label).toBe('Account Code');
      expect(metadata.type).toBe('Text');
      expect(metadata.description).toBe('Unique account identifier');
      expect(metadata.required).toBe(true);
      expect(metadata.length).toBe(50);
    });

    it('should generate Number field metadata', () => {
      const requirement: FieldRequirement = {
        fieldName: 'Quantity',
        fieldLabel: 'Quantity',
        fieldType: 'Number',
        description: 'Number of items',
        required: false,
        precision: 10,
        scale: 2,
      };

      const metadata = generator.generateCustomField(requirement);

      expect(metadata.fullName).toBe('Quantity__c');
      expect(metadata.type).toBe('Number');
      expect(metadata.precision).toBe(10);
      expect(metadata.scale).toBe(2);
    });

    it('should generate Currency field metadata', () => {
      const requirement: FieldRequirement = {
        fieldName: 'Total_Amount',
        fieldLabel: 'Total Amount',
        fieldType: 'Currency',
        description: 'Total transaction amount',
        required: true,
        precision: 16,
        scale: 2,
      };

      const metadata = generator.generateCustomField(requirement);

      expect(metadata.fullName).toBe('Total_Amount__c');
      expect(metadata.type).toBe('Currency');
      expect(metadata.precision).toBe(16);
      expect(metadata.scale).toBe(2);
    });

    it('should generate Percent field metadata', () => {
      const requirement: FieldRequirement = {
        fieldName: 'Discount_Rate',
        fieldLabel: 'Discount Rate',
        fieldType: 'Percent',
        description: 'Discount percentage',
        required: false,
        precision: 5,
        scale: 2,
      };

      const metadata = generator.generateCustomField(requirement);

      expect(metadata.fullName).toBe('Discount_Rate__c');
      expect(metadata.type).toBe('Percent');
      expect(metadata.precision).toBe(5);
      expect(metadata.scale).toBe(2);
    });

    it('should generate Date field metadata', () => {
      const requirement: FieldRequirement = {
        fieldName: 'Start_Date',
        fieldLabel: 'Start Date',
        fieldType: 'Date',
        description: 'Project start date',
        required: true,
      };

      const metadata = generator.generateCustomField(requirement);

      expect(metadata.fullName).toBe('Start_Date__c');
      expect(metadata.type).toBe('Date');
      expect(metadata.required).toBe(true);
    });

    it('should generate DateTime field metadata', () => {
      const requirement: FieldRequirement = {
        fieldName: 'Last_Modified',
        fieldLabel: 'Last Modified',
        fieldType: 'DateTime',
        description: 'Last modification timestamp',
        required: false,
      };

      const metadata = generator.generateCustomField(requirement);

      expect(metadata.fullName).toBe('Last_Modified__c');
      expect(metadata.type).toBe('DateTime');
    });

    it('should generate Checkbox field metadata', () => {
      const requirement: FieldRequirement = {
        fieldName: 'Is_Active',
        fieldLabel: 'Is Active',
        fieldType: 'Checkbox',
        description: 'Active status',
        required: false,
        defaultValue: 'true',
      };

      const metadata = generator.generateCustomField(requirement);

      expect(metadata.fullName).toBe('Is_Active__c');
      expect(metadata.type).toBe('Checkbox');
      expect(metadata.defaultValue).toBe('true');
    });

    it('should generate Picklist field metadata', () => {
      const requirement: FieldRequirement = {
        fieldName: 'Status',
        fieldLabel: 'Status',
        fieldType: 'Picklist',
        description: 'Record status',
        required: true,
        picklistValues: ['New', 'In Progress', 'Completed'],
      };

      const metadata = generator.generateCustomField(requirement);

      expect(metadata.fullName).toBe('Status__c');
      expect(metadata.type).toBe('Picklist');
      expect(metadata.valueSet?.valueSetDefinition?.value).toHaveLength(3);
      expect(metadata.valueSet?.valueSetDefinition?.value[0]?.label).toBe('New');
    });

    it('should generate Email field metadata', () => {
      const requirement: FieldRequirement = {
        fieldName: 'Contact_Email',
        fieldLabel: 'Contact Email',
        fieldType: 'Email',
        description: 'Primary email address',
        required: true,
      };

      const metadata = generator.generateCustomField(requirement);

      expect(metadata.fullName).toBe('Contact_Email__c');
      expect(metadata.type).toBe('Email');
    });

    it('should generate Phone field metadata', () => {
      const requirement: FieldRequirement = {
        fieldName: 'Phone_Number',
        fieldLabel: 'Phone Number',
        fieldType: 'Phone',
        description: 'Contact phone',
        required: false,
      };

      const metadata = generator.generateCustomField(requirement);

      expect(metadata.fullName).toBe('Phone_Number__c');
      expect(metadata.type).toBe('Phone');
    });

    it('should generate URL field metadata', () => {
      const requirement: FieldRequirement = {
        fieldName: 'Website',
        fieldLabel: 'Website',
        fieldType: 'URL',
        description: 'Company website',
        required: false,
      };

      const metadata = generator.generateCustomField(requirement);

      expect(metadata.fullName).toBe('Website__c');
      expect(metadata.type).toBe('Url');
    });

    it('should generate TextArea field metadata', () => {
      const requirement: FieldRequirement = {
        fieldName: 'Description',
        fieldLabel: 'Description',
        fieldType: 'TextArea',
        description: 'Detailed description',
        required: false,
        maxLength: 5000,
      };

      const metadata = generator.generateCustomField(requirement);

      expect(metadata.fullName).toBe('Description__c');
      expect(metadata.type).toBe('LongTextArea');
      expect(metadata.length).toBe(5000);
      expect(metadata.visibleLines).toBe(5);
    });

    it('should generate Lookup field metadata', () => {
      const requirement: FieldRequirement = {
        fieldName: 'Account',
        fieldLabel: 'Account',
        fieldType: 'Lookup',
        description: 'Related account',
        required: false,
        relatedObject: 'Account',
      };

      const metadata = generator.generateCustomField(requirement);

      expect(metadata.fullName).toBe('Account__c');
      expect(metadata.type).toBe('Lookup');
      expect(metadata.referenceTo).toBe('Account');
      expect(metadata.relationshipName).toBe('Account__r');
      expect(metadata.deleteConstraint).toBe('SetNull');
    });

    it('should generate MasterDetail field metadata', () => {
      const requirement: FieldRequirement = {
        fieldName: 'Parent_Account',
        fieldLabel: 'Parent Account',
        fieldType: 'MasterDetail',
        description: 'Parent account relationship',
        required: true,
        relatedObject: 'Account',
      };

      const metadata = generator.generateCustomField(requirement);

      expect(metadata.fullName).toBe('Parent_Account__c');
      expect(metadata.type).toBe('MasterDetail');
      expect(metadata.referenceTo).toBe('Account');
      expect(metadata.relationshipName).toBe('Parent_Account__r');
    });

    it('should generate Formula field metadata', () => {
      const requirement: FieldRequirement = {
        fieldName: 'Days_Open',
        fieldLabel: 'Days Open',
        fieldType: 'Formula',
        description: 'Number of days since creation',
        required: false,
        formula: 'TODAY() - CreatedDate',
      };

      const metadata = generator.generateCustomField(requirement);

      expect(metadata.fullName).toBe('Days_Open__c');
      expect(metadata.formula).toBe('TODAY() - CreatedDate');
      expect(metadata.formulaTreatBlanksAs).toBe('BlankAsZero');
    });

    it('should add __c suffix if not present', () => {
      const requirement: FieldRequirement = {
        fieldName: 'CustomField',
        fieldLabel: 'Custom Field',
        fieldType: 'Text',
        description: 'Test field',
        required: false,
      };

      const metadata = generator.generateCustomField(requirement);

      expect(metadata.fullName).toBe('CustomField__c');
    });

    it('should not double-add __c suffix', () => {
      const requirement: FieldRequirement = {
        fieldName: 'CustomField__c',
        fieldLabel: 'Custom Field',
        fieldType: 'Text',
        description: 'Test field',
        required: false,
      };

      const metadata = generator.generateCustomField(requirement);

      expect(metadata.fullName).toBe('CustomField__c');
    });

    it('should throw error for Formula field without formula', () => {
      const requirement: FieldRequirement = {
        fieldName: 'Bad_Formula',
        fieldLabel: 'Bad Formula',
        fieldType: 'Formula',
        description: 'Formula without expression',
        required: false,
      };

      expect(() => generator.generateCustomField(requirement)).toThrow(
        'Formula field Bad_Formula requires a formula expression'
      );
    });
  });

  describe('generateValidationRule', () => {
    it('should generate validation rule metadata', () => {
      const requirement: ValidationRuleRequirement = {
        ruleName: 'Amount_Must_Be_Positive',
        description: 'Ensure amount is positive',
        errorConditionFormula: 'Amount__c < 0',
        errorMessage: 'Amount must be greater than or equal to 0',
        errorLocation: 'FIELD',
        relatedField: 'Amount__c',
      };

      const metadata = generator.generateValidationRule(requirement);

      expect(metadata.fullName).toBe('Amount_Must_Be_Positive');
      expect(metadata.active).toBe(true);
      expect(metadata.description).toBe('Ensure amount is positive');
      expect(metadata.errorConditionFormula).toBe('Amount__c < 0');
      expect(metadata.errorMessage).toBe('Amount must be greater than or equal to 0');
      expect(metadata.errorDisplayField).toBe('Amount__c');
    });

    it('should handle TOP error location', () => {
      const requirement: ValidationRuleRequirement = {
        ruleName: 'Global_Validation',
        description: 'Global validation rule',
        errorConditionFormula: 'Field1__c > Field2__c',
        errorMessage: 'Field1 cannot be greater than Field2',
        errorLocation: 'TOP',
      };

      const metadata = generator.generateValidationRule(requirement);

      expect(metadata.errorDisplayField).toBeUndefined();
    });

    it('should clean up rule names', () => {
      const requirement: ValidationRuleRequirement = {
        ruleName: 'Rule With Spaces!',
        description: 'Test rule',
        errorConditionFormula: 'TRUE',
        errorMessage: 'Test',
        errorLocation: 'TOP',
      };

      const metadata = generator.generateValidationRule(requirement);

      expect(metadata.fullName).toBe('Rule_With_Spaces_');
    });
  });

  describe('validateMetadata', () => {
    it('should validate correct metadata', () => {
      const metadata = {
        fields: [
          {
            fullName: 'Test_Field__c',
            label: 'Test Field',
            type: 'Text',
            length: 100,
          },
        ],
        validationRules: [
          {
            fullName: 'Test_Rule',
            active: true,
            description: 'Test',
            errorConditionFormula: 'ISBLANK(Test_Field__c)',
            errorMessage: 'Field is required',
          },
        ],
        isValid: true,
        errors: [],
      };

      const result = generator.validateMetadata(metadata);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid field names', () => {
      const metadata = {
        fields: [
          {
            fullName: 'Invalid-Field-Name',
            label: 'Invalid Field',
            type: 'Text',
          },
        ],
        validationRules: [],
        isValid: true,
        errors: [],
      };

      const result = generator.validateMetadata(metadata);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Invalid field name: Invalid-Field-Name. Must contain only alphanumeric characters and underscores.'
      );
    });

    it('should detect missing field labels', () => {
      const metadata = {
        fields: [
          {
            fullName: 'Test_Field__c',
            label: '',
            type: 'Text',
          },
        ],
        validationRules: [],
        isValid: true,
        errors: [],
      };

      const result = generator.validateMetadata(metadata);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Field Test_Field__c must have a label.');
    });

    it('should validate Text field length', () => {
      const metadata = {
        fields: [
          {
            fullName: 'Test_Field__c',
            label: 'Test Field',
            type: 'Text',
            length: 300,
          },
        ],
        validationRules: [],
        isValid: true,
        errors: [],
      };

      const result = generator.validateMetadata(metadata);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Text field Test_Field__c length must be between 1 and 255.');
    });

    it('should validate Number field precision', () => {
      const metadata = {
        fields: [
          {
            fullName: 'Number_Field__c',
            label: 'Number Field',
            type: 'Number',
            precision: 20,
            scale: 2,
          },
        ],
        validationRules: [],
        isValid: true,
        errors: [],
      };

      const result = generator.validateMetadata(metadata);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Number field Number_Field__c precision must be between 1 and 18.');
    });

    it('should validate scale does not exceed precision', () => {
      const metadata = {
        fields: [
          {
            fullName: 'Number_Field__c',
            label: 'Number Field',
            type: 'Number',
            precision: 5,
            scale: 10,
          },
        ],
        validationRules: [],
        isValid: true,
        errors: [],
      };

      const result = generator.validateMetadata(metadata);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Number field Number_Field__c scale cannot exceed precision.');
    });

    it('should validate Picklist has values', () => {
      const metadata = {
        fields: [
          {
            fullName: 'Status__c',
            label: 'Status',
            type: 'Picklist',
          },
        ],
        validationRules: [],
        isValid: true,
        errors: [],
      };

      const result = generator.validateMetadata(metadata);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Picklist field Status__c must have at least one value.');
    });

    it('should validate Lookup has reference', () => {
      const metadata = {
        fields: [
          {
            fullName: 'Account__c',
            label: 'Account',
            type: 'Lookup',
          },
        ],
        validationRules: [],
        isValid: true,
        errors: [],
      };

      const result = generator.validateMetadata(metadata);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Relationship field Account__c must reference an object.');
    });

    it('should validate Formula has expression', () => {
      const metadata = {
        fields: [
          {
            fullName: 'Calc__c',
            label: 'Calculation',
            type: 'Formula',
          },
        ],
        validationRules: [],
        isValid: true,
        errors: [],
      };

      const result = generator.validateMetadata(metadata);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Formula field Calc__c must have a formula expression.');
    });

    it('should validate validation rule has formula', () => {
      const metadata = {
        fields: [],
        validationRules: [
          {
            fullName: 'Test_Rule',
            active: true,
            description: 'Test',
            errorConditionFormula: '',
            errorMessage: 'Error',
          },
        ],
        isValid: true,
        errors: [],
      };

      const result = generator.validateMetadata(metadata);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Validation rule Test_Rule must have an error condition formula.');
    });

    it('should validate validation rule has error message', () => {
      const metadata = {
        fields: [],
        validationRules: [
          {
            fullName: 'Test_Rule',
            active: true,
            description: 'Test',
            errorConditionFormula: 'TRUE',
            errorMessage: '',
          },
        ],
        isValid: true,
        errors: [],
      };

      const result = generator.validateMetadata(metadata);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Validation rule Test_Rule must have an error message.');
    });
  });

  describe('enforceNamingConvention', () => {
    it('should apply PascalCase convention', () => {
      const result = generator.enforceNamingConvention('my_field_name', 'PascalCase');
      expect(result).toBe('MyFieldName__c');
    });

    it('should apply camelCase convention', () => {
      const result = generator.enforceNamingConvention('my_field_name', 'camelCase');
      expect(result).toBe('myFieldName__c');
    });

    it('should apply snake_case convention', () => {
      const result = generator.enforceNamingConvention('MyFieldName', 'snake_case');
      expect(result).toBe('myfieldname__c');
    });

    it('should apply SCREAMING_SNAKE convention', () => {
      const result = generator.enforceNamingConvention('myFieldName', 'SCREAMING_SNAKE');
      expect(result).toBe('MYFIELDNAME__c');
    });

    it('should clean special characters', () => {
      const result = generator.enforceNamingConvention('field-name!@#$', undefined);
      expect(result).toBe('field_name__c');
    });

    it('should remove consecutive underscores', () => {
      const result = generator.enforceNamingConvention('field___name', undefined);
      expect(result).toBe('field_name__c');
    });

    it('should remove leading and trailing underscores', () => {
      const result = generator.enforceNamingConvention('_field_name_', undefined);
      expect(result).toBe('field_name__c');
    });
  });

  describe('generateAllFieldTypes', () => {
    it('should generate examples for all field types', () => {
      const examples = generator.generateAllFieldTypes();

      expect(examples).toHaveProperty('Text');
      expect(examples).toHaveProperty('Number');
      expect(examples).toHaveProperty('Date');
      expect(examples).toHaveProperty('DateTime');
      expect(examples).toHaveProperty('Checkbox');
      expect(examples).toHaveProperty('Picklist');
      expect(examples).toHaveProperty('Currency');
      expect(examples).toHaveProperty('Percent');
      expect(examples).toHaveProperty('Email');
      expect(examples).toHaveProperty('Phone');
      expect(examples).toHaveProperty('URL');
      expect(examples).toHaveProperty('TextArea');
      expect(examples).toHaveProperty('Lookup');
      expect(examples).toHaveProperty('MasterDetail');
      expect(examples).toHaveProperty('Formula');

      // Verify each has correct type
      expect(examples.Text?.type).toBe('Text');
      expect(examples.Number?.type).toBe('Number');
      expect(examples.Currency?.type).toBe('Currency');
      expect(examples.Picklist?.type).toBe('Picklist');
    });
  });
});