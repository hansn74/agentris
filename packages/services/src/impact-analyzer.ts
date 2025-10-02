export interface FieldImpact {
  fieldName: string;
  impactType: 'conflict' | 'dependency' | 'modification' | 'deletion';
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedComponents: string[];
}

export interface ValidationRuleConflict {
  ruleName: string;
  conflictType: 'overlap' | 'contradiction' | 'redundancy';
  severity: 'low' | 'medium' | 'high';
  description: string;
  existingRule?: string;
}

export interface Dependency {
  sourceComponent: string;
  targetComponent: string;
  dependencyType: 'field' | 'formula' | 'workflow' | 'apex' | 'validation';
  description: string;
}

export interface RiskAssessment {
  score: number; // 0-100
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: string[];
  recommendations: string[];
}

export class ImpactAnalyzerService {
  analyzeFieldImpacts(newField: any, existingFields: any[]): FieldImpact[] {
    const impacts: FieldImpact[] = [];
    
    // Check for name conflicts
    const nameConflict = existingFields.find(
      f => f.name?.toLowerCase() === newField.name?.toLowerCase()
    );
    if (nameConflict) {
      impacts.push({
        fieldName: newField.name,
        impactType: 'conflict',
        severity: 'high',
        description: `Field name "${newField.name}" already exists`,
        affectedComponents: [nameConflict.name]
      });
    }
    
    // Check for label conflicts
    const labelConflict = existingFields.find(
      f => f.label?.toLowerCase() === newField.label?.toLowerCase() && 
      f.name !== newField.name
    );
    if (labelConflict) {
      impacts.push({
        fieldName: newField.name,
        impactType: 'conflict',
        severity: 'medium',
        description: `Field label "${newField.label}" is already used by field "${labelConflict.name}"`,
        affectedComponents: [labelConflict.name]
      });
    }
    
    // Check for relationship impacts
    if (newField.type === 'MasterDetail') {
      const existingMasterDetail = existingFields.filter(f => f.type === 'MasterDetail');
      if (existingMasterDetail.length >= 2) {
        impacts.push({
          fieldName: newField.name,
          impactType: 'conflict',
          severity: 'high',
          description: 'Object already has maximum number of master-detail relationships (2)',
          affectedComponents: existingMasterDetail.map(f => f.name)
        });
      }
    }
    
    // Check for formula field dependencies
    if (newField.type === 'Formula') {
      const referencedFields = this.extractFieldReferences(newField.formula || '');
      const missingFields = referencedFields.filter(
        ref => !existingFields.some(f => f.name === ref)
      );
      
      if (missingFields.length > 0) {
        impacts.push({
          fieldName: newField.name,
          impactType: 'dependency',
          severity: 'high',
          description: `Formula references non-existent fields: ${missingFields.join(', ')}`,
          affectedComponents: missingFields
        });
      }
    }
    
    // Check for rollup summary impacts
    if (newField.type === 'Rollup') {
      const masterDetailField = existingFields.find(
        f => f.type === 'MasterDetail' && f.referenceTo?.includes(newField.summarizedObject)
      );
      
      if (!masterDetailField) {
        impacts.push({
          fieldName: newField.name,
          impactType: 'dependency',
          severity: 'high',
          description: `Rollup summary requires master-detail relationship to ${newField.summarizedObject}`,
          affectedComponents: []
        });
      }
    }
    
    // Check for unique field limits
    if (newField.unique) {
      const uniqueFields = existingFields.filter(f => f.unique);
      if (uniqueFields.length >= 10) {
        impacts.push({
          fieldName: newField.name,
          impactType: 'conflict',
          severity: 'medium',
          description: 'Approaching limit of unique fields on object',
          affectedComponents: []
        });
      }
    }
    
    return impacts;
  }

  checkValidationRuleConflicts(newRule: any, existingRules: any[]): ValidationRuleConflict[] {
    const conflicts: ValidationRuleConflict[] = [];
    
    // Check for name conflicts
    const nameConflict = existingRules.find(
      r => r.name?.toLowerCase() === newRule.name?.toLowerCase()
    );
    if (nameConflict) {
      conflicts.push({
        ruleName: newRule.name,
        conflictType: 'overlap',
        severity: 'high',
        description: `Validation rule name "${newRule.name}" already exists`,
        existingRule: nameConflict.name
      });
    }
    
    // Check for formula overlaps
    const newFormulaFields = this.extractFieldReferences(newRule.errorConditionFormula || '');
    
    for (const existingRule of existingRules) {
      if (existingRule.name === newRule.name) continue;
      
      const existingFormulaFields = this.extractFieldReferences(
        existingRule.errorConditionFormula || ''
      );
      
      const overlappingFields = newFormulaFields.filter(f => 
        existingFormulaFields.includes(f)
      );
      
      if (overlappingFields.length > 0) {
        // Check if formulas might conflict
        const similarity = this.calculateFormulaSimilarity(
          newRule.errorConditionFormula,
          existingRule.errorConditionFormula
        );
        
        if (similarity > 0.7) {
          conflicts.push({
            ruleName: newRule.name,
            conflictType: 'redundancy',
            severity: 'medium',
            description: `Similar validation logic to existing rule "${existingRule.name}"`,
            existingRule: existingRule.name
          });
        } else if (this.areFormulasContradictory(
          newRule.errorConditionFormula,
          existingRule.errorConditionFormula
        )) {
          conflicts.push({
            ruleName: newRule.name,
            conflictType: 'contradiction',
            severity: 'high',
            description: `Potentially contradicts existing rule "${existingRule.name}"`,
            existingRule: existingRule.name
          });
        }
      }
    }
    
    return conflicts;
  }

