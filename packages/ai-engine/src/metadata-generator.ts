import { z } from 'zod';
import type { FieldRequirement, ValidationRuleRequirement } from './requirements-parser';

export interface SalesforceFieldMetadata {
  fullName: string;
  label: string;
  type: string;
  description?: string;
  required?: boolean;
  defaultValue?: string;
  length?: number;
  precision?: number;
  scale?: number;
  visibleLines?: number;
  valueSet?: {
    valueSetDefinition?: {
      value: Array<{
        fullName: string;
        label: string;
        default?: boolean;
      }>;
    };
  };
  formula?: string;
  formulaTreatBlanksAs?: string;
  referenceTo?: string;
  relationshipLabel?: string;
  relationshipName?: string;
  deleteConstraint?: string;
  displayFormat?: string;
  externalId?: boolean;
  unique?: boolean;
  reparentableMasterDetail?: boolean;
  writeRequiresMasterRead?: boolean;
}

export interface SalesforceValidationRuleMetadata {
  fullName: string;
  active: boolean;
  description: string;
  errorConditionFormula: string;
  errorDisplayField?: string;
  errorMessage: string;
}

export interface GeneratedMetadata {
  fields: SalesforceFieldMetadata[];
  validationRules: SalesforceValidationRuleMetadata[];
  isValid: boolean;
  errors: string[];
}

export class MetadataGenerator {
  private fieldTypeMapping: Map<string, string> = new Map([
    ['Text', 'Text'],
    ['TextArea', 'LongTextArea'],
    ['Number', 'Number'],
    ['Currency', 'Currency'],
    ['Percent', 'Percent'],
    ['Date', 'Date'],
    ['DateTime', 'DateTime'],
    ['Checkbox', 'Checkbox'],
    ['Picklist', 'Picklist'],
    ['MultiSelectPicklist', 'MultiselectPicklist'],
    ['Email', 'Email'],
    ['Phone', 'Phone'],
    ['URL', 'Url'],
    ['Lookup', 'Lookup'],
    ['MasterDetail', 'MasterDetail'],
    ['Formula', 'Formula'],
  ]);

  generateCustomField(requirement: FieldRequirement): SalesforceFieldMetadata {
    const salesforceType = this.fieldTypeMapping.get(requirement.fieldType) || 'Text';
    
    const metadata: SalesforceFieldMetadata = {
      fullName: this.ensureCustomFieldSuffix(requirement.fieldName),
      label: requirement.fieldLabel,
      type: salesforceType,
      description: requirement.description,
      required: requirement.required || false,
    };

    // Apply type-specific properties
    switch (requirement.fieldType) {
      case 'Text':
        metadata.length = requirement.maxLength || 255;
        if ((requirement as any).unique) metadata.unique = true;
        if (requirement.defaultValue) metadata.defaultValue = requirement.defaultValue;
        break;

      case 'TextArea':
        metadata.type = 'LongTextArea';
        metadata.length = requirement.maxLength || 32768;
        metadata.visibleLines = 5;
        break;

      case 'Number':
      case 'Currency':
      case 'Percent':
        metadata.precision = requirement.precision || 18;
        metadata.scale = requirement.scale || (requirement.fieldType === 'Currency' ? 2 : 0);
        if (requirement.defaultValue) metadata.defaultValue = requirement.defaultValue;
        break;

      case 'Date':
      case 'DateTime':
        if (requirement.defaultValue) metadata.defaultValue = requirement.defaultValue;
        break;

      case 'Checkbox':
        metadata.defaultValue = requirement.defaultValue || 'false';
        break;

      case 'Picklist':
        if (requirement.picklistValues && requirement.picklistValues.length > 0) {
          metadata.valueSet = {
            valueSetDefinition: {
              value: requirement.picklistValues.map((val, index) => ({
                fullName: val.replace(/[^a-zA-Z0-9_]/g, '_'),
                label: val,
                default: index === 0 && requirement.defaultValue === val,
              })),
            },
          };
        }
        break;

      case 'MultiSelectPicklist':
        metadata.type = 'MultiselectPicklist';
        metadata.visibleLines = 4;
        if (requirement.picklistValues && requirement.picklistValues.length > 0) {
          metadata.valueSet = {
            valueSetDefinition: {
              value: requirement.picklistValues.map(val => ({
                fullName: val.replace(/[^a-zA-Z0-9_]/g, '_'),
                label: val,
                default: false,
              })),
            },
          };
        }
        break;

      case 'Email':
      case 'Phone':
      case 'URL':
        if (requirement.defaultValue) metadata.defaultValue = requirement.defaultValue;
        break;

      case 'Lookup':
        metadata.referenceTo = requirement.relatedObject || 'Account';
        metadata.relationshipLabel = requirement.fieldLabel;
        metadata.relationshipName = this.generateRelationshipName(requirement.fieldName);
        metadata.deleteConstraint = 'SetNull';
        break;

      case 'MasterDetail':
        metadata.type = 'MasterDetail';
        metadata.referenceTo = requirement.relatedObject || 'Account';
        metadata.relationshipLabel = requirement.fieldLabel;
        metadata.relationshipName = this.generateRelationshipName(requirement.fieldName);
        metadata.reparentableMasterDetail = false;
        metadata.writeRequiresMasterRead = false;
        break;

      case 'Formula':
        if (!requirement.formula) {
          throw new Error(`Formula field ${requirement.fieldName} requires a formula expression`);
        }
        metadata.formula = requirement.formula;
        metadata.formulaTreatBlanksAs = 'BlankAsZero';
        // Determine formula return type based on content
        metadata.type = this.detectFormulaReturnType(requirement.formula);
        break;

      case 'AutoNumber':
        metadata.type = 'AutoNumber';
        metadata.displayFormat = (requirement as any).displayFormat || 'A-{00000}';
        break;
    }

    return metadata;
  }

