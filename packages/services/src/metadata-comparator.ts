export interface FieldComparison {
  fieldName: string;
  status: 'added' | 'modified' | 'removed' | 'unchanged';
  current?: any;
  proposed?: any;
  differences?: FieldDifference[];
}

export interface FieldDifference {
  property: string;
  currentValue: any;
  proposedValue: any;
  changeType: 'added' | 'modified' | 'removed';
}

export interface ValidationRuleComparison {
  ruleName: string;
  status: 'added' | 'modified' | 'removed' | 'unchanged';
  current?: any;
  proposed?: any;
  differences?: RuleDifference[];
}

export interface RuleDifference {
  property: string;
  currentValue: any;
  proposedValue: any;
  changeType: 'added' | 'modified' | 'removed';
}

export interface DiffRepresentation {
  summary: {
    totalChanges: number;
    fieldsAdded: number;
    fieldsModified: number;
    fieldsRemoved: number;
    rulesAdded: number;
    rulesModified: number;
    rulesRemoved: number;
  };
  fields: FieldComparison[];
  validationRules: ValidationRuleComparison[];
  changePercentage: number;
}

export interface CurrentState {
  fields: any[];
  validationRules: any[];
  lastModified?: Date;
  objectName: string;
}

export class MetadataComparatorService {
  compareFields(currentFields: any[], proposedFields: any[]): FieldComparison[] {
    const comparisons: FieldComparison[] = [];
    const processedFieldNames = new Set<string>();
    
    // Check for added and modified fields
    for (const proposedField of proposedFields) {
      const fieldName = proposedField.name || proposedField.fullName;
      processedFieldNames.add(fieldName);
      
      const currentField = currentFields.find(
        f => (f.name || f.fullName) === fieldName
      );
      
      if (!currentField) {
        // Field is being added
        comparisons.push({
          fieldName,
          status: 'added',
          proposed: proposedField
        });
      } else {
        // Check if field is modified
        const differences = this.compareFieldProperties(currentField, proposedField);
        
        if (differences.length > 0) {
          comparisons.push({
            fieldName,
            status: 'modified',
            current: currentField,
            proposed: proposedField,
            differences
          });
        } else {
          comparisons.push({
            fieldName,
            status: 'unchanged',
            current: currentField,
            proposed: proposedField
          });
        }
      }
    }
    
    // Check for removed fields
    for (const currentField of currentFields) {
      const fieldName = currentField.name || currentField.fullName;
      
      if (!processedFieldNames.has(fieldName)) {
        comparisons.push({
          fieldName,
          status: 'removed',
          current: currentField
        });
      }
    }
    
    return comparisons;
  }

  compareValidationRules(currentRules: any[], proposedRules: any[]): ValidationRuleComparison[] {
    const comparisons: ValidationRuleComparison[] = [];
    const processedRuleNames = new Set<string>();
    
    // Check for added and modified rules
    for (const proposedRule of proposedRules) {
      const ruleName = proposedRule.name || proposedRule.fullName;
      processedRuleNames.add(ruleName);
      
      const currentRule = currentRules.find(
        r => (r.name || r.fullName) === ruleName
      );
      
      if (!currentRule) {
        // Rule is being added
        comparisons.push({
          ruleName,
          status: 'added',
          proposed: proposedRule
        });
      } else {
        // Check if rule is modified
        const differences = this.compareRuleProperties(currentRule, proposedRule);
        
        if (differences.length > 0) {
          comparisons.push({
            ruleName,
            status: 'modified',
            current: currentRule,
            proposed: proposedRule,
            differences
          });
        } else {
          comparisons.push({
            ruleName,
            status: 'unchanged',
            current: currentRule,
            proposed: proposedRule
          });
        }
      }
    }
    
    // Check for removed rules
    for (const currentRule of currentRules) {
      const ruleName = currentRule.name || currentRule.fullName;
      
      if (!processedRuleNames.has(ruleName)) {
        comparisons.push({
          ruleName,
          status: 'removed',
          current: currentRule
        });
      }
    }
    
    return comparisons;
  }

  generateDiff(
    currentState: CurrentState,
    proposedFields: any[],
    proposedRules: any[]
  ): DiffRepresentation {
    const fieldComparisons = this.compareFields(currentState.fields, proposedFields);
    const ruleComparisons = this.compareValidationRules(
      currentState.validationRules,
      proposedRules
    );
    
    // Calculate summary
    const summary = {
      totalChanges: 0,
      fieldsAdded: fieldComparisons.filter(f => f.status === 'added').length,
      fieldsModified: fieldComparisons.filter(f => f.status === 'modified').length,
      fieldsRemoved: fieldComparisons.filter(f => f.status === 'removed').length,
      rulesAdded: ruleComparisons.filter(r => r.status === 'added').length,
      rulesModified: ruleComparisons.filter(r => r.status === 'modified').length,
      rulesRemoved: ruleComparisons.filter(r => r.status === 'removed').length
    };
    
    summary.totalChanges = 
      summary.fieldsAdded + summary.fieldsModified + summary.fieldsRemoved +
      summary.rulesAdded + summary.rulesModified + summary.rulesRemoved;
    
    // Calculate change percentage
    const totalCurrentItems = currentState.fields.length + currentState.validationRules.length;
    const totalProposedItems = proposedFields.length + proposedRules.length;
    const maxItems = Math.max(totalCurrentItems, totalProposedItems, 1);
    const changePercentage = Math.round((summary.totalChanges / maxItems) * 100);
    
    return {
      summary,
      fields: fieldComparisons,
      validationRules: ruleComparisons,
      changePercentage
    };
  }

