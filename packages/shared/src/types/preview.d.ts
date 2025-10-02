import { z } from 'zod';
export declare enum PreviewFormat {
    DIAGRAM = "diagram",
    MOCKUP = "mockup",
    CODE_DIFF = "code-diff",
    DEPENDENCY_GRAPH = "dependency-graph",
    TABLE = "table",
    TEXT = "text"
}
export declare const previewFormatSchema: z.ZodNativeEnum<typeof PreviewFormat>;
export declare const diagramDataSchema: z.ZodObject<{
    type: z.ZodLiteral<"diagram">;
    mermaidSyntax: z.ZodString;
    nodes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        type: z.ZodString;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean]>>>;
    }, "strip", z.ZodTypeAny, {
        label: string;
        id: string;
        type: string;
        metadata?: Record<string, string | number | boolean> | undefined;
    }, {
        label: string;
        id: string;
        type: string;
        metadata?: Record<string, string | number | boolean> | undefined;
    }>, "many">;
    edges: z.ZodArray<z.ZodObject<{
        from: z.ZodString;
        to: z.ZodString;
        label: z.ZodOptional<z.ZodString>;
        type: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        from: string;
        to: string;
        label?: string | undefined;
        type?: string | undefined;
    }, {
        from: string;
        to: string;
        label?: string | undefined;
        type?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "diagram";
    mermaidSyntax: string;
    nodes: {
        label: string;
        id: string;
        type: string;
        metadata?: Record<string, string | number | boolean> | undefined;
    }[];
    edges: {
        from: string;
        to: string;
        label?: string | undefined;
        type?: string | undefined;
    }[];
}, {
    type: "diagram";
    mermaidSyntax: string;
    nodes: {
        label: string;
        id: string;
        type: string;
        metadata?: Record<string, string | number | boolean> | undefined;
    }[];
    edges: {
        from: string;
        to: string;
        label?: string | undefined;
        type?: string | undefined;
    }[];
}>;
export declare const mockupDataSchema: z.ZodObject<{
    type: z.ZodLiteral<"mockup">;
    html: z.ZodString;
    css: z.ZodOptional<z.ZodString>;
    sections: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        fields: z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            type: z.ZodString;
            required: z.ZodBoolean;
            value: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
        }, "strip", z.ZodTypeAny, {
            label: string;
            type: string;
            required: boolean;
            value?: string | number | boolean | null | undefined;
        }, {
            label: string;
            type: string;
            required: boolean;
            value?: string | number | boolean | null | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        name: string;
        fields: {
            label: string;
            type: string;
            required: boolean;
            value?: string | number | boolean | null | undefined;
        }[];
    }, {
        name: string;
        fields: {
            label: string;
            type: string;
            required: boolean;
            value?: string | number | boolean | null | undefined;
        }[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "mockup";
    html: string;
    sections: {
        name: string;
        fields: {
            label: string;
            type: string;
            required: boolean;
            value?: string | number | boolean | null | undefined;
        }[];
    }[];
    css?: string | undefined;
}, {
    type: "mockup";
    html: string;
    sections: {
        name: string;
        fields: {
            label: string;
            type: string;
            required: boolean;
            value?: string | number | boolean | null | undefined;
        }[];
    }[];
    css?: string | undefined;
}>;
export declare const codeDiffDataSchema: z.ZodObject<{
    type: z.ZodLiteral<"code-diff">;
    language: z.ZodString;
    before: z.ZodString;
    after: z.ZodString;
    changes: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["add", "remove", "modify"]>;
        lineStart: z.ZodNumber;
        lineEnd: z.ZodNumber;
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "add" | "remove" | "modify";
        lineStart: number;
        lineEnd: number;
        content: string;
    }, {
        type: "add" | "remove" | "modify";
        lineStart: number;
        lineEnd: number;
        content: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "code-diff";
    language: string;
    before: string;
    after: string;
    changes: {
        type: "add" | "remove" | "modify";
        lineStart: number;
        lineEnd: number;
        content: string;
    }[];
}, {
    type: "code-diff";
    language: string;
    before: string;
    after: string;
    changes: {
        type: "add" | "remove" | "modify";
        lineStart: number;
        lineEnd: number;
        content: string;
    }[];
}>;
export declare const dependencyGraphDataSchema: z.ZodObject<{
    type: z.ZodLiteral<"dependency-graph">;
    mermaidSyntax: z.ZodString;
    objects: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodString;
        fields: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: string;
        name: string;
        fields?: string[] | undefined;
    }, {
        type: string;
        name: string;
        fields?: string[] | undefined;
    }>, "many">;
    relationships: z.ZodArray<z.ZodObject<{
        from: z.ZodString;
        to: z.ZodString;
        type: z.ZodString;
        field: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: string;
        from: string;
        to: string;
        field?: string | undefined;
    }, {
        type: string;
        from: string;
        to: string;
        field?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "dependency-graph";
    mermaidSyntax: string;
    objects: {
        type: string;
        name: string;
        fields?: string[] | undefined;
    }[];
    relationships: {
        type: string;
        from: string;
        to: string;
        field?: string | undefined;
    }[];
}, {
    type: "dependency-graph";
    mermaidSyntax: string;
    objects: {
        type: string;
        name: string;
        fields?: string[] | undefined;
    }[];
    relationships: {
        type: string;
        from: string;
        to: string;
        field?: string | undefined;
    }[];
}>;
export declare const tableDataSchema: z.ZodObject<{
    type: z.ZodLiteral<"table">;
    headers: z.ZodArray<z.ZodString, "many">;
    rows: z.ZodArray<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>, "many">, "many">;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean]>>>;
}, "strip", z.ZodTypeAny, {
    type: "table";
    headers: string[];
    rows: (string | number | boolean | null)[][];
    metadata?: Record<string, string | number | boolean> | undefined;
}, {
    type: "table";
    headers: string[];
    rows: (string | number | boolean | null)[][];
    metadata?: Record<string, string | number | boolean> | undefined;
}>;
export declare const textDataSchema: z.ZodObject<{
    type: z.ZodLiteral<"text">;
    content: z.ZodString;
    format: z.ZodOptional<z.ZodEnum<["plain", "markdown", "html"]>>;
}, "strip", z.ZodTypeAny, {
    type: "text";
    content: string;
    format?: "html" | "plain" | "markdown" | undefined;
}, {
    type: "text";
    content: string;
    format?: "html" | "plain" | "markdown" | undefined;
}>;
export declare const previewDataSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"diagram">;
    mermaidSyntax: z.ZodString;
    nodes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        type: z.ZodString;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean]>>>;
    }, "strip", z.ZodTypeAny, {
        label: string;
        id: string;
        type: string;
        metadata?: Record<string, string | number | boolean> | undefined;
    }, {
        label: string;
        id: string;
        type: string;
        metadata?: Record<string, string | number | boolean> | undefined;
    }>, "many">;
    edges: z.ZodArray<z.ZodObject<{
        from: z.ZodString;
        to: z.ZodString;
        label: z.ZodOptional<z.ZodString>;
        type: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        from: string;
        to: string;
        label?: string | undefined;
        type?: string | undefined;
    }, {
        from: string;
        to: string;
        label?: string | undefined;
        type?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "diagram";
    mermaidSyntax: string;
    nodes: {
        label: string;
        id: string;
        type: string;
        metadata?: Record<string, string | number | boolean> | undefined;
    }[];
    edges: {
        from: string;
        to: string;
        label?: string | undefined;
        type?: string | undefined;
    }[];
}, {
    type: "diagram";
    mermaidSyntax: string;
    nodes: {
        label: string;
        id: string;
        type: string;
        metadata?: Record<string, string | number | boolean> | undefined;
    }[];
    edges: {
        from: string;
        to: string;
        label?: string | undefined;
        type?: string | undefined;
    }[];
}>, z.ZodObject<{
    type: z.ZodLiteral<"mockup">;
    html: z.ZodString;
    css: z.ZodOptional<z.ZodString>;
    sections: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        fields: z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            type: z.ZodString;
            required: z.ZodBoolean;
            value: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
        }, "strip", z.ZodTypeAny, {
            label: string;
            type: string;
            required: boolean;
            value?: string | number | boolean | null | undefined;
        }, {
            label: string;
            type: string;
            required: boolean;
            value?: string | number | boolean | null | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        name: string;
        fields: {
            label: string;
            type: string;
            required: boolean;
            value?: string | number | boolean | null | undefined;
        }[];
    }, {
        name: string;
        fields: {
            label: string;
            type: string;
            required: boolean;
            value?: string | number | boolean | null | undefined;
        }[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "mockup";
    html: string;
    sections: {
        name: string;
        fields: {
            label: string;
            type: string;
            required: boolean;
            value?: string | number | boolean | null | undefined;
        }[];
    }[];
    css?: string | undefined;
}, {
    type: "mockup";
    html: string;
    sections: {
        name: string;
        fields: {
            label: string;
            type: string;
            required: boolean;
            value?: string | number | boolean | null | undefined;
        }[];
    }[];
    css?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"code-diff">;
    language: z.ZodString;
    before: z.ZodString;
    after: z.ZodString;
    changes: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["add", "remove", "modify"]>;
        lineStart: z.ZodNumber;
        lineEnd: z.ZodNumber;
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "add" | "remove" | "modify";
        lineStart: number;
        lineEnd: number;
        content: string;
    }, {
        type: "add" | "remove" | "modify";
        lineStart: number;
        lineEnd: number;
        content: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "code-diff";
    language: string;
    before: string;
    after: string;
    changes: {
        type: "add" | "remove" | "modify";
        lineStart: number;
        lineEnd: number;
        content: string;
    }[];
}, {
    type: "code-diff";
    language: string;
    before: string;
    after: string;
    changes: {
        type: "add" | "remove" | "modify";
        lineStart: number;
        lineEnd: number;
        content: string;
    }[];
}>, z.ZodObject<{
    type: z.ZodLiteral<"dependency-graph">;
    mermaidSyntax: z.ZodString;
    objects: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodString;
        fields: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: string;
        name: string;
        fields?: string[] | undefined;
    }, {
        type: string;
        name: string;
        fields?: string[] | undefined;
    }>, "many">;
    relationships: z.ZodArray<z.ZodObject<{
        from: z.ZodString;
        to: z.ZodString;
        type: z.ZodString;
        field: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: string;
        from: string;
        to: string;
        field?: string | undefined;
    }, {
        type: string;
        from: string;
        to: string;
        field?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "dependency-graph";
    mermaidSyntax: string;
    objects: {
        type: string;
        name: string;
        fields?: string[] | undefined;
    }[];
    relationships: {
        type: string;
        from: string;
        to: string;
        field?: string | undefined;
    }[];
}, {
    type: "dependency-graph";
    mermaidSyntax: string;
    objects: {
        type: string;
        name: string;
        fields?: string[] | undefined;
    }[];
    relationships: {
        type: string;
        from: string;
        to: string;
        field?: string | undefined;
    }[];
}>, z.ZodObject<{
    type: z.ZodLiteral<"table">;
    headers: z.ZodArray<z.ZodString, "many">;
    rows: z.ZodArray<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>, "many">, "many">;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean]>>>;
}, "strip", z.ZodTypeAny, {
    type: "table";
    headers: string[];
    rows: (string | number | boolean | null)[][];
    metadata?: Record<string, string | number | boolean> | undefined;
}, {
    type: "table";
    headers: string[];
    rows: (string | number | boolean | null)[][];
    metadata?: Record<string, string | number | boolean> | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"text">;
    content: z.ZodString;
    format: z.ZodOptional<z.ZodEnum<["plain", "markdown", "html"]>>;
}, "strip", z.ZodTypeAny, {
    type: "text";
    content: string;
    format?: "html" | "plain" | "markdown" | undefined;
}, {
    type: "text";
    content: string;
    format?: "html" | "plain" | "markdown" | undefined;
}>]>;
export type DiagramData = z.infer<typeof diagramDataSchema>;
export type MockupData = z.infer<typeof mockupDataSchema>;
export type CodeDiffData = z.infer<typeof codeDiffDataSchema>;
export type DependencyGraphData = z.infer<typeof dependencyGraphDataSchema>;
export type TableData = z.infer<typeof tableDataSchema>;
export type TextData = z.infer<typeof textDataSchema>;
export type PreviewData = z.infer<typeof previewDataSchema>;
export declare const FieldMetadataSchema: z.ZodObject<{
    name: z.ZodString;
    label: z.ZodString;
    type: z.ZodEnum<["Text", "TextArea", "LongTextArea", "RichTextArea", "EncryptedText", "Email", "Phone", "Url", "Number", "Currency", "Percent", "Date", "DateTime", "Time", "Checkbox", "Picklist", "MultiselectPicklist", "Lookup", "MasterDetail", "Formula", "Rollup", "AutoNumber", "Geolocation"]>;
    required: z.ZodOptional<z.ZodBoolean>;
    length: z.ZodOptional<z.ZodNumber>;
    precision: z.ZodOptional<z.ZodNumber>;
    scale: z.ZodOptional<z.ZodNumber>;
    defaultValue: z.ZodOptional<z.ZodString>;
    helpText: z.ZodOptional<z.ZodString>;
    formula: z.ZodOptional<z.ZodString>;
    picklistValues: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    referenceTo: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    unique: z.ZodOptional<z.ZodBoolean>;
    externalId: z.ZodOptional<z.ZodBoolean>;
    caseSensitive: z.ZodOptional<z.ZodBoolean>;
    restricted: z.ZodOptional<z.ZodBoolean>;
    relationshipName: z.ZodOptional<z.ZodString>;
    deleteConstraint: z.ZodOptional<z.ZodEnum<["SetNull", "Cascade", "Restrict"]>>;
    currencyCode: z.ZodOptional<z.ZodString>;
    formulaTreatBlanksAs: z.ZodOptional<z.ZodEnum<["BlankAsZero", "BlankAsBlank"]>>;
}, "strip", z.ZodTypeAny, {
    label: string;
    type: "Text" | "TextArea" | "LongTextArea" | "RichTextArea" | "EncryptedText" | "Email" | "Phone" | "Url" | "Number" | "Currency" | "Percent" | "Date" | "DateTime" | "Time" | "Checkbox" | "Picklist" | "MultiselectPicklist" | "Lookup" | "MasterDetail" | "Formula" | "Rollup" | "AutoNumber" | "Geolocation";
    name: string;
    required?: boolean | undefined;
    length?: number | undefined;
    precision?: number | undefined;
    scale?: number | undefined;
    defaultValue?: string | undefined;
    helpText?: string | undefined;
    formula?: string | undefined;
    picklistValues?: string[] | undefined;
    referenceTo?: string[] | undefined;
    unique?: boolean | undefined;
    externalId?: boolean | undefined;
    caseSensitive?: boolean | undefined;
    restricted?: boolean | undefined;
    relationshipName?: string | undefined;
    deleteConstraint?: "SetNull" | "Cascade" | "Restrict" | undefined;
    currencyCode?: string | undefined;
    formulaTreatBlanksAs?: "BlankAsZero" | "BlankAsBlank" | undefined;
}, {
    label: string;
    type: "Text" | "TextArea" | "LongTextArea" | "RichTextArea" | "EncryptedText" | "Email" | "Phone" | "Url" | "Number" | "Currency" | "Percent" | "Date" | "DateTime" | "Time" | "Checkbox" | "Picklist" | "MultiselectPicklist" | "Lookup" | "MasterDetail" | "Formula" | "Rollup" | "AutoNumber" | "Geolocation";
    name: string;
    required?: boolean | undefined;
    length?: number | undefined;
    precision?: number | undefined;
    scale?: number | undefined;
    defaultValue?: string | undefined;
    helpText?: string | undefined;
    formula?: string | undefined;
    picklistValues?: string[] | undefined;
    referenceTo?: string[] | undefined;
    unique?: boolean | undefined;
    externalId?: boolean | undefined;
    caseSensitive?: boolean | undefined;
    restricted?: boolean | undefined;
    relationshipName?: string | undefined;
    deleteConstraint?: "SetNull" | "Cascade" | "Restrict" | undefined;
    currencyCode?: string | undefined;
    formulaTreatBlanksAs?: "BlankAsZero" | "BlankAsBlank" | undefined;
}>;
export declare const ValidationRuleMetadataSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    errorConditionFormula: z.ZodString;
    errorMessage: z.ZodString;
    active: z.ZodDefault<z.ZodBoolean>;
    errorDisplayField: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    errorConditionFormula: string;
    errorMessage: string;
    active: boolean;
    description?: string | undefined;
    errorDisplayField?: string | undefined;
}, {
    name: string;
    errorConditionFormula: string;
    errorMessage: string;
    description?: string | undefined;
    active?: boolean | undefined;
    errorDisplayField?: string | undefined;
}>;
export declare const GeneratedMetadataSchema: z.ZodObject<{
    fields: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        label: z.ZodString;
        type: z.ZodEnum<["Text", "TextArea", "LongTextArea", "RichTextArea", "EncryptedText", "Email", "Phone", "Url", "Number", "Currency", "Percent", "Date", "DateTime", "Time", "Checkbox", "Picklist", "MultiselectPicklist", "Lookup", "MasterDetail", "Formula", "Rollup", "AutoNumber", "Geolocation"]>;
        required: z.ZodOptional<z.ZodBoolean>;
        length: z.ZodOptional<z.ZodNumber>;
        precision: z.ZodOptional<z.ZodNumber>;
        scale: z.ZodOptional<z.ZodNumber>;
        defaultValue: z.ZodOptional<z.ZodString>;
        helpText: z.ZodOptional<z.ZodString>;
        formula: z.ZodOptional<z.ZodString>;
        picklistValues: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        referenceTo: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        unique: z.ZodOptional<z.ZodBoolean>;
        externalId: z.ZodOptional<z.ZodBoolean>;
        caseSensitive: z.ZodOptional<z.ZodBoolean>;
        restricted: z.ZodOptional<z.ZodBoolean>;
        relationshipName: z.ZodOptional<z.ZodString>;
        deleteConstraint: z.ZodOptional<z.ZodEnum<["SetNull", "Cascade", "Restrict"]>>;
        currencyCode: z.ZodOptional<z.ZodString>;
        formulaTreatBlanksAs: z.ZodOptional<z.ZodEnum<["BlankAsZero", "BlankAsBlank"]>>;
    }, "strip", z.ZodTypeAny, {
        label: string;
        type: "Text" | "TextArea" | "LongTextArea" | "RichTextArea" | "EncryptedText" | "Email" | "Phone" | "Url" | "Number" | "Currency" | "Percent" | "Date" | "DateTime" | "Time" | "Checkbox" | "Picklist" | "MultiselectPicklist" | "Lookup" | "MasterDetail" | "Formula" | "Rollup" | "AutoNumber" | "Geolocation";
        name: string;
        required?: boolean | undefined;
        length?: number | undefined;
        precision?: number | undefined;
        scale?: number | undefined;
        defaultValue?: string | undefined;
        helpText?: string | undefined;
        formula?: string | undefined;
        picklistValues?: string[] | undefined;
        referenceTo?: string[] | undefined;
        unique?: boolean | undefined;
        externalId?: boolean | undefined;
        caseSensitive?: boolean | undefined;
        restricted?: boolean | undefined;
        relationshipName?: string | undefined;
        deleteConstraint?: "SetNull" | "Cascade" | "Restrict" | undefined;
        currencyCode?: string | undefined;
        formulaTreatBlanksAs?: "BlankAsZero" | "BlankAsBlank" | undefined;
    }, {
        label: string;
        type: "Text" | "TextArea" | "LongTextArea" | "RichTextArea" | "EncryptedText" | "Email" | "Phone" | "Url" | "Number" | "Currency" | "Percent" | "Date" | "DateTime" | "Time" | "Checkbox" | "Picklist" | "MultiselectPicklist" | "Lookup" | "MasterDetail" | "Formula" | "Rollup" | "AutoNumber" | "Geolocation";
        name: string;
        required?: boolean | undefined;
        length?: number | undefined;
        precision?: number | undefined;
        scale?: number | undefined;
        defaultValue?: string | undefined;
        helpText?: string | undefined;
        formula?: string | undefined;
        picklistValues?: string[] | undefined;
        referenceTo?: string[] | undefined;
        unique?: boolean | undefined;
        externalId?: boolean | undefined;
        caseSensitive?: boolean | undefined;
        restricted?: boolean | undefined;
        relationshipName?: string | undefined;
        deleteConstraint?: "SetNull" | "Cascade" | "Restrict" | undefined;
        currencyCode?: string | undefined;
        formulaTreatBlanksAs?: "BlankAsZero" | "BlankAsBlank" | undefined;
    }>, "many">>;
    validationRules: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        errorConditionFormula: z.ZodString;
        errorMessage: z.ZodString;
        active: z.ZodDefault<z.ZodBoolean>;
        errorDisplayField: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        errorConditionFormula: string;
        errorMessage: string;
        active: boolean;
        description?: string | undefined;
        errorDisplayField?: string | undefined;
    }, {
        name: string;
        errorConditionFormula: string;
        errorMessage: string;
        description?: string | undefined;
        active?: boolean | undefined;
        errorDisplayField?: string | undefined;
    }>, "many">>;
    objectName: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    fields: {
        label: string;
        type: "Text" | "TextArea" | "LongTextArea" | "RichTextArea" | "EncryptedText" | "Email" | "Phone" | "Url" | "Number" | "Currency" | "Percent" | "Date" | "DateTime" | "Time" | "Checkbox" | "Picklist" | "MultiselectPicklist" | "Lookup" | "MasterDetail" | "Formula" | "Rollup" | "AutoNumber" | "Geolocation";
        name: string;
        required?: boolean | undefined;
        length?: number | undefined;
        precision?: number | undefined;
        scale?: number | undefined;
        defaultValue?: string | undefined;
        helpText?: string | undefined;
        formula?: string | undefined;
        picklistValues?: string[] | undefined;
        referenceTo?: string[] | undefined;
        unique?: boolean | undefined;
        externalId?: boolean | undefined;
        caseSensitive?: boolean | undefined;
        restricted?: boolean | undefined;
        relationshipName?: string | undefined;
        deleteConstraint?: "SetNull" | "Cascade" | "Restrict" | undefined;
        currencyCode?: string | undefined;
        formulaTreatBlanksAs?: "BlankAsZero" | "BlankAsBlank" | undefined;
    }[];
    validationRules: {
        name: string;
        errorConditionFormula: string;
        errorMessage: string;
        active: boolean;
        description?: string | undefined;
        errorDisplayField?: string | undefined;
    }[];
    objectName: string;
}, {
    fields?: {
        label: string;
        type: "Text" | "TextArea" | "LongTextArea" | "RichTextArea" | "EncryptedText" | "Email" | "Phone" | "Url" | "Number" | "Currency" | "Percent" | "Date" | "DateTime" | "Time" | "Checkbox" | "Picklist" | "MultiselectPicklist" | "Lookup" | "MasterDetail" | "Formula" | "Rollup" | "AutoNumber" | "Geolocation";
        name: string;
        required?: boolean | undefined;
        length?: number | undefined;
        precision?: number | undefined;
        scale?: number | undefined;
        defaultValue?: string | undefined;
        helpText?: string | undefined;
        formula?: string | undefined;
        picklistValues?: string[] | undefined;
        referenceTo?: string[] | undefined;
        unique?: boolean | undefined;
        externalId?: boolean | undefined;
        caseSensitive?: boolean | undefined;
        restricted?: boolean | undefined;
        relationshipName?: string | undefined;
        deleteConstraint?: "SetNull" | "Cascade" | "Restrict" | undefined;
        currencyCode?: string | undefined;
        formulaTreatBlanksAs?: "BlankAsZero" | "BlankAsBlank" | undefined;
    }[] | undefined;
    validationRules?: {
        name: string;
        errorConditionFormula: string;
        errorMessage: string;
        description?: string | undefined;
        active?: boolean | undefined;
        errorDisplayField?: string | undefined;
    }[] | undefined;
    objectName?: string | undefined;
}>;
export declare const PreviewMetadataSchema: z.ZodObject<{
    diffData: z.ZodObject<{
        before: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        after: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        changes: z.ZodOptional<z.ZodArray<z.ZodObject<{
            field: z.ZodString;
            type: z.ZodEnum<["added", "removed", "modified"]>;
            before: z.ZodOptional<z.ZodUnknown>;
            after: z.ZodOptional<z.ZodUnknown>;
        }, "strip", z.ZodTypeAny, {
            type: "modified" | "added" | "removed";
            field: string;
            before?: unknown;
            after?: unknown;
        }, {
            type: "modified" | "added" | "removed";
            field: string;
            before?: unknown;
            after?: unknown;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        before?: Record<string, unknown> | undefined;
        after?: Record<string, unknown> | undefined;
        changes?: {
            type: "modified" | "added" | "removed";
            field: string;
            before?: unknown;
            after?: unknown;
        }[] | undefined;
    }, {
        before?: Record<string, unknown> | undefined;
        after?: Record<string, unknown> | undefined;
        changes?: {
            type: "modified" | "added" | "removed";
            field: string;
            before?: unknown;
            after?: unknown;
        }[] | undefined;
    }>;
    fieldDescriptions: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
        properties: z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean]>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        description: string;
        properties: Record<string, string | number | boolean>;
    }, {
        name: string;
        description: string;
        properties: Record<string, string | number | boolean>;
    }>, "many">;
    ruleDescriptions: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        description: string;
    }, {
        name: string;
        description: string;
    }>, "many">;
    fieldImpacts: z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        impact: z.ZodString;
        severity: z.ZodEnum<["low", "medium", "high"]>;
        description: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        field: string;
        impact: string;
        severity: "low" | "medium" | "high";
        description?: string | undefined;
    }, {
        field: string;
        impact: string;
        severity: "low" | "medium" | "high";
        description?: string | undefined;
    }>, "many">;
    ruleConflicts: z.ZodArray<z.ZodObject<{
        rule: z.ZodString;
        conflictWith: z.ZodString;
        severity: z.ZodEnum<["warning", "error"]>;
        description: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        description: string;
        severity: "warning" | "error";
        rule: string;
        conflictWith: string;
    }, {
        description: string;
        severity: "warning" | "error";
        rule: string;
        conflictWith: string;
    }>, "many">;
    riskAssessment: z.ZodObject<{
        score: z.ZodNumber;
        level: z.ZodEnum<["low", "medium", "high", "critical"]>;
        factors: z.ZodArray<z.ZodString, "many">;
        recommendations: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        score: number;
        level: "low" | "medium" | "high" | "critical";
        factors: string[];
        recommendations: string[];
    }, {
        score: number;
        level: "low" | "medium" | "high" | "critical";
        factors: string[];
        recommendations: string[];
    }>;
}, "strip", z.ZodTypeAny, {
    diffData: {
        before?: Record<string, unknown> | undefined;
        after?: Record<string, unknown> | undefined;
        changes?: {
            type: "modified" | "added" | "removed";
            field: string;
            before?: unknown;
            after?: unknown;
        }[] | undefined;
    };
    fieldDescriptions: {
        name: string;
        description: string;
        properties: Record<string, string | number | boolean>;
    }[];
    ruleDescriptions: {
        name: string;
        description: string;
    }[];
    fieldImpacts: {
        field: string;
        impact: string;
        severity: "low" | "medium" | "high";
        description?: string | undefined;
    }[];
    ruleConflicts: {
        description: string;
        severity: "warning" | "error";
        rule: string;
        conflictWith: string;
    }[];
    riskAssessment: {
        score: number;
        level: "low" | "medium" | "high" | "critical";
        factors: string[];
        recommendations: string[];
    };
}, {
    diffData: {
        before?: Record<string, unknown> | undefined;
        after?: Record<string, unknown> | undefined;
        changes?: {
            type: "modified" | "added" | "removed";
            field: string;
            before?: unknown;
            after?: unknown;
        }[] | undefined;
    };
    fieldDescriptions: {
        name: string;
        description: string;
        properties: Record<string, string | number | boolean>;
    }[];
    ruleDescriptions: {
        name: string;
        description: string;
    }[];
    fieldImpacts: {
        field: string;
        impact: string;
        severity: "low" | "medium" | "high";
        description?: string | undefined;
    }[];
    ruleConflicts: {
        description: string;
        severity: "warning" | "error";
        rule: string;
        conflictWith: string;
    }[];
    riskAssessment: {
        score: number;
        level: "low" | "medium" | "high" | "critical";
        factors: string[];
        recommendations: string[];
    };
}>;
export type FieldMetadata = z.infer<typeof FieldMetadataSchema>;
export type ValidationRuleMetadata = z.infer<typeof ValidationRuleMetadataSchema>;
export type GeneratedMetadata = z.infer<typeof GeneratedMetadataSchema>;
export type PreviewMetadata = z.infer<typeof PreviewMetadataSchema>;
export interface GeneratePreviewRequest {
    ticketId: string;
    format?: PreviewFormat;
    metadata?: Record<string, any>;
}
export interface PreviewResponse {
    id: string;
    ticketId: string;
    format: PreviewFormat;
    data: PreviewData;
    generatedAt: Date;
    expiresAt: Date;
    availableFormats: PreviewFormat[];
}
export declare function sanitizeString(input: string): string;
export declare function sanitizeMetadata(metadata: unknown): GeneratedMetadata;
//# sourceMappingURL=preview.d.ts.map