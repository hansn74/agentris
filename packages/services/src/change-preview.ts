import { z } from 'zod';

export interface FieldDescription {
  name: string;
  label: string;
  type: string;
  required: boolean;
  length?: number;
  precision?: number;
  scale?: number;
  defaultValue?: string;
  helpText?: string;
  formula?: string;
  picklistValues?: string[];
  referenceTo?: string[];
}

export interface ValidationRuleDescription {
  name: string;
  description: string;
  errorConditionFormula: string;
  errorMessage: string;
  active: boolean;
}

export interface FieldProperties {
  name: string;
  label: string;
  type: string;
  attributes: Record<string, any>;
}

export interface ChangeSummary {
  totalChanges: number;
  fields: {
    new: number;
    modified: number;
    deleted: number;
  };
  validationRules: {
    new: number;
    modified: number;
    deleted: number;
  };
  impacts: {
    high: number;
    medium: number;
    low: number;
  };
}

export class ChangePreviewService {
  generateFieldDescription(field: any): string {
    const type = this.getHumanReadableFieldType(field.type);
    const required = field.required ? 'Required' : 'Optional';
    
    let description = `${required} ${type} field "${field.label}"`;
    
    if (field.length) {
      description += ` with maximum length of ${field.length} characters`;
    }
    
    if (field.precision && field.scale) {
      description += ` with ${field.precision} total digits and ${field.scale} decimal places`;
    }
    
    if (field.defaultValue) {
      description += `. Default value: "${field.defaultValue}"`;
    }
    
    if (field.helpText) {
      description += `. Help: ${field.helpText}`;
    }
    
    if (field.formula) {
      description += `. Formula: ${field.formula}`;
    }
    
    if (field.picklistValues && field.picklistValues.length > 0) {
      const values = field.picklistValues.slice(0, 5).join(', ');
      const more = field.picklistValues.length > 5 ? ` and ${field.picklistValues.length - 5} more` : '';
      description += `. Values: ${values}${more}`;
    }
    
    if (field.referenceTo && field.referenceTo.length > 0) {
      description += `. References: ${field.referenceTo.join(', ')}`;
    }
    
    return description;
  }

  generateValidationRuleDescription(rule: any): string {
    let description = `Validation rule "${rule.name}"`;
    
    if (rule.description) {
      description += `: ${rule.description}`;
    }
    
    description += `. Triggers when: ${this.simplifyFormula(rule.errorConditionFormula)}`;
    description += `. Error message: "${rule.errorMessage}"`;
    
    if (!rule.active) {
      description += ` (Currently inactive)`;
    }
    
    return description;
  }

  formatFieldProperties(field: any): FieldProperties {
    const attributes: Record<string, any> = {};
    
    // Add relevant attributes based on field type
    if (field.required !== undefined) attributes.required = field.required;
    if (field.unique) attributes.unique = field.unique;
    if (field.externalId) attributes.externalId = field.externalId;
    if (field.caseSensitive !== undefined) attributes.caseSensitive = field.caseSensitive;
    
    // Type-specific attributes
    switch (field.type) {
      case 'Text':
      case 'TextArea':
      case 'LongTextArea':
      case 'EncryptedText':
        if (field.length) attributes.maxLength = field.length;
        break;
      case 'Number':
      case 'Currency':
      case 'Percent':
        if (field.precision) attributes.precision = field.precision;
        if (field.scale) attributes.scale = field.scale;
        break;
      case 'Picklist':
      case 'MultiselectPicklist':
        if (field.picklistValues) attributes.values = field.picklistValues;
        if (field.restricted !== undefined) attributes.restricted = field.restricted;
        break;
      case 'Lookup':
      case 'MasterDetail':
        if (field.referenceTo) attributes.referenceTo = field.referenceTo;
        if (field.relationshipName) attributes.relationshipName = field.relationshipName;
        if (field.deleteConstraint) attributes.deleteConstraint = field.deleteConstraint;
        break;
      case 'Formula':
        if (field.formula) attributes.formula = field.formula;
        if (field.formulaTreatBlanksAs) attributes.treatBlanksAs = field.formulaTreatBlanksAs;
        break;
      case 'Checkbox':
        if (field.defaultValue !== undefined) attributes.defaultValue = field.defaultValue;
        break;
    }
    
    // Common attributes
    if (field.defaultValue !== undefined && field.type !== 'Checkbox') {
      attributes.defaultValue = field.defaultValue;
    }
    if (field.helpText) attributes.helpText = field.helpText;
    if (field.inlineHelpText) attributes.inlineHelpText = field.inlineHelpText;
    
    return {
      name: field.name || field.fullName,
      label: field.label,
      type: field.type,
      attributes
    };
  }

  getChangesSummary(changes: any[]): ChangeSummary {
    const summary: ChangeSummary = {
      totalChanges: 0,
      fields: { new: 0, modified: 0, deleted: 0 },
      validationRules: { new: 0, modified: 0, deleted: 0 },
      impacts: { high: 0, medium: 0, low: 0 }
    };
    
    for (const change of changes) {
      summary.totalChanges++;
      
      // Count by type and operation
      if (change.type === 'field') {
        if (change.operation === 'create') summary.fields.new++;
        else if (change.operation === 'update') summary.fields.modified++;
        else if (change.operation === 'delete') summary.fields.deleted++;
      } else if (change.type === 'validationRule') {
        if (change.operation === 'create') summary.validationRules.new++;
        else if (change.operation === 'update') summary.validationRules.modified++;
        else if (change.operation === 'delete') summary.validationRules.deleted++;
      }
      
      // Count by impact level
      if (change.impact === 'high') summary.impacts.high++;
      else if (change.impact === 'medium') summary.impacts.medium++;
      else if (change.impact === 'low') summary.impacts.low++;
    }
    
    return summary;
  }

  private getHumanReadableFieldType(type: string): string {
    const typeMap: Record<string, string> = {
      'Text': 'text',
      'TextArea': 'text area',
      'LongTextArea': 'long text area',
      'RichTextArea': 'rich text',
      'EncryptedText': 'encrypted text',
      'Email': 'email',
      'Phone': 'phone',
      'Url': 'URL',
      'Number': 'number',
      'Currency': 'currency',
      'Percent': 'percentage',
      'Date': 'date',
      'DateTime': 'date/time',
      'Time': 'time',
      'Checkbox': 'checkbox',
      'Picklist': 'picklist',
      'MultiselectPicklist': 'multi-select picklist',
      'Lookup': 'lookup relationship',
      'MasterDetail': 'master-detail relationship',
      'Formula': 'formula',
      'Rollup': 'rollup summary',
      'AutoNumber': 'auto-number',
      'Geolocation': 'geolocation'
    };
    
    return typeMap[type] || type.toLowerCase();
  }

  private simplifyFormula(formula: string): string {
    // Simplify common Salesforce formula patterns for readability
    return formula
      .replace(/ISBLANK\((.*?)\)/g, '$1 is blank')
      .replace(/NOT\(ISBLANK\((.*?)\)\)/g, '$1 is not blank')
      .replace(/ISNULL\((.*?)\)/g, '$1 is null')
      .replace(/NOT\(ISNULL\((.*?)\)\)/g, '$1 is not null')
      .replace(/AND\((.*?)\)/g, '($1)')
      .replace(/OR\((.*?)\)/g, '($1)')
      .replace(/\s+/g, ' ')
      .trim();
  }
}