import { z } from 'zod';
export declare const fieldRequirementSchema: z.ZodObject<{
    fieldName: z.ZodString;
    fieldLabel: z.ZodString;
    fieldType: z.ZodString;
    description: z.ZodString;
    required: z.ZodBoolean;
    defaultValue: z.ZodOptional<z.ZodString>;
    picklistValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
    formula: z.ZodOptional<z.ZodString>;
    relatedObject: z.ZodOptional<z.ZodString>;
    maxLength: z.ZodOptional<z.ZodNumber>;
    precision: z.ZodOptional<z.ZodNumber>;
    scale: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const validationRuleRequirementSchema: z.ZodObject<{
    ruleName: z.ZodString;
    description: z.ZodString;
    errorConditionFormula: z.ZodString;
    errorMessage: z.ZodString;
    errorLocation: z.ZodEnum<{
        FIELD: "FIELD";
        TOP: "TOP";
    }>;
    relatedField: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type FieldRequirement = z.infer<typeof fieldRequirementSchema>;
export type ValidationRuleRequirement = z.infer<typeof validationRuleRequirementSchema>;
export interface ParsedRequirements {
    fields: FieldRequirement[];
    validationRules: ValidationRuleRequirement[];
    summary: string;
    ambiguities: string[];
}
export declare class RequirementsParser {
    private anthropic;
    private apiKeyProvider;
    constructor(apiKey?: string);
    parseTicketDescription(description: string, includeContext?: boolean): Promise<ParsedRequirements>;
    parseAcceptanceCriteria(acceptanceCriteria: string): Promise<Partial<ParsedRequirements>>;
    detectFieldType(requirementText: string): string;
    extractValidationRules(description: string): Promise<ValidationRuleRequirement[]>;
}
//# sourceMappingURL=requirements-parser.d.ts.map