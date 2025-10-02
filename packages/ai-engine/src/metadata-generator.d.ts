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
export declare class MetadataGenerator {
    private fieldTypeMapping;
    generateCustomField(requirement: FieldRequirement): SalesforceFieldMetadata;
    generateValidationRule(requirement: ValidationRuleRequirement): SalesforceValidationRuleMetadata;
    validateMetadata(metadata: GeneratedMetadata): {
        isValid: boolean;
        errors: string[];
    };
    enforceNamingConvention(fieldName: string, orgStandard?: string): string;
    private ensureCustomFieldSuffix;
    private ensureValidRuleName;
    private generateRelationshipName;
    private detectFormulaReturnType;
    private isValidApiName;
    private toPascalCase;
    private toCamelCase;
    generateAllFieldTypes(): {
        [key: string]: SalesforceFieldMetadata;
    };
}
//# sourceMappingURL=metadata-generator.d.ts.map