  generateValidationRule(requirement: ValidationRuleRequirement): SalesforceValidationRuleMetadata {
    return {
      fullName: this.ensureValidRuleName(requirement.ruleName),
      active: true,
      description: requirement.description,
      errorConditionFormula: requirement.errorConditionFormula,
      errorDisplayField: requirement.errorLocation === 'FIELD' ? requirement.relatedField : undefined,
      errorMessage: requirement.errorMessage,
    };
  }

  validateMetadata(metadata: GeneratedMetadata): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate fields
    for (const field of metadata.fields) {
      // Check field name
      if (!this.isValidApiName(field.fullName)) {
        errors.push(`Invalid field name: ${field.fullName}. Must contain only alphanumeric characters and underscores.`);
      }

      // Check field label
      if (!field.label || field.label.length === 0) {
        errors.push(`Field ${field.fullName} must have a label.`);
      }

      // Type-specific validations
      switch (field.type) {
        case 'Text':
          if (field.length && (field.length < 1 || field.length > 255)) {
            errors.push(`Text field ${field.fullName} length must be between 1 and 255.`);
          }
          break;

        case 'LongTextArea':
          if (field.length && (field.length < 256 || field.length > 131072)) {
            errors.push(`Long text area ${field.fullName} length must be between 256 and 131,072.`);
          }
          break;

        case 'Number':
        case 'Currency':
        case 'Percent':
          if (field.precision && (field.precision < 1 || field.precision > 18)) {
            errors.push(`${field.type} field ${field.fullName} precision must be between 1 and 18.`);
          }
          if (field.scale && field.precision && field.scale > field.precision) {
            errors.push(`${field.type} field ${field.fullName} scale cannot exceed precision.`);
          }
          break;

        case 'Picklist':
        case 'MultiselectPicklist':
          if (!field.valueSet?.valueSetDefinition?.value || field.valueSet.valueSetDefinition.value.length === 0) {
            errors.push(`Picklist field ${field.fullName} must have at least one value.`);
          }
          break;

        case 'Lookup':
        case 'MasterDetail':
          if (!field.referenceTo) {
            errors.push(`Relationship field ${field.fullName} must reference an object.`);
          }
          if (!field.relationshipName) {
            errors.push(`Relationship field ${field.fullName} must have a relationship name.`);
          }
          break;

        case 'Formula':
          if (!field.formula) {
            errors.push(`Formula field ${field.fullName} must have a formula expression.`);
          }
          break;
      }
    }

