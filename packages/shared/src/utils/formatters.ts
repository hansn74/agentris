export type FieldType = 
  | 'Text' | 'TextArea' | 'LongTextArea' | 'RichTextArea' | 'EncryptedText'
  | 'Email' | 'Phone' | 'Url'
  | 'Number' | 'Currency' | 'Percent'
  | 'Date' | 'DateTime' | 'Time'
  | 'Checkbox'
  | 'Picklist' | 'MultiselectPicklist'
  | 'Lookup' | 'MasterDetail'
  | 'Formula' | 'Rollup' | 'AutoNumber' | 'Geolocation';

export class FieldFormatters {
  static formatText(value: string, maxLength?: number): string {
    if (!value) return '';
    if (maxLength && value.length > maxLength) {
      return `${value.substring(0, maxLength)}...`;
    }
    return value;
  }

  static formatNumber(value: number, precision?: number, scale?: number): string {
    if (value === null || value === undefined) return '';
    
    if (scale !== undefined) {
      return value.toFixed(scale);
    }
    
    if (precision !== undefined) {
      const str = value.toString();
      const parts = str.split('.');
      const integerPart = parts[0] || '0';
      const decimalPart = parts[1] || '';
      
      const maxDecimalPlaces = precision - integerPart.length;
      if (maxDecimalPlaces < 0) {
        return 'Exceeds precision';
      }
      
      if (decimalPart.length > maxDecimalPlaces) {
        return `${integerPart}.${decimalPart.substring(0, maxDecimalPlaces)}`;
      }
    }
    
    return value.toString();
  }