  detectDependencies(component: any, allComponents: any[]): Dependency[] {
    const dependencies: Dependency[] = [];
    
    if (component.type === 'field') {
      // Check if field is referenced in formulas
      const formulaFields = allComponents.filter(c => 
        c.type === 'field' && c.fieldType === 'Formula'
      );
      
      for (const formulaField of formulaFields) {
        const references = this.extractFieldReferences(formulaField.formula || '');
        if (references.includes(component.name)) {
          dependencies.push({
            sourceComponent: formulaField.name,
            targetComponent: component.name,
            dependencyType: 'formula',
            description: `Formula field "${formulaField.name}" references this field`
          });
        }
      }
      
      // Check if field is referenced in validation rules
      const validationRules = allComponents.filter(c => c.type === 'validationRule');
      
      for (const rule of validationRules) {
        const references = this.extractFieldReferences(rule.errorConditionFormula || '');
        if (references.includes(component.name)) {
          dependencies.push({
            sourceComponent: rule.name,
            targetComponent: component.name,
            dependencyType: 'validation',
            description: `Validation rule "${rule.name}" references this field`
          });
        }
      }
      
      // Check for lookup/master-detail relationships
      if (component.fieldType === 'Lookup' || component.fieldType === 'MasterDetail') {
        const relatedFields = allComponents.filter(c => 
          c.type === 'field' && 
          c.referenceTo?.includes(component.referenceTo?.[0])
        );
        
        for (const relatedField of relatedFields) {
          dependencies.push({
            sourceComponent: relatedField.name,
            targetComponent: component.name,
            dependencyType: 'field',
            description: `Related through ${component.referenceTo?.[0]} object`
          });
        }
      }
    }
    
    return dependencies;
  }

  getRiskScore(changes: any[]): RiskAssessment {
    let score = 0;
    const factors: string[] = [];
    const recommendations: string[] = [];
    
    // Analyze each change
    for (const change of changes) {
      // High-risk changes
      if (change.type === 'field' && change.operation === 'delete') {
        score += 25;
        factors.push('Field deletion detected');
        recommendations.push('Ensure no dependencies exist on deleted fields');
      }
      
      if (change.type === 'field' && change.fieldType === 'MasterDetail') {
        score += 20;
        factors.push('Master-detail relationship change');
        recommendations.push('Test data model integrity after deployment');
      }
      
      if (change.type === 'validationRule' && change.operation === 'create') {
        score += 10;
        factors.push('New validation rule added');
        recommendations.push('Test with existing data to ensure compliance');
      }
      
      // Medium-risk changes
      if (change.type === 'field' && change.required === true) {
        score += 15;
        factors.push('Required field added');
        recommendations.push('Provide default values for existing records');
      }
      
      if (change.type === 'field' && change.unique === true) {
        score += 12;
        factors.push('Unique field constraint added');
        recommendations.push('Check for duplicate values in existing data');
      }
      
      // Low-risk changes
      if (change.type === 'field' && change.operation === 'create' && !change.required) {
        score += 5;
        factors.push('Optional field added');
      }
    }
    
    // Calculate risk level
    let level: 'low' | 'medium' | 'high' | 'critical';
    if (score >= 75) {
      level = 'critical';
      recommendations.unshift('Critical changes detected - thorough testing required');
    } else if (score >= 50) {
      level = 'high';
      recommendations.unshift('High-risk changes - comprehensive validation recommended');
    } else if (score >= 25) {
      level = 'medium';
      recommendations.unshift('Moderate risk - standard testing procedures apply');
    } else {
      level = 'low';
      recommendations.unshift('Low risk - basic validation sufficient');
    }
    
    // Cap score at 100
    score = Math.min(score, 100);
    
    return {
      score,
      level,
      factors,
      recommendations
    };
  }

  private extractFieldReferences(formula: string): string[] {
    // Extract field names from Salesforce formula
    const fieldPattern = /\b([A-Za-z_][A-Za-z0-9_]*__c)\b/g;
    const standardFieldPattern = /\b(Id|Name|CreatedDate|CreatedById|LastModifiedDate|LastModifiedById|OwnerId|RecordTypeId)\b/g;
    
    const customFields = [...(formula.match(fieldPattern) || [])];
    const standardFields = [...(formula.match(standardFieldPattern) || [])];
    
    return [...new Set([...customFields, ...standardFields])];
  }

  private calculateFormulaSimilarity(formula1: string, formula2: string): number {
    // Simple similarity calculation based on shared tokens
    const tokens1 = this.tokenizeFormula(formula1);
    const tokens2 = this.tokenizeFormula(formula2);
    
    const intersection = tokens1.filter(t => tokens2.includes(t));
    const union = [...new Set([...tokens1, ...tokens2])];
    
    return union.length > 0 ? intersection.length / union.length : 0;
  }

  private tokenizeFormula(formula: string): string[] {
    // Tokenize formula for comparison
    return formula
      .replace(/[(){}[\],]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 0)
      .map(token => token.toLowerCase());
  }

  private areFormulasContradictory(formula1: string, formula2: string): boolean {
    // Simple check for potential contradictions
    const normalized1 = formula1.toLowerCase();
    const normalized2 = formula2.toLowerCase();
    
    // Check for opposite conditions
    if (normalized1.includes('not') && !normalized2.includes('not')) {
      const withoutNot = normalized1.replace(/not\s*\(/g, '(');
      return this.calculateFormulaSimilarity(withoutNot, normalized2) > 0.5;
    }
    
    if (!normalized1.includes('not') && normalized2.includes('not')) {
      const withoutNot = normalized2.replace(/not\s*\(/g, '(');
      return this.calculateFormulaSimilarity(normalized1, withoutNot) > 0.5;
    }
    
    return false;
  }
}