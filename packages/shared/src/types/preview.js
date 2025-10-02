"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreviewMetadataSchema = exports.GeneratedMetadataSchema = exports.ValidationRuleMetadataSchema = exports.FieldMetadataSchema = exports.previewDataSchema = exports.textDataSchema = exports.tableDataSchema = exports.dependencyGraphDataSchema = exports.codeDiffDataSchema = exports.mockupDataSchema = exports.diagramDataSchema = exports.previewFormatSchema = exports.PreviewFormat = void 0;
exports.sanitizeString = sanitizeString;
exports.sanitizeMetadata = sanitizeMetadata;
const zod_1 = require("zod");
var PreviewFormat;
(function (PreviewFormat) {
    PreviewFormat["DIAGRAM"] = "diagram";
    PreviewFormat["MOCKUP"] = "mockup";
    PreviewFormat["CODE_DIFF"] = "code-diff";
    PreviewFormat["DEPENDENCY_GRAPH"] = "dependency-graph";
    PreviewFormat["TABLE"] = "table";
    PreviewFormat["TEXT"] = "text";
})(PreviewFormat || (exports.PreviewFormat = PreviewFormat = {}));
exports.previewFormatSchema = zod_1.z.nativeEnum(PreviewFormat);
exports.diagramDataSchema = zod_1.z.object({
    type: zod_1.z.literal('diagram'),
    mermaidSyntax: zod_1.z.string(),
    nodes: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        label: zod_1.z.string(),
        type: zod_1.z.string(),
        metadata: zod_1.z.record(zod_1.z.union([zod_1.z.string(), zod_1.z.number(), zod_1.z.boolean()])).optional(),
    })),
    edges: zod_1.z.array(zod_1.z.object({
        from: zod_1.z.string(),
        to: zod_1.z.string(),
        label: zod_1.z.string().optional(),
        type: zod_1.z.string().optional(),
    })),
});
exports.mockupDataSchema = zod_1.z.object({
    type: zod_1.z.literal('mockup'),
    html: zod_1.z.string(),
    css: zod_1.z.string().optional(),
    sections: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        fields: zod_1.z.array(zod_1.z.object({
            label: zod_1.z.string(),
            type: zod_1.z.string(),
            required: zod_1.z.boolean(),
            value: zod_1.z.union([zod_1.z.string(), zod_1.z.number(), zod_1.z.boolean(), zod_1.z.null()]).optional(),
        })),
    })),
});
exports.codeDiffDataSchema = zod_1.z.object({
    type: zod_1.z.literal('code-diff'),
    language: zod_1.z.string(),
    before: zod_1.z.string(),
    after: zod_1.z.string(),
    changes: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.enum(['add', 'remove', 'modify']),
        lineStart: zod_1.z.number(),
        lineEnd: zod_1.z.number(),
        content: zod_1.z.string(),
    })),
});
exports.dependencyGraphDataSchema = zod_1.z.object({
    type: zod_1.z.literal('dependency-graph'),
    mermaidSyntax: zod_1.z.string(),
    objects: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        type: zod_1.z.string(),
        fields: zod_1.z.array(zod_1.z.string()).optional(),
    })),
    relationships: zod_1.z.array(zod_1.z.object({
        from: zod_1.z.string(),
        to: zod_1.z.string(),
        type: zod_1.z.string(),
        field: zod_1.z.string().optional(),
    })),
});
exports.tableDataSchema = zod_1.z.object({
    type: zod_1.z.literal('table'),
    headers: zod_1.z.array(zod_1.z.string()),
    rows: zod_1.z.array(zod_1.z.array(zod_1.z.union([zod_1.z.string(), zod_1.z.number(), zod_1.z.boolean(), zod_1.z.null()]))),
    metadata: zod_1.z.record(zod_1.z.union([zod_1.z.string(), zod_1.z.number(), zod_1.z.boolean()])).optional(),
});
exports.textDataSchema = zod_1.z.object({
    type: zod_1.z.literal('text'),
    content: zod_1.z.string(),
    format: zod_1.z.enum(['plain', 'markdown', 'html']).optional(),
});
exports.previewDataSchema = zod_1.z.discriminatedUnion('type', [
    exports.diagramDataSchema,
    exports.mockupDataSchema,
    exports.codeDiffDataSchema,
    exports.dependencyGraphDataSchema,
    exports.tableDataSchema,
    exports.textDataSchema,
]);
// Existing Salesforce metadata schemas
exports.FieldMetadataSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    label: zod_1.z.string().min(1).max(255),
    type: zod_1.z.enum([
        'Text', 'TextArea', 'LongTextArea', 'RichTextArea', 'EncryptedText',
        'Email', 'Phone', 'Url', 'Number', 'Currency', 'Percent',
        'Date', 'DateTime', 'Time', 'Checkbox',
        'Picklist', 'MultiselectPicklist',
        'Lookup', 'MasterDetail',
        'Formula', 'Rollup', 'AutoNumber', 'Geolocation'
    ]),
    required: zod_1.z.boolean().optional(),
    length: zod_1.z.number().int().positive().optional(),
    precision: zod_1.z.number().int().positive().optional(),
    scale: zod_1.z.number().int().min(0).optional(),
    defaultValue: zod_1.z.string().optional(),
    helpText: zod_1.z.string().max(1000).optional(),
    formula: zod_1.z.string().optional(),
    picklistValues: zod_1.z.array(zod_1.z.string()).optional(),
    referenceTo: zod_1.z.array(zod_1.z.string()).optional(),
    unique: zod_1.z.boolean().optional(),
    externalId: zod_1.z.boolean().optional(),
    caseSensitive: zod_1.z.boolean().optional(),
    restricted: zod_1.z.boolean().optional(),
    relationshipName: zod_1.z.string().optional(),
    deleteConstraint: zod_1.z.enum(['SetNull', 'Cascade', 'Restrict']).optional(),
    currencyCode: zod_1.z.string().length(3).optional(),
    formulaTreatBlanksAs: zod_1.z.enum(['BlankAsZero', 'BlankAsBlank']).optional()
});
exports.ValidationRuleMetadataSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    description: zod_1.z.string().max(1000).optional(),
    errorConditionFormula: zod_1.z.string().min(1).max(5000),
    errorMessage: zod_1.z.string().min(1).max(500),
    active: zod_1.z.boolean().default(true),
    errorDisplayField: zod_1.z.string().optional()
});
exports.GeneratedMetadataSchema = zod_1.z.object({
    fields: zod_1.z.array(exports.FieldMetadataSchema).default([]),
    validationRules: zod_1.z.array(exports.ValidationRuleMetadataSchema).default([]),
    objectName: zod_1.z.string().default('CustomObject__c')
});
exports.PreviewMetadataSchema = zod_1.z.object({
    diffData: zod_1.z.object({
        before: zod_1.z.record(zod_1.z.unknown()).optional(),
        after: zod_1.z.record(zod_1.z.unknown()).optional(),
        changes: zod_1.z.array(zod_1.z.object({
            field: zod_1.z.string(),
            type: zod_1.z.enum(['added', 'removed', 'modified']),
            before: zod_1.z.unknown().optional(),
            after: zod_1.z.unknown().optional(),
        })).optional(),
    }),
    fieldDescriptions: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        description: zod_1.z.string(),
        properties: zod_1.z.record(zod_1.z.union([zod_1.z.string(), zod_1.z.number(), zod_1.z.boolean()]))
    })),
    ruleDescriptions: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        description: zod_1.z.string()
    })),
    fieldImpacts: zod_1.z.array(zod_1.z.object({
        field: zod_1.z.string(),
        impact: zod_1.z.string(),
        severity: zod_1.z.enum(['low', 'medium', 'high']),
        description: zod_1.z.string().optional(),
    })),
    ruleConflicts: zod_1.z.array(zod_1.z.object({
        rule: zod_1.z.string(),
        conflictWith: zod_1.z.string(),
        severity: zod_1.z.enum(['warning', 'error']),
        description: zod_1.z.string(),
    })),
    riskAssessment: zod_1.z.object({
        score: zod_1.z.number().min(0).max(100),
        level: zod_1.z.enum(['low', 'medium', 'high', 'critical']),
        factors: zod_1.z.array(zod_1.z.string()),
        recommendations: zod_1.z.array(zod_1.z.string())
    })
});
// Sanitization helper
function sanitizeString(input) {
    // Remove potential script tags and dangerous HTML
    return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '') // Remove event handlers
        .trim();
}
function sanitizeMetadata(metadata) {
    // Parse and validate metadata with Zod schema
    const parsed = exports.GeneratedMetadataSchema.parse(metadata);
    // Additional sanitization for string fields
    if (parsed.fields) {
        parsed.fields = parsed.fields.map(field => ({
            ...field,
            label: sanitizeString(field.label),
            helpText: field.helpText ? sanitizeString(field.helpText) : undefined,
            defaultValue: field.defaultValue ? sanitizeString(field.defaultValue) : undefined,
            formula: field.formula ? sanitizeString(field.formula) : undefined,
            picklistValues: field.picklistValues?.map(v => sanitizeString(v))
        }));
    }
    if (parsed.validationRules) {
        parsed.validationRules = parsed.validationRules.map(rule => ({
            ...rule,
            description: rule.description ? sanitizeString(rule.description) : undefined,
            errorMessage: sanitizeString(rule.errorMessage),
            errorConditionFormula: sanitizeString(rule.errorConditionFormula)
        }));
    }
    return parsed;
}
//# sourceMappingURL=preview.js.map