  static formatCurrency(value: number, currencyCode: string = 'USD', scale: number = 2): string {
    if (value === null || value === undefined) return '';
    
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: scale,
        maximumFractionDigits: scale
      }).format(value);
    } catch {
      return `${currencyCode} ${value.toFixed(scale)}`;
    }
  }

  static formatPercent(value: number, scale: number = 2): string {
    if (value === null || value === undefined) return '';
    return `${value.toFixed(scale)}%`;
  }

  static formatDate(value: Date | string, includeTime: boolean = false): string {
    if (!value) return '';
    
    const date = typeof value === 'string' ? new Date(value) : value;
    
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    
    if (includeTime) {
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  static formatTime(value: string): string {
    if (!value) return '';
    
    // Assuming time is in HH:mm:ss format
    const parts = value.split(':');
    if (parts.length < 2) return value;
    
    const hours = parseInt(parts[0] || '0', 10);
    const minutes = parts[1] || '00';
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    
    return `${displayHours}:${minutes} ${ampm}`;
  }

  static formatBoolean(value: boolean | null | undefined): string {
    if (value === null || value === undefined) return '';
    return value ? 'True' : 'False';
  }

  static formatPicklist(values: string[] | null | undefined, multiselect: boolean = false): string {
    if (!values || values.length === 0) return '';
    
    if (multiselect) {
      return values.join('; ');
    }
    
    return values[0] || '';
  }

  static formatFieldType(type: FieldType, field: any): string {
    switch (type) {
      case 'Text':
      case 'TextArea':
      case 'LongTextArea':
      case 'RichTextArea':
      case 'EncryptedText':
      case 'Email':
      case 'Phone':
      case 'Url':
        return this.formatText(field.value, field.length);
      
      case 'Number':
        return this.formatNumber(field.value, field.precision, field.scale);
      
      case 'Currency':
        return this.formatCurrency(field.value, field.currencyCode, field.scale);
      
      case 'Percent':
        return this.formatPercent(field.value, field.scale);
      
      case 'Date':
        return this.formatDate(field.value, false);
      
      case 'DateTime':
        return this.formatDate(field.value, true);
      
      case 'Time':
        return this.formatTime(field.value);
      
      case 'Checkbox':
        return this.formatBoolean(field.value);
      
      case 'Picklist':
        return this.formatPicklist([field.value], false);
      
      case 'MultiselectPicklist':
        return this.formatPicklist(field.value, true);
      
      case 'Formula':
      case 'AutoNumber':
        return this.formatText(field.value);
      
      case 'Lookup':
      case 'MasterDetail':
        return field.referenceName || field.value || '';
      
      case 'Geolocation':
        if (field.latitude && field.longitude) {
          return `${field.latitude}, ${field.longitude}`;
        }
        return '';
      
      default:
        return field.value ? String(field.value) : '';
    }
  }
}

export class ValidationRuleFormatters {
  static formatFormula(formula: string): string {
    if (!formula) return '';
    
    // Format common Salesforce formula patterns for readability
    let formatted = formula;
    
    // Add spacing around operators
    formatted = formatted.replace(/([=<>!]+)/g, ' $1 ');
    formatted = formatted.replace(/\s+/g, ' ');
    
    // Format common functions
    formatted = formatted.replace(/ISBLANK\(/g, 'ISBLANK(');
    formatted = formatted.replace(/ISNULL\(/g, 'ISNULL(');
    formatted = formatted.replace(/NOT\(/g, 'NOT(');
    formatted = formatted.replace(/AND\(/g, 'AND(');
    formatted = formatted.replace(/OR\(/g, 'OR(');
    
    return formatted.trim();
  }

  static simplifyFormula(formula: string): string {
    if (!formula) return '';
    
    let simplified = formula;
    
    // Replace common patterns with human-readable text
    // Handle NOT(ISBLANK()) first to avoid double replacement
    simplified = simplified.replace(/NOT\(ISBLANK\((.*?)\)\)/g, '$1 is not blank');
    simplified = simplified.replace(/NOT\(ISNULL\((.*?)\)\)/g, '$1 is not null');
    simplified = simplified.replace(/ISBLANK\((.*?)\)/g, '$1 is blank');
    simplified = simplified.replace(/ISNULL\((.*?)\)/g, '$1 is null');
    simplified = simplified.replace(/\s*=\s*TRUE/gi, ' is true');
    simplified = simplified.replace(/\s*=\s*FALSE/gi, ' is false');
    simplified = simplified.replace(/\s*!=\s*/g, ' is not equal to ');
    simplified = simplified.replace(/\s*=\s*/g, ' equals ');
    simplified = simplified.replace(/\s*>\s*/g, ' is greater than ');
    simplified = simplified.replace(/\s*<\s*/g, ' is less than ');
    simplified = simplified.replace(/\s*>=\s*/g, ' is greater than or equal to ');
    simplified = simplified.replace(/\s*<=\s*/g, ' is less than or equal to ');
    simplified = simplified.replace(/AND\((.*?)\)/g, '($1)');
    simplified = simplified.replace(/OR\((.*?)\)/g, '($1 or another condition)');
    simplified = simplified.replace(/\s+/g, ' ');
    
    return simplified.trim();
  }

  static formatErrorMessage(message: string, fieldName?: string): string {
    if (!message) return '';
    
    // Replace field API names with labels if provided
    if (fieldName) {
      const fieldLabel = this.apiNameToLabel(fieldName);
      message = message.replace(new RegExp(fieldName, 'gi'), fieldLabel);
    }
    
    // Ensure proper sentence formatting
    if (!message.endsWith('.') && !message.endsWith('!') && !message.endsWith('?')) {
      message += '.';
    }
    
    return message;
  }

  private static apiNameToLabel(apiName: string): string {
    // Convert API name to human-readable label
    // Remove __c suffix
    let label = apiName.replace(/__c$/i, '');
    
    // Replace underscores with spaces
    label = label.replace(/_/g, ' ');
    
    // Capitalize words
    label = label.replace(/\b\w/g, char => char.toUpperCase());
    
    return label;
  }
}

export class MetadataDescriptionBuilder {
  static buildFieldDescription(field: any): string {
    const parts: string[] = [];
    
    // Add type
    const typeLabel = this.getFieldTypeLabel(field.type);
    parts.push(typeLabel);
    
    // Add label
    if (field.label) {
      parts.push(`labeled "${field.label}"`);
    }
    
    // Add required status
    if (field.required) {
      parts.push('(required)');
    }
    
    // Add length constraint
    if (field.length) {
      parts.push(`with maximum ${field.length} characters`);
    }
    
    // Add precision/scale for numbers
    if (field.precision && field.type !== 'Currency') {
      if (field.scale) {
        parts.push(`with ${field.precision} digits (${field.scale} decimal places)`);
      } else {
        parts.push(`with ${field.precision} digits`);
      }
    }
    
    // Add picklist values
    if (field.picklistValues && field.picklistValues.length > 0) {
      const valueCount = field.picklistValues.length;
      const preview = field.picklistValues.slice(0, 3).join(', ');
      if (valueCount > 3) {
        parts.push(`with values: ${preview}, and ${valueCount - 3} more`);
      } else {
        parts.push(`with values: ${preview}`);
      }
    }
    
    // Add formula
    if (field.formula) {
      const simplified = ValidationRuleFormatters.simplifyFormula(field.formula);
      parts.push(`calculated as: ${simplified}`);
    }
    
    // Add reference information
    if (field.referenceTo && field.referenceTo.length > 0) {
      parts.push(`referencing ${field.referenceTo.join(', ')}`);
    }
    
    // Add help text
    if (field.helpText) {
      parts.push(`- ${field.helpText}`);
    }
    
    return parts.join(' ');
  }

  static buildValidationRuleDescription(rule: any): string {
    const parts: string[] = [];
    
    // Add name
    parts.push(`Validation rule "${rule.name}"`);
    
    // Add description if available
    if (rule.description) {
      parts.push(`- ${rule.description}`);
    }
    
    // Add condition
    const simplified = ValidationRuleFormatters.simplifyFormula(rule.errorConditionFormula);
    parts.push(`triggers when ${simplified}`);
    
    // Add error message
    parts.push(`showing error: "${rule.errorMessage}"`);
    
    // Add status
    if (rule.active === false) {
      parts.push('(currently inactive)');
    }
    
    return parts.join(' ');
  }

  private static getFieldTypeLabel(type: string): string {
    const typeLabels: Record<string, string> = {
      'Text': 'Text field',
      'TextArea': 'Text area field',
      'LongTextArea': 'Long text area field',
      'RichTextArea': 'Rich text field',
      'EncryptedText': 'Encrypted text field',
      'Email': 'Email field',
      'Phone': 'Phone number field',
      'Url': 'URL field',
      'Number': 'Number field',
      'Currency': 'Currency field',
      'Percent': 'Percentage field',
      'Date': 'Date field',
      'DateTime': 'Date and time field',
      'Time': 'Time field',
      'Checkbox': 'Checkbox field',
      'Picklist': 'Picklist field',
      'MultiselectPicklist': 'Multi-select picklist field',
      'Lookup': 'Lookup relationship field',
      'MasterDetail': 'Master-detail relationship field',
      'Formula': 'Formula field',
      'Rollup': 'Rollup summary field',
      'AutoNumber': 'Auto-number field',
      'Geolocation': 'Geolocation field'
    };
    
    return typeLabels[type] || `${type} field`;
  }
}

// Internationalization support
export class I18nFormatters {
  private static messages: Record<string, Record<string, string>> = {
    en: {
      'field.required': 'Required',
      'field.optional': 'Optional',
      'field.unique': 'Unique',
      'field.externalId': 'External ID',
      'validation.active': 'Active',
      'validation.inactive': 'Inactive',
      'impact.low': 'Low Impact',
      'impact.medium': 'Medium Impact',
      'impact.high': 'High Impact',
      'impact.critical': 'Critical Impact',
      'change.added': 'Added',
      'change.modified': 'Modified',
      'change.removed': 'Removed'
    }
  };

  static translate(key: string, locale: string = 'en'): string {
    const localeMessages = this.messages[locale] || this.messages['en'];
    return localeMessages?.[key] || key;
  }

  static formatWithLocale(value: any, type: string, locale: string = 'en'): string {
    // This can be extended to support different locale-specific formatting
    switch (type) {
      case 'number':
        return new Intl.NumberFormat(locale).format(value);
      case 'date':
        return new Intl.DateTimeFormat(locale).format(new Date(value));
      case 'currency':
        return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(value);
      default:
        return String(value);
    }
  }
}