    // Validate validation rules
    for (const rule of metadata.validationRules) {
      if (!this.isValidApiName(rule.fullName)) {
        errors.push(`Invalid validation rule name: ${rule.fullName}.`);
      }

      if (!rule.errorConditionFormula) {
        errors.push(`Validation rule ${rule.fullName} must have an error condition formula.`);
      }

      if (!rule.errorMessage) {
        errors.push(`Validation rule ${rule.fullName} must have an error message.`);
      }

      if (rule.errorDisplayField && !metadata.fields.some(f => f.fullName === rule.errorDisplayField)) {
        errors.push(`Validation rule ${rule.fullName} references non-existent field: ${rule.errorDisplayField}.`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  enforceNamingConvention(fieldName: string, orgStandard?: string): string {
    // Remove spaces and special characters
    let cleanName = fieldName.replace(/[^a-zA-Z0-9_]/g, '_');
    
    // Remove consecutive underscores
    cleanName = cleanName.replace(/_+/g, '_');
    
    // Remove leading/trailing underscores
    cleanName = cleanName.replace(/^_+|_+$/g, '');
    
    // Apply org-specific naming convention if provided
    if (orgStandard) {
      switch (orgStandard) {
        case 'PascalCase':
          cleanName = this.toPascalCase(cleanName);
          break;
        case 'camelCase':
          cleanName = this.toCamelCase(cleanName);
          break;
        case 'snake_case':
          cleanName = cleanName.toLowerCase();
          break;
        case 'SCREAMING_SNAKE':
          cleanName = cleanName.toUpperCase();
          break;
      }
    }
    
    // Ensure it ends with __c for custom fields
    return this.ensureCustomFieldSuffix(cleanName);
  }

  private ensureCustomFieldSuffix(fieldName: string): string {
    if (!fieldName.endsWith('__c')) {
      return `${fieldName}__c`;
    }
    return fieldName;
  }

  private ensureValidRuleName(ruleName: string): string {
    // Remove spaces and special characters, replace with underscores
    return ruleName.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_');
  }

  private generateRelationshipName(fieldName: string): string {
    // Remove __c suffix and add __r for relationship
    const baseName = fieldName.replace(/__c$/, '');
    return `${baseName}__r`;
  }

  private detectFormulaReturnType(formula: string): string {
    const upperFormula = formula.toUpperCase();
    
    if (upperFormula.includes('TRUE') || upperFormula.includes('FALSE') || 
        upperFormula.includes('AND(') || upperFormula.includes('OR(') || 
        upperFormula.includes('NOT(')) {
      return 'Checkbox';
    }
    
    if (upperFormula.includes('DATE(') || upperFormula.includes('TODAY(') || 
        upperFormula.includes('DATEVALUE(')) {
      return 'Date';
    }
    
    if (upperFormula.includes('NOW(') || upperFormula.includes('DATETIMEVALUE(')) {
      return 'DateTime';
    }
    
    if (upperFormula.includes('VALUE(') || upperFormula.includes('ROUND(') || 
        upperFormula.includes('CEILING(') || upperFormula.includes('FLOOR(') ||
        upperFormula.includes('+') || upperFormula.includes('-') || 
        upperFormula.includes('*') || upperFormula.includes('/')) {
      return 'Number';
    }
    
    return 'Text'; // Default to Text for string operations
  }

  private isValidApiName(name: string): boolean {
    // Salesforce API names can only contain alphanumeric characters and underscores
    // Must start with a letter, cannot end with underscore (except __c, __r suffixes)
    return /^[a-zA-Z][a-zA-Z0-9_]*(__[cr])?$/.test(name);
  }

  private toPascalCase(str: string): string {
    return str
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  private toCamelCase(str: string): string {
    const pascal = this.toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }

  generateAllFieldTypes(): { [key: string]: SalesforceFieldMetadata } {
    const examples: { [key: string]: SalesforceFieldMetadata } = {};

    // Text field
    examples.Text = this.generateCustomField({
      fieldName: 'Sample_Text',
      fieldLabel: 'Sample Text',
      fieldType: 'Text',
      description: 'Sample text field',
      required: false,
      maxLength: 100,
    });

    // Number field
    examples.Number = this.generateCustomField({
      fieldName: 'Sample_Number',
      fieldLabel: 'Sample Number',
      fieldType: 'Number',
      description: 'Sample number field',
      required: false,
      precision: 10,
      scale: 2,
    });

    // Date field
    examples.Date = this.generateCustomField({
      fieldName: 'Sample_Date',
      fieldLabel: 'Sample Date',
      fieldType: 'Date',
      description: 'Sample date field',
      required: false,
    });

    // DateTime field
    examples.DateTime = this.generateCustomField({
      fieldName: 'Sample_DateTime',
      fieldLabel: 'Sample Date Time',
      fieldType: 'DateTime',
      description: 'Sample datetime field',
      required: false,
    });

    // Checkbox field
    examples.Checkbox = this.generateCustomField({
      fieldName: 'Is_Active',
      fieldLabel: 'Is Active',
      fieldType: 'Checkbox',
      description: 'Sample checkbox field',
      required: false,
      defaultValue: 'true',
    });

    // Picklist field
    examples.Picklist = this.generateCustomField({
      fieldName: 'Status',
      fieldLabel: 'Status',
      fieldType: 'Picklist',
      description: 'Sample picklist field',
      required: true,
      picklistValues: ['New', 'In Progress', 'Completed'],
    });

    // Currency field
    examples.Currency = this.generateCustomField({
      fieldName: 'Amount',
      fieldLabel: 'Amount',
      fieldType: 'Currency',
      description: 'Sample currency field',
      required: false,
      precision: 16,
      scale: 2,
    });

    // Percent field
    examples.Percent = this.generateCustomField({
      fieldName: 'Completion_Percentage',
      fieldLabel: 'Completion Percentage',
      fieldType: 'Percent',
      description: 'Sample percent field',
      required: false,
      precision: 5,
      scale: 2,
    });

    // Email field
    examples.Email = this.generateCustomField({
      fieldName: 'Contact_Email',
      fieldLabel: 'Contact Email',
      fieldType: 'Email',
      description: 'Sample email field',
      required: false,
    });

    // Phone field
    examples.Phone = this.generateCustomField({
      fieldName: 'Contact_Phone',
      fieldLabel: 'Contact Phone',
      fieldType: 'Phone',
      description: 'Sample phone field',
      required: false,
    });

    // URL field
    examples.URL = this.generateCustomField({
      fieldName: 'Website',
      fieldLabel: 'Website',
      fieldType: 'URL',
      description: 'Sample URL field',
      required: false,
    });

    // TextArea field
    examples.TextArea = this.generateCustomField({
      fieldName: 'Description',
      fieldLabel: 'Description',
      fieldType: 'TextArea',
      description: 'Sample long text area field',
      required: false,
      maxLength: 32000,
    });

    // Lookup field
    examples.Lookup = this.generateCustomField({
      fieldName: 'Account',
      fieldLabel: 'Account',
      fieldType: 'Lookup',
      description: 'Sample lookup field',
      required: false,
      relatedObject: 'Account',
    });

    // Master-Detail field
    examples.MasterDetail = this.generateCustomField({
      fieldName: 'Parent_Account',
      fieldLabel: 'Parent Account',
      fieldType: 'MasterDetail',
      description: 'Sample master-detail field',
      required: true,
      relatedObject: 'Account',
    });

    // Formula field
    examples.Formula = this.generateCustomField({
      fieldName: 'Days_Open',
      fieldLabel: 'Days Open',
      fieldType: 'Formula',
      description: 'Sample formula field',
      required: false,
      formula: 'TODAY() - CreatedDate',
    });

    return examples;
  }
}