  getCurrentState(metadata: any): CurrentState {
    // Extract current state from Salesforce metadata or cached data
    const fields = metadata.fields || [];
    const validationRules = metadata.validationRules || [];
    
    return {
      fields: fields.map((f: any) => this.normalizeField(f)),
      validationRules: validationRules.map((r: any) => this.normalizeRule(r)),
      lastModified: metadata.lastModified || new Date(),
      objectName: metadata.objectName || 'CustomObject'
    };
  }

  private compareFieldProperties(current: any, proposed: any): FieldDifference[] {
    const differences: FieldDifference[] = [];
    const allKeys = new Set([
      ...Object.keys(current),
      ...Object.keys(proposed)
    ]);
    
    // Properties to compare
    const relevantProperties = [
      'label', 'type', 'length', 'precision', 'scale',
      'required', 'unique', 'externalId', 'defaultValue',
      'formula', 'picklistValues', 'referenceTo', 'relationshipName',
      'deleteConstraint', 'helpText', 'description'
    ];
    
    for (const key of allKeys) {
      if (!relevantProperties.includes(key)) continue;
      
      const currentValue = current[key];
      const proposedValue = proposed[key];
      
      if (currentValue === undefined && proposedValue !== undefined) {
        differences.push({
          property: key,
          currentValue: null,
          proposedValue,
          changeType: 'added'
        });
      } else if (currentValue !== undefined && proposedValue === undefined) {
        differences.push({
          property: key,
          currentValue,
          proposedValue: null,
          changeType: 'removed'
        });
      } else if (this.isDifferent(currentValue, proposedValue)) {
        differences.push({
          property: key,
          currentValue,
          proposedValue,
          changeType: 'modified'
        });
      }
    }
    
    return differences;
  }

  private compareRuleProperties(current: any, proposed: any): RuleDifference[] {
    const differences: RuleDifference[] = [];
    
    // Properties to compare for validation rules
    const relevantProperties = [
      'description', 'errorConditionFormula', 'errorMessage',
      'active', 'errorDisplayField'
    ];
    
    for (const key of relevantProperties) {
      const currentValue = current[key];
      const proposedValue = proposed[key];
      
      if (currentValue === undefined && proposedValue !== undefined) {
        differences.push({
          property: key,
          currentValue: null,
          proposedValue,
          changeType: 'added'
        });
      } else if (currentValue !== undefined && proposedValue === undefined) {
        differences.push({
          property: key,
          currentValue,
          proposedValue: null,
          changeType: 'removed'
        });
      } else if (this.isDifferent(currentValue, proposedValue)) {
        differences.push({
          property: key,
          currentValue,
          proposedValue,
          changeType: 'modified'
        });
      }
    }
    
    return differences;
  }

  private isDifferent(value1: any, value2: any): boolean {
    // Handle arrays
    if (Array.isArray(value1) && Array.isArray(value2)) {
      if (value1.length !== value2.length) return true;
      
      // For picklist values, compare sorted arrays
      const sorted1 = [...value1].sort();
      const sorted2 = [...value2].sort();
      
      return !sorted1.every((val, index) => val === sorted2[index]);
    }
    
    // Handle objects
    if (typeof value1 === 'object' && value1 !== null &&
        typeof value2 === 'object' && value2 !== null) {
      return JSON.stringify(value1) !== JSON.stringify(value2);
    }
    
    // Handle primitives
    return value1 !== value2;
  }

  private normalizeField(field: any): any {
    // Normalize field structure for consistent comparison
    return {
      name: field.name || field.fullName,
      label: field.label,
      type: field.type,
      length: field.length,
      precision: field.precision,
      scale: field.scale,
      required: field.required || false,
      unique: field.unique || false,
      externalId: field.externalId || false,
      defaultValue: field.defaultValue,
      formula: field.formula,
      picklistValues: field.picklistValues,
      referenceTo: field.referenceTo,
      relationshipName: field.relationshipName,
      deleteConstraint: field.deleteConstraint,
      helpText: field.helpText,
      description: field.description
    };
  }

  private normalizeRule(rule: any): any {
    // Normalize validation rule structure for consistent comparison
    return {
      name: rule.name || rule.fullName,
      description: rule.description,
      errorConditionFormula: rule.errorConditionFormula,
      errorMessage: rule.errorMessage,
      active: rule.active !== false,
      errorDisplayField: rule.errorDisplayField
    };
  }
}